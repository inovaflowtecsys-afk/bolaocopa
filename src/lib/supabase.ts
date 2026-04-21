import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL      as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const looksLikePlaceholder = (value?: string) => {
  if (!value) return true;

  return [
    'SEU_PROJETO',
    'eyJ...',
    'your-project',
    'your-anon-key',
  ].some(placeholder => value.includes(placeholder));
};

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !looksLikePlaceholder(supabaseUrl) &&
  !looksLikePlaceholder(supabaseAnonKey)
);

export const supabaseConfigError = isSupabaseConfigured
  ? null
  : 'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY com valores reais no arquivo .env.local.';

if (!isSupabaseConfigured) {
  console.warn(supabaseConfigError);
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const resilientFetch: typeof fetch = async (input, init) => {
  const method = (init?.method ?? 'GET').toUpperCase();
  const maxAttempts = method === 'GET' || method === 'HEAD' ? 3 : 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        throw error;
      }

      await wait(250 * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Falha de rede ao comunicar com o Supabase.');
};

export const supabase = createClient(
  supabaseUrl || 'https://invalid.local',
  supabaseAnonKey || 'invalid-anon-key',
  {
    global: {
      fetch: resilientFetch,
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
