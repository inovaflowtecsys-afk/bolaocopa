# Bolão da Copa 2026

Aplicação React + Vite com autenticação e CRUD no Supabase para gerenciamento do bolão.

## Pré-requisitos

- Node.js 20+
- Um projeto Supabase ativo

## Configuração

1. Copie o conteúdo de [.env.example](.env.example) para `.env.local`.
2. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os valores reais do seu projeto.
3. Abra o SQL Editor do Supabase e execute o arquivo `supabase/schema.sql`.
4. Para iniciar com jogos de exemplo, execute `supabase/seed.sql`.
5. Instale as dependências com `npm install`.
6. Rode o projeto com `npm run dev`.

## Estrutura do banco

O arquivo `supabase/schema.sql` cria:

- tabelas `users`, `matches`, `bets` e `settings`
- trigger para espelhar `auth.users` em `public.users`
- políticas RLS para leitura autenticada e escrita controlada por admin
- configuração inicial da tabela `settings`

O arquivo `supabase/seed.sql` insere partidas iniciais para o bolao.

## Observações importantes

- O primeiro usuário cadastrado vira administrador e já entra como pago.
- A exclusão de perfil na tela remove o registro da tabela `public.users`; para apagar também o usuário do Auth é necessário usar uma função administrativa ou o painel do Supabase.
- Sem credenciais reais no `.env.local`, login e cadastro ficam bloqueados por segurança.
