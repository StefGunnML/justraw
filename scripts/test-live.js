const WebSocket = require('ws');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const ws = new WebSocket('wss://justraw-ixih3.ondigitalocean.app/api/voice');

ws.on('open', () => {
  console.log('✅ Connected');
  ws.send(JSON.stringify({ type: 'start', scenarioId: 'paris-cafe' }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('📩', msg.type, msg.text ? `"${msg.text.substring(0,80)}..."` : JSON.stringify(msg).substring(0, 100));
  
  if (msg.type === 'ready') {
    console.log('✅ Ready, sending message...');
    setTimeout(() => {
      ws.send(JSON.stringify({ type: 'text', text: 'Hello, I want a coffee please' }));
    }, 500);
  }
  
  if (msg.type === 'response') {
    console.log('🎉 SUCCESS! Pierre responded.');
    ws.close();
    process.exit(0);
  }
  
  if (msg.type === 'error') {
    console.error('❌ Error:', msg.message);
    ws.close();
    process.exit(1);
  }
});

ws.on('error', (e) => console.error('WS Error:', e.message));
setTimeout(() => { console.error('Timeout'); process.exit(1); }, 30000);
