import React, { createContext, useContext, useState, useCallback } from 'react';
import type { TradingInstance } from '@/types';
import { setDemoMode } from '@/services/okx/client';
import { okxWebSocket } from '@/services/okx/websocket';

const STORAGE_KEY = 'wealthflow:trading-instance';

interface TradingInstanceContextValue {
  instance: TradingInstance;
  setInstance: (instance: TradingInstance) => void;
  isDemo: boolean;
}

const TradingInstanceContext = createContext<TradingInstanceContextValue | null>(null);

function getInitialInstance(): TradingInstance {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'live' || stored === 'demo') return stored;
  return 'live';
}

export const TradingInstanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [instance, setInstanceState] = useState<TradingInstance>(getInitialInstance);

  const setInstance = useCallback((next: TradingInstance) => {
    setInstanceState(next);
    localStorage.setItem(STORAGE_KEY, next);
    const isDemo = next === 'demo';
    setDemoMode(isDemo);
    okxWebSocket.setDemoMode(isDemo);
  }, []);

  // Sync OKX client on mount
  React.useEffect(() => {
    const isDemo = instance === 'demo';
    setDemoMode(isDemo);
    okxWebSocket.setDemoMode(isDemo);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const value: TradingInstanceContextValue = {
    instance,
    setInstance,
    isDemo: instance === 'demo',
  };

  return React.createElement(TradingInstanceContext.Provider, { value }, children);
};

export function useTradingInstance(): TradingInstanceContextValue {
  const ctx = useContext(TradingInstanceContext);
  if (!ctx) {
    throw new Error('useTradingInstance must be used within TradingInstanceProvider');
  }
  return ctx;
}
