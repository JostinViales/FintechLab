import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const WHITELISTED_ENDPOINTS = new Set([
  '/api/v5/trade/fills-history',
  '/api/v5/trade/fills',
  '/api/v5/trade/orders-history-archive',
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

async function getCredentials(
  db: ReturnType<typeof createClient>,
): Promise<{ apiKey: string; secretKey: string; passphrase: string } | null> {
  const { data, error } = await db
    .from('okx_credentials')
    .select('api_key, secret_key, passphrase')
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    apiKey: data.api_key,
    secretKey: data.secret_key,
    passphrase: data.passphrase,
  };
}

async function handleStoreCredentials(
  db: ReturnType<typeof createClient>,
  body: ProxyRequestBody,
): Promise<Response> {
  const { apiKey, secretKey, passphrase } = body;
  if (!apiKey || !secretKey || !passphrase) {
    return new Response(
      JSON.stringify({ error: 'apiKey, secretKey, and passphrase are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Upsert: delete existing row then insert new one
  await db.from('okx_credentials').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const { error } = await db.from('okx_credentials').insert({
    api_key: apiKey,
    secret_key: secretKey,
    passphrase: passphrase,
  });

  if (error) {
    return new Response(
      JSON.stringify({ error: `Failed to store credentials: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleProxyRequest(
  db: ReturnType<typeof createClient>,
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

  const credentials = await getCredentials(db);
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

  // Always return 200 from our proxy — OKX error details are in responseData.code/msg
  return new Response(JSON.stringify({ data: responseData }), {
    status: 200,
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

  // Service role client — bypasses RLS
  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const body: ProxyRequestBody = await req.json();

  if (body.action === 'store-credentials') {
    return handleStoreCredentials(db, body);
  }

  return handleProxyRequest(db, body);
});
