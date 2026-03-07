import React, { useState, useRef, useEffect } from 'react';
import { Account, Transaction, Category } from '@/types';
import { askFinancialAdvisor } from '@/services/gemini';
import { Send, Bot, User, Loader2 } from 'lucide-react';

interface FinancialAdvisorProps {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const FinancialAdvisor: React.FC<FinancialAdvisorProps> = ({
  accounts,
  transactions,
  categories,
  isOpen,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Hello! I am your AI Financial Advisor. Ask me anything about your budget, savings, or spending habits.',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!query.trim()) return;

    const userMsg = query;
    setQuery('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    const response = await askFinancialAdvisor(userMsg, accounts, transactions, categories);

    setLoading(false);
    setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-[var(--bg-secondary)] shadow-2xl z-50 flex flex-col border-l border-[var(--border-default)] animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-subtle)] flex justify-between items-center bg-indigo-600 text-white">
        <div className="flex items-center gap-2">
          <Bot size={20} />
          <h3 className="font-semibold">AI Advisor</h3>
        </div>
        <button onClick={onClose} className="hover:bg-indigo-700 p-1 rounded transition-colors">
          Close
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--bg-tertiary)]">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'user'
                  ? 'bg-[var(--accent-primary-light)] text-[var(--accent-primary)]'
                  : 'bg-[var(--accent-success-light)] text-[var(--accent-success)]'
              }`}
            >
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div
              className={`p-3 rounded-lg text-sm max-w-[80%] ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-none'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm border border-[var(--border-default)] rounded-tl-none'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--accent-success-light)] text-[var(--accent-success)] flex items-center justify-center shrink-0">
              <Bot size={16} />
            </div>
            <div className="bg-[var(--bg-secondary)] p-3 rounded-lg border border-[var(--border-default)] shadow-sm rounded-tl-none flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-[var(--accent-primary)]" />
              <span className="text-xs text-[var(--text-secondary)]">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about your finances..."
            className="flex-1 px-4 py-2 border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-lg focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--accent-primary)] outline-none text-sm"
          />
          <button
            onClick={handleSend}
            disabled={loading || !query.trim()}
            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-2 text-center">
          Powered by Gemini 3 Pro. AI can make mistakes.
        </p>
      </div>
    </div>
  );
};
