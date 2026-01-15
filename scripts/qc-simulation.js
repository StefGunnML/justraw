
const WebSocket = require('ws');
const fs = require('fs');

async function runQC() {
  console.log('--- RAW SOCIAL FRICTION ENGINE: FULL QC SIMULATION ---');
  
  const url = 'ws://localhost:8081/api/voice';
  console.log(`1. Connecting to ${url}...`);
  
  const ws = new WebSocket(url);
  
  let handshakeResolved = false;
  let responseResolved = false;

  const timeout = setTimeout(() => {
    console.error('❌ QC FAILED: Timeout waiting for response');
    process.exit(1);
  }, 30000);

  ws.on('open', () => {
    console.log('✅ Connection established');
    console.log('2. Sending START handshake...');
    ws.send(JSON.stringify({ type: 'start', scenarioId: 'paris-cafe' }));
  });

  ws.on('message', async (data) => {
    const msg = JSON.parse(data.toString());
    console.log(`[INCOMING] Type: ${msg.type}`);

    if (msg.type === 'ready') {
      console.log('✅ Handshake successful');
      console.log(`   Scenario: ${msg.scenario.name}`);
      console.log(`   Character: ${msg.scenario.character}`);
      console.log(`   Initial Image: ${msg.imageUrl ? 'YES' : 'NO'}`);
      
      if (!msg.imageUrl && process.env.BFL_API_KEY) {
        console.warn('⚠️ Warning: BFL_API_KEY set but no imageUrl returned');
      }
      
      handshakeResolved = true;
      
      console.log('3. Sending MOCK AUDIO (simulating user speech)...');
      // Create a dummy buffer to simulate PCM audio
      const dummyAudio = Buffer.alloc(16000); 
      ws.send(dummyAudio);
    }

    if (msg.type === 'response') {
      console.log('✅ Response received from character');
      console.log(`   Text: "${msg.text}"`);
      console.log(`   Character: ${msg.character}`);
      console.log(`   Respect Score: ${msg.respectScore}%`);
      console.log(`   Reactive Image: ${msg.imageUrl ? 'YES' : 'NO'}`);
      
      responseResolved = true;
      
      console.log('\n--- QC RESULTS ---');
      console.log('Handshake: SUCCESS');
      console.log('Gemini Integration: SUCCESS');
      console.log('Protocol Integrity: SUCCESS');
      console.log('------------------');
      
      clearTimeout(timeout);
      ws.close();
      process.exit(0);
    }

    if (msg.type === 'error') {
      console.error('❌ SERVER ERROR:', msg.message);
      process.exit(1);
    }
  });

  ws.on('error', (err) => {
    console.error('❌ WS CONNECTION ERROR:', err.message);
    process.exit(1);
  });

  ws.on('close', () => {
    if (!responseResolved) {
      console.error('❌ Connection closed before QC completed');
      process.exit(1);
    }
  });
}

runQC();
