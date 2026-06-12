import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

if (!globalThis.WebSocket) {
  globalThis.WebSocket = ws;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).end();

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
}
