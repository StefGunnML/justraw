export class VoiceWebSocket {
  private ws: any | null = null;
  private onMessageCallback: (data: any) => void;
  private onStatusCallback: (status: string) => void;

  constructor(
    onMessage: (data: any) => void,
    onStatus: (status: string) => void
  ) {
    this.onMessageCallback = onMessage;
    this.onStatusCallback = onStatus;
  }

  connect() {
    if (typeof window === 'undefined') return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    // Use window.WebSocket to be explicit and avoid any potential Node.js conflicts
    this.ws = new (window as any).WebSocket(`${protocol}//${host}/api/voice`);

    this.ws.onopen = () => {
      console.log('[WS] Connected to server');
      this.onStatusCallback('Connected');
      this.ws?.send(JSON.stringify({ type: 'start' }));
    };

    this.ws.onmessage = (event: any) => {
      try {
        const data = JSON.parse(event.data);
        this.onMessageCallback(data);
      } catch (err) {
        console.warn('[WS] Received non-JSON message');
      }
    };

    this.ws.onclose = () => {
      console.log('[WS] Disconnected');
      this.onStatusCallback('Disconnected');
      setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = (err: any) => {
      console.error('[WS] Error:', err);
      this.onStatusCallback('Error');
    };
  }

  sendAudio(audioData: Float32Array) {
    // readyState 1 is OPEN
    if (this.ws?.readyState === 1) {
      this.ws.send(audioData.buffer);
    }
  }

  disconnect() {
    this.ws?.close();
  }
}
