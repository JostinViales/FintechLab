import React, { useState } from 'react';
import type { AssetBalance, OkxAccountType } from '../../types';
import type { OkxTicker } from '../../types/okx';
import { formatCurrency, formatCrypto, formatPercent, formatPnl, formatPnlPct } from '../../lib/format';

type AccountTypeFilter = 'all' | OkxAccountType;

const ACCOUNT_TYPE_FILTERS: { id: AccountTypeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'trading', label: 'Trading' },
  { id: 'funding', label: 'Funding' },
  { id: 'earn', label: 'Earn' },
];

const ACCOUNT_TYPE_COLORS: Record<OkxAccountType, string> = {
  trading: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
  funding: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  earn: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
};

interface AssetBalancesTableProps {
  balances: AssetBalance[];
  livePrices?: Map<string, OkxTicker>;
}

export const AssetBalancesTable: React.FC<AssetBalancesTableProps> = ({ balances, livePrices }) => {
  const [activeFilter, setActiveFilter] = useState<AccountTypeFilter>('all');

  const filtered =
    activeFilter === 'all' ? balances : balances.filter((b) => b.accountType === activeFilter);

  const hasMultipleTypes = new Set(balances.map((b) => b.accountType)).size > 1;

  const totalCost = filtered.reduce((sum, b) => sum + b.totalCost, 0);
  const hasLivePrices = livePrices && livePrices.size > 0;

  const enriched = filtered.map((b) => {
    const ticker = livePrices?.get(b.asset + '-USDT');
    const currentPrice = ticker ? Number(ticker.last) : undefined;
    const currentValue = currentPrice ? b.totalQuantity * currentPrice : undefined;
    const unrealizedPnl = currentValue && b.totalCost > 0 ? currentValue - b.totalCost : undefined;
    const unrealizedPnlPct =
      unrealizedPnl !== undefined && b.totalCost > 0
        ? (unrealizedPnl / b.totalCost) * 100
        : undefined;

    return {
      ...b,
      allocationPct: totalCost > 0 ? (b.totalCost / totalCost) * 100 : 0,
      currentPrice,
      currentValue,
      unrealizedPnl,
      unrealizedPnlPct,
    };
  });

  const totalCurrentValue = enriched.reduce((sum, b) => sum + (b.currentValue ?? 0), 0);
  const totalUnrealizedPnl = enriched.reduce((sum, b) => sum + (b.unrealizedPnl ?? 0), 0);

  if (enriched.length === 0) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)]">
        No holdings yet. Add your first trade to track assets.
      </div>
    );
  }

  return (
    <>
      {/* Account Type Filter Tabs */}
      {hasMultipleTypes && (
        <div className="flex gap-1 mb-4">
          {ACCOUNT_TYPE_FILTERS.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeFilter === filter.id
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead className="border-b border-[var(--border-default)]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Asset
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Quantity
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Avg Buy Price
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Total Cost
              </th>
              {hasLivePrices && (
                <>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    Price
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    Value
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    P&L
                  </th>
                </>
              )}
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Allocation
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {enriched.map((b) => (
              <tr key={`${b.asset}-${b.accountType}`} className="transition-colors hover:bg-[var(--bg-tertiary)]">
                <td className="px-4 py-4 text-sm font-bold text-[var(--text-primary)]">
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        {b.asset}
                        {hasMultipleTypes && (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${ACCOUNT_TYPE_COLORS[b.accountType]}`}
                          >
                            {b.accountType}
                          </span>
                        )}
                      </div>
                      {b.accountType === 'earn' && b.earnings !== undefined && b.earnings > 0 && (
                        <div className="text-xs text-emerald-500 mt-1">
                          Earnings: {formatCurrency(b.earnings)}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right text-sm text-[var(--text-secondary)]">
                  {formatCrypto(b.totalQuantity)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right text-sm text-[var(--text-secondary)]">
                  {formatCurrency(b.avgBuyPrice)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right text-sm text-[var(--text-primary)]">
                  {formatCurrency(b.totalCost)}
                </td>
                {hasLivePrices && (
                  <>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-mono text-[var(--text-secondary)]">
                      {b.currentPrice !== undefined ? formatCurrency(b.currentPrice) : '--'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm text-[var(--text-primary)]">
                      {b.currentValue !== undefined ? formatCurrency(b.currentValue) : '--'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm">
                      {b.unrealizedPnl !== undefined ? (
                        <div>
                          <span className={b.unrealizedPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                            {formatPnl(b.unrealizedPnl)}
                          </span>
                          {b.unrealizedPnlPct !== undefined && (
                            <span className={`ml-1 text-xs ${b.unrealizedPnlPct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              ({formatPnlPct(b.unrealizedPnlPct)})
                            </span>
                          )}
                        </div>
                      ) : (
                        '--'
                      )}
                    </td>
                  </>
                )}
                <td className="whitespace-nowrap px-4 py-4 text-right text-sm">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--accent-primary)]"
                        style={{ width: `${Math.min(b.allocationPct, 100)}%` }}
                      />
                    </div>
                    <span className="text-[var(--text-secondary)] w-12 text-right">
                      {formatPercent(b.allocationPct)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-[var(--border-default)]">
            <tr>
              <td className="px-4 py-3 text-sm font-bold text-[var(--text-primary)]">Total</td>
              <td />
              <td />
              <td className="px-4 py-3 text-right text-sm font-bold text-[var(--text-primary)]">
                {formatCurrency(totalCost)}
              </td>
              {hasLivePrices && (
                <>
                  <td />
                  <td className="px-4 py-3 text-right text-sm font-bold text-[var(--text-primary)]">
                    {totalCurrentValue > 0 ? formatCurrency(totalCurrentValue) : '--'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold">
                    {totalUnrealizedPnl !== 0 ? (
                      <span className={totalUnrealizedPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                        {formatPnl(totalUnrealizedPnl)}
                      </span>
                    ) : (
                      '--'
                    )}
                  </td>
                </>
              )}
              <td className="px-4 py-3 text-right text-sm font-bold text-[var(--text-secondary)]">
                100%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="divide-y divide-[var(--border-subtle)] md:hidden">
        {enriched.map((b) => (
          <div key={`${b.asset}-${b.accountType}`} className="py-3">
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-2 font-bold text-[var(--text-primary)]">
                {b.asset}
                {hasMultipleTypes && (
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${ACCOUNT_TYPE_COLORS[b.accountType]}`}
                  >
                    {b.accountType}
                  </span>
                )}
              </span>
              <span className="text-sm text-[var(--text-primary)]">
                {formatCurrency(b.totalCost)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>
                {formatCrypto(b.totalQuantity)} @ {formatCurrency(b.avgBuyPrice)}
              </span>
              <span>{formatPercent(b.allocationPct)}</span>
            </div>
            {b.accountType === 'earn' && b.earnings !== undefined && b.earnings > 0 && (
              <div className="text-xs text-emerald-500 mt-1">
                Earnings: {formatCurrency(b.earnings)}
              </div>
            )}
            {hasLivePrices && b.currentPrice !== undefined && (
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-[var(--text-secondary)]">
                  Now: {formatCurrency(b.currentPrice)}
                </span>
                {b.unrealizedPnl !== undefined && (
                  <span className={b.unrealizedPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                    {formatPnl(b.unrealizedPnl)}
                  </span>
                )}
              </div>
            )}
            <div className="mt-1.5 w-full h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--accent-primary)]"
                style={{ width: `${Math.min(b.allocationPct, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
