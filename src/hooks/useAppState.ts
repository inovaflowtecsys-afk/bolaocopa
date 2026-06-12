import { useState, useEffect, useRef } from 'react';
import { AppState, User, Match, Bet } from '../types';
import { calculatePoints } from '../constants';
import { toast } from 'sonner';
import { getLastSupabaseFetchDiagnostics, isSupabaseConfigured, supabase, supabaseConfigError } from '../lib/supabase';

// ============================================================
// Funções de mapeamento snake_case (Supabase) → camelCase (App)
// ============================================================

function mapUser(row: Record<string, any>): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    photoUrl: row.photo_url ?? '',
    championPrediction: row.champion_prediction ?? '',
    isPaid: row.is_paid ?? false,
    isAdmin: row.is_admin ?? false,
    senhaProvisoria: row.senha_provisoria ?? false,
    totalPoints: row.total_points ?? 0,
  };
}

function mapMatch(row: Record<string, any>): Match {
  return {
    id: row.id,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    group: row.group_name ?? row.group,
    date: row.date,
    status: row.status ?? 'scheduled',
    homeScore: row.home_score ?? undefined,
    awayScore: row.away_score ?? undefined,
    location: row.location ?? undefined,
    homeFlagUrl: row.home_flag_url ?? undefined,
    awayFlagUrl: row.away_flag_url ?? undefined,
  };
}

function mapBet(row: Record<string, any>): Bet {
  return {
    id: row.id,
    userId: row.user_id,
    matchId: row.match_id,
    homeScore: row.home_score,
    awayScore: row.away_score,
    pointsEarned: row.points_earned ?? undefined,
    isLocked: row.is_locked ?? false,
  };
}

const SUPABASE_PAGE_SIZE = 1000;
const SUPABASE_OPERATION_TIMEOUT_MS = 20000;

const authLog = (step: string, details?: Record<string, unknown>) => {
  console.info(`[auth-mobile] ${step}`, details ?? {});
};

const authErrorLog = (step: string, error: unknown, details?: Record<string, unknown>) => {
  console.error(`[auth-mobile] ${step}`, { error, ...(details ?? {}) });
};

const getErrorDiagnostics = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    };
  }

  if (typeof error === 'object' && error) {
    return error;
  }

  return { message: String(error) };
};

const isNetworkLikeAuthError = (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: unknown }).message)
        : String(error);

  return /failed to fetch|networkerror|load failed|tempo esgotado|abort|cors|preflight|network request failed|fetch/i.test(message);
};

const betLog = (step: string, details?: Record<string, unknown>) => {
  console.info(`[bet-mobile] ${step}`, details ?? {});
};

const betErrorLog = (step: string, error: unknown, details?: Record<string, unknown>) => {
  console.error(`[bet-mobile] ${step}`, { error, ...(details ?? {}) });
};

const clearLargeAccessibleCookies = () => {
  if (typeof document === 'undefined' || document.cookie.length < 6000) return;

  document.cookie.split(';').forEach(cookie => {
    const name = cookie.split('=')[0]?.trim();
    if (!name) return;

    document.cookie = `${name}=; Max-Age=0; path=/`;
  });
};

function withOperationTimeout<T>(
  operation: PromiseLike<T>,
  context: string,
  timeoutMs = SUPABASE_OPERATION_TIMEOUT_MS,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    Promise.resolve(operation),
    new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        reject(new Error(`Tempo esgotado ao ${context}.`));
      }, timeoutMs);
    }),
  ]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

async function fetchAllBetsRows() {
  const rows: Record<string, any>[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('bets')
      .select('*')
      .order('created_at', { ascending: true })
      .range(from, to);

    if (error) {
      return { data: rows, error };
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < SUPABASE_PAGE_SIZE) {
      return { data: rows, error: null };
    }
  }
}

// ============================================================

const initialState: AppState = {
  users: [],
  matches: [],
  bets: [],
  currentUser: null,
  settings: {
    betsLocked: false,
    entryFee: 50,
    year: '2026',
    logoUrl: 'https://thebrandinquirer.wordpress.com/wp-content/uploads/2023/05/cover-colors-fifa-unveils-official-logo-for-2026-world-cup-custom-cities.png?w=1024',
    prizes: {
      firstPlacePercent: 50,
      secondPlacePercent: 20,
      thirdPlacePercent: 10,
      championBonusPercent: 20,
    },
  },
};

function mapSettings(row: Record<string, any> | null | undefined, fallback = initialState.settings) {
  if (!row) return fallback;

  return {
    betsLocked: row.bets_locked ?? fallback.betsLocked,
    entryFee: Number(row.entry_fee ?? fallback.entryFee),
    year: row.year ?? fallback.year,
    logoUrl: row.logo_url ?? fallback.logoUrl,
    prizes: row.prizes ?? fallback.prizes,
  };
}

const SETTINGS_CACHE_KEY = 'bolao-settings-cache';
const MATCHES_CACHE_KEY = 'bolao-matches-cache';

function mapAuthUser(authUser: { id: string; email?: string; user_metadata?: Record<string, any> }): User {
  return {
    id: authUser.id,
    name: authUser.user_metadata?.name ?? authUser.email?.split('@')[0] ?? 'Participante',
    email: authUser.email ?? '',
    photoUrl: authUser.user_metadata?.photo_url ?? '',
    championPrediction: authUser.user_metadata?.champion_prediction ?? '',
    isPaid: false,
    isAdmin: false,
    senhaProvisoria: false,
    totalPoints: 0,
  };
}

export function useAppState() {
  const loadCachedSettings = () => {
    try {
      const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
      if (!raw) return initialState.settings;

      return mapSettings(JSON.parse(raw), initialState.settings);
    } catch {
      return initialState.settings;
    }
  };

  const loadCachedMatches = () => {
    try {
      const raw = localStorage.getItem(MATCHES_CACHE_KEY);
      if (!raw) return initialState.matches;

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(mapMatch) : initialState.matches;
    } catch {
      return initialState.matches;
    }
  };

  const [state, setState] = useState<AppState>({
    ...initialState,
    settings: loadCachedSettings(),
    matches: loadCachedMatches(),
  });
  const isHydrating = useRef(false);
  const pendingHydrateUserId = useRef<string | null | undefined>(undefined);
  const hydrateDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressAuthHydrationForUser = useRef<string | null>(null);

  const ensureSupabaseReady = (action: string, showToast = true) => {
    if (isSupabaseConfigured) {
      return true;
    }

    console.error(`Supabase não configurado ao tentar ${action}.`, supabaseConfigError);
    if (showToast) {
      toast.error(supabaseConfigError ?? 'Configure o Supabase antes de continuar.');
    }

    return false;
  };

  const fetchUserProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar perfil do usuário:', error);
      return null;
    }

    return data ? mapUser(data) : null;
  };

  const waitForUserProfile = async (userId: string, retries = 5, delayMs = 300) => {
    for (let attempt = 0; attempt < retries; attempt++) {
      const profile = await fetchUserProfile(userId);
      if (profile) {
        return profile;
      }

      if (attempt < retries - 1) {
        await new Promise(res => setTimeout(res, delayMs * (attempt + 1)));
      }
    }

    return null;
  };

  const getReadableSupabaseError = (error: unknown, fallback: string) => {
    const message =
      typeof error === 'string'
        ? error
        : error instanceof Error
          ? error.message
          : typeof error === 'object' && error && 'message' in error
            ? String((error as { message?: unknown }).message)
            : '';

    const normalizedMessage = message.toLowerCase();
    const isNetworkError =
      normalizedMessage.includes('failed to fetch') ||
      normalizedMessage.includes('networkerror') ||
      normalizedMessage.includes('err_connection') ||
      normalizedMessage.includes('http2') ||
      normalizedMessage.includes('fetch');

    if (isNetworkError) {
      return 'Não foi possível conectar ao Supabase agora. Verifique sua internet, VPN, firewall ou tente novamente em alguns segundos.';
    }

    return fallback;
  };

  const handleSupabaseError = (error: any, context: string) => {
    console.error(`Erro ao ${context}:`, error);
    toast.error(getReadableSupabaseError(error, `Erro ao ${context}. Verifique sua conexão ou firewall.`));
    return null;
  };

  const cacheSettings = (settings: AppState['settings']) => {
    try {
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
    } catch {
      // Ignora erro de cache para não interromper a tela.
    }
  };

  const cacheMatches = (matches: Match[]) => {
    try {
      const rows = matches.map(match => ({
        id: match.id,
        home_team: match.homeTeam,
        away_team: match.awayTeam,
        group_name: match.group,
        date: match.date,
        status: match.status,
        home_score: match.homeScore,
        away_score: match.awayScore,
        location: match.location,
        home_flag_url: match.homeFlagUrl,
        away_flag_url: match.awayFlagUrl,
      }));

      localStorage.setItem(MATCHES_CACHE_KEY, JSON.stringify(rows));
    } catch {
      // Ignora erro de cache para não interromper a tela.
    }
  };

  // Helper to retry supabase calls on network errors
  const withRetry = async <T>(fn: () => PromiseLike<T>, context: string, retries = 3, delayMs = 500): Promise<T | null> => {
    for (let attempt = 0; attempt < 2; attempt++) { // só 2 tentativas
      try {
        return await withOperationTimeout(fn(), context);
      } catch (err) {
        if (attempt === 1) {
          handleSupabaseError(err, context);
          return null;
        }
        // espera menor
        await new Promise(res => setTimeout(res, 100));
      }
    }
    return null;
  };

  const hydrateState = async (userId: string | null) => {
    authLog('hydrate:start', { hasUserId: Boolean(userId), alreadyHydrating: isHydrating.current });

    // Evita chamadas paralelas simultâneas
    if (isHydrating.current) {
      pendingHydrateUserId.current = userId;
      return;
    }
    isHydrating.current = true;
    pendingHydrateUserId.current = undefined;

    if (!ensureSupabaseReady('carregar dados', false)) {
      setState(prev => ({
        ...prev,
        users: [],
        matches: [],
        bets: [],
        currentUser: null,
      }));
      isHydrating.current = false;
      const queuedUserId = pendingHydrateUserId.current;
      if (queuedUserId !== undefined) {
        void hydrateState(queuedUserId);
      }
      return;
    }

    try {
      const [matchesRes, settingsRes] = await Promise.all([
        withRetry(async () => await supabase.from('matches').select('*').order('date', { ascending: true }), 'buscar partidas'),
        withRetry(async () => await supabase.from('settings').select('*').eq('id', 1).maybeSingle(), 'buscar configurações'),
      ]);

      const resolvedMatches = matchesRes
        ? (matchesRes.data ?? []).map(mapMatch)
        : state.matches;

      if (!matchesRes && resolvedMatches.length === 0) return;

      const resolvedSettings = settingsRes
        ? mapSettings(settingsRes.data, state.settings)
        : state.settings;

      if (matchesRes) {
        cacheMatches(resolvedMatches);
      } else {
        toast.error('Não foi possível atualizar os jogos agora. Usando a última lista salva localmente.');
      }

      if (settingsRes) {
        cacheSettings(resolvedSettings);
      } else {
        toast.error('Não foi possível atualizar as configurações agora. Usando os dados locais salvos.');
      }

      let currentUser: User | null = null;
      let users: User[] = [];
      let bets: Bet[] = [];

      if (userId) {
        currentUser = await withOperationTimeout(fetchUserProfile(userId), 'buscar perfil do usuario');

        if (!currentUser) {
          await supabase.auth.signOut();
          toast.error('Seu perfil não foi encontrado no banco. Execute o schema do Supabase antes de fazer login.');
        } else {
          const [usersRes, ownBetsRes, allBetsRes] = await withOperationTimeout(
            Promise.all([
              supabase.from('users').select('*').order('total_points', { ascending: false }),
              supabase.from('bets').select('*').eq('user_id', userId),
              currentUser.isAdmin ? fetchAllBetsRows() : Promise.resolve(null),
            ]),
            'carregar dados do usuario',
          );

          if (usersRes.error) throw usersRes.error;
          if (ownBetsRes.error) throw ownBetsRes.error;
          if (allBetsRes?.error) {
            console.error('Erro ao buscar todos os palpites do admin:', allBetsRes.error);
            toast.error('Nao foi possivel carregar todos os palpites. Seus palpites foram carregados.');
          }

          users = (usersRes.data ?? []).map(mapUser);
          const mergedBetsById = new Map<string, Record<string, any>>();
          for (const row of allBetsRes?.data ?? []) {
            mergedBetsById.set(row.id, row);
          }
          for (const row of ownBetsRes.data ?? []) {
            mergedBetsById.set(row.id, row);
          }
          bets = Array.from(mergedBetsById.values()).map(mapBet);
        }
      }

      setState(prev => ({
        ...prev,
        users,
        matches: resolvedMatches,
        bets,
        currentUser,
        settings: resolvedSettings,
      }));
      authLog('hydrate:success', {
        hasCurrentUser: Boolean(currentUser),
        usersCount: users.length,
        matchesCount: resolvedMatches.length,
        betsCount: bets.length,
      });
    } catch (error) {
      authErrorLog('hydrate:error', error);
      toast.error('Erro ao carregar dados do Supabase.');
    } finally {
      authLog('hydrate:finish');
      isHydrating.current = false;
      const queuedUserId = pendingHydrateUserId.current;
      if (queuedUserId !== undefined) {
        void hydrateState(queuedUserId);
      }
    }
  };

  const upsertSettings = async (patch: Record<string, any>, errorMessage: string) => {
    if (!ensureSupabaseReady('atualizar configurações')) return null;

    const payload = {
      id: 1,
      bets_locked: state.settings.betsLocked,
      entry_fee: state.settings.entryFee,
      year: state.settings.year,
      logo_url: state.settings.logoUrl,
      prizes: state.settings.prizes,
      ...patch,
    };

    const { data, error } = await supabase
      .from('settings')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      toast.error(`${errorMessage} | Detalhes: ${error.message}`);
      return null;
    }

    const mappedSettings = mapSettings(data, state.settings);
    cacheSettings(mappedSettings);
    setState(prev => ({ ...prev, settings: mappedSettings }));
    return mappedSettings;
  };

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      if (!ensureSupabaseReady('inicializar a aplicação', false)) {
        return;
      }

      authLog('bootstrap:get-session:start');
      const { data, error } = await withOperationTimeout(
        supabase.auth.getSession(),
        'recuperar sessao',
      );
      if (error) {
        console.error('Erro ao recuperar sessão:', error);
      }

      authLog('bootstrap:get-session:finish', {
        hasSession: Boolean(data.session),
        userId: data.session?.user?.id,
      });

      if (isMounted) {
        await hydrateState(data.session?.user?.id ?? null);
      }
    }

    void bootstrap();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      authLog('auth-state-change', {
        event,
        hasSession: Boolean(session),
        userId: session?.user?.id,
      });

      if (
        suppressAuthHydrationForUser.current &&
        session?.user?.id === suppressAuthHydrationForUser.current
      ) {
        return;
      }

      if (!session && suppressAuthHydrationForUser.current) {
        suppressAuthHydrationForUser.current = null;
      }

      // Debounce para evitar múltiplas chamadas simultâneas quando vários eventos
      // de auth disparam em sequência (ex: SIGNED_IN + TOKEN_REFRESHED + SIGNED_OUT)
      if (hydrateDebounceTimer.current) {
        clearTimeout(hydrateDebounceTimer.current);
      }
      hydrateDebounceTimer.current = setTimeout(() => {
        if (isMounted) {
          void hydrateState(session?.user?.id ?? null);
        }
      }, 300);
    });

    return () => {
      isMounted = false;
      if (hydrateDebounceTimer.current) {
        clearTimeout(hydrateDebounceTimer.current);
      }
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    if (!ensureSupabaseReady('fazer login')) return false;

    authLog('login:start', { email: email.trim() });
    let loginData: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['data'];

    try {
      const { data, error } = await withOperationTimeout(
        supabase.auth.signInWithPassword({ email: email.trim(), password }),
        'fazer login',
      );

      authLog('login:supabase-response', {
        hasUser: Boolean(data.user),
        hasSession: Boolean(data.session),
        userId: data.user?.id,
        error: error ? { message: error.message, status: error.status, code: error.code } : null,
        fetch: getLastSupabaseFetchDiagnostics(),
      });

      if (error) {
        authErrorLog('login:supabase-error', error, {
          email: email.trim(),
          fetch: getLastSupabaseFetchDiagnostics(),
        });
        toast.error('E-mail ou senha incorretos.');
        return false;
      }

      loginData = data;
    } catch (error) {
      const diagnostics = {
        error: getErrorDiagnostics(error),
        fetch: getLastSupabaseFetchDiagnostics(),
        standalone:
          typeof window !== 'undefined' &&
          (window.matchMedia?.('(display-mode: standalone)').matches ||
            ('standalone' in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        online: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
      };
      authErrorLog('login:unexpected-error', error, diagnostics);

      const userMessage = isNetworkLikeAuthError(error)
        ? 'Falha de rede/CORS ao comunicar com o Supabase. Abra o console do iOS Safari e procure por [auth-mobile] login:unexpected-error.'
        : error instanceof Error
          ? error.message
          : 'Não foi possível entrar agora. Verifique sua conexão e tente novamente.';

      toast.error(userMessage);
      throw new Error(userMessage, { cause: error });
    }

    // Busca perfil do usuário na tabela users
    const { data: userDb, error: userDbError } = await withOperationTimeout(
      supabase.from('users').select('*').eq('id', loginData.user.id).maybeSingle(),
      'buscar perfil do usuario',
    );
    authLog('login:profile-response', {
      hasProfile: Boolean(userDb),
      userId: loginData.user.id,
      error: userDbError ? { message: userDbError.message, code: userDbError.code } : null,
      fetch: getLastSupabaseFetchDiagnostics(),
    });
    if (userDbError || !userDb) {
      authErrorLog('login:profile-error', userDbError ?? new Error('Perfil nao encontrado'), {
        userId: loginData.user.id,
        fetch: getLastSupabaseFetchDiagnostics(),
      });
      toast.error('Usuário não encontrado no sistema. Contate o administrador.');
      await supabase.auth.signOut();
      return false;
    }

    authLog('login:session-created', {
      userId: loginData.user.id,
      expiresAt: loginData.session?.expires_at,
    });
    const loggedUser = mapUser(userDb);
    setState(prev => ({
      ...prev,
      currentUser: loggedUser,
      users: prev.users.some(user => user.id === loggedUser.id)
        ? prev.users.map(user => user.id === loggedUser.id ? loggedUser : user)
        : [loggedUser, ...prev.users],
    }));
    void withOperationTimeout(hydrateState(loginData.user.id), 'carregar dados do login')
      .then(() => authLog('login:hydrate-background:success', { userId: loginData.user.id }))
      .catch(error => authErrorLog('login:hydrate-background:error', error, { userId: loginData.user.id }));
    authLog('login:dashboard-ready', { userId: loginData.user.id });
    return true;
  };

  const logout = async () => {
    if (!ensureSupabaseReady('encerrar a sessão', false)) {
      setState(prev => ({ ...prev, currentUser: null }));
      return;
    }

    await supabase.auth.signOut();
    setState(prev => ({ ...prev, currentUser: null }));
  };

  const resetState = async () => {
    await hydrateState(state.currentUser?.id ?? null);
    toast.success('Dados recarregados com sucesso!');
  };

  const updateCurrentUserPhoto = async (photoUrl: string) => {
    if (!state.currentUser) {
      toast.error('Faça login para alterar sua foto.');
      return false;
    }

    if (!ensureSupabaseReady('alterar foto do usuário')) return false;

    const { error } = await supabase
      .from('users')
      .update({ photo_url: photoUrl })
      .eq('id', state.currentUser.id);

    if (error) {
      toast.error(`Erro ao alterar foto: ${error.message}`);
      return false;
    }

    const { error: authError } = await supabase.auth.updateUser({
      data: { photo_url: photoUrl },
    });

    if (authError) {
      console.warn('Não foi possível atualizar a foto no metadata do Auth:', authError);
    }

    setState(prev => ({
      ...prev,
      currentUser: prev.currentUser ? { ...prev.currentUser, photoUrl } : prev.currentUser,
      users: prev.users.map(user =>
        user.id === state.currentUser?.id ? { ...user, photoUrl } : user
      ),
    }));

    toast.success('Foto atualizada com sucesso!');
    return true;
  };

  const updateCurrentUserChampionPrediction = async (championPrediction: string) => {
    if (!state.currentUser) {
      toast.error('Faça login para alterar seu país campeão.');
      return false;
    }

    if (state.settings.betsLocked) {
      toast.error('A alteração do país campeão está bloqueada.');
      return false;
    }

    if (!ensureSupabaseReady('alterar país campeão')) return false;

    const { error } = await supabase
      .from('users')
      .update({ champion_prediction: championPrediction })
      .eq('id', state.currentUser.id);

    if (error) {
      toast.error(`Erro ao alterar país: ${error.message}`);
      return false;
    }

    const { error: authError } = await supabase.auth.updateUser({
      data: { champion_prediction: championPrediction },
    });

    if (authError) {
      console.warn('Não foi possível atualizar o país campeão no metadata do Auth:', authError);
    }

    setState(prev => ({
      ...prev,
      currentUser: prev.currentUser ? { ...prev.currentUser, championPrediction } : prev.currentUser,
      users: prev.users.map(user =>
        user.id === state.currentUser?.id ? { ...user, championPrediction } : user
      ),
    }));

    toast.success('País campeão atualizado com sucesso!');
    return true;
  };

  const registerUser = async (userData: Omit<User, 'id' | 'totalPoints' | 'isAdmin' | 'isPaid'>) => {
    if (!ensureSupabaseReady('cadastrar usuário')) return { success: false, error: 'Supabase não configurado' };

    if (state.settings.betsLocked) {
      return { success: false, error: 'O Bolão está fechado para novos participantes.' };
    }

    if ((userData.password || '').length < 6) {
      return { success: false, error: 'A senha deve ter pelo menos 6 caracteres.' };
    }

    // O signUp do Supabase Auth já rejeita e-mails duplicados nativamente,
    // então não precisamos de consultas prévias à tabela users.
    const result = await withRetry(
      () => supabase.auth.signUp({
        email: userData.email,
        password: userData.password || '',
        options: {
          data: {
            name: userData.name,
            photo_url: userData.photoUrl,
            champion_prediction: userData.championPrediction,
          },
        },
      }),
      'cadastrar usuário'
    );
    if (!result) {
      return {
        success: false,
        error: 'Nao foi possivel conectar ao Supabase agora. Verifique sua internet, VPN, firewall ou tente novamente em alguns segundos.',
      };
    }
    const { data: authData, error: authError } = result;

    if (authError) {
      console.error('Erro detalhado Supabase Auth:', authError);
      // Traduzir mensagens comuns do Supabase Auth
      if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
        return { success: false, error: 'Este e-mail já está cadastrado.' };
      }
      return {
        success: false,
        error: getReadableSupabaseError(authError, `Erro ao cadastrar usuário: ${authError.message}`),
      };
    }

    const userId = authData.user?.id;
    if (!userId) {
      return { success: false, error: 'Erro ao obter ID do usuário.' };
    }

    // O Supabase faz login automático ao cadastrar se a confirmação de e-mail estiver desativada.
    // Forçamos o logout para redirecionar à tela de login.
    if (authData.session) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.error('Erro ao fazer logout após cadastro:', e);
      }
      setState(prev => ({ ...prev, currentUser: null }));
    }

    toast.success('Cadastro realizado com sucesso! Faça o login para continuar.');
    return { success: true };
  };

  const registerUserAndRedirect = async (userData: Omit<User, 'id' | 'totalPoints' | 'isAdmin' | 'isPaid'>) => {
    if (!ensureSupabaseReady('cadastrar usuário')) return { success: false, error: 'Supabase não configurado' };

    if (state.settings.betsLocked) {
      return { success: false, error: 'O Bolão está fechado para novos participantes.' };
    }

    if ((userData.password || '').length < 6) {
      return { success: false, error: 'A senha deve ter pelo menos 6 caracteres.' };
    }

    const result = await withRetry(
      () => supabase.auth.signUp({
        email: userData.email,
        password: userData.password || '',
        options: {
          data: {
            name: userData.name,
            photo_url: userData.photoUrl,
            champion_prediction: userData.championPrediction,
          },
        },
      }),
      'cadastrar usuário'
    );

    if (!result) {
      return {
        success: false,
        error: 'Nao foi possivel conectar ao Supabase agora. Verifique sua internet, VPN, firewall ou tente novamente em alguns segundos.',
      };
    }

    const { data: authData, error: authError } = result;

    if (authError) {
      console.error('Erro detalhado Supabase Auth:', authError);
      if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
        return { success: false, error: 'Este e-mail já está cadastrado.' };
      }

      return {
        success: false,
        error: getReadableSupabaseError(authError, `Erro ao cadastrar usuario: ${authError.message}`),
      };
    }

    const userId = authData.user?.id;
    if (!userId) {
      return { success: false, error: 'Erro ao obter ID do usuário.' };
    }

    if (authData.session) {
      suppressAuthHydrationForUser.current = userId;
      setState(prev => ({ ...prev, currentUser: null }));

      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.warn('Não foi possível encerrar a sessão automática após o cadastro:', error);
      }
    }

    toast.success('Cadastro realizado com sucesso! Faça o login para continuar.');
    return { success: true, autoLoggedIn: false };
  };

  const setEntryFee = async (fee: number) => {
    await upsertSettings({ entry_fee: fee }, 'Erro ao atualizar taxa.');
  };

  const setYear = async (year: string) => {
    await upsertSettings({ year }, 'Erro ao atualizar ano.');
  };

  const setLogoUrl = async (logoUrl: string) => {
    await upsertSettings({ logo_url: logoUrl }, 'Erro ao atualizar logo.');
  };

  const setPrizeSettings = async (prizeData: AppState['settings']['prizes']) => {
    await upsertSettings({ prizes: prizeData }, 'Erro ao atualizar prêmios.');
  };

  const placeBet = async (matchId: string, homeScore: number, awayScore: number) => {
    if (!state.currentUser) {
      toast.error('Faça login para salvar seu palpite.');
      return false;
    }

    if (state.settings.betsLocked) {
      toast.error('Os palpites estão bloqueados.');
      return false;
    }

    if (!ensureSupabaseReady('salvar palpite')) return false;

    const userId = state.currentUser.id;
    betLog('save:start', { userId, matchId, homeScore, awayScore });

    try {
      const { data: sessionData, error: sessionError } = await withOperationTimeout(
        supabase.auth.getSession(),
        'validar sessao antes de salvar palpite',
      );

      betLog('save:session', {
        hasSession: Boolean(sessionData.session),
        sessionUserId: sessionData.session?.user.id,
        error: sessionError ? { message: sessionError.message } : null,
      });

      if (sessionError || !sessionData.session?.access_token || sessionData.session.user.id !== userId) {
        toast.error('Sua sessao expirou. Faca login novamente para salvar o palpite.');
        await supabase.auth.signOut();
        setState(prev => ({ ...prev, currentUser: null }));
        return false;
      }

      const { data, error } = await withOperationTimeout(
        supabase
          .from('bets')
          .upsert({
            user_id: userId,
            match_id: matchId,
            home_score: homeScore,
            away_score: awayScore,
            is_locked: false,
          }, { onConflict: 'user_id,match_id' })
          .select()
          .single(),
        'salvar palpite',
      );

      betLog('save:upsert-response', {
        hasData: Boolean(data),
        betId: data?.id,
        error: error ? { message: error.message, code: error.code } : null,
      });

      if (error || !data) {
        toast.error(`Erro ao salvar palpite: ${error?.message ?? 'registro nao confirmado.'}`);
        return false;
      }

      const { data: confirmedBet, error: confirmError } = await withOperationTimeout(
        supabase
          .from('bets')
          .select('*')
          .eq('user_id', userId)
          .eq('match_id', matchId)
          .maybeSingle(),
        'confirmar palpite salvo',
      );

      betLog('save:confirm-response', {
        confirmed: Boolean(confirmedBet),
        betId: confirmedBet?.id,
        error: confirmError ? { message: confirmError.message, code: confirmError.code } : null,
      });

      if (confirmError || !confirmedBet) {
        toast.error('Nao foi possivel confirmar o palpite salvo. Tente novamente.');
        return false;
      }

      const mappedBet = mapBet(confirmedBet);
      setState(prev => {
        const existingIndex = prev.bets.findIndex(
          b => b.userId === userId && b.matchId === matchId
        );
        const newBets = [...prev.bets];
        if (existingIndex >= 0) {
          newBets[existingIndex] = mappedBet;
        } else {
          newBets.push(mappedBet);
        }
        return { ...prev, bets: newBets };
      });

      betLog('save:success', { userId, matchId, betId: mappedBet.id });
      return true;
    } catch (error) {
      betErrorLog('save:error', error, { userId, matchId });
      const message = getReadableSupabaseError(
        error,
        'Nao foi possivel salvar seu palpite agora. Verifique sua conexao e tente novamente.',
      );
      toast.error(message);
      return false;
    }
  };

  const loadMatchBets = async (matchId: string) => {
    if (!state.currentUser) {
      toast.error('Faça login para ver os palpites.');
      return false;
    }

    try {
      const { data: sessionData, error: sessionError } = await withOperationTimeout(
        supabase.auth.getSession(),
        'validar sessao para carregar palpites',
      );

      if (sessionError || !sessionData.session?.access_token) {
        throw new Error('Sessao obrigatoria para carregar palpites.');
      }

      const response = await withOperationTimeout(
        fetch(new URL('/api/match-bets', window.location.origin).toString(), {
          method: 'POST',
          cache: 'no-store',
          credentials: 'omit',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            matchId,
            accessToken: sessionData.session.access_token,
          }),
        }),
        'carregar palpites do jogo',
        30000,
      );

      const payload = await response.json().catch(() => null) as { bets?: Record<string, any>[]; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error || `API retornou HTTP ${response.status} ao carregar palpites.`);
      }

      const loadedBets = (payload?.bets ?? []).map(mapBet);
      setState(prev => {
        const byKey = new Map(prev.bets.map(bet => [`${bet.userId}:${bet.matchId}`, bet]));
        for (const bet of loadedBets) {
          byKey.set(`${bet.userId}:${bet.matchId}`, bet);
        }
        return { ...prev, bets: Array.from(byKey.values()) };
      });

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao carregar palpites.';
      console.error('[match-bets] load:error', error);
      toast.error(message);
      return false;
    }
  };

  const updateMatchResult = async (matchId: string, homeScore: number, awayScore: number) => {
    if (!ensureSupabaseReady('atualizar resultado')) return;

    const { error: matchError } = await supabase
      .from('matches')
      .update({ home_score: homeScore, away_score: awayScore, status: 'finished' })
      .eq('id', matchId);

    if (matchError) { toast.error(`Erro ao atualizar partida: ${matchError.message}`); return; }

    const finishedMatch = state.matches.find(m => m.id === matchId);
    if (!finishedMatch) {
      await hydrateState(state.currentUser?.id ?? null);
      return;
    }

    const computedMatch = {
      ...finishedMatch,
      homeScore,
      awayScore,
      status: 'finished' as const,
    };

    const updatedBets = state.bets.map(bet => {
      if (bet.matchId !== matchId) return bet;
      return {
        ...bet,
        pointsEarned: calculatePoints(bet, computedMatch, state.settings.betsLocked),
      };
    });

    const betUpdates = updatedBets
      .filter(bet => bet.matchId === matchId)
      .map(bet => supabase.from('bets').update({ points_earned: bet.pointsEarned ?? 0 }).eq('id', bet.id));

    const pointByUser = new Map<string, number>();
    for (const bet of updatedBets) {
      pointByUser.set(bet.userId, (pointByUser.get(bet.userId) ?? 0) + (bet.pointsEarned ?? 0));
    }

    const userUpdates = state.users.map(user => {
      const totalPoints = pointByUser.get(user.id) ?? 0;
      return supabase.from('users').update({ total_points: totalPoints }).eq('id', user.id);
    });

    const results = await Promise.all([...betUpdates, ...userUpdates]);
    const failedUpdate = results.find(result => result.error);

    if (failedUpdate?.error) {
      toast.error(`Erro ao recalcular pontuação: ${failedUpdate.error.message}`);
      await hydrateState(state.currentUser?.id ?? null);
      return;
    }

    setState(prev => ({
      ...prev,
      matches: prev.matches.map(match =>
        match.id === matchId ? computedMatch : match
      ),
      bets: updatedBets,
      users: prev.users.map(user => ({
        ...user,
        totalPoints: pointByUser.get(user.id) ?? 0,
      })),
    }));
  };

  const togglePaymentStatus = async (userId: string) => {
    if (!ensureSupabaseReady('alterar pagamento')) return;

    const user = state.users.find(u => u.id === userId);
    if (!user) return;
    const { error } = await supabase
      .from('users').update({ is_paid: !user.isPaid }).eq('id', userId);
    if (error) { toast.error('Erro ao atualizar pagamento.'); return; }
    setState(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === userId ? { ...u, isPaid: !u.isPaid } : u),
    }));
  };

  const toggleAdminStatus = async (userId: string) => {
    if (!ensureSupabaseReady('alterar permissão de administrador')) return;

    const user = state.users.find(u => u.id === userId);
    if (!user) return;
    const { error } = await supabase
      .from('users').update({ is_admin: !user.isAdmin }).eq('id', userId);
    if (error) { toast.error('Erro ao atualizar status de admin.'); return; }
    setState(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === userId ? { ...u, isAdmin: !u.isAdmin } : u),
    }));
  };

  const toggleBetsLock = async () => {
    await upsertSettings(
      { bets_locked: !state.settings.betsLocked },
      'Erro ao atualizar bloqueio de apostas.'
    );
  };

  const addMatch = async (matchData: Omit<Match, 'id' | 'status'>) => {
    if (!ensureSupabaseReady('adicionar partida')) return false;

    const { data, error } = await supabase
      .from('matches')
      .insert([{
        home_team: matchData.homeTeam,
        away_team: matchData.awayTeam,
        group_name: matchData.group,
        date: matchData.date,
        status: 'scheduled',
        location: matchData.location,
        home_flag_url: matchData.homeFlagUrl,
        away_flag_url: matchData.awayFlagUrl,
      }])
      .select()
      .single();

    if (error) {
      toast.error(`Erro ao adicionar partida: ${error.message}`);
      return false;
    }

    setState(prev => {
      const matches = [...prev.matches, mapMatch(data)];
      cacheMatches(matches);
      return { ...prev, matches };
    });

    return true;
  };

  const updateMatch = async (matchId: string, matchData: Partial<Match>) => {
    if (!ensureSupabaseReady('editar partida')) return false;

    const payload: Record<string, any> = {};
    if (matchData.homeTeam !== undefined) payload.home_team = matchData.homeTeam;
    if (matchData.awayTeam !== undefined) payload.away_team = matchData.awayTeam;
    if (matchData.group !== undefined) payload.group_name = matchData.group;
    if (matchData.date !== undefined) payload.date = matchData.date;
    if (matchData.status !== undefined) payload.status = matchData.status;
    if (matchData.homeScore !== undefined) payload.home_score = matchData.homeScore;
    if (matchData.awayScore !== undefined) payload.away_score = matchData.awayScore;
    if (matchData.location !== undefined) payload.location = matchData.location;
    if (matchData.homeFlagUrl !== undefined) payload.home_flag_url = matchData.homeFlagUrl;
    if (matchData.awayFlagUrl !== undefined) payload.away_flag_url = matchData.awayFlagUrl;

    const { error } = await supabase.from('matches').update(payload).eq('id', matchId);
    if (error) {
      toast.error(`Erro ao atualizar partida: ${error.message}`);
      return false;
    }

    setState(prev => {
      const matches = prev.matches.map(m => m.id === matchId ? { ...m, ...matchData } : m);
      cacheMatches(matches);
      return {
        ...prev,
        matches,
      };
    });

    return true;
  };

  const deleteMatch = async (matchId: string) => {
    if (!ensureSupabaseReady('deletar partida')) return;

    const { error } = await supabase.from('matches').delete().eq('id', matchId);
    setState(prev => {
      const matches = prev.matches.filter(m => m.id !== matchId);
      cacheMatches(matches);
      return {
        ...prev,
        matches,
        bets: prev.bets.filter(b => b.matchId !== matchId),
      };
    });
  };

  const deleteUser = async (userId: string) => {
    if (!ensureSupabaseReady('remover usuário')) return;

    try {
      const { data: sessionData, error: sessionError } = await withOperationTimeout(
        supabase.auth.getSession(),
        'validar sessao administrativa',
      );
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error('Sessao administrativa obrigatoria.');
      }

      clearLargeAccessibleCookies();

      const response = await withOperationTimeout(
        fetch(new URL('/api/delete-user', window.location.origin).toString(), {
          method: 'POST',
          cache: 'no-store',
          credentials: 'omit',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId, accessToken: sessionData.session.access_token }),
        }),
        'excluir usuario',
        60000,
      );

      let payload: { error?: string } | null = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(payload?.error || `API administrativa retornou HTTP ${response.status} ao excluir usuario.`);
      }
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Erro ao deletar usuario.';
      const message = /failed to fetch|networkerror|tempo esgotado|fetch|http 50[0-9]|http 52[0-9]/i.test(rawMessage)
        ? 'Nao foi possivel concluir o banimento agora. A API esta online, mas a operacao expirou ou a rede oscilou. Tente novamente em instantes.'
        : rawMessage;
      toast.error(message);
      return false;
    }

    if (state.currentUser?.id === userId) {
      await supabase.auth.signOut();
      setState(prev => ({ ...prev, currentUser: null }));
    }

    setState(prev => ({
      ...prev,
      users: prev.users.filter(u => u.id !== userId),
      bets: prev.bets.filter(b => b.userId !== userId),
    }));

    return true;
  };

  return {
    state,
    login,
    logout,
    registerUser: registerUserAndRedirect,
    placeBet,
    loadMatchBets,
    updateMatchResult,
    togglePaymentStatus,
    toggleAdminStatus,
    toggleBetsLock,
    addMatch,
    updateMatch,
    deleteMatch,
    deleteUser,
    updateCurrentUserPhoto,
    updateCurrentUserChampionPrediction,
    setEntryFee,
    setYear,
    setLogoUrl,
    setPrizeSettings,
    resetState,
  };
}
