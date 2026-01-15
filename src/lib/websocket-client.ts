export class VoiceWebSocket {
  private ws: WebSocket | null = null;
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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.ws = new WebSocket(`${protocol}//${host}/api/voice`);

    this.ws.onopen = () => {
      console.log('[WS] Connected to server');
      this.onStatusCallback('Connected');
      this.ws?.send(JSON.stringify({ type: 'start' }));
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.onMessageCallback(data);
      } catch (err) {
        // If not JSON, it might be raw audio binary (not expected in this simplified version yet)
        console.warn('[WS] Received non-JSON message');
      }
    };

    this.ws.onclose = () => {
      console.log('[WS] Disconnected');
      this.onStatusCallback('Disconnected');
      // Attempt reconnect after 3 seconds
      setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = (err) => {
      console.error('[WS] Error:', err);
      this.onStatusCallback('Error');
    };
  }

  sendAudio(audioData: Float32Array) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Convert Float32Array to Int16 for efficiency if needed, or send as is
      // For simplicity with Gemini Multimodal Live, we'll send as Buffer
      this.ws.send(audioData.buffer);
    }
  }

  disconnect() {
    this.ws?.close();
  }
}
