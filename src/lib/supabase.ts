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

export const supabase = createClient(
  supabaseUrl || 'https://invalid.local',
  supabaseAnonKey || 'invalid-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
