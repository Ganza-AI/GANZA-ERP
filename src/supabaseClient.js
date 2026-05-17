import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env variable(s): VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ==================== AUTH FUNCTIONS ====================

/**
 * Lấy session hiện tại
 * @returns {Promise<Object|null>} session object hoặc null
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    console.error('Supabase getSession error:', error)
    return null
  }
  return data.session
}

/**
 * Đăng nhập bằng email và password
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{user: Object|null, error: Object|null}>}
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  return { user: data?.user || null, session: data?.session || null, error }
}

/**
 * Đăng xuất
 * @returns {Promise<{error: Object|null}>}
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

/**
 * Lắng nghe thay đổi auth state
 * @param {Function} callback - (event, session) => void
 * @returns {Object} subscription object (gọi .unsubscribe() để hủy)
 */
export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session)
  })
  return data.subscription
}

/**
 * Lấy user hiện tại
 * @returns {Promise<Object|null>}
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) {
    console.error('Get current user error:', error)
    return null
  }
  return user
}
