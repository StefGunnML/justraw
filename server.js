const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');

// Detect if we are in production
const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0'; // Essential for DigitalOcean
const port = parseInt(process.env.PORT || '8080', 10);

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Create WebSocket server
  const wss = new WebSocketServer({ noServer: true });

  // Handle WebSocket upgrades
  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url);

    if (pathname === '/api/voice') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        console.log('[Server] WebSocket connection established at /api/voice');
        // We'll import the handler dynamically to avoid build-time issues
        try {
          // Allow use of ts-node/register in development or as a fallback
          if (dev) {
            require('ts-node/register');
          }
          
          let handleVoiceWebSocket;
          try {
            // Try compiled first
            handleVoiceWebSocket = require('./dist/lib/voice-service').handleVoiceWebSocket;
          } catch (e) {
            // Fallback to source if ts-node is available
            try {
              handleVoiceWebSocket = require('./src/lib/voice-service').handleVoiceWebSocket;
            } catch (e2) {
              console.error('[Server] Could not find voice-service in dist or src');
            }
          }
          
          if (handleVoiceWebSocket) {
            handleVoiceWebSocket(ws);
          } else {
            throw new Error('Voice handler not found');
          }
        } catch (err) {
          console.error('[Server] Failed to load voice handler:', err);
          // Fallback if not compiled yet
          ws.send(JSON.stringify({ type: 'error', message: 'Voice service not ready' }));
          ws.close();
        }
      });
    } else {
      socket.destroy();
    }
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket listening on ws://${hostname}:${port}/api/voice`);
  });
});
