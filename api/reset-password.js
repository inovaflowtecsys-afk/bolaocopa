import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

if (!globalThis.WebSocket) {
  globalThis.WebSocket = ws;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).end();

    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId obrigatorio' });

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({
        error: 'Servidor sem SUPABASE_URL/VITE_SUPABASE_URL ou SUPABASE_SERVICE_KEY configuradas para reset administrativo.',
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { error } = await supabase.auth.admin.updateUserById(userId, { password: '0102bolaoCop@' });
    if (error) return res.status(500).json({ error: error.message });

    const { error: profileError } = await supabase
      .from('users')
      .update({ senha_provisoria: true })
      .eq('id', userId);
    if (profileError) return res.status(500).json({ error: profileError.message });

    return res.status(200).json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno ao resetar senha.';
    return res.status(500).json({ error: message });
  }
}
