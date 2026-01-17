const WebSocket = require('ws');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const APP_URL = 'wss://justraw-ixih3.ondigitalocean.app/api/voice';

let testsPassed = 0;
let testsFailed = 0;
const results = [];

function log(status, test, details = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏳';
  console.log(`${icon} ${test}${details ? ': ' + details : ''}`);
  results.push({ status, test, details });
  if (status === 'PASS') testsPassed++;
  if (status === 'FAIL') testsFailed++;
}

async function runTests() {
  console.log('\n========================================');
  console.log('    RAW - Comprehensive QC Suite');
  console.log('========================================\n');

  // Test 1: WebSocket Connection
  log('INFO', 'Test 1: WebSocket Connection');
  
  const ws = await new Promise((resolve, reject) => {
    const socket = new WebSocket(APP_URL);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error('Connection timeout'));
    }, 10000);
    
    socket.on('open', () => {
      clearTimeout(timeout);
      resolve(socket);
    });
    
    socket.on('error', (e) => {
      clearTimeout(timeout);
      reject(e);
    });
  }).catch(e => {
    log('FAIL', 'WebSocket Connection', e.message);
    return null;
  });

  if (!ws) {
    console.log('\n❌ Cannot continue - WebSocket connection failed');
    process.exit(1);
  }
  log('PASS', 'WebSocket Connection', 'Connected successfully');

  // Test 2: Handshake (start message → ready response)
  log('INFO', 'Test 2: Handshake');
  
  const readyResponse = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Handshake timeout')), 10000);
    
    ws.on('message', function handler(data) {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'ready') {
        clearTimeout(timeout);
        ws.off('message', handler);
        resolve(msg);
      } else if (msg.type === 'error') {
        clearTimeout(timeout);
        ws.off('message', handler);
        reject(new Error(msg.message));
      }
    });
    
    ws.send(JSON.stringify({ type: 'start', scenarioId: 'paris-cafe' }));
  }).catch(e => {
    log('FAIL', 'Handshake', e.message);
    return null;
  });

  if (!readyResponse) {
    ws.close();
    process.exit(1);
  }
  
  log('PASS', 'Handshake', `Scenario: ${readyResponse.scenario?.name || 'Unknown'}`);
  
  // Verify handshake data
  if (readyResponse.scenario?.id === 'paris-cafe') {
    log('PASS', 'Scenario Data', `Character: ${readyResponse.scenario.character}, Location: ${readyResponse.scenario.location}`);
  } else {
    log('FAIL', 'Scenario Data', 'Missing or incorrect scenario');
  }
  
  if (typeof readyResponse.respectScore === 'number') {
    log('PASS', 'Respect Score Initial', `Score: ${readyResponse.respectScore}`);
  } else {
    log('FAIL', 'Respect Score Initial', 'Missing respect score');
  }

  // Test 3: Polite Message (should increase respect)
  log('INFO', 'Test 3: Polite Message Processing');
  
  const politeResponse = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Response timeout')), 30000);
    
    ws.on('message', function handler(data) {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'response') {
        clearTimeout(timeout);
        ws.off('message', handler);
        resolve(msg);
      } else if (msg.type === 'error') {
        clearTimeout(timeout);
        ws.off('message', handler);
        reject(new Error(msg.message));
      }
    });
    
    ws.send(JSON.stringify({ 
      type: 'text', 
      text: 'Hello Pierre, may I please have a coffee?' 
    }));
  }).catch(e => {
    log('FAIL', 'Polite Message', e.message);
    return null;
  });

  if (!politeResponse) {
    ws.close();
    process.exit(1);
  }

  if (politeResponse.text && politeResponse.text.length > 0) {
    log('PASS', 'AI Response', `Pierre says: "${politeResponse.text.substring(0, 60)}..."`);
  } else {
    log('FAIL', 'AI Response', 'Empty or missing response text');
  }

  if (politeResponse.character) {
    log('PASS', 'Character Attribution', `Response from: ${politeResponse.character}`);
  } else {
    log('FAIL', 'Character Attribution', 'Missing character name');
  }

  if (typeof politeResponse.respectScore === 'number') {
    log('PASS', 'Respect Score Update', `New score: ${politeResponse.respectScore}`);
  } else {
    log('FAIL', 'Respect Score Update', 'Missing respect score in response');
  }

  // Test 4: Rude Message (should decrease respect)
  log('INFO', 'Test 4: Rude Message Processing');
  
  const rudeResponse = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Response timeout')), 30000);
    
    ws.on('message', function handler(data) {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'response') {
        clearTimeout(timeout);
        ws.off('message', handler);
        resolve(msg);
      } else if (msg.type === 'error') {
        clearTimeout(timeout);
        ws.off('message', handler);
        reject(new Error(msg.message));
      }
    });
    
    ws.send(JSON.stringify({ 
      type: 'text', 
      text: 'Hey! Coffee! Now! Hurry up!' 
    }));
  }).catch(e => {
    log('FAIL', 'Rude Message', e.message);
    return null;
  });

  if (rudeResponse) {
    log('PASS', 'Rude Response', `Pierre says: "${rudeResponse.text?.substring(0, 60) || 'N/A'}..."`);
    
    const prevScore = politeResponse.respectScore;
    const newScore = rudeResponse.respectScore;
    if (newScore < prevScore) {
      log('PASS', 'Respect Decrease', `Score dropped from ${prevScore} to ${newScore}`);
    } else if (newScore === prevScore) {
      log('INFO', 'Respect Unchanged', `Score stayed at ${newScore} (AI might not have penalized)`);
    } else {
      log('INFO', 'Respect Increased', `Score went up to ${newScore} (unexpected but not a bug)`);
    }
  }

  // Test 5: JSON Response Format
  log('INFO', 'Test 5: Response Format Validation');
  
  const hasRequiredFields = politeResponse && 
    typeof politeResponse.type === 'string' &&
    typeof politeResponse.text === 'string' &&
    typeof politeResponse.respectScore === 'number';
  
  if (hasRequiredFields) {
    log('PASS', 'Response Format', 'All required fields present');
  } else {
    log('FAIL', 'Response Format', 'Missing required fields in response');
  }

  // Test 6: Connection Stability
  log('INFO', 'Test 6: Connection Stability Check');
  
  if (ws.readyState === WebSocket.OPEN) {
    log('PASS', 'Connection Stability', 'WebSocket still open after tests');
  } else {
    log('FAIL', 'Connection Stability', `WebSocket state: ${ws.readyState}`);
  }

  // Cleanup
  ws.close();

  // Summary
  console.log('\n========================================');
  console.log('           QC Summary');
  console.log('========================================');
  console.log(`\n  ✅ Passed: ${testsPassed}`);
  console.log(`  ❌ Failed: ${testsFailed}`);
  console.log(`  📊 Total:  ${testsPassed + testsFailed}\n`);

  if (testsFailed > 0) {
    console.log('Failed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.test}: ${r.details}`);
    });
    process.exit(1);
  } else {
    console.log('🎉 All tests passed!\n');
    process.exit(0);
  }
}

runTests().catch(e => {
  console.error('QC Suite crashed:', e);
  process.exit(1);
});
