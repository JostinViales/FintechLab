import { GoogleGenAI } from "@google/genai";
import { Account, Transaction, Category, TransactionType } from '../types';

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY not found in environment variables.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const askFinancialAdvisor = async (
  query: string,
  accounts: Account[],
  transactions: Transaction[],
  categories: Category[]
): Promise<string> => {
  const client = getClient();
  if (!client) return "Please configure your API Key to use the AI Advisor.";

  const now = new Date();
  
  // 1. Calculate Financial Summary
  const netWorth = accounts.reduce((sum, a) => sum + a.balance, 0);
  
  // Calculate current month's income and expenses
  const currentMonthPrefix = now.toISOString().slice(0, 7); // YYYY-MM
  const currentMonthTxs = transactions.filter(t => t.date.startsWith(currentMonthPrefix));
  const income = currentMonthTxs
    .filter(t => t.type === TransactionType.INCOME)
    .reduce((sum, t) => sum + t.amount, 0);
  const expenses = currentMonthTxs
    .filter(t => t.type === TransactionType.EXPENSE)
    .reduce((sum, t) => sum + t.amount, 0);

  // 2. Prepare Data Context Strings
  const accountsContext = accounts
    .map(a => `- ${a.name} (${a.type}): $${a.balance.toFixed(2)}`)
    .join('\n');

  const budgetsContext = categories
    .map(c => `- ${c.name}: $${c.yearlyBudget.toLocaleString()}/year`)
    .join('\n');

  // Limit transactions to last 50 for token efficiency, sorted by date desc
  const transactionsContext = transactions
    .slice(0, 50)
    .map(t => `- ${t.date}: ${t.description} ($${t.amount.toFixed(2)}) [${t.type}] - Cat: ${t.category}`)
    .join('\n');

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3-pro-preview', // Upgraded to 3-Pro for complex reasoning
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
        thinkingConfig: { thinkingBudget: 2048 }, // Enable thinking for deeper analysis
      }
    });

    return response.text || "I couldn't generate a response at this time.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I encountered an error while analyzing your finances. Please try again.";
  }
};