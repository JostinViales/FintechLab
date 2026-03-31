import React, { useState, useMemo } from 'react';
import { Calculator, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatCurrency, formatCrypto } from '@/lib/format';

export const PositionSizingCalc: React.FC = () => {
  const [accountBalance, setAccountBalance] = useState(10000);
  const [riskPct, setRiskPct] = useState(2);
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLossPrice, setStopLossPrice] = useState('');
  const [takeProfitPrice, setTakeProfitPrice] = useState('');

  const result = useMemo(() => {
    const entry = parseFloat(entryPrice);
    const stopLoss = parseFloat(stopLossPrice);
    const takeProfit = takeProfitPrice ? parseFloat(takeProfitPrice) : null;

    if (!entry || !stopLoss || entry <= 0 || stopLoss <= 0) return null;

    const riskAmount = accountBalance * (riskPct / 100);
    const priceDiff = Math.abs(entry - stopLoss);
    if (priceDiff === 0) return null;

    const quantity = riskAmount / priceDiff;
    const positionValue = quantity * entry;
    const riskRewardRatio = takeProfit ? Math.abs(takeProfit - entry) / priceDiff : 0;
    const positionPct = (positionValue / accountBalance) * 100;

    return { quantity, riskAmount, positionValue, riskRewardRatio, positionPct };
  }, [accountBalance, riskPct, entryPrice, stopLossPrice, takeProfitPrice]);

  const inputClass =
    'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]';

  return (
    <Card
      title="Position Sizing Calculator"
      action={<Calculator size={16} className="text-[var(--text-muted)]" />}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-[var(--text-secondary)]">
            Account Balance ($)
          </label>
          <input
            type="number"
            value={accountBalance}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v > 0) setAccountBalance(v);
            }}
            className={inputClass}
            placeholder="10000"
            min="100"
            step="100"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-[var(--text-secondary)]">
            Risk per Trade: {riskPct}%
          </label>
          <input
            type="range"
            min={0.5}
            max={10}
            step={0.5}
            value={riskPct}
            onChange={(e) => setRiskPct(parseFloat(e.target.value))}
            className="w-full accent-[var(--accent-primary)]"
          />
          <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
            <span>Conservative (0.5-2%)</span>
            <span>Moderate (3-5%)</span>
            <span>Aggressive (6-10%)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              Entry Price ($)
            </label>
            <input
              type="number"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              className={inputClass}
              placeholder="100"
              step="0.01"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">Stop Loss ($)</label>
            <input
              type="number"
              value={stopLossPrice}
              onChange={(e) => setStopLossPrice(e.target.value)}
              className={inputClass}
              placeholder="95"
              step="0.01"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">
              Take Profit ($)
            </label>
            <input
              type="number"
              value={takeProfitPrice}
              onChange={(e) => setTakeProfitPrice(e.target.value)}
              className={inputClass}
              placeholder="110 (optional)"
              step="0.01"
            />
          </div>
        </div>

        {result && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
              <p className="text-xs text-[var(--text-muted)]">Position Size</p>
              <p className="text-lg font-bold text-[var(--text-primary)]">
                {formatCrypto(result.quantity)} units
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
              <p className="text-xs text-[var(--text-muted)]">Risk Amount</p>
              <p className="text-lg font-bold text-red-500">
                {formatCurrency(result.riskAmount)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
              <p className="text-xs text-[var(--text-muted)]">Position Value</p>
              <p className="text-lg font-bold text-[var(--text-primary)]">
                {formatCurrency(result.positionValue)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
              <p className="text-xs text-[var(--text-muted)]">Risk/Reward</p>
              <p
                className={`text-lg font-bold ${
                  result.riskRewardRatio >= 2
                    ? 'text-emerald-500'
                    : result.riskRewardRatio >= 1
                      ? 'text-amber-500'
                      : 'text-red-500'
                }`}
              >
                {result.riskRewardRatio > 0 ? `1:${result.riskRewardRatio.toFixed(2)}` : 'N/A'}
              </p>
            </div>
          </div>
        )}

        {result && result.positionPct > 25 && (
          <div className="flex items-center gap-2 text-amber-500 text-sm">
            <AlertTriangle size={16} />
            Position exceeds 25% of account ({result.positionPct.toFixed(1)}%)
          </div>
        )}
        {result && result.riskRewardRatio > 0 && result.riskRewardRatio < 1 && (
          <div className="flex items-center gap-2 text-amber-500 text-sm">
            <AlertTriangle size={16} />
            Risk/reward below 1:1
          </div>
        )}
      </div>
    </Card>
  );
};
