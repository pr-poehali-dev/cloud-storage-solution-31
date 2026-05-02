import func2url from '../../backend/func2url.json'

const REGISTER_URL = (func2url as Record<string, string>)['auth-register']
const LOGIN_URL = (func2url as Record<string, string>)['auth-login']
const PROFILE_URL = (func2url as Record<string, string>)['auth-profile']
const PAYMENT_CREATE_URL = (func2url as Record<string, string>)['payment-create']

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

export async function apiCreatePayment(data: { amount: number; method: 'card' | 'sbp'; return_url: string }) {
  const res = await fetch(PAYMENT_CREATE_URL, { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка создания платежа')
  return json as { payment_id: string; confirmation_url: string }
}

export async function apiWithdraw(data: { amount: number; method: 'bank_card' | 'sbp' | 'crypto'; details: Record<string, string> }) {
  const res = await fetch(PAYMENT_CREATE_URL + '/withdraw', { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка вывода')
  return json as { ok: boolean; withdrawal_id: number; status: string; message?: string }
}

export async function apiGetWithdrawals() {
  const res = await fetch(PAYMENT_CREATE_URL + '/withdrawals', { method: 'GET', headers: authHeaders() })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка')
  return json as { items: Array<{ id: number; amount: number; method: string; status: string; created_at: string }>; balance: number }
}

// ── Admin API ──────────────────────────────────────────────────

export async function apiAdminUsers() {
  const res = await fetch(PROFILE_URL + '/admin/users', { headers: authHeaders() })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка')
  return json as { users: AdminUser[]; total: number }
}

export async function apiAdminDeposits() {
  const res = await fetch(PROFILE_URL + '/admin/deposits', { headers: authHeaders() })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка')
  return json as { items: AdminDeposit[]; total: number }
}

export async function apiAdminWithdrawals() {
  const res = await fetch(PROFILE_URL + '/admin/withdrawals', { headers: authHeaders() })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка')
  return json as { items: AdminWithdrawal[]; total: number }
}

export async function apiAdminApproveWithdrawal(id: number) {
  const res = await fetch(PROFILE_URL + '/admin/withdrawals/approve', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ id }) })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка')
  return json
}

export async function apiAdminRejectWithdrawal(id: number) {
  const res = await fetch(PROFILE_URL + '/admin/withdrawals/reject', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ id }) })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка')
  return json
}

export async function apiAdminConfirmDeposit(id: number) {
  const res = await fetch(PROFILE_URL + '/admin/deposits/confirm', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ id }) })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка')
  return json
}

export async function apiAdminToggleAdmin(id: number) {
  const res = await fetch(PROFILE_URL + '/admin/users/toggle-admin', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ id }) })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка')
  return json as { ok: boolean; is_admin: boolean }
}

export interface AdminUser {
  id: number; name: string; email: string; referral_code: string
  is_admin: boolean; created_at: string; deposit: number
  dividends: number; ref_total: number; ref_count: number; balance: number
}
export interface AdminDeposit {
  id: number; user_id: number; user_name: string; user_email: string
  amount: number; method: string; status: string; external_id: string
  created_at: string; confirmed_at: string | null
}
export interface AdminWithdrawal {
  id: number; user_id: number; user_name: string; user_email: string
  amount: number; method: string; details: Record<string, string>
  status: string; external_id: string; created_at: string; processed_at: string | null
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