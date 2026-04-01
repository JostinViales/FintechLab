import React, { useState, useMemo } from 'react';
import { Brain, Loader2, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import type { AssetBalance, RebalancingSuggestion } from '../../../types';
import { suggestRebalancing } from '../../../services/gemini';
import { formatCurrency } from '../../../lib/format';

interface RebalancingSuggestionsProps {
  assetBalances: AssetBalance[];
}

const COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#3b82f6',
  '#8b5cf6',
  '#14b8a6',
  '#ef4444',
];

const ACTION_BADGE: Record<string, string> = {
  buy: 'bg-emerald-500/15 text-emerald-500',
  sell: 'bg-red-500/15 text-red-500',
  hold: 'bg-gray-500/15 text-gray-400',
};

export const RebalancingSuggestions: React.FC<RebalancingSuggestionsProps> = ({ assetBalances }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RebalancingSuggestion[] | null>(null);

  const totalCost = useMemo(
    () => assetBalances.reduce((s, a) => s + a.totalCost, 0),
    [assetBalances],
  );

  const currentData = useMemo(
    () =>
      assetBalances
        .filter((b) => b.totalCost > 0)
        .map((b) => ({
          name: b.asset,
          value: Number(((b.totalCost / (totalCost || 1)) * 100).toFixed(1)),
        })),
    [assetBalances, totalCost],
  );

  const suggestedData = useMemo(() => {
    if (!result) return [];
    return result
      .filter((s) => s.targetPct > 0)
      .map((s) => ({ name: s.asset, value: s.targetPct }));
  }, [result]);

  const handleAnalyze = async () => {
    setLoading(true);
    setResult(null);
    try {
      const suggestions = await suggestRebalancing(assetBalances, totalCost);
      setResult(suggestions);
    } catch {
      setResult([]);
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
        Analyze Allocation
      </button>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
        </div>
      )}

      {result && !loading && (
        <div className="space-y-6">
          {currentData.length > 0 && suggestedData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2 text-center">
                  Current Allocation
                </h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={currentData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {currentData.map((_entry, index) => (
                          <Cell key={`cur-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: 'none',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                        }}
                        formatter={(value) => [`${value}%`, 'Allocation']}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2 text-center">
                  Suggested Allocation
                </h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={suggestedData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {suggestedData.map((_entry, index) => (
                          <Cell key={`sug-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: 'none',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                        }}
                        formatter={(value) => [`${value}%`, 'Target']}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {result.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                    <th className="pb-2 pr-4">Asset</th>
                    <th className="pb-2 pr-4">Current %</th>
                    <th className="pb-2 pr-4">Target %</th>
                    <th className="pb-2 pr-4">Action</th>
                    <th className="pb-2 pr-4">Amount</th>
                    <th className="pb-2">Reasoning</th>
                  </tr>
                </thead>
                <tbody>
                  {result.map((s, i) => (
                    <tr key={i} className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 pr-4 font-medium text-[var(--text-primary)]">
                        {s.asset}
                      </td>
                      <td className="py-2 pr-4 text-[var(--text-secondary)]">
                        {s.currentPct.toFixed(1)}%
                      </td>
                      <td className="py-2 pr-4 text-[var(--text-secondary)]">
                        {s.targetPct.toFixed(1)}%
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ACTION_BADGE[s.action]}`}
                        >
                          {s.action.charAt(0).toUpperCase() + s.action.slice(1)}
                        </span>
                      </td>
                      <td className="py-2 pr-4 font-mono text-[var(--text-primary)]">
                        {formatCurrency(s.amount)}
                      </td>
                      <td className="py-2 text-xs text-[var(--text-secondary)] max-w-xs">
                        {s.reasoning}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.length === 0 && (
            <p className="text-sm text-[var(--text-muted)] text-center py-4">
              No rebalancing suggestions available.
            </p>
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

      {!result && !loading && assetBalances.length === 0 && (
        <p className="text-sm text-[var(--text-muted)] text-center py-4">
          No holdings yet. Add some trades to enable rebalancing analysis.
        </p>
      )}
    </div>
  );
};
