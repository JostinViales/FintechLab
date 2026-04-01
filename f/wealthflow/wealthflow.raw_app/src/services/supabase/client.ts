import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;
let _userId: string = 'default-user';

export function initSupabase(url: string, key: string, userId: string): void {
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  _userId = userId;
}

export function getSupabaseUserId(): string {
  return _userId;
}

function getClient(): SupabaseClient {
  if (!_client) {
    throw new Error('Supabase not initialized. Call initSupabase() first.');
  }
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    const client = getClient();
    const value = client[prop as keyof SupabaseClient];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
