// Teste simples de conexão com Supabase via Node.js
// Salve este arquivo como test-supabase.js e rode: node test-supabase.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dlddejpumfphlanzyyia.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZGRlanB1bWZwaGxhbnp5eWlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMDkxOTEsImV4cCI6MjA5MTU4NTE5MX0.aODiYWYYsU4_jF1xIlGMAY8pzj1zPWxSxxnGt6RhE7k';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  const { data, error } = await supabase.from('users').select('*').limit(1);
  console.log('DATA:', data);
  console.log('ERROR:', error);
}

testConnection();
