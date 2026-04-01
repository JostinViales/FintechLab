import React, { useState } from 'react';
import { Shield, Loader2, RefreshCw, CheckCircle } from 'lucide-react';
import type {
  AssetBalance,
  Trade,
  TradingStats,
  RiskAssessment as RiskAssessmentType,
} from '../../../types';
import { assessPortfolioRisk } from '../../../services/gemini';

interface RiskAssessmentProps {
  assetBalances: AssetBalance[];
  trades: Trade[];
  stats: TradingStats;
}

const RISK_COLORS: Record<string, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

const RISK_BADGE: Record<string, string> = {
  low: 'bg-emerald-500/15 text-emerald-500',
  medium: 'bg-amber-500/15 text-amber-500',
  high: 'bg-orange-500/15 text-orange-500',
  critical: 'bg-red-500/15 text-red-500',
};

const SEVERITY_BADGE: Record<string, string> = {
  low: 'bg-emerald-500/15 text-emerald-500',
  medium: 'bg-amber-500/15 text-amber-500',
  high: 'bg-red-500/15 text-red-500',
};

export const RiskAssessment: React.FC<RiskAssessmentProps> = ({
  assetBalances,
  trades,
  stats,
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RiskAssessmentType | null>(null);

  const handleAssess = async () => {
    setLoading(true);
    setResult(null);
    try {
      const assessment = await assessPortfolioRisk(assetBalances, trades, stats);
      setResult(assessment);
    } catch {
      setResult({
        overallRisk: 'medium',
        score: 50,
        factors: [],
        suggestions: ['Error assessing risk. Please try again.'],
      });
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = result
    ? result.score <= 25
      ? RISK_COLORS.low
      : result.score <= 50
        ? RISK_COLORS.medium
        : result.score <= 75
          ? RISK_COLORS.high
          : RISK_COLORS.critical
    : RISK_COLORS.medium;

  return (
    <div className="space-y-4">
      <button
        onClick={handleAssess}
        disabled={loading}
        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
        Assess Risk
      </button>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
        </div>
      )}

      {result && !loading && (
        <div className="space-y-5">
          <div className="flex items-center gap-6">
            <svg viewBox="0 0 100 100" className="w-24 h-24">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="var(--border-subtle)"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke={scoreColor}
                strokeWidth="8"
                strokeDasharray={`${result.score * 2.83} 283`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
              <text
                x="50"
                y="55"
                textAnchor="middle"
                fill="currentColor"
                className="text-lg font-bold"
                style={{ fontSize: '20px' }}
              >
                {result.score}
              </text>
            </svg>
            <div>
              <span
                className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${RISK_BADGE[result.overallRisk]}`}
              >
                {result.overallRisk.charAt(0).toUpperCase() + result.overallRisk.slice(1)} Risk
              </span>
              <p className="text-xs text-[var(--text-muted)] mt-1">Risk Score (0-100)</p>
            </div>
          </div>

          {result.factors.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2">
                Risk Factors
              </h4>
              <div className="space-y-2">
                {result.factors.map((factor, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-[var(--bg-tertiary)] flex items-start gap-3"
                  >
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium shrink-0 ${SEVERITY_BADGE[factor.severity]}`}
                    >
                      {factor.severity}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {factor.name}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {factor.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.suggestions.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2">
                Suggestions
              </h4>
              <div className="space-y-2">
                {result.suggestions.map((suggestion, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-[var(--text-primary)]">{suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleAssess}
            className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <RefreshCw size={14} />
            Re-assess
          </button>
        </div>
      )}

      {!result && !loading && (
        <p className="text-sm text-[var(--text-muted)] text-center py-4">
          Click &quot;Assess Risk&quot; to analyze your portfolio risk profile.
        </p>
      )}
    </div>
  );
};
