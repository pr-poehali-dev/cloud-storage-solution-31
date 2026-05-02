import { useEffect, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Icon from '@/components/ui/icon'
import { useAuth } from '@/context/AuthContext'
import {
  apiAdminUsers, apiAdminDeposits, apiAdminWithdrawals,
  apiAdminApproveWithdrawal, apiAdminRejectWithdrawal,
  apiAdminConfirmDeposit, apiAdminToggleAdmin,
  type AdminUser, type AdminDeposit, type AdminWithdrawal
} from '@/lib/api'

type Tab = 'users' | 'deposits' | 'withdrawals'

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  confirmed: 'bg-green-500/15 text-green-400 border-green-500/30',
  completed: 'bg-green-500/15 text-green-400 border-green-500/30',
  failed: 'bg-red-500/15 text-red-400 border-red-500/30',
}

const METHOD_LABEL: Record<string, string> = {
  card: 'Карта', sbp: 'СБП', bank_card: 'Карта', crypto: 'Крипто'
}

function fmt(n: number) { return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtDate(s: string) {
  if (!s || s === 'None') return '—'
  return new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function AdminPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('withdrawals')

  const [users, setUsers] = useState<AdminUser[]>([])
  const [deposits, setDeposits] = useState<AdminDeposit[]>([])
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([])
  const [fetching, setFetching] = useState(false)
  const [actionId, setActionId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!loading && (!user || !user.is_admin)) navigate('/')
  }, [user, loading, navigate])

  const load = useCallback(async (t: Tab) => {
    setFetching(true)
    setError('')
    try {
      if (t === 'users') { const r = await apiAdminUsers(); setUsers(r.users) }
      else if (t === 'deposits') { const r = await apiAdminDeposits(); setDeposits(r.items) }
      else { const r = await apiAdminWithdrawals(); setWithdrawals(r.items) }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => { if (user?.is_admin) load(tab) }, [tab, user, load])

  const action = async (fn: () => Promise<unknown>) => {
    setError('')
    try { await fn(); load(tab) }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Ошибка') }
    finally { setActionId(null) }
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'withdrawals', label: 'Выводы', icon: 'ArrowUpRight' },
    { key: 'deposits', label: 'Депозиты', icon: 'ArrowDownLeft' },
    { key: 'users', label: 'Пользователи', icon: 'Users' },
  ]

  const pendingW = withdrawals.filter(w => w.status === 'pending').length
  const pendingD = deposits.filter(d => d.status === 'pending').length

  if (loading || !user) return null

  // Stats
  const totalDeposit = deposits.reduce((s, d) => d.status === 'confirmed' ? s + d.amount : s, 0)
  const totalWithdrawn = withdrawals.reduce((s, w) => w.status === 'completed' ? s + w.amount : s, 0)

  // Filter
  const q = search.toLowerCase()
  const filteredUsers = users.filter(u => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  const filteredDeposits = deposits.filter(d => !q || d.user_name.toLowerCase().includes(q) || d.user_email.toLowerCase().includes(q))
  const filteredWithdrawals = withdrawals.filter(w => !q || w.user_name.toLowerCase().includes(q) || w.user_email.toLowerCase().includes(q))

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-neutral-500 hover:text-neutral-300 transition-colors">
            <Icon name="ArrowLeft" size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Администрирование</h1>
            <p className="text-neutral-500 text-xs">{user.email}</p>
          </div>
        </div>
        <div className="flex gap-3 text-xs text-neutral-400">
          <span className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
            Депозитов: <span className="text-white font-medium">{fmt(totalDeposit)} ₽</span>
          </span>
          <span className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
            Выплачено: <span className="text-white font-medium">{fmt(totalWithdrawn)} ₽</span>
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setSearch('') }}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === t.key ? 'bg-[#FF4D00] text-white' : 'bg-white/5 border border-white/10 text-neutral-400 hover:bg-white/10'
              }`}>
              <Icon name={t.icon as Parameters<typeof Icon>[0]['name']} size={15} />
              {t.label}
              {t.key === 'withdrawals' && pendingW > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {pendingW}
                </span>
              )}
              {t.key === 'deposits' && pendingD > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-yellow-500 text-black text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {pendingD}
                </span>
              )}
            </button>
          ))}
          <div className="ml-auto">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по имени / email..."
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#FF4D00] w-64" />
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex gap-2">
            <Icon name="AlertCircle" size={15} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {fetching ? (
          <div className="flex items-center justify-center py-20 text-neutral-500">
            <Icon name="Loader" size={20} className="animate-spin mr-2" /> Загрузка...
          </div>
        ) : (
          <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>

            {/* WITHDRAWALS */}
            {tab === 'withdrawals' && (
              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-neutral-400">
                    <tr>
                      {['ID', 'Пользователь', 'Сумма', 'Метод', 'Реквизиты', 'Статус', 'Дата', 'Действия'].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredWithdrawals.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-neutral-500">Нет заявок</td></tr>
                    )}
                    {filteredWithdrawals.map(w => (
                      <tr key={w.id} className="hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3 text-neutral-500">#{w.id}</td>
                        <td className="px-4 py-3">
                          <p className="text-white font-medium">{w.user_name}</p>
                          <p className="text-neutral-500 text-xs">{w.user_email}</p>
                        </td>
                        <td className="px-4 py-3 text-white font-semibold">{fmt(w.amount)} ₽</td>
                        <td className="px-4 py-3 text-neutral-300">{METHOD_LABEL[w.method] || w.method}</td>
                        <td className="px-4 py-3 max-w-[180px]">
                          <div className="text-neutral-400 text-xs font-mono truncate">
                            {w.details?.card_number || w.details?.phone || w.details?.address || '—'}
                          </div>
                          {w.details?.coin && <div className="text-neutral-600 text-xs">{w.details.coin}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs border rounded-full px-2.5 py-0.5 ${STATUS_BADGE[w.status] || 'text-neutral-400'}`}>
                            {w.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-neutral-500 text-xs whitespace-nowrap">{fmtDate(w.created_at)}</td>
                        <td className="px-4 py-3">
                          {w.status === 'pending' && (
                            <div className="flex gap-1.5">
                              <Button size="sm" disabled={actionId === w.id}
                                className="bg-green-600 hover:bg-green-500 text-white border-0 h-7 px-2.5 text-xs"
                                onClick={() => { setActionId(w.id); action(() => apiAdminApproveWithdrawal(w.id)) }}>
                                <Icon name="Check" size={12} className="mr-1" /> Выдать
                              </Button>
                              <Button size="sm" variant="outline" disabled={actionId === w.id}
                                className="border-red-500/40 text-red-400 hover:bg-red-500/10 bg-transparent h-7 px-2.5 text-xs"
                                onClick={() => { setActionId(w.id); action(() => apiAdminRejectWithdrawal(w.id)) }}>
                                <Icon name="X" size={12} className="mr-1" /> Откл.
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* DEPOSITS */}
            {tab === 'deposits' && (
              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-neutral-400">
                    <tr>
                      {['ID', 'Пользователь', 'Сумма', 'Метод', 'Статус', 'Создан', 'Подтверждён', 'Действие'].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredDeposits.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-neutral-500">Нет депозитов</td></tr>
                    )}
                    {filteredDeposits.map(d => (
                      <tr key={d.id} className="hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3 text-neutral-500">#{d.id}</td>
                        <td className="px-4 py-3">
                          <p className="text-white font-medium">{d.user_name}</p>
                          <p className="text-neutral-500 text-xs">{d.user_email}</p>
                        </td>
                        <td className="px-4 py-3 text-white font-semibold">{fmt(d.amount)} ₽</td>
                        <td className="px-4 py-3 text-neutral-300">{METHOD_LABEL[d.method] || d.method}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs border rounded-full px-2.5 py-0.5 ${STATUS_BADGE[d.status] || 'text-neutral-400'}`}>
                            {d.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-neutral-500 text-xs whitespace-nowrap">{fmtDate(d.created_at)}</td>
                        <td className="px-4 py-3 text-neutral-500 text-xs whitespace-nowrap">{fmtDate(d.confirmed_at || '')}</td>
                        <td className="px-4 py-3">
                          {d.status === 'pending' && (
                            <Button size="sm" disabled={actionId === d.id}
                              className="bg-green-600 hover:bg-green-500 text-white border-0 h-7 px-2.5 text-xs"
                              onClick={() => { setActionId(d.id); action(() => apiAdminConfirmDeposit(d.id)) }}>
                              <Icon name="CheckCircle" size={12} className="mr-1" /> Подтвердить
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* USERS */}
            {tab === 'users' && (
              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-neutral-400">
                    <tr>
                      {['ID', 'Пользователь', 'Депозит', 'Дивиденды', 'Рефералы', 'Баланс', 'Ставка', 'Зарегистрирован', 'Права'].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredUsers.length === 0 && (
                      <tr><td colSpan={9} className="px-4 py-8 text-center text-neutral-500">Нет пользователей</td></tr>
                    )}
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3 text-neutral-500">#{u.id}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="text-white font-medium flex items-center gap-1.5">
                                {u.name}
                                {u.is_admin && <Badge className="text-[10px] bg-[#FF4D00]/20 text-[#FF4D00] border-[#FF4D00]/30 px-1.5 py-0">admin</Badge>}
                              </p>
                              <p className="text-neutral-500 text-xs">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-white">{fmt(u.deposit)} ₽</td>
                        <td className="px-4 py-3 text-green-400">{fmt(u.dividends)} ₽</td>
                        <td className="px-4 py-3 text-neutral-300">{fmt(u.ref_total)} ₽ <span className="text-neutral-600 text-xs">({u.ref_count} чел.)</span></td>
                        <td className="px-4 py-3 text-[#FF4D00] font-semibold">{fmt(u.balance)} ₽</td>
                        <td className="px-4 py-3 text-neutral-300">{u.deposit > 100000 ? '15%' : '10%'}/нед</td>
                        <td className="px-4 py-3 text-neutral-500 text-xs whitespace-nowrap">{fmtDate(u.created_at)}</td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="outline" disabled={actionId === u.id}
                            className="border-white/20 text-neutral-300 hover:bg-white/10 bg-transparent h-7 px-2.5 text-xs"
                            onClick={() => { setActionId(u.id); action(() => apiAdminToggleAdmin(u.id)) }}>
                            {u.is_admin ? <><Icon name="ShieldOff" size={12} className="mr-1" /> Снять</> : <><Icon name="Shield" size={12} className="mr-1" /> Сделать</>}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </motion.div>
        )}
      </div>
    </div>
  )
}
