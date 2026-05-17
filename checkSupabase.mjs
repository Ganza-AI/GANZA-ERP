import { createClient } from '@supabase/supabase-js'

const url = 'https://fqtxdsogzgvhuwqvgqum.supabase.co'
const key = process.env.SUPABASE_KEY || 'YOUR_SUPABASE_KEY';
const supabase = createClient(url, key)

async function main() {
  try {
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
    console.log('SESSION:', sessionErr || sessionData)

    const { data, error } = await supabase.from('todos').select('*').limit(1)
    console.log('TODOS:', error || data)
  } catch (e) {
    console.error('ERR:', e)
  }
}

main()
