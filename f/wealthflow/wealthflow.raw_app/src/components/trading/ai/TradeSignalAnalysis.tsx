import React, { useState, useMemo } from 'react';
import { Brain, Loader2, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { Trade, AssetBalance, TradeSignalAnalysis as TradeSignalAnalysisType } from '../../../types';
import { analyzeTradeSignals } from '../../../services/gemini';
import { formatCurrency } from '../../../lib/format';

interface TradeSignalAnalysisProps {
  trades: Trade[];
  assetBalances: AssetBalance[];
}

const SENTIMENT_CONFIG = {
  bullish: { color: 'bg-emerald-500/15 text-emerald-500', icon: TrendingUp, label: 'Bullish' },
  bearish: { color: 'bg-red-500/15 text-red-500', icon: TrendingDown, label: 'Bearish' },
  neutral: { color: 'bg-gray-500/15 text-gray-400', icon: Minus, label: 'Neutral' },
};

const CONFIDENCE_CONFIG = {
  high: 'bg-emerald-500/15 text-emerald-500',
  medium: 'bg-amber-500/15 text-amber-500',
  low: 'bg-red-500/15 text-red-500',
};

export const TradeSignalAnalysis: React.FC<TradeSignalAnalysisProps> = ({
  trades,
  assetBalances,
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TradeSignalAnalysisType | null>(null);

  const uniqueSymbols = useMemo(() => {
    const symbols = new Set(trades.map((t) => t.symbol));
    return Array.from(symbols).sort();
  }, [trades]);

  const handleAnalyze = async () => {
    if (!selectedSymbol) return;
    setLoading(true);
    setResult(null);
    try {
      const analysis = await analyzeTradeSignals(selectedSymbol, trades, assetBalances);
      setResult(analysis);
    } catch {
      setResult({
        summary: 'Error analyzing trade signals. Please try again.',
        sentiment: 'neutral',
        keyLevels: [],
        confidence: 'low',
        reasoning: 'An unexpected error occurred.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select
          value={selectedSymbol}
          onChange={(e) => setSelectedSymbol(e.target.value)}
          className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
        >
          <option value="">Select a symbol...</option>
          {uniqueSymbols.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          onClick={handleAnalyze}
          disabled={!selectedSymbol || loading}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
          Analyze
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {(() => {
              const cfg = SENTIMENT_CONFIG[result.sentiment];
              const Icon = cfg.icon;
              return (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}
                >
                  <Icon size={12} />
                  {cfg.label}
                </span>
              );
            })()}
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${CONFIDENCE_CONFIG[result.confidence]}`}
            >
              {result.confidence.charAt(0).toUpperCase() + result.confidence.slice(1)} Confidence
            </span>
          </div>

          <p className="text-sm text-[var(--text-primary)]">{result.summary}</p>

          {result.keyLevels.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2">Key Levels</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                      <th className="pb-2 pr-4">Type</th>
                      <th className="pb-2 pr-4">Price</th>
                      <th className="pb-2">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.keyLevels.map((level, i) => (
                      <tr key={i} className="border-b border-[var(--border-subtle)]">
                        <td className="py-2 pr-4">
                          <span
                            className={`text-xs font-medium ${level.type === 'support' ? 'text-emerald-500' : 'text-red-500'}`}
                          >
                            {level.type === 'support' ? 'Support' : 'Resistance'}
                          </span>
                        </td>
                        <td className="py-2 pr-4 font-mono text-[var(--text-primary)]">
                          {formatCurrency(level.price)}
                        </td>
                        <td className="py-2 text-[var(--text-secondary)]">{level.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(result.entryZone || result.stopLoss || result.takeProfit) && (
            <div className="grid grid-cols-3 gap-3">
              {result.entryZone && (
                <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
                  <p className="text-xs text-[var(--text-muted)]">Entry Zone</p>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {formatCurrency(result.entryZone.low)} - {formatCurrency(result.entryZone.high)}
                  </p>
                </div>
              )}
              {result.stopLoss && (
                <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
                  <p className="text-xs text-[var(--text-muted)]">Stop Loss</p>
                  <p className="text-sm font-medium text-red-500">
                    {formatCurrency(result.stopLoss)}
                  </p>
                </div>
              )}
              {result.takeProfit && (
                <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
                  <p className="text-xs text-[var(--text-muted)]">Take Profit</p>
                  <p className="text-sm font-medium text-emerald-500">
                    {formatCurrency(result.takeProfit)}
                  </p>
                </div>
              )}
            </div>
          )}

          <p className="text-sm text-[var(--text-secondary)]">{result.reasoning}</p>

          <button
            onClick={handleAnalyze}
            className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <RefreshCw size={14} />
            Re-analyze
          </button>
        </div>
      )}

      {!result && !loading && uniqueSymbols.length === 0 && (
        <p className="text-sm text-[var(--text-muted)] text-center py-4">
          No trades yet. Add some trades to enable signal analysis.
        </p>
      )}
    </div>
  );
};
