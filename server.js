import express from 'express';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

// Carrega variáveis de ambiente locais antes do servidor subir.
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

if (!globalThis.WebSocket) {
  globalThis.WebSocket = ws;
}


const app = express();
app.use(express.json());
app.use((_req, res, next) => {
  res.charset = 'utf-8';
  next();
});

const allowedOrigins = new Set([
  'https://app.bolaocopa.inovaflowtec.com.br',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.APP_ORIGIN,
].filter(Boolean));

const applyCorsHeaders = (req, res) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.has(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }

  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
};

app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use((req, res, next) => {
  applyCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
  } else {
    next();
  }
});

app.post('/api/reset-password', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId obrigatório' });

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({
        error: 'Servidor sem SUPABASE_URL/VITE_SUPABASE_URL ou SUPABASE_SERVICE_KEY configuradas para reset administrativo.',
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Reset senha
    const { error } = await supabase.auth.admin.updateUserById(userId, { password: '0102bolaoCop@' });
    if (error) return res.status(500).json({ error: error.message });

    // Marca senha_provisoria
    const { error: profileError } = await supabase
      .from('users')
      .update({ senha_provisoria: true })
      .eq('id', userId);
    if (profileError) return res.status(500).json({ error: profileError.message });

    res.status(200).json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno ao resetar senha.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/match-bets', async (req, res) => {
  try {
    const { matchId, accessToken } = req.body;
    if (!matchId) return res.status(400).json({ error: 'matchId obrigatorio' });
    console.info('[match-bets] request:start', { matchId });

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({
        error: 'Servidor sem SUPABASE_URL/VITE_SUPABASE_URL ou SUPABASE_SERVICE_KEY configuradas para carregar palpites.',
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const token = accessToken || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Sessao obrigatoria para carregar palpites.' });

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return res.status(401).json({ error: 'Sessao invalida.' });

    const [{ data: requester, error: requesterError }, { data: match, error: matchError }] = await Promise.all([
      supabase.from('users').select('id,is_admin').eq('id', authData.user.id).maybeSingle(),
      supabase.from('matches').select('id,status').eq('id', matchId).maybeSingle(),
    ]);

    if (requesterError) return res.status(500).json({ error: requesterError.message });
    if (matchError) return res.status(500).json({ error: matchError.message });
    if (!requester) return res.status(403).json({ error: 'Usuario nao cadastrado para visualizar palpites.' });
    if (!match) return res.status(404).json({ error: 'Partida nao encontrada.' });

    const { data: bets, error: betsError } = await supabase
      .from('bets')
      .select('*')
      .eq('match_id', matchId);
    if (betsError) return res.status(500).json({ error: betsError.message });

    console.info('[match-bets] request:success', {
      matchId,
      requesterId: authData.user.id,
      canSeeAllBets: true,
      count: bets?.length ?? 0,
    });

    return res.status(200).json({ bets: bets ?? [], canSeeAllBets: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno ao carregar palpites.';
    console.error('[match-bets] request:error', { message });
    return res.status(500).json({ error: message });
  }
});

app.post('/api/delete-user', async (req, res) => {
  try {
    const { userId, accessToken } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId obrigatorio' });
    console.info('[delete-user] request:start', { userId });

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({
        error: 'Servidor sem SUPABASE_URL/VITE_SUPABASE_URL ou SUPABASE_SERVICE_KEY configuradas para exclusao administrativa.',
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const token = accessToken || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Sessao administrativa obrigatoria.' });

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return res.status(401).json({ error: 'Sessao invalida.' });
    console.info('[delete-user] admin-session', { adminUserId: authData.user.id, targetUserId: userId });

    const { data: adminProfile, error: adminError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (adminError) return res.status(500).json({ error: adminError.message });
    if (!adminProfile?.is_admin) return res.status(403).json({ error: 'Apenas administradores podem excluir usuarios.' });

    const { error: profileError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);
    if (profileError) return res.status(500).json({ error: profileError.message });
    console.info('[delete-user] public-profile-deleted', { targetUserId: userId });

    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error && !/not found|does not exist|user not found/i.test(error.message)) {
      return res.status(500).json({ error: error.message });
    }
    console.info('[delete-user] auth-user-deleted', { targetUserId: userId, alreadyDeleted: Boolean(error) });

    res.status(200).json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno ao excluir usuario.';
    console.error('[delete-user] request:error', { message });
    res.status(500).json({ error: message });
  }
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'JSON inválido na requisição.' });
  }

  const message = error instanceof Error ? error.message : 'Erro interno do servidor.';
  return res.status(500).json({ error: message });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor Express rodando em http://localhost:${PORT}`);
});
