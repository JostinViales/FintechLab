import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]!;
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

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
  cors: Record<string, string>,
): Promise<Response> {
  const { apiKey, secretKey, passphrase } = body;
  if (!apiKey || !secretKey || !passphrase) {
    return new Response(
      JSON.stringify({ error: 'apiKey, secretKey, and passphrase are required' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }

  // Upsert: delete user's existing credentials (RLS scopes to current user), then insert
  await db.from('okx_credentials').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const { error } = await db.from('okx_credentials').insert({
    api_key: apiKey,
    secret_key: secretKey,
    passphrase: passphrase,
  });

  if (error) {
    return new Response(
      JSON.stringify({ error: `Failed to store credentials: ${error.message}` }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

async function handleProxyRequest(
  db: ReturnType<typeof createClient>,
  body: ProxyRequestBody,
  cors: Record<string, string>,
): Promise<Response> {
  const { endpoint, method, params, demo } = body;

  if (!endpoint || !method) {
    return new Response(JSON.stringify({ error: 'endpoint and method are required' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  if (!WHITELISTED_ENDPOINTS.has(endpoint)) {
    return new Response(JSON.stringify({ error: 'Endpoint not allowed' }), {
      status: 403,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const credentials = await getCredentials(db);
  if (!credentials) {
    return new Response(
      JSON.stringify({ error: 'OKX credentials not configured. Add your API keys in Settings.' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
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
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

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

  // Authenticate user via JWT — scopes credential access to this user
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );

  // Verify the user is authenticated
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body: ProxyRequestBody = await req.json();

  if (body.action === 'store-credentials') {
    return handleStoreCredentials(db, body, corsHeaders);
  }

  return handleProxyRequest(db, body, corsHeaders);
});
