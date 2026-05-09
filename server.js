import express from 'express';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Carrega variáveis de ambiente locais antes do servidor subir.
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });


const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

// Habilita CORS para desenvolvimento local
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
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
