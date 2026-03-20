import React, { useState } from 'react';
import { Wifi, WifiOff, Eye, EyeOff, RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import {
  testConnection,
  storeCredentials,
  syncTradesFromOkx,
  syncBalancesFromOkx,
} from '@/services/okx/client';
import { useTradingInstance } from '@/hooks/useTradingInstance';
import type { OkxSyncResult } from '@/types/okx';

interface OkxConnectionSettingsProps {
  onSyncComplete: () => void;
}

type ConnectionStatus = 'unknown' | 'testing' | 'connected' | 'error';
type SyncStatus = 'idle' | 'syncing' | 'done' | 'error';

export const OkxConnectionSettings: React.FC<OkxConnectionSettingsProps> = ({ onSyncComplete }) => {
  const { instance, isDemo } = useTradingInstance();

  // Credential inputs
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);

  // Status
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [savingKeys, setSavingKeys] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Sync
  const [tradeSyncStatus, setTradeSyncStatus] = useState<SyncStatus>('idle');
  const [balanceSyncStatus, setBalanceSyncStatus] = useState<SyncStatus>('idle');
  const [syncResult, setSyncResult] = useState<OkxSyncResult | null>(null);

  const handleSaveCredentials = async () => {
    if (!apiKey.trim() || !secretKey.trim() || !passphrase.trim()) {
      setSaveMessage('All three fields are required.');
      return;
    }

    setSavingKeys(true);
    setSaveMessage('');

    const success = await storeCredentials(apiKey, secretKey, passphrase, isDemo);

    if (success) {
      setSaveMessage('Credentials saved to Vault.');
      setApiKey('');
      setSecretKey('');
      setPassphrase('');
    } else {
      setSaveMessage('Failed to save credentials. Check console for details.');
    }

    setSavingKeys(false);
  };

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    const success = await testConnection();
    setConnectionStatus(success ? 'connected' : 'error');
  };

  const handleSyncTrades = async () => {
    setTradeSyncStatus('syncing');
    setSyncResult(null);

    const result = await syncTradesFromOkx(instance);
    setSyncResult(result);
    setTradeSyncStatus(result.errors.length > 0 ? 'error' : 'done');
    onSyncComplete();
  };

  const handleSyncBalances = async () => {
    setBalanceSyncStatus('syncing');
    const success = await syncBalancesFromOkx(instance);
    setBalanceSyncStatus(success ? 'done' : 'error');
    if (success) onSyncComplete();
  };

  const instanceLabel = isDemo ? 'Demo' : 'Live';
  const instanceColor = isDemo ? 'amber' : 'emerald';

  return (
    <div className="space-y-6">
      {/* Instance Badge */}
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-${instanceColor}-500/10 border border-${instanceColor}-500/20`}>
        <span className={`w-2 h-2 rounded-full bg-${instanceColor}-500`} />
        <span className={`text-xs font-semibold text-${instanceColor}-500`}>
          Configuring: {instanceLabel}
        </span>
      </div>

      {/* Connection Status */}
      <Card title="OKX Connection">
        <div className="flex items-center gap-3 mb-4">
          {connectionStatus === 'connected' ? (
            <>
              <Wifi size={18} className="text-emerald-500" />
              <span className="text-emerald-500 text-sm font-medium">Connected</span>
            </>
          ) : connectionStatus === 'error' ? (
            <>
              <WifiOff size={18} className="text-red-500" />
              <span className="text-red-500 text-sm font-medium">
                Connection failed. Check your credentials.
              </span>
            </>
          ) : connectionStatus === 'testing' ? (
            <>
              <Loader2 size={18} className="text-[var(--text-muted)] animate-spin" />
              <span className="text-[var(--text-muted)] text-sm">Testing connection...</span>
            </>
          ) : (
            <>
              <WifiOff size={18} className="text-[var(--text-muted)]" />
              <span className="text-[var(--text-muted)] text-sm">Not tested</span>
            </>
          )}
        </div>

        <button
          onClick={handleTestConnection}
          disabled={connectionStatus === 'testing'}
          className="px-4 py-2 text-sm rounded-lg border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50"
        >
          Test Connection
        </button>
      </Card>

      {/* API Key Setup */}
      <Card title="API Keys">
        <p className="text-xs text-[var(--text-muted)] mb-4">
          These credentials are for your <span className={`font-semibold text-${instanceColor}-500`}>{instanceLabel}</span> instance.
          Keys are stored server-side in encrypted Vault. They never touch the browser after setup.
        </p>

        <div className="space-y-3">
          {/* API Key */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              API Key
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter API key"
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-3 py-2 pr-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Secret Key */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Secret Key
            </label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="Enter secret key"
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-3 py-2 pr-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Passphrase */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Passphrase
            </label>
            <div className="relative">
              <input
                type={showPassphrase ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter passphrase"
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-3 py-2 pr-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              />
              <button
                type="button"
                onClick={() => setShowPassphrase(!showPassphrase)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                {showPassphrase ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSaveCredentials}
              disabled={savingKeys || !apiKey.trim() || !secretKey.trim() || !passphrase.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingKeys && <Loader2 size={14} className="animate-spin" />}
              Save to Vault
            </button>
            {saveMessage && (
              <span
                className={`text-xs ${saveMessage.includes('saved') ? 'text-emerald-500' : 'text-red-500'}`}
              >
                {saveMessage}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Sync Controls */}
      <Card title="Data Sync">
        <div className="space-y-4">
          {/* Sync Trades */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncTrades}
              disabled={tradeSyncStatus === 'syncing'}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50"
            >
              {tradeSyncStatus === 'syncing' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              Sync Trades
            </button>
            {tradeSyncStatus === 'done' && syncResult && (
              <div className="flex items-center gap-1.5 text-xs">
                <CheckCircle size={14} className="text-emerald-500" />
                <span className="text-emerald-500">
                  Imported {syncResult.imported}, skipped {syncResult.skipped} duplicates
                </span>
              </div>
            )}
            {tradeSyncStatus === 'error' && syncResult && (
              <div className="flex items-center gap-1.5 text-xs">
                <AlertCircle size={14} className="text-amber-500" />
                <span className="text-amber-500">
                  Imported {syncResult.imported}, {syncResult.errors.length} error(s)
                </span>
              </div>
            )}
          </div>

          {/* Sync Error Details */}
          {syncResult && syncResult.errors.length > 0 && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-xs font-medium text-red-500 mb-1">Sync Errors:</p>
              <ul className="text-xs text-red-400 space-y-0.5">
                {syncResult.errors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {syncResult.errors.length > 5 && (
                  <li>... and {syncResult.errors.length - 5} more</li>
                )}
              </ul>
            </div>
          )}

          {/* Sync Balances */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncBalances}
              disabled={balanceSyncStatus === 'syncing'}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50"
            >
              {balanceSyncStatus === 'syncing' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              Sync Balances
            </button>
            {balanceSyncStatus === 'done' && (
              <div className="flex items-center gap-1.5 text-xs">
                <CheckCircle size={14} className="text-emerald-500" />
                <span className="text-emerald-500">Balances synced (Trading + Funding + Earn)</span>
              </div>
            )}
            {balanceSyncStatus === 'error' && (
              <div className="flex items-center gap-1.5 text-xs">
                <AlertCircle size={14} className="text-red-500" />
                <span className="text-red-500">Sync failed. Check credentials.</span>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
