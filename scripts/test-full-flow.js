const WebSocket = require('ws');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const ws = new WebSocket('wss://justraw-ixih3.ondigitalocean.app/api/voice');

ws.on('open', () => {
  console.log('✅ Connected');
  ws.send(JSON.stringify({ type: 'start', scenarioId: 'paris-cafe' }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('📩 Received:', msg.type);
  
  if (msg.type === 'ready') {
    console.log('✅ Ready! Sending test message...');
    ws.send(JSON.stringify({ type: 'text', text: 'Hello Pierre, I would like a coffee please.' }));
  }
  
  if (msg.type === 'response') {
    console.log('🎉 Pierre says:', msg.text);
    console.log('   Respect score:', msg.respectScore);
    ws.close();
    process.exit(0);
  }
  
  if (msg.type === 'error') {
    console.error('❌ Error:', msg.message);
    ws.close();
    process.exit(1);
  }
});

ws.on('error', (e) => {
  console.error('❌ WS Error:', e.message);
  process.exit(1);
});

setTimeout(() => {
  console.error('⏱️ Timeout');
  process.exit(1);
}, 30000);
