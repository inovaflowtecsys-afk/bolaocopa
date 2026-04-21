import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dlddejpumfphlanzyyia.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZGRlanB1bWZwaGxhbnp5eWlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMDkxOTEsImV4cCI6MjA5MTU4NTE5MX0.aODiYWYYsU4_jF1xIlGMAY8pzj1zPWxSxxnGt6RhE7k';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSignup() {
  const email = `test-${Date.now()}@example.com`;
  console.log('Testing signup for:', email);
  const { data, error } = await supabase.auth.signUp({
    email,
    password: 'password123',
    options: {
      data: {
        name: 'Test User',
        photo_url: '',
        champion_prediction: 'Brasil',
      },
    },
  });
  console.log('AUTH DATA:', JSON.stringify(data, null, 2));
  console.log('AUTH ERROR:', error);
}

testSignup();
