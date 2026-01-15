const WebSocket = require('ws');

const url = 'wss://justraw-ixih3.ondigitalocean.app/api/voice';
const ws = new WebSocket(url);

ws.on('open', () => {
  console.log('--- WebSocket Opened ---');
  ws.send(JSON.stringify({ type: 'start', scenarioId: 'paris-cafe' }));
});

let handshakeDone = false;

ws.on('message', (data) => {
  console.log('--- Message Received ---');
  const dataStr = data.toString();
  console.log(dataStr.substring(0, 200) + (dataStr.length > 200 ? '...' : ''));
  
  try {
    const msg = JSON.parse(dataStr);
    if (msg.type === 'ready') {
      console.log('QC Handshake: SUCCESS');
      handshakeDone = true;
      
      // Now send dummy audio data (16kHz PCM mono is expected)
      // Sending a small buffer of silence
      console.log('Sending dummy audio buffer...');
      const dummyAudio = Buffer.alloc(16000 * 2); // 1 second of 16-bit silence
      ws.send(dummyAudio);
    }
    if (msg.type === 'response') {
      console.log('QC Audio Response: SUCCESS');
      console.log('Pierre said:', msg.text);
      ws.close();
      process.exit(0);
    }
    if (msg.type === 'error') {
      console.error('QC FAILED: Received error from server:', msg.message);
      ws.close();
      process.exit(1);
    }
  } catch (e) {
    console.error('Failed to parse message:', e.message);
  }
});

ws.on('error', (err) => {
  console.error('QC FAILED: WebSocket Error:', err.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('--- WebSocket Closed ---');
});

// Timeout after 30 seconds (Gemini + FLUX can be slow)
setTimeout(() => {
  console.error('QC FAILED: WebSocket Test timed out');
  process.exit(1);
}, 30000);
