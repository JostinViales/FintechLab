import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const WHITELISTED_ENDPOINTS = new Set([
  '/api/v5/trade/fills-history',
  '/api/v5/account/balance',
  '/api/v5/market/ticker',
  '/api/v5/market/tickers',
]);

const OKX_BASE_URL = 'https://www.okx.com';

interface ProxyRequestBody {
  endpoint: string;
  method: 'GET' | 'POST';
  params?: Record<string, string>;
  action?: string;
  apiKey?: string;
  secretKey?: string;
  passphrase?: string;
  demo?: boolean;
}

interface VaultSecret {
  name: string;
  decrypted_secret: string;
}

async function hmacSign(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function getVaultSecrets(
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<{ apiKey: string; secretKey: string; passphrase: string } | null> {
  const { data, error } = await supabaseAdmin
    .from('vault.decrypted_secrets')
    .select('name, decrypted_secret')
    .in('name', ['okx_api_key', 'okx_secret_key', 'okx_passphrase']);

  if (error || !data || data.length < 3) {
    return null;
  }

  const secrets = (data as VaultSecret[]).reduce(
    (acc: Record<string, string>, s) => {
      acc[s.name] = s.decrypted_secret;
      return acc;
    },
    {} as Record<string, string>,
  );

  if (!secrets['okx_api_key'] || !secrets['okx_secret_key'] || !secrets['okx_passphrase']) {
    return null;
  }

  return {
    apiKey: secrets['okx_api_key'],
    secretKey: secrets['okx_secret_key'],
    passphrase: secrets['okx_passphrase'],
  };
}

async function handleStoreCredentials(
  supabaseAdmin: ReturnType<typeof createClient>,
  body: ProxyRequestBody,
): Promise<Response> {
  const { apiKey, secretKey, passphrase } = body;
  if (!apiKey || !secretKey || !passphrase) {
    return new Response(
      JSON.stringify({ error: 'apiKey, secretKey, and passphrase are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const secrets = [
    { name: 'okx_api_key', secret: apiKey },
    { name: 'okx_secret_key', secret: secretKey },
    { name: 'okx_passphrase', secret: passphrase },
  ];

  for (const { name, secret } of secrets) {
    // Try to update existing secret first, then insert if not found
    const { data: existing } = await supabaseAdmin
      .from('vault.decrypted_secrets')
      .select('id')
      .eq('name', name)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin.rpc('vault.update_secret', {
        secret_id: existing.id,
        new_secret: secret,
      });
      if (error) {
        return new Response(
          JSON.stringify({ error: `Failed to update secret ${name}: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    } else {
      const { error } = await supabaseAdmin.rpc('vault.create_secret', {
        new_secret: secret,
        new_name: name,
      });
      if (error) {
        return new Response(
          JSON.stringify({ error: `Failed to store secret ${name}: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleProxyRequest(
  supabaseAdmin: ReturnType<typeof createClient>,
  body: ProxyRequestBody,
): Promise<Response> {
  const { endpoint, method, params, demo } = body;

  if (!endpoint || !method) {
    return new Response(JSON.stringify({ error: 'endpoint and method are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!WHITELISTED_ENDPOINTS.has(endpoint)) {
    return new Response(JSON.stringify({ error: 'Endpoint not allowed' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const credentials = await getVaultSecrets(supabaseAdmin);
  if (!credentials) {
    return new Response(
      JSON.stringify({ error: 'OKX credentials not configured. Add your API keys in Settings.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Build request path with query params
  let requestPath = endpoint;
  if (params && Object.keys(params).length > 0) {
    const qs = new URLSearchParams(params).toString();
    requestPath = `${endpoint}?${qs}`;
  }

  // OKX V5 signing
  const timestamp = new Date().toISOString();
  const prehash = timestamp + method.toUpperCase() + requestPath;
  const signature = await hmacSign(credentials.secretKey, prehash);

  const headers: Record<string, string> = {
    'OK-ACCESS-KEY': credentials.apiKey,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': credentials.passphrase,
    'Content-Type': 'application/json',
  };

  if (demo) {
    headers['x-simulated-trading'] = '1';
  }

  const url = `${OKX_BASE_URL}${requestPath}`;

  const okxResponse = await fetch(url, {
    method: method.toUpperCase(),
    headers,
  });

  const responseData = await okxResponse.json();

  return new Response(JSON.stringify({ data: responseData }), {
    status: okxResponse.ok ? 200 : okxResponse.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify JWT from Authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Create admin client (for Vault access)
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // Verify the user's JWT
  const token = authHeader.replace('Bearer ', '');
  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );

  const {
    data: { user },
    error: authError,
  } = await supabaseUser.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body: ProxyRequestBody = await req.json();

  if (body.action === 'store-credentials') {
    return handleStoreCredentials(supabaseAdmin, body);
  }

  return handleProxyRequest(supabaseAdmin, body);
});
