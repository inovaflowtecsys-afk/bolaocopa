import { useState, useEffect, useRef } from 'react';
import { AppState, User, Match, Bet } from '../types';
import { calculatePoints } from '../constants';
import { toast } from 'sonner';
import { isSupabaseConfigured, supabase, supabaseConfigError } from '../lib/supabase';

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
    toast.error(getReadableSupabaseError(error, `Erro ao ${context}. Verifique sua conex?o ou firewall.`));
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
        return await fn();
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
    // Evita chamadas paralelas simultâneas
    if (isHydrating.current) return;
    isHydrating.current = true;

    if (!ensureSupabaseReady('carregar dados', false)) {
      setState(prev => ({
        ...prev,
        users: [],
        matches: [],
        bets: [],
        currentUser: null,
      }));
      isHydrating.current = false;
      return;
    }

    try {
      const [matchesRes, settingsRes] = await Promise.all([
        withRetry(async () => await supabase.from('matches').select('*').order('date', { ascending: true }), 'buscar partidas'),
        withRetry(async () => await supabase.from('settings').select('*').eq('id', 1).maybeSingle(), 'buscar configura??es'),
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
        currentUser = await fetchUserProfile(userId);

        if (!currentUser) {
          await supabase.auth.signOut();
          toast.error('Seu perfil não foi encontrado no banco. Execute o schema do Supabase antes de fazer login.');
        } else {
          const [usersRes, betsRes] = await Promise.all([
            supabase.from('users').select('*').order('total_points', { ascending: false }),
            currentUser.isAdmin
              ? supabase.from('bets').select('*')
              : supabase.from('bets').select('*').eq('user_id', userId),
          ]);

          if (usersRes.error) throw usersRes.error;
          if (betsRes.error) throw betsRes.error;

          users = (usersRes.data ?? []).map(mapUser);
          bets = (betsRes.data ?? []).map(mapBet);
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
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar dados do Supabase.');
    } finally {
      isHydrating.current = false;
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

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Erro ao recuperar sessão:', error);
      }

      if (isMounted) {
        await hydrateState(data.session?.user?.id ?? null);
      }
    }

    void bootstrap();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;

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

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error('E-mail ou senha incorretos.');
      return false;
    }

    // Busca perfil do usuário na tabela users
    const { data: userDb, error: userDbError } = await supabase.from('users').select('*').eq('id', data.user.id).maybeSingle();
    if (userDbError || !userDb) {
      toast.error('Usuário não encontrado no sistema. Contate o administrador.');
      await supabase.auth.signOut();
      return false;
    }

    await hydrateState(data.user.id);
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
        error: getReadableSupabaseError(authError, `Erro ao cadastrar usu?rio: ${authError.message}`),
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
    if (!ensureSupabaseReady('cadastrar usuÃ¡rio')) return { success: false, error: 'Supabase nÃ£o configurado' };

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
      'cadastrar usuÃ¡rio'
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
        return { success: false, error: 'Este e-mail jÃ¡ estÃ¡ cadastrado.' };
      }

      return {
        success: false,
        error: getReadableSupabaseError(authError, `Erro ao cadastrar usuario: ${authError.message}`),
      };
    }

    const userId = authData.user?.id;
    if (!userId) {
      return { success: false, error: 'Erro ao obter ID do usuÃ¡rio.' };
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
    if (!state.currentUser || state.settings.betsLocked) return;
    if (!ensureSupabaseReady('salvar palpite')) return;

    const { data, error } = await supabase
      .from('bets')
      .upsert({
        user_id: state.currentUser.id,
        match_id: matchId,
        home_score: homeScore,
        away_score: awayScore,
        is_locked: false,
      }, { onConflict: 'user_id,match_id' })
      .select()
      .single();

    if (error) { toast.error('Erro ao fazer aposta.'); return; }

    const mappedBet = mapBet(data);
    setState(prev => {
      const existingIndex = prev.bets.findIndex(
        b => b.userId === state.currentUser?.id && b.matchId === matchId
      );
      const newBets = [...prev.bets];
      if (existingIndex >= 0) {
        newBets[existingIndex] = { ...newBets[existingIndex], homeScore, awayScore };
      } else {
        newBets.push(mappedBet);
      }
      return { ...prev, bets: newBets };
    });
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
    if (!ensureSupabaseReady('adicionar partida')) return;

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

    if (error) { toast.error(`Erro ao adicionar partida: ${error.message}`); return; }
    setState(prev => ({ ...prev, matches: [...prev.matches, mapMatch(data)] }));
  };

  const updateMatch = async (matchId: string, matchData: Partial<Match>) => {
    if (!ensureSupabaseReady('editar partida')) return;

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
    if (error) { toast.error('Erro ao atualizar partida.'); return; }
    setState(prev => ({
      ...prev,
      matches: prev.matches.map(m => m.id === matchId ? { ...m, ...matchData } : m),
    }));
  };

  const deleteMatch = async (matchId: string) => {
    if (!ensureSupabaseReady('deletar partida')) return;

    const { error } = await supabase.from('matches').delete().eq('id', matchId);
    if (error) { toast.error('Erro ao deletar partida.'); return; }
    setState(prev => ({
      ...prev,
      matches: prev.matches.filter(m => m.id !== matchId),
      bets: prev.bets.filter(b => b.matchId !== matchId),
    }));
  };

  const deleteUser = async (userId: string) => {
    if (!ensureSupabaseReady('remover usuário')) return;

    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) { toast.error('Erro ao deletar usuário.'); return; }

    if (state.currentUser?.id === userId) {
      await supabase.auth.signOut();
      setState(prev => ({ ...prev, currentUser: null }));
    }

    setState(prev => ({
      ...prev,
      users: prev.users.filter(u => u.id !== userId),
      bets: prev.bets.filter(b => b.userId !== userId),
    }));

    toast.success('Perfil removido. Para excluir também o usuário do Auth, use o painel do Supabase ou uma função administrativa.');
  };

  return {
    state,
    login,
    logout,
    registerUser: registerUserAndRedirect,
    placeBet,
    updateMatchResult,
    togglePaymentStatus,
    toggleAdminStatus,
    toggleBetsLock,
    addMatch,
    updateMatch,
    deleteMatch,
    deleteUser,
    setEntryFee,
    setYear,
    setLogoUrl,
    setPrizeSettings,
    resetState,
  };
}
