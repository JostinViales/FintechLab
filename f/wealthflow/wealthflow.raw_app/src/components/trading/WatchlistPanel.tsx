import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Wifi, WifiOff } from 'lucide-react';
import type { WatchlistItem } from '../../types/trading';
import type { OkxTicker } from '../../types/okx';
import { okxWebSocket } from '../../services/okx/websocket';
import { formatCurrency, formatPnlPct } from '../../lib/format';
import { Card } from '../ui/Card';

interface WatchlistPanelProps {
  watchlist: WatchlistItem[];
  onAdd: (symbol: string) => void;
  onRemove: (id: string) => void;
}

const COMMON_PAIRS = [
  'BTC-USDT',
  'ETH-USDT',
  'SOL-USDT',
  'XRP-USDT',
  'DOGE-USDT',
  'ADA-USDT',
  'AVAX-USDT',
  'DOT-USDT',
  'LINK-USDT',
  'MATIC-USDT',
  'UNI-USDT',
  'ATOM-USDT',
  'LTC-USDT',
  'NEAR-USDT',
  'ARB-USDT',
  'OP-USDT',
];

interface LiveData {
  price: number;
  change24h: number;
  change24hPct: number;
}

export const WatchlistPanel: React.FC<WatchlistPanelProps> = ({ watchlist, onAdd, onRemove }) => {
  const [livePrices, setLivePrices] = useState<Map<string, LiveData>>(new Map());
  const [flashingSymbols, setFlashingSymbols] = useState<Map<string, 'up' | 'down'>>(new Map());
  const [newSymbol, setNewSymbol] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [connected, setConnected] = useState(false);
  const prevPrices = useRef<Map<string, number>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);

  // Track connection status
  useEffect(() => {
    const interval = setInterval(() => {
      setConnected(okxWebSocket.isConnected);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to watchlist tickers
  useEffect(() => {
    if (watchlist.length === 0) return;

    okxWebSocket.connect();

    const handleTicker = (symbol: string) => (ticker: OkxTicker) => {
      const price = Number(ticker.last);
      const open = Number(ticker.open24h);
      const change24h = price - open;
      const change24hPct = open > 0 ? (change24h / open) * 100 : 0;

      // Determine flash direction
      const prev = prevPrices.current.get(symbol);
      if (prev !== undefined && prev !== price) {
        const dir = price > prev ? 'up' : 'down';
        setFlashingSymbols((f) => {
          const next = new Map(f);
          next.set(symbol, dir);
          return next;
        });
        setTimeout(() => {
          setFlashingSymbols((f) => {
            const next = new Map(f);
            next.delete(symbol);
            return next;
          });
        }, 300);
      }
      prevPrices.current.set(symbol, price);

      setLivePrices((prev) => {
        const next = new Map(prev);
        next.set(symbol, { price, change24h, change24hPct });
        return next;
      });
    };

    const handlers = new Map<string, (ticker: OkxTicker) => void>();
    watchlist.forEach((item) => {
      const handler = handleTicker(item.symbol);
      handlers.set(item.symbol, handler);
      okxWebSocket.subscribeTicker(item.symbol, handler);
    });

    return () => {
      handlers.forEach((_handler, symbol) => {
        okxWebSocket.unsubscribeTicker(symbol);
      });
    };
  }, [watchlist]);

  const filteredSuggestions = COMMON_PAIRS.filter(
    (pair) =>
      pair.toLowerCase().includes(newSymbol.toLowerCase()) &&
      !watchlist.some((w) => w.symbol === pair),
  );

  const handleAdd = (symbol: string) => {
    const upper = symbol.toUpperCase();
    if (!upper || watchlist.some((w) => w.symbol === upper)) return;
    onAdd(upper);
    setNewSymbol('');
    setShowSuggestions(false);
  };

  return (
    <Card
      title="Watchlist"
      action={
        <div className="flex items-center gap-2">
          {connected ? (
            <Wifi size={14} className="text-emerald-500" />
          ) : (
            <WifiOff size={14} className="text-red-500" />
          )}
          <span className={`text-xs ${connected ? 'text-emerald-500' : 'text-red-500'}`}>
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>
      }
    >
      {/* Add Symbol Input */}
      <div className="relative mb-4">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newSymbol}
            onChange={(e) => {
              setNewSymbol(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd(newSymbol);
            }}
            placeholder="Add pair (e.g. BTC-USDT)"
            className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
          />
          <button
            onClick={() => handleAdd(newSymbol)}
            disabled={!newSymbol.trim()}
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && newSymbol && filteredSuggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-lg max-h-40 overflow-y-auto">
            {filteredSuggestions.slice(0, 8).map((pair) => (
              <button
                key={pair}
                onMouseDown={() => handleAdd(pair)}
                className="w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                {pair}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Watchlist Items */}
      {watchlist.length === 0 ? (
        <div className="py-8 text-center text-[var(--text-muted)] text-sm">
          Add trading pairs to your watchlist to track live prices.
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-subtle)]">
          {watchlist.map((item) => {
            const data = livePrices.get(item.symbol);
            const flash = flashingSymbols.get(item.symbol);

            return (
              <div
                key={item.id}
                className={`flex items-center justify-between py-3 px-1 transition-colors duration-200 ${
                  flash === 'up'
                    ? 'bg-emerald-500/10'
                    : flash === 'down'
                      ? 'bg-red-500/10'
                      : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-[var(--text-primary)]">
                    {item.symbol}
                  </div>
                  {data && (
                    <div
                      className={`text-xs ${data.change24h >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
                    >
                      {data.change24h >= 0 ? '+' : ''}
                      {formatCurrency(data.change24h)} ({formatPnlPct(data.change24hPct)})
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {data ? (
                    <span className="text-sm font-mono font-medium text-[var(--text-primary)]">
                      {formatCurrency(data.price)}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">--</span>
                  )}
                  <button
                    onClick={() => onRemove(item.id)}
                    className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-red-500 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
