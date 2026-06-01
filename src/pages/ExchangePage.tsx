import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Icon from '@/components/ui/icon'
import PageLayout from '@/components/landing/PageLayout'
import { useAuth } from '@/context/AuthContext'
import {
  apiExchangeOrders, apiExchangeBalances, apiExchangeMyOrders,
  apiExchangeCreate, apiExchangeTake, apiExchangeCancel,
  type ExchangeOrder
} from '@/lib/api'

const CURRENCIES = ['RUB', 'USDT', 'BTC', 'ETH', 'BNB', 'USDC']
const COIN_COLORS: Record<string, string> = {
  RUB: 'text-green-400', USDT: 'text-emerald-400', BTC: 'text-orange-400',
  ETH: 'text-blue-400', BNB: 'text-yellow-400', USDC: 'text-sky-400',
}
const COIN_ICONS: Record<string, string> = {
  RUB: '₽', USDT: '💚', BTC: '🟠', ETH: '🔵', BNB: '🟡', USDC: '🔹',
}

function fmt(amount: number, currency: string) {
  if (currency === 'RUB') return amount.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' ₽'
  if (['BTC', 'ETH'].includes(currency)) return amount.toFixed(6) + ' ' + currency
  return amount.toFixed(2) + ' ' + currency
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'только что'
  if (diff < 3600) return Math.floor(diff / 60) + ' мин назад'
  if (diff < 86400) return Math.floor(diff / 3600) + ' ч назад'
  return Math.floor(diff / 86400) + ' дн назад'
}

type Tab = 'market' | 'create' | 'my'

export default function ExchangePage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab] = useState<Tab>('market')
  const [orders, setOrders] = useState<ExchangeOrder[]>([])
  const [myOrders, setMyOrders] = useState<ExchangeOrder[]>([])
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  // Фильтры
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  // Форма создания
  const [fromCur, setFromCur] = useState('RUB')
  const [toCur, setToCur] = useState('USDT')
  const [fromAmt, setFromAmt] = useState('')
  const [toAmt, setToAmt] = useState('')
  const [comment, setComment] = useState('')
  const [creating, setCreating] = useState(false)

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const loadData = useCallback(async () => {
    try {
      const [ordersRes, myRes] = await Promise.all([
        apiExchangeOrders(filterFrom || filterTo ? { from_currency: filterFrom || undefined, to_currency: filterTo || undefined } : undefined),
        user ? apiExchangeMyOrders() : Promise.resolve({ orders: [] }),
      ])
      setOrders(ordersRes.orders)
      setMyOrders(myRes.orders)
    } finally {
      setLoading(false)
    }
  }, [filterFrom, filterTo, user])

  const loadBalances = useCallback(async () => {
    if (!user) return
    try {
      const res = await apiExchangeBalances()
      setBalances(res.balances)
    } catch { /* ignore */ }
  }, [user])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { loadBalances() }, [loadBalances])

  const handleTake = async (orderId: number) => {
    if (!user) { navigate('/login'); return }
    setActionLoading(orderId)
    try {
      await apiExchangeTake(orderId)
      showToast('ok', 'Сделка совершена!')
      loadData(); loadBalances()
    } catch (e: unknown) {
      showToast('err', e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = async (orderId: number) => {
    setActionLoading(orderId)
    try {
      await apiExchangeCancel(orderId)
      showToast('ok', 'Заявка отменена, средства возвращены')
      loadData(); loadBalances()
    } catch (e: unknown) {
      showToast('err', e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) { navigate('/login'); return }
    if (fromCur === toCur) { showToast('err', 'Нельзя обменять на ту же валюту'); return }
    const fa = parseFloat(fromAmt)
    const ta = parseFloat(toAmt)
    if (!fa || !ta || fa <= 0 || ta <= 0) { showToast('err', 'Введите суммы'); return }
    setCreating(true)
    try {
      await apiExchangeCreate({ from_currency: fromCur, from_amount: fa, to_currency: toCur, to_amount: ta, comment })
      showToast('ok', 'Заявка создана!')
      setFromAmt(''); setToAmt(''); setComment('')
      setTab('my')
      loadData(); loadBalances()
    } catch (e: unknown) {
      showToast('err', e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setCreating(false)
    }
  }

  const filteredOrders = orders.filter(o => {
    if (filterFrom && o.from_currency !== filterFrom) return false
    if (filterTo && o.to_currency !== filterTo) return false
    return true
  })

  return (
    <PageLayout imgIndex={0}>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl flex items-center gap-2 text-sm font-medium shadow-xl
              ${toast.type === 'ok' ? 'bg-green-500/20 border border-green-500/40 text-green-300' : 'bg-red-500/20 border border-red-500/40 text-red-300'}`}
          >
            <Icon name={toast.type === 'ok' ? 'CheckCircle' : 'AlertCircle'} size={16} />
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen overflow-y-auto">
        <div className="max-w-5xl mx-auto p-5 md:p-8">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <Link to="/dashboard" className="text-neutral-500 hover:text-neutral-300 text-sm flex items-center gap-1.5 mb-5 transition-colors w-fit">
              <Icon name="ArrowLeft" size={14} /> Назад в кабинет
            </Link>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white">P2P Обменник</h1>
                <p className="text-neutral-400 mt-1 text-sm">Прямые сделки между пользователями — без посредников</p>
              </div>
              <button onClick={() => { loadData(); loadBalances() }}
                className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-300 text-sm transition-colors mt-1">
                <Icon name="RefreshCw" size={14} /> Обновить
              </button>
            </div>
          </motion.div>

          {/* Балансы */}
          {user && Object.keys(balances).length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
              {CURRENCIES.map(cur => (
                <div key={cur} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                  <p className="text-lg mb-0.5">{COIN_ICONS[cur]}</p>
                  <p className={`text-xs font-bold ${COIN_COLORS[cur]}`}>{cur}</p>
                  <p className="text-white text-xs font-mono mt-1">
                    {cur === 'RUB'
                      ? (balances[cur] ?? 0).toFixed(2)
                      : (balances[cur] ?? 0).toFixed(4)}
                  </p>
                </div>
              ))}
            </motion.div>
          )}

          {/* Tabs */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="flex gap-2 mb-6">
            {([
              { key: 'market', label: 'Рынок', icon: 'BarChart2' },
              { key: 'create', label: 'Создать заявку', icon: 'Plus' },
              { key: 'my', label: 'Мои заявки', icon: 'User' },
            ] as { key: Tab; label: string; icon: string }[]).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  tab === t.key
                    ? 'bg-[#FF4D00] text-white shadow-lg shadow-orange-900/30'
                    : 'bg-white/5 border border-white/10 text-neutral-400 hover:bg-white/10'
                }`}>
                <Icon name={t.icon as Parameters<typeof Icon>[0]['name']} size={15} />
                {t.label}
                {t.key === 'my' && myOrders.filter(o => o.status === 'open').length > 0 && (
                  <span className="bg-[#FF4D00] text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                    {myOrders.filter(o => o.status === 'open').length}
                  </span>
                )}
              </button>
            ))}
          </motion.div>

          {/* ── MARKET ────────────────────────────────────────────────── */}
          {tab === 'market' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              {/* Фильтры */}
              <div className="flex flex-wrap gap-2 mb-4">
                <select value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                  className="bg-white/5 border border-white/10 text-neutral-300 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-[#FF4D00]">
                  <option value="">Отдаю: все</option>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <Icon name="ArrowRight" size={16} className="text-neutral-600 self-center" />
                <select value={filterTo} onChange={e => setFilterTo(e.target.value)}
                  className="bg-white/5 border border-white/10 text-neutral-300 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-[#FF4D00]">
                  <option value="">Получаю: все</option>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {(filterFrom || filterTo) && (
                  <button onClick={() => { setFilterFrom(''); setFilterTo('') }}
                    className="text-neutral-500 hover:text-neutral-300 text-sm flex items-center gap-1 transition-colors">
                    <Icon name="X" size={13} /> Сбросить
                  </button>
                )}
              </div>

              {loading ? (
                <div className="flex justify-center py-16">
                  <div className="w-6 h-6 border-2 border-[#FF4D00] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <Icon name="ArrowLeftRight" size={28} className="text-neutral-600" />
                  </div>
                  <p className="text-neutral-400 font-medium">Нет открытых заявок</p>
                  <p className="text-neutral-600 text-sm mt-1">Создайте первую заявку</p>
                  <Button onClick={() => setTab('create')} size="sm"
                    className="mt-4 bg-[#FF4D00] hover:bg-[#e64500] text-white border-0">
                    Создать заявку
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredOrders.map(order => (
                    <motion.div key={order.id}
                      initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                      className={`bg-white/5 border rounded-2xl p-4 flex flex-wrap items-center gap-4 ${
                        order.is_mine ? 'border-[#FF4D00]/30' : 'border-white/10'
                      }`}>
                      {/* Пара валют */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xl">{COIN_ICONS[order.from_currency]}</span>
                          <div>
                            <p className={`font-bold text-base ${COIN_COLORS[order.from_currency]}`}>
                              {fmt(order.from_amount, order.from_currency)}
                            </p>
                            <p className="text-neutral-600 text-xs">{order.from_currency}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-center">
                          <Icon name="ArrowRight" size={16} className="text-neutral-500" />
                          <p className="text-neutral-600 text-xs">курс {order.rate.toFixed(4)}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xl">{COIN_ICONS[order.to_currency]}</span>
                          <div>
                            <p className={`font-bold text-base ${COIN_COLORS[order.to_currency]}`}>
                              {fmt(order.to_amount, order.to_currency)}
                            </p>
                            <p className="text-neutral-600 text-xs">{order.to_currency}</p>
                          </div>
                        </div>
                      </div>

                      {/* Инфо */}
                      <div className="text-right shrink-0">
                        <p className="text-neutral-400 text-xs">{order.creator_name}</p>
                        <p className="text-neutral-600 text-xs">{timeAgo(order.created_at)}</p>
                        {order.comment && (
                          <p className="text-neutral-500 text-xs mt-0.5 max-w-[120px] truncate">{order.comment}</p>
                        )}
                      </div>

                      {/* Действие */}
                      {order.is_mine ? (
                        <span className="text-[#FF4D00] text-xs font-medium bg-[#FF4D00]/10 px-3 py-1.5 rounded-lg">Моя заявка</span>
                      ) : (
                        <Button size="sm" onClick={() => handleTake(order.id)}
                          disabled={actionLoading === order.id}
                          className="bg-[#FF4D00] hover:bg-[#e64500] text-white border-0 shrink-0">
                          {actionLoading === order.id
                            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : 'Принять'}
                        </Button>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── CREATE ────────────────────────────────────────────────── */}
          {tab === 'create' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="max-w-lg">
              {!user && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex gap-3 mb-5">
                  <Icon name="AlertTriangle" size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-yellow-400 text-sm">
                    Для создания заявки нужно <Link to="/login" className="underline">войти в аккаунт</Link>
                  </p>
                </div>
              )}

              <form onSubmit={handleCreate} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
                {/* Отдаю */}
                <div>
                  <Label className="text-neutral-300 mb-2 block text-sm">Отдаю</Label>
                  <div className="flex gap-2">
                    <select value={fromCur} onChange={e => setFromCur(e.target.value)}
                      className="bg-white/5 border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#FF4D00] shrink-0">
                      {CURRENCIES.map(c => <option key={c} value={c}>{COIN_ICONS[c]} {c}</option>)}
                    </select>
                    <Input type="number" step="any" value={fromAmt} onChange={e => setFromAmt(e.target.value)}
                      placeholder="Сумма" required min={0}
                      className="bg-white/5 border-white/20 text-white placeholder:text-neutral-600 focus:border-[#FF4D00] h-11" />
                  </div>
                  {user && balances[fromCur] !== undefined && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <p className="text-neutral-600 text-xs">Доступно: <span className={COIN_COLORS[fromCur]}>{fmt(balances[fromCur], fromCur)}</span></p>
                      <button type="button" onClick={() => setFromAmt(String(balances[fromCur]))}
                        className="text-[#FF4D00] text-xs hover:underline">Всё</button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center">
                  <button type="button"
                    onClick={() => { const tmp = fromCur; setFromCur(toCur); setToCur(tmp); setFromAmt(toAmt); setToAmt(fromAmt) }}
                    className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all hover:rotate-180 duration-300">
                    <Icon name="ArrowUpDown" size={16} className="text-neutral-400" />
                  </button>
                </div>

                {/* Получаю */}
                <div>
                  <Label className="text-neutral-300 mb-2 block text-sm">Получаю</Label>
                  <div className="flex gap-2">
                    <select value={toCur} onChange={e => setToCur(e.target.value)}
                      className="bg-white/5 border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#FF4D00] shrink-0">
                      {CURRENCIES.map(c => <option key={c} value={c}>{COIN_ICONS[c]} {c}</option>)}
                    </select>
                    <Input type="number" step="any" value={toAmt} onChange={e => setToAmt(e.target.value)}
                      placeholder="Сумма" required min={0}
                      className="bg-white/5 border-white/20 text-white placeholder:text-neutral-600 focus:border-[#FF4D00] h-11" />
                  </div>
                </div>

                {/* Курс */}
                {fromAmt && toAmt && parseFloat(fromAmt) > 0 && parseFloat(toAmt) > 0 && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
                    <Icon name="TrendingUp" size={14} className="text-[#FF4D00]" />
                    <p className="text-neutral-400 text-xs">
                      Курс: 1 {fromCur} = <span className="text-white font-medium">{(parseFloat(toAmt) / parseFloat(fromAmt)).toFixed(6)} {toCur}</span>
                    </p>
                  </div>
                )}

                {/* Комментарий */}
                <div>
                  <Label className="text-neutral-300 mb-2 block text-sm">Комментарий <span className="text-neutral-600">(необязательно)</span></Label>
                  <Input value={comment} onChange={e => setComment(e.target.value)} maxLength={200}
                    placeholder="Например: только СБП, пишите в Telegram..."
                    className="bg-white/5 border-white/20 text-white placeholder:text-neutral-600 focus:border-[#FF4D00] h-11" />
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex gap-2">
                  <Icon name="Info" size={15} className="text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-blue-400 text-xs">
                    Средства будут заблокированы до принятия заявки. При отмене — полностью возвращены.
                  </p>
                </div>

                <Button type="submit" disabled={creating || !user} size="lg"
                  className="w-full bg-[#FF4D00] hover:bg-[#e64500] text-white border-0 h-11">
                  {creating ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Создаём...
                    </span>
                  ) : 'Разместить заявку'}
                </Button>
              </form>
            </motion.div>
          )}

          {/* ── MY ORDERS ─────────────────────────────────────────────── */}
          {tab === 'my' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              {!user ? (
                <div className="text-center py-16">
                  <p className="text-neutral-400">
                    <Link to="/login" className="text-[#FF4D00] hover:underline">Войдите</Link>, чтобы видеть свои заявки
                  </p>
                </div>
              ) : myOrders.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <Icon name="ClipboardList" size={28} className="text-neutral-600" />
                  </div>
                  <p className="text-neutral-400 font-medium">У вас нет заявок</p>
                  <Button onClick={() => setTab('create')} size="sm"
                    className="mt-4 bg-[#FF4D00] hover:bg-[#e64500] text-white border-0">
                    Создать заявку
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {myOrders.map(order => {
                    const statusLabel = { open: 'Открыта', completed: 'Выполнена', cancelled: 'Отменена' }[order.status]
                    const statusColor = { open: 'text-green-400 bg-green-500/10 border-green-500/20', completed: 'text-blue-400 bg-blue-500/10 border-blue-500/20', cancelled: 'text-neutral-500 bg-white/5 border-white/10' }[order.status]
                    return (
                      <motion.div key={order.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xl">{COIN_ICONS[order.from_currency]}</span>
                            <div>
                              <p className={`font-bold ${COIN_COLORS[order.from_currency]}`}>{fmt(order.from_amount, order.from_currency)}</p>
                              <p className="text-neutral-600 text-xs">{order.from_currency}</p>
                            </div>
                          </div>
                          <Icon name="ArrowRight" size={14} className="text-neutral-600 shrink-0" />
                          <div className="flex items-center gap-1.5">
                            <span className="text-xl">{COIN_ICONS[order.to_currency]}</span>
                            <div>
                              <p className={`font-bold ${COIN_COLORS[order.to_currency]}`}>{fmt(order.to_amount, order.to_currency)}</p>
                              <p className="text-neutral-600 text-xs">{order.to_currency}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${statusColor}`}>{statusLabel}</span>
                          <p className="text-neutral-600 text-xs">{timeAgo(order.created_at)}</p>
                          {order.status === 'open' && (
                            <Button variant="outline" size="sm" onClick={() => handleCancel(order.id)}
                              disabled={actionLoading === order.id}
                              className="border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 text-xs h-8">
                              {actionLoading === order.id
                                ? <span className="w-3 h-3 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                                : 'Отменить'}
                            </Button>
                          )}
                          {order.status === 'completed' && order.taker_name && (
                            <p className="text-neutral-500 text-xs">с {order.taker_name}</p>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </PageLayout>
  )
}
