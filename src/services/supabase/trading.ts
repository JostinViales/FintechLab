import { supabase } from './client';
import type {
  Trade,
  AssetBalance,
  WatchlistItem,
  TradingGoal,
  StrategyTag,
  TradeFilters,
  TradingLimit,
  TradingInstance,
  OkxAccountType,
} from '@/types';

async function getCurrentUserId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('Not authenticated');
  return session.user.id;
}

// --- Row Types (snake_case from Supabase) ---

interface SupabaseTradeRow {
  id: string;
  symbol: string;
  side: string;
  price: number;
  quantity: number;
  total: number;
  fee: number;
  fee_currency: string;
  realized_pnl: number | null;
  strategy_tag: string | null;
  notes: string | null;
  source: string;
  okx_trade_id: string | null;
  okx_order_id: string | null;
  traded_at: string;
  created_at: string;
  // Position-based columns
  okx_pos_id: string | null;
  direction: string | null;
  open_avg_px: number | null;
  close_avg_px: number | null;
  funding_fee: number | null;
  liq_penalty: number | null;
  pnl_ratio: number | null;
  leverage: string | null;
  margin_mode: string | null;
  open_time: string | null;
  close_time: string | null;
}

interface SupabaseAssetBalanceRow {
  id: string;
  asset: string;
  total_quantity: number;
  avg_buy_price: number;
  total_cost: number;
  last_synced_at: string | null;
  account_type: string;
  earnings: number | null;
}

interface SupabaseWatchlistRow {
  id: string;
  symbol: string;
  sort_order: number;
  created_at: string;
}

interface SupabaseTradingGoalRow {
  id: string;
  period_type: string;
  period_key: string;
  target_pnl: number;
  max_trades: number | null;
  max_capital: number | null;
  created_at: string;
}

interface SupabaseStrategyTagRow {
  id: string;
  name: string;
  color: string;
  description: string | null;
}

// --- Row Mappers ---

function mapTradeRow(row: SupabaseTradeRow): Trade {
  return {
    id: row.id,
    symbol: row.symbol,
    side: row.side as Trade['side'],
    price: Number(row.price),
    quantity: Number(row.quantity),
    total: Number(row.total),
    fee: Number(row.fee),
    feeCurrency: row.fee_currency,
    realizedPnl: row.realized_pnl != null ? Number(row.realized_pnl) : undefined,
    strategyTag: row.strategy_tag ?? undefined,
    notes: row.notes ?? undefined,
    source: row.source as Trade['source'],
    okxTradeId: row.okx_trade_id ?? undefined,
    okxOrderId: row.okx_order_id ?? undefined,
    tradedAt: row.traded_at,
    createdAt: row.created_at,
    okxPosId: row.okx_pos_id ?? undefined,
    direction: (row.direction as Trade['direction']) ?? undefined,
    openAvgPx: row.open_avg_px != null ? Number(row.open_avg_px) : undefined,
    closeAvgPx: row.close_avg_px != null ? Number(row.close_avg_px) : undefined,
    fundingFee: row.funding_fee != null ? Number(row.funding_fee) : undefined,
    liqPenalty: row.liq_penalty != null ? Number(row.liq_penalty) : undefined,
    pnlRatio: row.pnl_ratio != null ? Number(row.pnl_ratio) : undefined,
    leverage: row.leverage ?? undefined,
    marginMode: (row.margin_mode as Trade['marginMode']) ?? undefined,
    openTime: row.open_time ?? undefined,
    closeTime: row.close_time ?? undefined,
  };
}

function mapAssetBalanceRow(row: SupabaseAssetBalanceRow): AssetBalance {
  return {
    id: row.id,
    asset: row.asset,
    totalQuantity: Number(row.total_quantity),
    avgBuyPrice: Number(row.avg_buy_price),
    totalCost: Number(row.total_cost),
    lastSyncedAt: row.last_synced_at ?? undefined,
    accountType: (row.account_type as OkxAccountType) ?? 'trading',
    earnings: row.earnings != null ? Number(row.earnings) : undefined,
  };
}

function mapWatchlistRow(row: SupabaseWatchlistRow): WatchlistItem {
  return {
    id: row.id,
    symbol: row.symbol,
    sortOrder: row.sort_order,
  };
}

function mapTradingGoalRow(row: SupabaseTradingGoalRow): TradingGoal {
  return {
    id: row.id,
    periodType: row.period_type as TradingGoal['periodType'],
    periodKey: row.period_key,
    targetPnl: Number(row.target_pnl),
    maxTrades: row.max_trades ?? undefined,
    maxCapital: row.max_capital != null ? Number(row.max_capital) : undefined,
  };
}

function mapStrategyTagRow(row: SupabaseStrategyTagRow): StrategyTag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    description: row.description ?? undefined,
  };
}

// --- Trades CRUD ---

export const loadTrades = async (
  filters?: TradeFilters,
  instance: TradingInstance = 'live',
): Promise<Trade[]> => {
  let query = supabase
    .from('trades')
    .select('*')
    .eq('instance', instance)
    .order('traded_at', { ascending: false });

  if (filters?.symbol) query = query.eq('symbol', filters.symbol);
  if (filters?.side) query = query.eq('side', filters.side);
  if (filters?.strategyTag) query = query.eq('strategy_tag', filters.strategyTag);
  if (filters?.dateFrom) query = query.gte('traded_at', filters.dateFrom);
  if (filters?.dateTo) query = query.lte('traded_at', filters.dateTo);

  const { data, error } = await query;
  if (error) console.error('Error loading trades:', error);
  return (data ?? []).map(mapTradeRow);
};

export const saveTrade = async (
  trade: Omit<Trade, 'id' | 'createdAt' | 'total'>,
  instance: TradingInstance = 'live',
): Promise<Trade | null> => {
  const userId = await getCurrentUserId();
  const baseRow: Record<string, unknown> = {
    symbol: trade.symbol,
    side: trade.side,
    price: trade.price,
    quantity: trade.quantity,
    fee: trade.fee,
    fee_currency: trade.feeCurrency,
    realized_pnl: trade.realizedPnl ?? null,
    strategy_tag: trade.strategyTag ?? null,
    notes: trade.notes ?? null,
    source: trade.source,
    okx_trade_id: trade.okxTradeId ?? null,
    okx_order_id: trade.okxOrderId ?? null,
    traded_at: trade.tradedAt,
    instance,
    user_id: userId,
  };

  // Position columns (may not exist pre-migration)
  const positionFields: Record<string, unknown> = {
    okx_pos_id: trade.okxPosId ?? null,
    direction: trade.direction ?? null,
    open_avg_px: trade.openAvgPx ?? null,
    close_avg_px: trade.closeAvgPx ?? null,
    funding_fee: trade.fundingFee ?? null,
    liq_penalty: trade.liqPenalty ?? null,
    pnl_ratio: trade.pnlRatio ?? null,
    leverage: trade.leverage ?? null,
    margin_mode: trade.marginMode ?? null,
    open_time: trade.openTime ?? null,
    close_time: trade.closeTime ?? null,
  };

  // Include position fields if any have values
  const hasPositionData = trade.okxPosId !== undefined;
  const row = hasPositionData ? { ...baseRow, ...positionFields } : baseRow;

  const { data, error } = await supabase.from('trades').insert(row).select().single();

  // Fallback: retry without position columns if they don't exist yet
  if (error?.code === 'PGRST204' && hasPositionData) {
    const { data: retryData, error: retryError } = await supabase
      .from('trades')
      .insert(baseRow)
      .select()
      .single();

    if (retryError) {
      console.error('Error saving trade:', retryError);
      return null;
    }
    return mapTradeRow(retryData);
  }

  if (error) {
    console.error('Error saving trade:', error);
    return null;
  }
  return mapTradeRow(data);
};

export const updateTrade = async (
  id: string,
  trade: Partial<Omit<Trade, 'id' | 'createdAt' | 'total'>>,
): Promise<Trade | null> => {
  const row: Record<string, unknown> = {};
  if (trade.symbol !== undefined) row.symbol = trade.symbol;
  if (trade.side !== undefined) row.side = trade.side;
  if (trade.price !== undefined) row.price = trade.price;
  if (trade.quantity !== undefined) row.quantity = trade.quantity;
  if (trade.fee !== undefined) row.fee = trade.fee;
  if (trade.feeCurrency !== undefined) row.fee_currency = trade.feeCurrency;
  if ('realizedPnl' in trade) row.realized_pnl = trade.realizedPnl ?? null;
  if (trade.strategyTag !== undefined) row.strategy_tag = trade.strategyTag ?? null;
  if (trade.notes !== undefined) row.notes = trade.notes ?? null;
  if (trade.tradedAt !== undefined) row.traded_at = trade.tradedAt;

  const { data, error } = await supabase.from('trades').update(row).eq('id', id).select().single();
  if (error) {
    console.error('Error updating trade:', error);
    return null;
  }
  return mapTradeRow(data);
};

export const deleteTrade = async (id: string): Promise<void> => {
  const { error } = await supabase.from('trades').delete().eq('id', id);
  if (error) console.error('Error deleting trade:', error);
};

export const clearAllTrades = async (
  instance: TradingInstance = 'live',
): Promise<void> => {
  const { error } = await supabase
    .from('trades')
    .delete()
    .eq('instance', instance)
    .gte('created_at', '1970-01-01');
  if (error) console.error('Error clearing all trades:', error);
};

// --- Asset Balances ---

export const loadAssetBalances = async (
  instance: TradingInstance = 'live',
): Promise<AssetBalance[]> => {
  const { data, error } = await supabase
    .from('asset_balances')
    .select('*')
    .eq('instance', instance)
    .order('asset');
  if (error) console.error('Error loading asset balances:', error);
  return (data ?? []).map(mapAssetBalanceRow);
};

export const upsertAssetBalance = async (
  balance: Omit<AssetBalance, 'id'>,
  instance: TradingInstance = 'live',
): Promise<AssetBalance | null> => {
  // Guard against NaN values that would violate NOT NULL constraints
  if (!Number.isFinite(balance.totalQuantity) || balance.totalQuantity <= 0) return null;

  const userId = await getCurrentUserId();
  const baseRow: Record<string, unknown> = {
    asset: balance.asset,
    total_quantity: balance.totalQuantity,
    avg_buy_price: balance.avgBuyPrice,
    total_cost: balance.totalCost,
    last_synced_at: balance.lastSyncedAt ?? null,
    account_type: balance.accountType,
    instance,
    user_id: userId,
  };

  // Include earnings if provided (column may not exist pre-migration)
  if (balance.earnings !== undefined) {
    baseRow.earnings = balance.earnings;
  }

  const { data, error } = await supabase
    .from('asset_balances')
    .upsert(baseRow, { onConflict: 'asset,user_id,instance,account_type' })
    .select()
    .single();

  // Fallback: retry without earnings if column doesn't exist yet
  if (error?.code === 'PGRST204' && error.message?.includes('earnings')) {
    delete baseRow.earnings;
    const { data: retryData, error: retryError } = await supabase
      .from('asset_balances')
      .upsert(baseRow, { onConflict: 'asset,user_id,instance,account_type' })
      .select()
      .single();

    if (retryError) {
      console.error('Error upserting asset balance:', retryError);
      return null;
    }
    return mapAssetBalanceRow(retryData);
  }

  if (error) {
    console.error('Error upserting asset balance:', error);
    return null;
  }
  return mapAssetBalanceRow(data);
};

export const clearAssetBalances = async (
  instance: TradingInstance = 'live',
): Promise<void> => {
  const { error } = await supabase
    .from('asset_balances')
    .delete()
    .eq('instance', instance)
    .not('asset', 'is', null);
  if (error) console.error('Error clearing asset balances:', error);
};

export const clearAssetBalancesByType = async (
  accountType: OkxAccountType,
  instance: TradingInstance = 'live',
): Promise<void> => {
  const { error } = await supabase
    .from('asset_balances')
    .delete()
    .eq('instance', instance)
    .eq('account_type', accountType)
    .not('asset', 'is', null);
  if (error) console.error('Error clearing asset balances by type:', error);
};

// --- Strategy Tags ---

export const loadStrategyTags = async (
  instance: TradingInstance = 'live',
): Promise<StrategyTag[]> => {
  const { data, error } = await supabase
    .from('strategy_tags')
    .select('*')
    .eq('instance', instance)
    .order('name');
  if (error) console.error('Error loading strategy tags:', error);
  return (data ?? []).map(mapStrategyTagRow);
};

export const saveStrategyTag = async (
  tag: Omit<StrategyTag, 'id'>,
  instance: TradingInstance = 'live',
): Promise<StrategyTag | null> => {
  const { data, error } = await supabase
    .from('strategy_tags')
    .insert({
      name: tag.name,
      color: tag.color,
      description: tag.description ?? null,
      instance,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving strategy tag:', error);
    return null;
  }
  return mapStrategyTagRow(data);
};

export const deleteStrategyTag = async (id: string): Promise<void> => {
  const { error } = await supabase.from('strategy_tags').delete().eq('id', id);
  if (error) console.error('Error deleting strategy tag:', error);
};

// --- Watchlist ---

export const loadWatchlist = async (
  instance: TradingInstance = 'live',
): Promise<WatchlistItem[]> => {
  const { data, error } = await supabase
    .from('watchlist')
    .select('*')
    .eq('instance', instance)
    .order('sort_order');
  if (error) console.error('Error loading watchlist:', error);
  return (data ?? []).map(mapWatchlistRow);
};

export const addToWatchlist = async (
  symbol: string,
  instance: TradingInstance = 'live',
): Promise<WatchlistItem | null> => {
  const { data, error } = await supabase
    .from('watchlist')
    .insert({ symbol, sort_order: 0, instance })
    .select()
    .single();

  if (error) {
    console.error('Error adding to watchlist:', error);
    return null;
  }
  return mapWatchlistRow(data);
};

export const removeFromWatchlist = async (id: string): Promise<void> => {
  const { error } = await supabase.from('watchlist').delete().eq('id', id);
  if (error) console.error('Error removing from watchlist:', error);
};

// --- Trading Goals ---

export const loadTradingGoals = async (
  instance: TradingInstance = 'live',
): Promise<TradingGoal[]> => {
  const { data, error } = await supabase
    .from('trading_goals')
    .select('*')
    .eq('instance', instance)
    .order('created_at', { ascending: false });

  if (error) console.error('Error loading trading goals:', error);
  return (data ?? []).map(mapTradingGoalRow);
};

export const saveTradingGoal = async (
  goal: Omit<TradingGoal, 'id'>,
  instance: TradingInstance = 'live',
): Promise<TradingGoal | null> => {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('trading_goals')
    .upsert(
      {
        period_type: goal.periodType,
        period_key: goal.periodKey,
        target_pnl: goal.targetPnl,
        max_trades: goal.maxTrades ?? null,
        max_capital: goal.maxCapital ?? null,
        instance,
        user_id: userId,
      },
      { onConflict: 'period_type,period_key,user_id,instance' },
    )
    .select()
    .single();

  if (error) {
    console.error('Error saving trading goal:', error);
    return null;
  }
  return mapTradingGoalRow(data);
};

// --- Trading Limits ---

interface SupabaseTradingLimitRow {
  id: string;
  period_type: string;
  max_trades: number | null;
  max_loss: number | null;
  max_capital: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function mapTradingLimitRow(row: SupabaseTradingLimitRow): TradingLimit {
  return {
    id: row.id,
    periodType: row.period_type as TradingLimit['periodType'],
    maxTrades: row.max_trades ?? undefined,
    maxLoss: row.max_loss != null ? Number(row.max_loss) : undefined,
    maxCapital: row.max_capital != null ? Number(row.max_capital) : undefined,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const loadTradingLimits = async (
  instance: TradingInstance = 'live',
): Promise<TradingLimit[]> => {
  const { data, error } = await supabase
    .from('trading_limits')
    .select('*')
    .eq('instance', instance)
    .order('period_type');
  if (error) console.error('Error loading trading limits:', error);
  return (data ?? []).map(mapTradingLimitRow);
};

export const saveTradingLimit = async (
  limit: Omit<TradingLimit, 'id' | 'createdAt' | 'updatedAt'>,
  instance: TradingInstance = 'live',
): Promise<TradingLimit | null> => {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('trading_limits')
    .upsert(
      {
        period_type: limit.periodType,
        max_trades: limit.maxTrades ?? null,
        max_loss: limit.maxLoss ?? null,
        max_capital: limit.maxCapital ?? null,
        is_active: limit.isActive,
        updated_at: new Date().toISOString(),
        instance,
        user_id: userId,
      },
      { onConflict: 'period_type,user_id,instance' },
    )
    .select()
    .single();

  if (error) {
    console.error('Error saving trading limit:', error);
    return null;
  }
  return mapTradingLimitRow(data);
};

export const deleteTradingLimit = async (id: string): Promise<void> => {
  const { error } = await supabase.from('trading_limits').delete().eq('id', id);
  if (error) console.error('Error deleting trading limit:', error);
};

