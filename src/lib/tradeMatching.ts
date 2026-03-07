import type { Trade } from '@/types';

export interface TradeMatchUpdate {
  id: string;
  realizedPnl: number | null;
}

/**
 * Compute FIFO-matched realized P&L for all trades.
 *
 * Groups trades by symbol, sorts by tradedAt ascending, then matches sells
 * against the oldest unmatched buys. Buy trades always get realizedPnl: null.
 *
 * Args:
 *   trades: Full list of trades (all symbols)
 *
 * Returns:
 *   Array of updates — one per trade — with computed realizedPnl
 */
export function computeFifoMatches(trades: Trade[]): TradeMatchUpdate[] {
  const bySymbol = new Map<string, Trade[]>();
  for (const trade of trades) {
    const list = bySymbol.get(trade.symbol) ?? [];
    list.push(trade);
    bySymbol.set(trade.symbol, list);
  }

  const updates: TradeMatchUpdate[] = [];

  for (const symbolTrades of bySymbol.values()) {
    const sorted = [...symbolTrades].sort(
      (a, b) => new Date(a.tradedAt).getTime() - new Date(b.tradedAt).getTime(),
    );

    const buyQueue: { price: number; remainingQty: number }[] = [];

    for (const trade of sorted) {
      if (trade.side === 'buy') {
        buyQueue.push({ price: trade.price, remainingQty: trade.quantity });
        updates.push({ id: trade.id, realizedPnl: null });
      } else {
        // Sell — consume from oldest buys
        if (buyQueue.length === 0) {
          updates.push({ id: trade.id, realizedPnl: null });
          continue;
        }

        let remaining = trade.quantity;
        let totalCost = 0;
        let totalMatched = 0;

        while (remaining > 0 && buyQueue.length > 0) {
          const oldest = buyQueue[0]!;
          const matched = Math.min(remaining, oldest.remainingQty);

          totalCost += matched * oldest.price;
          totalMatched += matched;
          remaining -= matched;
          oldest.remainingQty -= matched;

          if (oldest.remainingQty <= 0) {
            buyQueue.shift();
          }
        }

        if (totalMatched === 0) {
          updates.push({ id: trade.id, realizedPnl: null });
        } else {
          const pnl = totalMatched * trade.price - totalCost - trade.fee;
          updates.push({ id: trade.id, realizedPnl: Math.round(pnl * 100) / 100 });
        }
      }
    }
  }

  return updates;
}
