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
const FETCH_TIMEOUT_MS = 15000;
const memoryStorage = new Map<string, string>();

type SupabaseFetchDiagnostics = {
  timestamp: string;
  url: string;
  method: string;
  attempt: number;
  standalone: boolean;
  status?: number;
  ok?: boolean;
  errorName?: string;
  errorMessage?: string;
  credentials?: RequestCredentials;
  mode?: RequestMode;
};

let lastSupabaseFetchDiagnostics: SupabaseFetchDiagnostics | null = null;

const isStandaloneDisplay = () => {
  if (typeof window === 'undefined') return false;

  const standaloneMedia = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const navigatorStandalone =
    'standalone' in window.navigator &&
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

  return standaloneMedia || navigatorStandalone;
};

const getFetchUrl = (input: Parameters<typeof fetch>[0]) => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  return 'unknown';
};

export const getLastSupabaseFetchDiagnostics = () => lastSupabaseFetchDiagnostics;

const authStorage = {
  getItem: (key: string) => {
    try {
      return window.localStorage.getItem(key) ?? memoryStorage.get(key) ?? null;
    } catch {
      return memoryStorage.get(key) ?? null;
    }
  },
  setItem: (key: string, value: string) => {
    memoryStorage.set(key, value);
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // iOS private/PWA storage can be unavailable; memory keeps the current session alive.
    }
  },
  removeItem: (key: string) => {
    memoryStorage.delete(key);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore unavailable storage.
    }
  },
};

const resilientFetch: typeof fetch = async (input, init) => {
  // Extrai o método HTTP corretamente, tratando o caso em que input é uma instância de Request
  const requestMethod = (
    init?.method ??
    (input instanceof Request ? input.method : null) ??
    'GET'
  ).toUpperCase();
  const requestUrl = getFetchUrl(input);

  const maxAttempts = requestMethod === 'GET' || requestMethod === 'HEAD' ? 3 : 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const abortFromParent = () => controller.abort();

    try {
      if (init?.signal) {
        if (init.signal.aborted) {
          controller.abort();
        } else {
          init.signal.addEventListener('abort', abortFromParent, { once: true });
        }
      }

      let req: Request | string;
      let options: RequestInit = { ...init };

      if (input instanceof Request) {
        req = input.clone();
      } else {
        req = input;
      }

      if (!options.signal) {
        options.signal = controller.signal;
      }

      const response = await fetch(req, options);

      if (/\.supabase\.co\//i.test(requestUrl)) {
        lastSupabaseFetchDiagnostics = {
          timestamp: new Date().toISOString(),
          url: requestUrl,
          method: requestMethod,
          attempt,
          standalone: isStandaloneDisplay(),
          status: response.status,
          ok: response.ok,
          credentials: options.credentials ?? (input instanceof Request ? input.credentials : undefined),
          mode: options.mode ?? (input instanceof Request ? input.mode : undefined),
        };

        if (!response.ok) {
          console.warn('[auth-mobile] supabase-fetch:http-error', lastSupabaseFetchDiagnostics);
        }
      }

      return response;
    } catch (error) {
      if (/\.supabase\.co\//i.test(requestUrl)) {
        lastSupabaseFetchDiagnostics = {
          timestamp: new Date().toISOString(),
          url: requestUrl,
          method: requestMethod,
          attempt,
          standalone: isStandaloneDisplay(),
          errorName: error instanceof Error ? error.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          credentials: init?.credentials ?? (input instanceof Request ? input.credentials : undefined),
          mode: init?.mode ?? (input instanceof Request ? input.mode : undefined),
        };
        console.error('[auth-mobile] supabase-fetch:network-error', lastSupabaseFetchDiagnostics);
      }

      lastError =
        error instanceof DOMException && error.name === 'AbortError'
          ? new Error('Tempo esgotado ao comunicar com o Supabase.')
          : error;

      if (attempt === maxAttempts) {
        throw lastError;
      }

      await wait(250 * attempt);
    } finally {
      clearTimeout(timeout);
      init?.signal?.removeEventListener('abort', abortFromParent);
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
      detectSessionInUrl: true,
      storage: authStorage,
    },
  }
);
