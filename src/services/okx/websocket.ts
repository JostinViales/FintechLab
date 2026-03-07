import type { OkxTicker, OkxWsMessage } from '@/types/okx';

type TickerCallback = (ticker: OkxTicker) => void;

const OKX_WS_LIVE_URL = 'wss://ws.okx.com:8443/ws/v5/public';
const OKX_WS_DEMO_URL = 'wss://wspap.okx.com:8443/ws/v5/public';
const PING_INTERVAL_MS = 25_000;
const MAX_RECONNECT_ATTEMPTS = 10;
const MAX_RECONNECT_DELAY_MS = 30_000;

export class OkxWebSocketService {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Set<TickerCallback>> = new Map();
  private reconnectAttempts = 0;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private pingIntervalId: ReturnType<typeof setInterval> | null = null;
  private isManualDisconnect = false;
  private demo = false;

  setDemoMode(enabled: boolean): void {
    const changed = this.demo !== enabled;
    this.demo = enabled;
    // Reconnect to the correct endpoint if already connected
    if (changed && this.ws?.readyState === WebSocket.OPEN) {
      this.disconnect();
      this.connect();
    }
  }

  get isDemoMode(): boolean {
    return this.demo;
  }

  private get wsUrl(): string {
    return this.demo ? OKX_WS_DEMO_URL : OKX_WS_LIVE_URL;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get subscribedSymbols(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.isManualDisconnect = false;

    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.startPing();
      this.resubscribeAll();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event);
    };

    this.ws.onclose = () => {
      this.stopPing();
      if (!this.isManualDisconnect) {
        this.reconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('OKX WebSocket error:', error);
    };
  }

  disconnect(): void {
    this.isManualDisconnect = true;
    this.stopPing();

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.subscriptions.clear();
    this.reconnectAttempts = 0;
  }

  subscribeTicker(instId: string, callback: TickerCallback): void {
    if (!this.subscriptions.has(instId)) {
      this.subscriptions.set(instId, new Set());
    }
    this.subscriptions.get(instId)!.add(callback);

    if (this.isConnected) {
      this.sendSubscribe([instId]);
    }
  }

  unsubscribeTicker(instId: string): void {
    this.subscriptions.delete(instId);

    if (this.isConnected) {
      this.sendUnsubscribe([instId]);
    }
  }

  private handleMessage(event: MessageEvent): void {
    const raw = event.data as string;

    // Handle pong responses
    if (raw === 'pong') return;

    let message: OkxWsMessage;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }

    // Ignore subscription confirmations (they have "event" field)
    if ('event' in message) return;

    // Route ticker data to callbacks
    if (message.arg?.channel === 'tickers' && message.data?.length > 0) {
      const instId = message.arg.instId;
      const callbacks = this.subscriptions.get(instId);
      if (callbacks) {
        for (const ticker of message.data) {
          callbacks.forEach((cb) => cb(ticker));
        }
      }
    }
  }

  private reconnect(): void {
    if (this.isManualDisconnect || this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), MAX_RECONNECT_DELAY_MS);
    this.reconnectAttempts++;

    this.reconnectTimeoutId = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startPing(): void {
    this.stopPing();
    this.pingIntervalId = setInterval(() => {
      if (this.isConnected) {
        this.ws!.send('ping');
      }
    }, PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  private resubscribeAll(): void {
    const instIds = Array.from(this.subscriptions.keys());
    if (instIds.length > 0) {
      this.sendSubscribe(instIds);
    }
  }

  private sendSubscribe(instIds: string[]): void {
    if (!this.isConnected) return;

    const msg = {
      op: 'subscribe',
      args: instIds.map((instId) => ({ channel: 'tickers', instId })),
    };
    this.ws!.send(JSON.stringify(msg));
  }

  private sendUnsubscribe(instIds: string[]): void {
    if (!this.isConnected) return;

    const msg = {
      op: 'unsubscribe',
      args: instIds.map((instId) => ({ channel: 'tickers', instId })),
    };
    this.ws!.send(JSON.stringify(msg));
  }
}

export const okxWebSocket = new OkxWebSocketService();
