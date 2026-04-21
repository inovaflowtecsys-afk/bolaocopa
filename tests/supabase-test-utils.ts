import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar definidos para os testes E2E.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function buildUniqueCredentials(prefix: string) {
  const unique = Date.now();

  return {
    name: `Playwright ${prefix}`,
    email: `playwright-${prefix.toLowerCase()}-${unique}@example.com`,
    password: 'password123',
    champion: 'Brasil',
  };
}

export async function createUserThroughApi(prefix: string) {
  const credentials = buildUniqueCredentials(prefix);

  const { data, error } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      data: {
        name: credentials.name,
        photo_url: '',
        champion_prediction: credentials.champion,
      },
    },
  });

  if (error) {
    throw new Error(`Falha ao criar usuário de teste: ${error.message}`);
  }

  const userId = data.user?.id;
  if (!userId) {
    throw new Error('Supabase não retornou o ID do usuário de teste.');
  }

  for (let attempt = 1; attempt <= 5; attempt++) {
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (profile) {
      return credentials;
    }

    if (profileError) {
      throw new Error(`Falha ao validar perfil do usuário de teste: ${profileError.message}`);
    }

    await wait(400 * attempt);
  }

  throw new Error('Perfil do usuário de teste não apareceu na tabela users.');
}
