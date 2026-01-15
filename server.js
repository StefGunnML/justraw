const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');
const path = require('path');

// Register ts-node for direct TypeScript loading
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2020',
    esModuleInterop: true,
  }
});

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '8080', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      const { pathname } = parsedUrl;

      if (pathname === '/api/ping') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
      }

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url);

    if (pathname === '/api/voice') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        console.log('[Server] WebSocket connection established at /api/voice');
        try {
          // Import voice service dynamically using ts-node
          const voiceService = require('./src/lib/voice-service');
          if (voiceService && typeof voiceService.handleVoiceWebSocket === 'function') {
            voiceService.handleVoiceWebSocket(ws);
          } else {
            throw new Error('handleVoiceWebSocket not found in voice-service.ts');
          }
        } catch (err) {
          console.error('[Server] Failed to load voice handler:', err);
          ws.send(JSON.stringify({ type: 'error', message: 'Voice service unavailable' }));
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
