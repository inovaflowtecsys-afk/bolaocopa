// Script para importar todos os usuários do Supabase Auth para a tabela 'users'.
// Execute este script uma vez para garantir que todos os usuários possam logar normalmente.
// Requer: node, dotenv, @supabase/supabase-js

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  // 1. Buscar todos os usuários do Auth
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Erro ao buscar usuários do Auth:', error);
    process.exit(1);
  }

  for (const user of users.users) {
    // 2. Verificar se já existe na tabela users
    const { data: userDb } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
    if (userDb) continue; // já existe

    // 3. Inserir na tabela users
    const { error: insertError } = await supabase.from('users').insert({
      id: user.id,
      name: user.user_metadata?.name || user.email.split('@')[0],
      email: user.email,
      photo_url: user.user_metadata?.photo_url || '',
      champion_prediction: user.user_metadata?.champion_prediction || '',
      is_paid: false,
      is_admin: false,
      total_points: 0
    });
    if (insertError) {
      console.error(`Erro ao inserir usuário ${user.email}:`, insertError);
    } else {
      console.log(`Usuário importado: ${user.email}`);
    }
  }
  console.log('Importação concluída!');
}

main();
