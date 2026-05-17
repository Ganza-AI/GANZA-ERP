import { createClient } from '@supabase/supabase-js'

const statusEl = document.getElementById('status')
const dataEl = document.getElementById('data')
const checkButton = document.getElementById('checkConnection')
const loadDataButton = document.getElementById('loadData')

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  statusEl.textContent = 'Missing Supabase credentials. Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  statusEl.style.background = '#fee2e2'
  statusEl.style.border = '1px solid #fecaca'
  checkButton.disabled = true
  loadDataButton.disabled = true
} else {
  statusEl.textContent = 'Supabase credentials loaded. Ready to connect.'
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkConnection() {
  statusEl.textContent = 'Testing Supabase connection...'
  try {
    const { data, error } = await supabase.from('todos').select('*').limit(1)
    if (error) {
      throw error
    }
    statusEl.textContent = `Connected. Sample query succeeded (${data.length} row(s)).`
    statusEl.style.background = '#ecfdf5'
    statusEl.style.border = '1px solid #a7f3d0'
  } catch (error) {
    statusEl.textContent = `Connection failed: ${error.message}`
    statusEl.style.background = '#fee2e2'
    statusEl.style.border = '1px solid #fecaca'
  }
}

async function loadTodos() {
  dataEl.innerHTML = 'Loading todos...'
  try {
    const { data, error } = await supabase.from('todos').select('id, task, is_complete')
    if (error) {
      throw error
    }
    if (!data || data.length === 0) {
      dataEl.innerHTML = '<p>No todos found. Create a table named <strong>todos</strong> in Supabase.</p>'
      return
    }

    dataEl.innerHTML = `
      <table>
        <thead>
          <tr><th>ID</th><th>Task</th><th>Complete</th></tr>
        </thead>
        <tbody>
          ${data.map(todo => `
            <tr>
              <td>${todo.id}</td>
              <td>${todo.task}</td>
              <td>${todo.is_complete ? 'Yes' : 'No'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
  } catch (error) {
    dataEl.innerHTML = `<p style="color:#b91c1c">Error loading todos: ${error.message}</p>`
  }
}

checkButton.addEventListener('click', checkConnection)
loadDataButton.addEventListener('click', loadTodos)

export default supabase
