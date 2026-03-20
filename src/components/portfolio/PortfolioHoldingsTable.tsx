import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ArrowUpDown } from 'lucide-react';
import type { PortfolioHolding, Trade } from '@/types';
import {
  formatCurrency,
  formatCrypto,
  formatPercent,
  formatPnl,
  formatPnlPct,
  formatDate,
} from '@/lib/format';

interface PortfolioHoldingsTableProps {
  holdings: PortfolioHolding[];
  trades: Trade[];
}

type SortKey =
  | 'asset'
  | 'currentValue'
  | 'unrealizedPnl'
  | 'allocationPct'
  | 'holdingDurationDays'
  | 'change24h';

interface SortHeaderProps {
  label: string;
  field: SortKey;
  align?: 'left' | 'right';
  activeSortKey: SortKey;
  onSort: (key: SortKey) => void;
}

const SortHeader: React.FC<SortHeaderProps> = ({
  label,
  field,
  align = 'right',
  activeSortKey,
  onSort,
}) => (
  <th
    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] cursor-pointer select-none hover:text-[var(--text-primary)] transition-colors ${
      align === 'left' ? 'text-left' : 'text-right'
    }`}
    onClick={() => onSort(field)}
  >
    <div
      className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : 'justify-start'}`}
    >
      {label}
      <ArrowUpDown
        size={12}
        className={activeSortKey === field ? 'text-[var(--accent-primary)]' : 'opacity-30'}
      />
    </div>
  </th>
);

const formatDuration = (days: number): string => {
  if (days === 0) return '< 1d';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
};

interface CostBasisBarProps {
  avgBuyPrice: number;
  currentPrice: number;
}

const CostBasisBar: React.FC<CostBasisBarProps> = ({ avgBuyPrice, currentPrice }) => {
  if (currentPrice <= 0 || avgBuyPrice <= 0) {
    return (
      <span className="text-[var(--text-secondary)]">{formatCurrency(avgBuyPrice)}</span>
    );
  }

  const isProfit = currentPrice >= avgBuyPrice;
  const maxPrice = Math.max(avgBuyPrice, currentPrice);
  const costPct = (avgBuyPrice / maxPrice) * 100;
  const currentPct = (currentPrice / maxPrice) * 100;
  const priceDiffPct = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;

  return (
    <div className="flex flex-col items-end gap-1 min-w-[120px]">
      <div className="flex items-center justify-between w-full text-[10px] leading-none text-[var(--text-muted)]">
        <span>Cost {formatCurrency(avgBuyPrice)}</span>
        <span>Now {formatCurrency(currentPrice)}</span>
      </div>
      <div className="relative w-full h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
        {/* Cost basis bar (always shows, dimmed) */}
        <div
          className="absolute top-0 left-0 h-full rounded-full bg-[var(--text-muted)] opacity-30"
          style={{ width: `${costPct}%` }}
        />
        {/* Current price bar (overlaid, colored) */}
        <div
          className={`absolute top-0 left-0 h-full rounded-full ${
            isProfit ? 'bg-emerald-500' : 'bg-red-500'
          }`}
          style={{ width: `${currentPct}%` }}
        />
      </div>
      <span
        className={`text-[10px] leading-none font-medium ${
          isProfit ? 'text-emerald-500' : 'text-red-500'
        }`}
      >
        {isProfit ? '+' : ''}{priceDiffPct.toFixed(1)}%
      </span>
    </div>
  );
};

export const PortfolioHoldingsTable: React.FC<PortfolioHoldingsTableProps> = ({
  holdings,
  trades,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('currentValue');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sorted = [...holdings].sort((a, b) => {
    const multiplier = sortAsc ? 1 : -1;
    if (sortKey === 'asset') return a.asset.localeCompare(b.asset) * multiplier;
    return ((a[sortKey] ?? 0) - (b[sortKey] ?? 0)) * multiplier;
  });

  const getAssetTrades = (asset: string): Trade[] => {
    return trades
      .filter((t) => {
        const tradeAsset = t.symbol.split('-')[0] ?? t.symbol;
        return tradeAsset === asset;
      })
      .sort((a, b) => new Date(b.tradedAt).getTime() - new Date(a.tradedAt).getTime())
      .slice(0, 10);
  };

  if (holdings.length === 0) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)]">
        No holdings yet. Add your first trade to track your portfolio.
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead className="border-b border-[var(--border-default)]">
            <tr>
              <th className="w-8 px-2 py-3" />
              <SortHeader label="Asset" field="asset" align="left" activeSortKey={sortKey} onSort={handleSort} />
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Quantity
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Cost Basis
              </th>
              <SortHeader label="Value" field="currentValue" activeSortKey={sortKey} onSort={handleSort} />
              <SortHeader label="P&L" field="unrealizedPnl" activeSortKey={sortKey} onSort={handleSort} />
              <SortHeader label="24h" field="change24h" activeSortKey={sortKey} onSort={handleSort} />
              <SortHeader label="Held" field="holdingDurationDays" activeSortKey={sortKey} onSort={handleSort} />
              <SortHeader label="Alloc" field="allocationPct" activeSortKey={sortKey} onSort={handleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {sorted.map((h) => {
              const isExpanded = expandedAsset === h.asset;
              const assetTrades = isExpanded ? getAssetTrades(h.asset) : [];

              return (
                <React.Fragment key={h.asset}>
                  <tr
                    className="transition-colors hover:bg-[var(--bg-tertiary)] cursor-pointer"
                    onClick={() => setExpandedAsset(isExpanded ? null : h.asset)}
                  >
                    <td className="px-2 py-4 text-[var(--text-muted)]">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm">
                      <div>
                        <span className="font-bold text-[var(--text-primary)]">{h.asset}</span>
                        <span className="ml-2 text-xs text-[var(--text-muted)]">
                          {h.tradeCount} trade{h.tradeCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm text-[var(--text-secondary)]">
                      {formatCrypto(h.totalQuantity)}
                    </td>
                    <td className="px-4 py-4 text-right text-sm">
                      <CostBasisBar avgBuyPrice={h.avgBuyPrice} currentPrice={h.currentPrice} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm">
                      <div>
                        <span className="text-[var(--text-primary)]">
                          {h.currentPrice > 0 ? formatCurrency(h.currentValue) : formatCurrency(h.totalCost)}
                        </span>
                        {h.currentPrice > 0 && (
                          <div className="text-xs text-[var(--text-muted)]">
                            @ {formatCurrency(h.currentPrice)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm">
                      {h.currentPrice > 0 ? (
                        <div>
                          <span
                            className={
                              h.unrealizedPnl >= 0 ? 'text-emerald-500' : 'text-red-500'
                            }
                          >
                            {formatPnl(h.unrealizedPnl)}
                          </span>
                          <div
                            className={`text-xs ${h.unrealizedPnlPct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
                          >
                            {formatPnlPct(h.unrealizedPnlPct)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)]">--</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm">
                      {h.currentPrice > 0 ? (
                        <span
                          className={h.change24hPct >= 0 ? 'text-emerald-500' : 'text-red-500'}
                        >
                          {formatPnlPct(h.change24hPct)}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">--</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm text-[var(--text-secondary)]">
                      {formatDuration(h.holdingDurationDays)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--accent-primary)]"
                            style={{ width: `${Math.min(h.allocationPct, 100)}%` }}
                          />
                        </div>
                        <span className="text-[var(--text-secondary)] w-12 text-right">
                          {formatPercent(h.allocationPct)}
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded: Recent Trades */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={9} className="px-6 py-3 bg-[var(--bg-tertiary)]">
                        <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2">
                          Recent Trades — {h.asset}
                          {h.firstBuyDate && (
                            <span className="font-normal text-[var(--text-muted)] ml-2">
                              First buy: {formatDate(h.firstBuyDate)}
                            </span>
                          )}
                        </p>
                        {assetTrades.length === 0 ? (
                          <p className="text-xs text-[var(--text-muted)]">No trade history</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-[var(--text-muted)]">
                                  <th className="text-left py-1 pr-4">Date</th>
                                  <th className="text-left py-1 pr-4">Side</th>
                                  <th className="text-right py-1 pr-4">Price</th>
                                  <th className="text-right py-1 pr-4">Qty</th>
                                  <th className="text-right py-1 pr-4">Total</th>
                                  <th className="text-right py-1">P&L</th>
                                </tr>
                              </thead>
                              <tbody>
                                {assetTrades.map((t) => (
                                  <tr key={t.id} className="text-[var(--text-secondary)]">
                                    <td className="py-1 pr-4">{formatDate(t.tradedAt)}</td>
                                    <td className="py-1 pr-4">
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                          t.side === 'buy'
                                            ? 'bg-emerald-500/10 text-emerald-500'
                                            : 'bg-red-500/10 text-red-500'
                                        }`}
                                      >
                                        {t.side.toUpperCase()}
                                      </span>
                                    </td>
                                    <td className="py-1 pr-4 text-right font-mono">
                                      {formatCurrency(t.price)}
                                    </td>
                                    <td className="py-1 pr-4 text-right">
                                      {formatCrypto(t.quantity)}
                                    </td>
                                    <td className="py-1 pr-4 text-right">
                                      {formatCurrency(t.total)}
                                    </td>
                                    <td className="py-1 text-right">
                                      {t.realizedPnl != null ? (
                                        <span
                                          className={
                                            t.realizedPnl >= 0
                                              ? 'text-emerald-500'
                                              : 'text-red-500'
                                          }
                                        >
                                          {formatPnl(t.realizedPnl)}
                                        </span>
                                      ) : (
                                        <span className="text-[var(--text-muted)]">—</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="divide-y divide-[var(--border-subtle)] md:hidden">
        {sorted.map((h) => (
          <div
            key={h.asset}
            className="py-3 cursor-pointer"
            onClick={() => setExpandedAsset(expandedAsset === h.asset ? null : h.asset)}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                {expandedAsset === h.asset ? (
                  <ChevronDown size={14} className="text-[var(--text-muted)]" />
                ) : (
                  <ChevronRight size={14} className="text-[var(--text-muted)]" />
                )}
                <span className="font-bold text-[var(--text-primary)]">{h.asset}</span>
                <span className="text-xs text-[var(--text-muted)]">
                  {h.tradeCount} trades
                </span>
              </div>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {h.currentPrice > 0 ? formatCurrency(h.currentValue) : formatCurrency(h.totalCost)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs ml-6">
              <span className="text-[var(--text-secondary)]">
                {formatCrypto(h.totalQuantity)} @ {formatCurrency(h.avgBuyPrice)}
              </span>
              {h.currentPrice > 0 && (
                <span
                  className={h.unrealizedPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}
                >
                  {formatPnl(h.unrealizedPnl)} ({formatPnlPct(h.unrealizedPnlPct)})
                </span>
              )}
            </div>

            {/* Cost basis mini bar (mobile) */}
            {h.currentPrice > 0 && h.avgBuyPrice > 0 && (
              <div className="ml-6 mt-1.5">
                <CostBasisBar avgBuyPrice={h.avgBuyPrice} currentPrice={h.currentPrice} />
              </div>
            )}

            <div className="flex items-center justify-between text-xs ml-6 mt-1">
              <span className="text-[var(--text-muted)]">
                Held {formatDuration(h.holdingDurationDays)}
              </span>
              <span className="text-[var(--text-muted)]">
                {formatPercent(h.allocationPct)}
              </span>
            </div>

            <div className="mt-1.5 ml-6 w-[calc(100%-1.5rem)] h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--accent-primary)]"
                style={{ width: `${Math.min(h.allocationPct, 100)}%` }}
              />
            </div>

            {/* Expanded trades on mobile */}
            {expandedAsset === h.asset && (
              <div className="ml-6 mt-3 space-y-1.5">
                <p className="text-xs font-semibold text-[var(--text-secondary)]">
                  Recent Trades
                  {h.firstBuyDate && (
                    <span className="font-normal text-[var(--text-muted)] ml-1">
                      (since {formatDate(h.firstBuyDate)})
                    </span>
                  )}
                </p>
                {getAssetTrades(h.asset).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between text-xs py-1 border-b border-[var(--border-subtle)]"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1 py-0.5 rounded font-medium ${
                          t.side === 'buy'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-red-500/10 text-red-500'
                        }`}
                      >
                        {t.side.toUpperCase()}
                      </span>
                      <span className="text-[var(--text-muted)]">{formatDate(t.tradedAt)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[var(--text-secondary)]">{formatCurrency(t.total)}</span>
                      {t.realizedPnl != null && (
                        <span
                          className={`ml-2 ${t.realizedPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
                        >
                          {formatPnl(t.realizedPnl)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
};
