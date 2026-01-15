const WebSocket = require('ws');

const url = 'wss://justraw-ixih3.ondigitalocean.app/api/voice';
const ws = new WebSocket(url);

ws.on('open', () => {
  console.log('--- WebSocket Opened ---');
  ws.send(JSON.stringify({ type: 'start', scenarioId: 'paris-cafe' }));
});

ws.on('message', (data) => {
  console.log('--- Message Received ---');
  console.log(data.toString());
  
  const msg = JSON.parse(data.toString());
  if (msg.type === 'ready') {
    console.log('QC PASSED: WebSocket ready and scenario loaded.');
    ws.close();
    process.exit(0);
  }
  if (msg.type === 'error') {
    console.error('QC FAILED: Received error from server:', msg.message);
    ws.close();
    process.exit(1);
  }
});

ws.on('error', (err) => {
  console.error('QC FAILED: WebSocket Error:', err.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('--- WebSocket Closed ---');
});

// Timeout after 15 seconds
setTimeout(() => {
  console.error('QC FAILED: WebSocket Test timed out');
  process.exit(1);
}, 15000);
