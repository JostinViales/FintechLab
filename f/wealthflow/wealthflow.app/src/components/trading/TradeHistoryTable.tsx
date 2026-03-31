import React, { useState, useMemo } from 'react';
import { Search, ArrowUp, ArrowDown } from 'lucide-react';
import type { Trade, StrategyTag, TradeSide } from '@/types';
import { Card } from '@/components/ui/Card';
import { formatCurrency, formatCrypto, formatPnl, formatDate } from '@/lib/format';

interface TradeHistoryTableProps {
  trades: Trade[];
  strategyTags: StrategyTag[];
}

type SortField = 'traded_at' | 'price' | 'total' | 'realized_pnl';
type SortOrder = 'asc' | 'desc';

export const TradeHistoryTable: React.FC<TradeHistoryTableProps> = ({
  trades,
  strategyTags,
}) => {
  const [search, setSearch] = useState('');
  const [filterSide, setFilterSide] = useState<TradeSide | 'All'>('All');
  const [filterSymbol, setFilterSymbol] = useState<string>('All');
  const [filterStrategy, setFilterStrategy] = useState<string>('All');
  const [sortField, setSortField] = useState<SortField>('traded_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const uniqueSymbols = useMemo(() => {
    const symbols = new Set(trades.map((t) => t.symbol));
    return Array.from(symbols).sort();
  }, [trades]);

  const processedTrades = useMemo(() => {
    return trades
      .filter((t) => {
        const matchesSearch = t.symbol.toLowerCase().includes(search.toLowerCase());
        const matchesSide = filterSide === 'All' || t.side === filterSide;
        const matchesSymbol = filterSymbol === 'All' || t.symbol === filterSymbol;
        const matchesStrategy =
          filterStrategy === 'All' || (t.strategyTag ?? '') === filterStrategy;
        return matchesSearch && matchesSide && matchesSymbol && matchesStrategy;
      })
      .sort((a, b) => {
        const mul = sortOrder === 'asc' ? 1 : -1;
        switch (sortField) {
          case 'traded_at':
            return mul * (new Date(a.tradedAt).getTime() - new Date(b.tradedAt).getTime());
          case 'price':
            return mul * (a.price - b.price);
          case 'total':
            return mul * (a.total - b.total);
          case 'realized_pnl':
            return mul * ((a.realizedPnl ?? 0) - (b.realizedPnl ?? 0));
          default:
            return 0;
        }
      });
  }, [trades, search, filterSide, filterSymbol, filterStrategy, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getTagColor = (tagName: string): string => {
    return strategyTags.find((t) => t.name === tagName)?.color ?? 'var(--text-muted)';
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:justify-between">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            size={18}
          />
          <input
            type="text"
            placeholder="Search by symbol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] pl-10 pr-4 py-2 text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={filterSide}
            onChange={(e) => setFilterSide(e.target.value as TradeSide | 'All')}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
          >
            <option value="All">All Sides</option>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
          <select
            value={filterSymbol}
            onChange={(e) => setFilterSymbol(e.target.value)}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
          >
            <option value="All">All Symbols</option>
            {uniqueSymbols.map((sym) => (
              <option key={sym} value={sym}>
                {sym}
              </option>
            ))}
          </select>
          <select
            value={filterStrategy}
            onChange={(e) => setFilterStrategy(e.target.value)}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
          >
            <option value="All">All Strategies</option>
            {strategyTags.map((tag) => (
              <option key={tag.id} value={tag.name}>
                {tag.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {/* Desktop Table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full">
            <thead className="border-b border-[var(--border-default)] bg-[var(--bg-tertiary)]">
              <tr>
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
                  onClick={() => toggleSort('traded_at')}
                >
                  <div className="flex items-center gap-1">Date {renderSortIcon('traded_at')}</div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Symbol
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Side
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
                  onClick={() => toggleSort('price')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Price {renderSortIcon('price')}
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Qty
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
                  onClick={() => toggleSort('total')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Total {renderSortIcon('total')}
                  </div>
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
                  onClick={() => toggleSort('realized_pnl')}
                >
                  <div className="flex items-center justify-end gap-1">
                    P&L {renderSortIcon('realized_pnl')}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Strategy
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--bg-secondary)]">
              {processedTrades.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-[var(--bg-tertiary)]">
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-[var(--text-secondary)]">
                    {formatDate(t.tradedAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-[var(--text-primary)]">
                    {t.symbol}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                          t.side === 'buy'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-red-500/15 text-red-400'
                        }`}
                      >
                        {t.side.toUpperCase()}
                      </span>
                      {t.direction && (
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                            t.direction === 'long'
                              ? 'bg-green-500/15 text-green-400'
                              : t.direction === 'short'
                                ? 'bg-red-500/15 text-red-400'
                                : 'bg-slate-500/15 text-slate-400'
                          }`}
                        >
                          {t.direction.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right text-sm text-[var(--text-primary)]">
                    {t.openAvgPx ? (
                      <span>
                        {formatCurrency(t.openAvgPx)} → {formatCurrency(t.price)}
                      </span>
                    ) : (
                      formatCurrency(t.price)
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right text-sm text-[var(--text-secondary)]">
                    {formatCrypto(t.quantity)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right text-sm text-[var(--text-primary)]">
                    {formatCurrency(t.total)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-bold">
                    {t.realizedPnl != null ? (
                      <span
                        className={
                          t.realizedPnl >= 0
                            ? 'text-[var(--accent-success)]'
                            : 'text-[var(--accent-danger)]'
                        }
                      >
                        {formatPnl(t.realizedPnl)}
                        {t.pnlRatio != null && (
                          <span className="ml-1 text-xs">
                            ({(t.pnlRatio * 100).toFixed(2)}%)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">---</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm">
                    {t.strategyTag ? (
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: `${getTagColor(t.strategyTag)}20`,
                          color: getTagColor(t.strategyTag),
                        }}
                      >
                        {t.strategyTag}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">---</span>
                    )}
                  </td>
                </tr>
              ))}
              {processedTrades.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-[var(--text-muted)]">
                    No trades found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="divide-y divide-[var(--border-subtle)] md:hidden">
          {processedTrades.length === 0 ? (
            <div className="px-4 py-12 text-center text-[var(--text-muted)]">
              No trades found matching your filters.
            </div>
          ) : (
            processedTrades.map((t) => (
              <div
                key={t.id}
                className="bg-[var(--bg-secondary)] p-4"
              >
                <div className="flex gap-3">
                  <div
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      t.side === 'buy' ? 'bg-emerald-400' : 'bg-red-400'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{t.symbol}</p>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block text-xs font-semibold ${
                              t.side === 'buy' ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {t.side.toUpperCase()}
                          </span>
                          {t.direction && (
                            <span
                              className={`inline-block text-xs font-semibold ${
                                t.direction === 'long'
                                  ? 'text-green-400'
                                  : t.direction === 'short'
                                    ? 'text-red-400'
                                    : 'text-slate-400'
                              }`}
                            >
                              {t.direction.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-[var(--text-primary)]">
                          {formatCurrency(t.total)}
                        </p>
                        {t.realizedPnl != null && (
                          <p
                            className={`text-xs font-bold ${
                              t.realizedPnl >= 0
                                ? 'text-[var(--accent-success)]'
                                : 'text-[var(--accent-danger)]'
                            }`}
                          >
                            {formatPnl(t.realizedPnl)}
                            {t.pnlRatio != null && (
                              <span className="ml-1">
                                ({(t.pnlRatio * 100).toFixed(2)}%)
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <span>{formatDate(t.tradedAt)}</span>
                      <span>-</span>
                      <span>
                        {formatCrypto(t.quantity)} @{' '}
                        {t.openAvgPx ? (
                          <>
                            {formatCurrency(t.openAvgPx)} → {formatCurrency(t.price)}
                          </>
                        ) : (
                          formatCurrency(t.price)
                        )}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex gap-2">
                        {t.strategyTag && (
                          <span
                            className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{
                              backgroundColor: `${getTagColor(t.strategyTag)}20`,
                              color: getTagColor(t.strategyTag),
                            }}
                          >
                            {t.strategyTag}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
