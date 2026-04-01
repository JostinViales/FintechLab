import React, { useState } from 'react';
import { Brain, Loader2, RefreshCw, CheckCircle, XCircle, Lightbulb } from 'lucide-react';
import type { Trade, TradingStats, JournalSummary } from '../../../types';
import { summarizeTradeJournal } from '../../../services/gemini';

interface TradeJournalSummaryProps {
  trades: Trade[];
  stats: TradingStats;
}

export const TradeJournalSummary: React.FC<TradeJournalSummaryProps> = ({ trades, stats }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<JournalSummary | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setResult(null);
    try {
      const summary = await summarizeTradeJournal(trades, stats);
      setResult(summary);
    } catch {
      setResult({
        overview: 'Error analyzing trade journal. Please try again.',
        patterns: [],
        strengths: [],
        weaknesses: [],
        recommendations: [],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handleAnalyze}
        disabled={loading}
        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
        Analyze Journal
      </button>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
        </div>
      )}

      {result && !loading && (
        <div className="space-y-6">
          <div className="p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
            <p className="text-sm text-[var(--text-primary)]">{result.overview}</p>
          </div>

          {result.patterns.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-3">
                Behavioral Patterns
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.patterns.map((p, i) => (
                  <div key={i} className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{p.pattern}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Frequency: {p.frequency}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Impact: {p.impact}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {result.strengths.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2">
                  Strengths
                </h4>
                <div className="space-y-2">
                  {result.strengths.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-[var(--text-primary)]">{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.weaknesses.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2">
                  Weaknesses
                </h4>
                <div className="space-y-2">
                  {result.weaknesses.map((w, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <XCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-[var(--text-primary)]">{w}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {result.recommendations.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2">
                Recommendations
              </h4>
              <div className="space-y-2">
                {result.recommendations.map((r, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Lightbulb size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-[var(--text-primary)]">{r}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleAnalyze}
            className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <RefreshCw size={14} />
            Re-analyze
          </button>
        </div>
      )}

      {!result && !loading && trades.length === 0 && (
        <p className="text-sm text-[var(--text-muted)] text-center py-4">
          No trades yet. Add some trades to enable journal analysis.
        </p>
      )}
    </div>
  );
};
