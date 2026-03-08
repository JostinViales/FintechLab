import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { Trade, StrategyTag, TradeSide } from '@/types';

interface TradeFormProps {
  strategyTags: StrategyTag[];
  initialData?: Trade | null;
  onClose: () => void;
  onSubmit: (data: Omit<Trade, 'id' | 'createdAt' | 'total'>) => void;
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export const TradeForm: React.FC<TradeFormProps> = ({
  strategyTags,
  initialData,
  onClose,
  onSubmit,
}) => {
  const [side, setSide] = useState<TradeSide>(initialData?.side ?? 'buy');
  const [symbol, setSymbol] = useState(initialData?.symbol ?? '');
  const [price, setPrice] = useState(initialData?.price.toString() ?? '');
  const [quantity, setQuantity] = useState(initialData?.quantity.toString() ?? '');
  const [fee, setFee] = useState(initialData?.fee.toString() ?? '0');
  const [feeCurrency, setFeeCurrency] = useState(initialData?.feeCurrency ?? 'USDT');
  const [realizedPnl, setRealizedPnl] = useState(
    initialData?.realizedPnl != null ? initialData.realizedPnl.toString() : '',
  );
  const [strategyTag, setStrategyTag] = useState(initialData?.strategyTag ?? '');
  const [tradedAt, setTradedAt] = useState(
    initialData ? toDatetimeLocal(initialData.tradedAt) : toDatetimeLocal(new Date().toISOString()),
  );
  const [notes, setNotes] = useState(initialData?.notes ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !price || !quantity) return;

    onSubmit({
      symbol: symbol.toUpperCase(),
      side,
      price: parseFloat(price),
      quantity: parseFloat(quantity),
      fee: parseFloat(fee) || 0,
      feeCurrency,
      realizedPnl: realizedPnl ? parseFloat(realizedPnl) : undefined,
      strategyTag: strategyTag || undefined,
      notes: notes || undefined,
      source: initialData?.source ?? 'manual',
      okxTradeId: initialData?.okxTradeId,
      okxOrderId: initialData?.okxOrderId,
      tradedAt: new Date(tradedAt).toISOString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-[var(--bg-secondary)] p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X size={24} />
        </button>

        <h2 className="mb-6 text-2xl font-bold text-[var(--text-primary)]">
          {initialData ? 'Edit Trade' : 'New Trade'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Side Toggle */}
          <div className="flex rounded-lg bg-[var(--bg-tertiary)] p-1">
            <button
              type="button"
              onClick={() => setSide('buy')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                side === 'buy'
                  ? 'bg-emerald-500/20 text-emerald-400 shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              BUY
            </button>
            <button
              type="button"
              onClick={() => setSide('sell')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                side === 'sell'
                  ? 'bg-red-500/20 text-red-400 shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              SELL
            </button>
          </div>

          {/* Symbol */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
              Symbol
            </label>
            <input
              type="text"
              required
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
              placeholder="BTC-USDT"
            />
          </div>

          {/* Price & Quantity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Price
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] pl-8 pr-4 py-2 text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Quantity
              </label>
              <input
                type="number"
                step="0.000001"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                placeholder="0.000000"
              />
            </div>
          </div>

          {/* Fee & Fee Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Fee
              </label>
              <input
                type="number"
                step="0.01"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                Fee Currency
              </label>
              <input
                type="text"
                value={feeCurrency}
                onChange={(e) => setFeeCurrency(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                placeholder="USDT"
              />
            </div>
          </div>

          {/* Realized P&L — hidden for buys, optional override for sells */}
          {side === 'sell' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
                P&L Override{' '}
                <span className="text-[var(--text-muted)] font-normal">
                  (leave blank for auto-calculation)
                </span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={realizedPnl}
                  onChange={(e) => setRealizedPnl(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] pl-8 pr-4 py-2 text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                  placeholder="Auto (FIFO)"
                />
              </div>
            </div>
          )}

          {/* Strategy Tag */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
              Strategy
            </label>
            <select
              value={strategyTag}
              onChange={(e) => setStrategyTag(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
            >
              <option value="">No Strategy</option>
              {strategyTags.map((tag) => (
                <option key={tag.id} value={tag.name}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date/Time */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
              Trade Date & Time
            </label>
            <input
              type="datetime-local"
              required
              value={tradedAt}
              onChange={(e) => setTradedAt(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">
              Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2 text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)] resize-none"
              placeholder="Trade notes..."
            />
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white shadow-md transition-colors hover:bg-indigo-700"
          >
            {initialData ? 'Save Changes' : 'Add Trade'}
          </button>
        </form>
      </div>
    </div>
  );
};
