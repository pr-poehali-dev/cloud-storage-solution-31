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

export async function apiGetBoosts() {
  const res = await fetch(PROFILE_URL + '/boost', { headers: authHeaders() })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка')
  return json as { boosts: Array<{ id: number; amount: number; bonus_pct: number; created_at: string }>; boost_percent: number }
}

export async function apiCreateBoost(amount: number) {
  const res = await fetch(PROFILE_URL + '/boost', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ amount }) })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка')
  return json as { ok: boolean; boost_id: number; bonus_pct: number }
}

// ── Wheel API ──────────────────────────────────────────────────

export type WheelSegment = { label: string; mult: number; color: string }
export type WheelSpin = { id: number; bet: number; multiplier: number; win_amount: number; segment: string; created_at: string }

export async function apiGetWheelSpins() {
  const res = await fetch(PROFILE_URL + '/wheel', { headers: authHeaders() })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка')
  return json as { spins: WheelSpin[]; segments: WheelSegment[] }
}

export async function apiSpinWheel(bet: number) {
  const res = await fetch(PROFILE_URL + '/wheel', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ bet }) })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка')
  return json as { ok: boolean; spin_id: number; seg_idx: number; segment: string; multiplier: number; win_amount: number; bet: number; win: boolean }
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
  if (!res.ok) throw new Error(`${res.status}: ${json.error || 'Ошибка'}`)
  return json as {
    id: number; name: string; email: string; referral_code: string
    is_admin: boolean; deposit: number; dividends_total: number
    referral_total: number; referral_count: number; balance: number; rate: number
    created_at: string
  }
}

// ── Exchange P2P API ──────────────────────────────────────────────────────────

export interface ExchangeOrder {
  id: number
  user_id: number
  creator_name: string
  from_currency: string
  from_amount: number
  to_currency: string
  to_amount: number
  rate: number
  status: 'open' | 'completed' | 'cancelled'
  taker_user_id: number | null
  taker_name: string | null
  comment: string | null
  created_at: string
  completed_at: string | null
  is_mine?: boolean
}

// Exchange API — все запросы идут на базовый PROFILE_URL с ?action=
function exchUrl(action: string, extra?: Record<string, string>) {
  const p = new URLSearchParams({ action })
  if (extra) Object.entries(extra).forEach(([k, v]) => p.set(k, v))
  return PROFILE_URL + '?' + p.toString()
}

export async function apiExchangeOrders(params?: { from_currency?: string; to_currency?: string }) {
  const p = new URLSearchParams({ action: 'exchange-list' })
  if (params?.from_currency) p.set('from_currency', params.from_currency)
  if (params?.to_currency) p.set('to_currency', params.to_currency)
  const res = await fetch(PROFILE_URL + '?' + p.toString(), { headers: { 'X-Session-Id': getSession() } })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка')
  return json as { orders: ExchangeOrder[] }
}

export async function apiExchangeBalances() {
  const res = await fetch(exchUrl('exchange-balances'), { headers: authHeaders() })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка')
  return json as { balances: Record<string, number> }
}

export async function apiExchangeMyOrders() {
  const res = await fetch(exchUrl('exchange-my'), { headers: authHeaders() })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка')
  return json as { orders: ExchangeOrder[] }
}

export async function apiExchangeCreate(data: {
  from_currency: string; from_amount: number
  to_currency: string; to_amount: number; comment?: string
}) {
  const res = await fetch(exchUrl('exchange-create'), { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка')
  return json as { ok: boolean; order_id: number }
}

export async function apiExchangeTake(order_id: number) {
  const res = await fetch(exchUrl('exchange-take'), { method: 'POST', headers: authHeaders(), body: JSON.stringify({ order_id }) })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка')
  return json as { ok: boolean }
}

export async function apiExchangeCancel(order_id: number) {
  const res = await fetch(exchUrl('exchange-cancel'), { method: 'POST', headers: authHeaders(), body: JSON.stringify({ order_id }) })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка')
  return json as { ok: boolean }
}

export async function apiAdminDepositCrypto(data: { user_id: number; coin: string; amount: number }) {
  const res = await fetch(exchUrl('exchange-admin-deposit'), { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка')
  return json as { ok: boolean }
}

export async function apiAdminExchangeOrders() {
  const res = await fetch(exchUrl('exchange-list'), { headers: authHeaders() })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка')
  return json as { orders: ExchangeOrder[] }
}

export async function apiAdminUserBalances(user_id: number) {
  const res = await fetch(exchUrl('exchange-admin-balances', { user_id: String(user_id) }), { headers: authHeaders() })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Ошибка')
  return json as { balances: Record<string, number> }
}