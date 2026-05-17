import { createClient } from '@supabase/supabase-js';

const url = 'https://fqtxdsogzgvhuwqvgqum.supabase.co';
const key = process.env.SUPABASE_KEY || 'YOUR_SUPABASE_KEY';
const supabase = createClient(url, key);

async function main() {
  try {
    const email = 'khoa.dvn911119@gmail.com';
    const password = '12345678';
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    console.log('RESULT', JSON.stringify({ data, error }, null, 2));
  } catch (err) {
    console.error('ERR', err);
  }
}

main();
