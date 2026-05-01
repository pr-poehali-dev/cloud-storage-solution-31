import func2url from '../../backend/func2url.json'

const REGISTER_URL = (func2url as Record<string, string>)['auth-register']
const LOGIN_URL = (func2url as Record<string, string>)['auth-login']
const PROFILE_URL = (func2url as Record<string, string>)['auth-profile']

function getSession(): string {
  return localStorage.getItem('session_id') || ''
}

function authHeaders() {
  return { 'Content-Type': 'application/json', 'X-Session-Id': getSession() }
}

export async function apiRegister(data: { name: string; email: string; password: string; referral_code?: string }) {
  const res = await fetch(REGISTER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка регистрации')
  return json as { session_id: string; user_id: number; referral_code: string }
}

export async function apiLogin(data: { email: string; password: string }) {
  const res = await fetch(LOGIN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка входа')
  return json as { session_id: string; user_id: number; name: string; referral_code: string; is_admin: boolean }
}

export async function apiLogout() {
  await fetch(LOGIN_URL + '/logout', { method: 'POST', headers: authHeaders() })
  localStorage.removeItem('session_id')
}

export async function apiProfile() {
  const res = await fetch(PROFILE_URL, { method: 'GET', headers: authHeaders() })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка')
  return json as {
    id: number; name: string; email: string; referral_code: string
    is_admin: boolean; deposit: number; dividends_total: number
    referral_total: number; referral_count: number; balance: number; rate: number
    created_at: string
  }
}