import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

if (!globalThis.WebSocket) {
  globalThis.WebSocket = ws;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).end();

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

    return res.status(200).json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno ao excluir usuario.';
    console.error('[delete-user] request:error', { message });
    return res.status(500).json({ error: message });
  }
}
