
const WebSocket = require('ws');

// We'll point this to the running server on 8081
// Even if Gemini fails due to no key, we want to see the 'ready' event and structured error handling.

async function testProtocol() {
  console.log('--- PROTOCOL & HANDSHAKE QC ---');
  const ws = new WebSocket('ws://localhost:8081/api/voice');

  ws.on('open', () => {
    console.log('1. WS Opened. Sending START...');
    ws.send(JSON.stringify({ type: 'start' }));
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log(`2. Received: ${msg.type}`);
    
    if (msg.type === 'ready') {
      console.log('✅ PASS: Handshake successful');
      console.log('3. Sending Audio Binary...');
      ws.send(Buffer.alloc(100)); // Small dummy audio
    } else if (msg.type === 'error') {
      if (msg.message.includes('API key missing')) {
        console.log('✅ PASS: Handshake failed as expected (Key Missing), but protocol is stable.');
      } else {
        console.log(`❌ FAIL: Unexpected error: ${msg.message}`);
      }
      ws.close();
      process.exit(0);
    } else if (msg.type === 'response') {
      console.log('✅ PASS: Full cycle complete!');
      ws.close();
      process.exit(0);
    }
  });

  ws.on('error', (e) => {
    console.error('❌ FAIL: Connection Error', e.message);
    process.exit(1);
  });

  setTimeout(() => {
    console.error('❌ FAIL: Timeout');
    process.exit(1);
  }, 10000);
}

testProtocol();
