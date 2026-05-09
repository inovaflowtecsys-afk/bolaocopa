import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import {defineConfig, loadEnv} from 'vite';

const RESET_PASSWORD = '0102bolaoCop@';

const readJsonBody = async (req: import('node:http').IncomingMessage) => {
  const chunks: Uint8Array[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf-8');
  return raw ? JSON.parse(raw) : {};
};

const createResetPasswordPlugin = (env: Record<string, string>) => ({
  name: 'local-reset-password-api',
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use('/api/reset-password', async (req, res, next) => {
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
        res.end();
        return;
      }

      if (req.method !== 'POST') {
        next();
        return;
      }

      try {
        const { userId } = await readJsonBody(req);

        if (!userId) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'userId obrigatorio' }));
          return;
        }

        const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
        const serviceKey = env.SUPABASE_SERVICE_KEY;

        if (!supabaseUrl || !serviceKey) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: 'Servidor sem SUPABASE_URL/VITE_SUPABASE_URL ou SUPABASE_SERVICE_KEY configuradas para reset administrativo.',
          }));
          return;
        }

        const supabase = createClient(supabaseUrl, serviceKey);

        const { error } = await supabase.auth.admin.updateUserById(userId, {
          password: RESET_PASSWORD,
        });

        if (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error.message }));
          return;
        }

        const { error: profileError } = await supabase
          .from('users')
          .update({ senha_provisoria: true })
          .eq('id', userId);

        if (profileError) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: profileError.message }));
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro interno ao resetar senha.';
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: message }));
      }
    });
  },
});

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, __dirname, '');
  const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')) as { version?: string };
  const appVersion = packageJson.version ?? '0.0.0';
  const buildDate = new Date().toLocaleDateString('pt-BR');

  const repository = env.GITHUB_REPOSITORY;
  const isGitHubPagesBuild = env.GITHUB_ACTIONS === 'true' && Boolean(repository);
  const repoName = repository?.split('/')[1] ?? '';
  const configuredBasePath = env.BASE_PATH;

  const base = configuredBasePath
    ? (configuredBasePath.endsWith('/') ? configuredBasePath : `${configuredBasePath}/`)
    : isGitHubPagesBuild && repoName
      ? `/${repoName}/`
      : '/';

  return {
    base,
    plugins: [react(), tailwindcss(), createResetPasswordPlugin(env)],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      __BUILD_DATE__: JSON.stringify(buildDate),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            supabase: ['@supabase/supabase-js'],
            charts: ['recharts'],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Mantem compatibilidade com ambientes que exigem HMR desativado.
      hmr: env.DISABLE_HMR !== 'true',
    },
  };
});
