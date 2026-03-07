import { GoogleGenAI } from '@google/genai';
import { Account, Transaction, Category, TransactionType } from '@/types';
import type {
  Trade,
  AssetBalance,
  TradingStats,
  TradeSignalAnalysis,
  RiskAssessment,
  JournalSummary,
  RebalancingSuggestion,
} from '@/types';

const getClient = (): GoogleGenAI | null => {
  const apiKey =
    import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('Gemini API key not found in environment variables.');
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const askFinancialAdvisor = async (
  query: string,
  accounts: Account[],
  transactions: Transaction[],
  categories: Category[],
): Promise<string> => {
  const client = getClient();
  if (!client) return 'Please configure your API Key to use the AI Advisor.';

  const now = new Date();

  // 1. Calculate Financial Summary
  const netWorth = accounts.reduce((sum, a) => sum + a.balance, 0);

  // Calculate current month's income and expenses
  const currentMonthPrefix = now.toISOString().slice(0, 7); // YYYY-MM
  const currentMonthTxs = transactions.filter((t) => t.date.startsWith(currentMonthPrefix));
  const income = currentMonthTxs
    .filter((t) => t.type === TransactionType.INCOME)
    .reduce((sum, t) => sum + t.amount, 0);
  const expenses = currentMonthTxs
    .filter((t) => t.type === TransactionType.EXPENSE)
    .reduce((sum, t) => sum + t.amount, 0);

  // 2. Prepare Data Context Strings
  const accountsContext = accounts
    .map((a) => `- ${a.name} (${a.type}): $${a.balance.toFixed(2)}`)
    .join('\n');

  const budgetsContext = categories
    .map((c) => `- ${c.name}: $${(c.defaultMonthlyBudget * 12).toLocaleString()}/year`)
    .join('\n');

  // Limit transactions to last 50 for token efficiency, sorted by date desc
  const transactionsContext = transactions
    .slice(0, 50)
    .map(
      (t) =>
        `- ${t.date}: ${t.description} ($${t.amount.toFixed(2)}) [${t.type}] - Cat: ${t.category}`,
    )
    .join('\n');

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `
        You are a highly intelligent and capable financial advisor for the "WealthFlow" application.
        Your goal is to provide accurate, data-driven, and actionable financial advice based on the user's actual data.

        **User's Financial Snapshot:**
        - Current Date: ${now.toLocaleDateString()}
        - Net Worth: $${netWorth.toLocaleString()}
        - Current Month Income: $${income.toLocaleString()}
        - Current Month Expenses: $${expenses.toLocaleString()}

        **Accounts:**
        ${accountsContext}

        **Yearly Category Budgets:**
        ${budgetsContext}

        **Recent Transactions (Last 50):**
        ${transactionsContext}

        **User Query:** "${query}"

        **Instructions:**
        1. Analyze the provided data to answer the user's specific question.
        2. If asking about spending habits, identify patterns in the transaction history.
        3. If asking about budget, compare recent spending against the yearly budget limits (considering the current time of year).
        4. Be specific: Cite specific transaction amounts, dates, or account names to ground your advice in reality.
        5. Provide concrete, actionable steps they can take to improve their financial health.
        6. If the user has high-interest debt (Credit Card/Loan), prioritize advice on paying that down.
        7. Keep the tone professional, encouraging, and objective.
      `,
      config: {
        thinkingConfig: { thinkingBudget: 2048 },
      },
    });

    return response.text ?? "I couldn't generate a response at this time.";
  } catch (error) {
    console.error('Gemini API Error:', error);
    return 'Sorry, I encountered an error while analyzing your finances. Please try again.';
  }
};

// --- Trading AI Functions (Phase 4) ---

export const analyzeTradeSignals = async (
  symbol: string,
  recentTrades: Trade[],
  assetBalances: AssetBalance[],
): Promise<TradeSignalAnalysis> => {
  const fallback: TradeSignalAnalysis = {
    summary: 'Unable to analyze trade signals.',
    sentiment: 'neutral',
    keyLevels: [],
    confidence: 'low',
    reasoning: 'Analysis unavailable.',
  };

  const client = getClient();
  if (!client) {
    return { ...fallback, summary: 'Please configure your API Key to use AI trading analysis.' };
  }

  const symbolTrades = recentTrades.filter((t) => t.symbol === symbol).slice(0, 20);
  const position = assetBalances.find((a) => a.asset === symbol.split('-')[0]);

  const prompt = `
    You are an expert crypto trading analyst. Analyze the following trading data for ${symbol}
    and provide structured trade signals.

    **Current Position:**
    ${position ? `Holding ${position.totalQuantity} units, avg buy price $${position.avgBuyPrice.toFixed(2)}, total cost $${position.totalCost.toFixed(2)}` : 'No current position'}

    **Recent Trades (${symbol}):**
    ${symbolTrades.map((t) => `${t.tradedAt.slice(0, 16)} | ${t.side.toUpperCase()} | Price: $${t.price} | Qty: ${t.quantity} | P&L: ${t.realizedPnl != null ? `$${t.realizedPnl.toFixed(2)}` : 'N/A'}`).join('\n')}

    **Instructions:**
    Respond ONLY with a valid JSON object (no markdown, no code fences) matching this structure:
    {
      "summary": "Brief 1-2 sentence overview",
      "sentiment": "bullish" | "bearish" | "neutral",
      "keyLevels": [{"type": "support" | "resistance", "price": number, "note": "string"}],
      "entryZone": {"low": number, "high": number} | null,
      "stopLoss": number | null,
      "takeProfit": number | null,
      "confidence": "low" | "medium" | "high",
      "reasoning": "Detailed reasoning paragraph"
    }

    Base your analysis on the trade history patterns, not external data.
    If there's insufficient data, say so in the summary and use "low" confidence.
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 2048 } },
    });

    const text = response.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as TradeSignalAnalysis;
    }

    return { ...fallback, summary: text, reasoning: text };
  } catch (error) {
    console.error('Gemini trade signal error:', error);
    return { ...fallback, summary: 'Error analyzing trade signals. Please try again.' };
  }
};

export const assessPortfolioRisk = async (
  assetBalances: AssetBalance[],
  trades: Trade[],
  stats: TradingStats,
): Promise<RiskAssessment> => {
  const fallback: RiskAssessment = {
    overallRisk: 'medium',
    score: 50,
    factors: [],
    suggestions: ['Unable to assess risk. Please try again.'],
  };

  const client = getClient();
  if (!client) {
    return {
      ...fallback,
      suggestions: ['Please configure your API Key to use AI risk assessment.'],
    };
  }

  const totalCost = assetBalances.reduce((s, a) => s + a.totalCost, 0);
  const positions = assetBalances.map((a) => ({
    asset: a.asset,
    quantity: a.totalQuantity,
    avgPrice: a.avgBuyPrice,
    cost: a.totalCost,
    pct: totalCost > 0 ? ((a.totalCost / totalCost) * 100).toFixed(1) : '0',
  }));

  const prompt = `
    You are a crypto portfolio risk manager. Assess the risk of this trading portfolio.

    **Portfolio Positions:**
    ${positions.map((p) => `${p.asset}: ${p.quantity} units @ $${p.avgPrice.toFixed(2)} (${p.pct}% of portfolio, $${p.cost.toFixed(2)})`).join('\n')}

    **Trading Statistics:**
    - Total Trades: ${stats.totalTrades}
    - Win Rate: ${stats.winRate.toFixed(1)}%
    - Profit Factor: ${stats.profitFactor === Infinity ? 'Infinity' : stats.profitFactor.toFixed(2)}
    - Max Drawdown: ${stats.maxDrawdownPct.toFixed(1)}%
    - Sharpe Ratio: ${stats.sharpeRatio.toFixed(2)}
    - Largest Win: $${stats.largestWin.toFixed(2)}
    - Largest Loss: $${stats.largestLoss.toFixed(2)}
    - Recent Trades: ${trades.length}

    Respond ONLY with a valid JSON object (no markdown, no code fences):
    {
      "overallRisk": "low" | "medium" | "high" | "critical",
      "score": number (0-100, higher = more risky),
      "factors": [{"name": "string", "severity": "low" | "medium" | "high", "description": "string"}],
      "suggestions": ["string"]
    }

    Consider: concentration risk, drawdown levels, win rate trends, position sizing,
    correlation between held assets, and overall portfolio balance.
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 2048 } },
    });

    const text = response.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as RiskAssessment;
    }

    return fallback;
  } catch (error) {
    console.error('Gemini risk assessment error:', error);
    return fallback;
  }
};

export const summarizeTradeJournal = async (
  trades: Trade[],
  stats: TradingStats,
): Promise<JournalSummary> => {
  const fallback: JournalSummary = {
    overview: 'Unable to analyze trade journal.',
    patterns: [],
    strengths: [],
    weaknesses: [],
    recommendations: [],
  };

  const client = getClient();
  if (!client) {
    return { ...fallback, overview: 'Please configure your API Key to use AI journal analysis.' };
  }

  const recentTrades = trades.slice(0, 50);
  const strategyBreakdown = new Map<string, number>();
  for (const t of recentTrades) {
    const tag = t.strategyTag ?? 'Untagged';
    strategyBreakdown.set(tag, (strategyBreakdown.get(tag) ?? 0) + 1);
  }

  const prompt = `
    You are a trading psychology coach and journal analyst. Analyze the trading history
    and identify behavioral patterns, strengths, and areas for improvement.

    **Trading Statistics:**
    - Total Trades: ${stats.totalTrades}
    - Win Rate: ${stats.winRate.toFixed(1)}%
    - Avg Win: $${stats.avgWin.toFixed(2)} | Avg Loss: $${stats.avgLoss.toFixed(2)}
    - Profit Factor: ${stats.profitFactor === Infinity ? 'Infinity' : stats.profitFactor.toFixed(2)}
    - Largest Win: $${stats.largestWin.toFixed(2)} | Largest Loss: $${stats.largestLoss.toFixed(2)}
    - Max Drawdown: ${stats.maxDrawdownPct.toFixed(1)}%

    **Strategy Usage:**
    ${Array.from(strategyBreakdown.entries()).map(([s, c]) => `${s}: ${c} trades`).join('\n')}

    **Recent Trades (Last 50):**
    ${recentTrades.map((t) => `${t.tradedAt.slice(0, 16)} | ${t.side.toUpperCase()} ${t.symbol} | $${t.price} x ${t.quantity} | P&L: ${t.realizedPnl != null ? `$${t.realizedPnl.toFixed(2)}` : 'open'} | Strategy: ${t.strategyTag ?? 'none'} | Notes: ${t.notes ?? '-'}`).join('\n')}

    Respond ONLY with a valid JSON object (no markdown, no code fences):
    {
      "overview": "2-3 sentence summary of trading behavior",
      "patterns": [{"pattern": "name", "frequency": "how often", "impact": "positive/negative impact"}],
      "strengths": ["string"],
      "weaknesses": ["string"],
      "recommendations": ["specific actionable recommendation"]
    }

    Focus on: emotional patterns (revenge trading, FOMO), sizing consistency,
    strategy adherence, timing patterns, and risk management discipline.
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 2048 } },
    });

    const text = response.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as JournalSummary;
    }

    return { ...fallback, overview: text };
  } catch (error) {
    console.error('Gemini journal summary error:', error);
    return fallback;
  }
};

export const suggestRebalancing = async (
  assetBalances: AssetBalance[],
  totalPortfolioValue: number,
): Promise<RebalancingSuggestion[]> => {
  const client = getClient();
  if (!client) return [];

  const totalCost = assetBalances.reduce((s, a) => s + a.totalCost, 0);
  const positions = assetBalances.map((a) => ({
    asset: a.asset,
    cost: a.totalCost,
    pct: totalCost > 0 ? (a.totalCost / totalCost) * 100 : 0,
  }));

  const prompt = `
    You are a crypto portfolio strategist. Analyze the current portfolio allocation
    and suggest rebalancing actions for better diversification and risk management.

    **Current Portfolio ($${(totalPortfolioValue || totalCost).toFixed(2)} total):**
    ${positions.map((p) => `${p.asset}: $${p.cost.toFixed(2)} (${p.pct.toFixed(1)}%)`).join('\n')}

    Respond ONLY with a valid JSON array (no markdown, no code fences):
    [
      {
        "asset": "string",
        "currentPct": number,
        "targetPct": number,
        "action": "buy" | "sell" | "hold",
        "amount": number (USD value to buy/sell),
        "reasoning": "why this adjustment"
      }
    ]

    Guidelines:
    - Suggest a balanced allocation based on common crypto portfolio strategies
    - If heavily concentrated in one asset (>50%), suggest reducing
    - Consider adding stablecoin allocation if none exists
    - Keep suggestions practical (minimum $50 trades)
    - If portfolio is already well-balanced, use "hold" actions
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 2048 } },
    });

    const text = response.text ?? '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as RebalancingSuggestion[];
    }

    return [];
  } catch (error) {
    console.error('Gemini rebalancing error:', error);
    return [];
  }
};
