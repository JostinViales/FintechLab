import React from 'react';
import type { AssetBalance } from '@/types';
import type { OkxTicker } from '@/types/okx';
import { formatCurrency, formatCrypto, formatPercent, formatPnl, formatPnlPct } from '@/lib/format';

interface AssetBalancesTableProps {
  balances: AssetBalance[];
  livePrices?: Map<string, OkxTicker>;
}

export const AssetBalancesTable: React.FC<AssetBalancesTableProps> = ({ balances, livePrices }) => {
  const totalCost = balances.reduce((sum, b) => sum + b.totalCost, 0);
  const hasLivePrices = livePrices && livePrices.size > 0;

  const enriched = balances.map((b) => {
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
              <tr key={b.asset} className="transition-colors hover:bg-[var(--bg-tertiary)]">
                <td className="whitespace-nowrap px-4 py-4 text-sm font-bold text-[var(--text-primary)]">
                  {b.asset}
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
          <div key={b.asset} className="py-3">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-[var(--text-primary)]">{b.asset}</span>
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
