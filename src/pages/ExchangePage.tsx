import { useEffect, useState, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import Icon from '@/components/ui/icon'
import { useAuth } from '@/context/AuthContext'
import {
  apiExchangeOrders, apiExchangeBalances, apiExchangeMyOrders,
  apiExchangeCreate, apiExchangeTake, apiExchangeCancel,
  apiTxFeed, apiExchangeStats,
  type ExchangeOrder, type TxFeedItem,
} from '@/lib/api'

// ── Константы ──────────────────────────────────────────────────
const CURRENCIES = ['RUB', 'USDT', 'BTC', 'ETH', 'BNB', 'USDC']

const COIN_META: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
  RUB:  { color: 'text-green-400',   bg: 'bg-green-500/10',   border: 'border-green-500/20',   icon: '₽',  label: 'Рубль'   },
  USDT: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: '₮',  label: 'Tether'  },
  BTC:  { color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20',  icon: '₿',  label: 'Bitcoin' },
  ETH:  { color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    icon: 'Ξ',  label: 'Ethereum'},
  BNB:  { color: 'text-yellow-400',  bg: 'bg-yellow-500/10',  border: 'border-yellow-500/20',  icon: 'B',  label: 'BNB'     },
  USDC: { color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20',     icon: '$',  label: 'USD Coin'},
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'text-green-400 bg-green-500/10 border-green-500/20',
  pending:   'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  failed:    'text-red-400 bg-red-500/10 border-red-500/20',
}

function fmtAmt(n: number, cur: string) {
  if (cur === 'RUB')  return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
  if (['BTC','ETH'].includes(cur)) return n.toFixed(6)
  return n.toFixed(2)
}

function shortHash(h: string) { return h.slice(0, 8) + '…' + h.slice(-4) }
function shortAddr(a: string) { return a.slice(0, 8) + '…' + a.slice(-4) }

function timeAgo(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000
  if (s < 5)   return 'только что'
  if (s < 60)  return Math.floor(s) + 'с назад'
  if (s < 3600) return Math.floor(s / 60) + 'м назад'
  return Math.floor(s / 3600) + 'ч назад'
}

type Tab = 'explorer' | 'market' | 'create' | 'my'

// ── CoinBadge ──────────────────────────────────────────────────
function CoinBadge({ cur }: { cur: string }) {
  const m = COIN_META[cur] ?? { color: 'text-neutral-400', bg: 'bg-white/5', border: 'border-white/10', icon: '?', label: cur }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${m.color} ${m.bg} ${m.border}`}>
      <span className="font-mono">{m.icon}</span> {cur}
    </span>
  )
}

// ── TxRow ──────────────────────────────────────────────────────
function TxRow({ tx, isNew }: { tx: TxFeedItem; isNew: boolean }) {
  return (
    <motion.div
      initial={isNew ? { opacity: 0, x: -12, backgroundColor: 'rgba(34,197,94,0.08)' } : { opacity: 1 }}
      animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(0,0,0,0)' }}
      transition={{ duration: 0.6 }}
      className="grid grid-cols-[1fr_auto_1fr_auto_auto] gap-3 items-center px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors text-xs"
    >
      {/* Hash + адреса */}
      <div className="min-w-0">
        <p className="font-mono text-purple-400 truncate text-[11px]">{shortHash(tx.tx_hash)}</p>
        <p className="text-neutral-600 truncate mt-0.5">
          <span className="text-neutral-500">{shortAddr(tx.from_addr)}</span>
          <span className="text-neutral-700 mx-1">→</span>
          <span className="text-neutral-500">{shortAddr(tx.to_addr)}</span>
        </p>
      </div>

      {/* От */}
      <div className="text-right shrink-0">
        <p className={`font-mono font-bold ${COIN_META[tx.from_cur]?.color ?? 'text-white'}`}>
          {fmtAmt(tx.from_amount, tx.from_cur)}
        </p>
        <CoinBadge cur={tx.from_cur} />
      </div>

      {/* Стрелка */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-1 text-neutral-600">
          <div className="h-px w-6 bg-neutral-700" />
          <Icon name="ArrowRight" size={12} className="text-neutral-500" />
          <div className="h-px w-6 bg-neutral-700" />
        </div>
      </div>

      {/* К */}
      <div className="text-right shrink-0">
        <p className={`font-mono font-bold ${COIN_META[tx.to_cur]?.color ?? 'text-white'}`}>
          {fmtAmt(tx.to_amount, tx.to_cur)}
        </p>
        <CoinBadge cur={tx.to_cur} />
      </div>

      {/* Статус + время */}
      <div className="text-right shrink-0">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[tx.status] ?? STATUS_COLORS.confirmed}`}>
          {tx.status === 'confirmed' ? '✓' : tx.status === 'pending' ? '⏳' : '✗'}
        </span>
        <p className="text-neutral-600 mt-1">{timeAgo(tx.created_at)}</p>
        {!tx.is_bot && <p className="text-purple-500 text-[10px] font-bold mt-0.5">USER</p>}
      </div>
    </motion.div>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function ExchangePage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab] = useState<Tab>('explorer')
  const [orders, setOrders]       = useState<ExchangeOrder[]>([])
  const [myOrders, setMyOrders]   = useState<ExchangeOrder[]>([])
  const [balances, setBalances]   = useState<Record<string, number>>({})
  const [txFeed, setTxFeed]       = useState<TxFeedItem[]>([])
  const [newIds, setNewIds]       = useState<Set<number>>(new Set())
  const [stats, setStats]         = useState({ total_tx: 0, p2p_done: 0, volume_usdt: 0, active_wallets: 0 })
  const [loading, setLoading]     = useState(true)
  const [actionId, setActionId]   = useState<number | null>(null)
  const [toast, setToast]         = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const lastIdRef = useRef(0)
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  // Форма создания
  const [fromCur, setFromCur] = useState('RUB')
  const [toCur,   setToCur]   = useState('USDT')
  const [fromAmt, setFromAmt] = useState('')
  const [toAmt,   setToAmt]   = useState('')
  const [comment, setComment] = useState('')
  const [creating, setCreating] = useState(false)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo,   setFilterTo]   = useState('')

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 3500)
  }

  // Загрузка начальная
  const loadAll = useCallback(async () => {
    try {
      const [ordersRes, feedRes, statsRes] = await Promise.all([
        apiExchangeOrders(),
        apiTxFeed(),
        apiExchangeStats(),
      ])
      setOrders(ordersRes.orders)
      setTxFeed(feedRes.txs)
      setStats(statsRes)
      if (feedRes.txs.length) lastIdRef.current = feedRes.txs[0].id
      if (user) {
        const [myRes, balRes] = await Promise.all([apiExchangeMyOrders(), apiExchangeBalances()])
        setMyOrders(myRes.orders)
        setBalances(balRes.balances)
      }
    } finally { setLoading(false) }
  }, [user])

  useEffect(() => { loadAll() }, [loadAll])

  // Polling новых транзакций каждые 4 сек
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await apiTxFeed(lastIdRef.current || undefined)
        if (res.txs.length) {
          lastIdRef.current = res.txs[0].id
          setNewIds(new Set(res.txs.map(t => t.id)))
          setTxFeed(prev => [...res.txs, ...prev].slice(0, 60))
          setTimeout(() => setNewIds(new Set()), 3000)
        }
      } catch { /* ignore */ }
    }, 4000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const handleTake = async (id: number) => {
    if (!user) { navigate('/login'); return }
    setActionId(id)
    try {
      await apiExchangeTake(id)
      showToast('ok', 'Сделка совершена!')
      loadAll()
    } catch (e: unknown) { showToast('err', e instanceof Error ? e.message : 'Ошибка') }
    finally { setActionId(null) }
  }

  const handleCancel = async (id: number) => {
    setActionId(id)
    try {
      await apiExchangeCancel(id)
      showToast('ok', 'Заявка отменена, средства возвращены')
      loadAll()
    } catch (e: unknown) { showToast('err', e instanceof Error ? e.message : 'Ошибка') }
    finally { setActionId(null) }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) { navigate('/login'); return }
    if (fromCur === toCur) { showToast('err', 'Нельзя обменять на ту же валюту'); return }
    const fa = parseFloat(fromAmt), ta = parseFloat(toAmt)
    if (!fa || !ta) { showToast('err', 'Введите суммы'); return }
    setCreating(true)
    try {
      await apiExchangeCreate({ from_currency: fromCur, from_amount: fa, to_currency: toCur, to_amount: ta, comment })
      showToast('ok', 'Заявка создана и попала в живую ленту!')
      setFromAmt(''); setToAmt(''); setComment('')
      setTab('explorer')
      loadAll()
    } catch (e: unknown) { showToast('err', e instanceof Error ? e.message : 'Ошибка') }
    finally { setCreating(false) }
  }

  const filteredOrders = orders.filter(o => {
    if (filterFrom && o.from_currency !== filterFrom) return false
    if (filterTo   && o.to_currency   !== filterTo)   return false
    return true
  })

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'explorer', label: 'Эксплорер',    icon: 'Activity' },
    { key: 'market',   label: 'P2P Рынок',    icon: 'ArrowLeftRight' },
    { key: 'create',   label: 'Создать',       icon: 'Plus' },
    { key: 'my',       label: 'Мои заявки',   icon: 'User' },
  ]

  return (
    <div className="min-h-screen bg-[#080808] text-white">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl flex items-center gap-2 text-sm font-medium shadow-xl border
              ${toast.type === 'ok' ? 'bg-green-500/15 border-green-500/30 text-green-300' : 'bg-red-500/15 border-red-500/30 text-red-300'}`}>
            <Icon name={toast.type === 'ok' ? 'CheckCircle' : 'AlertCircle'} size={16} />
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Link to="/dashboard" className="text-neutral-600 hover:text-neutral-400 text-xs flex items-center gap-1.5 mb-4 transition-colors w-fit">
            <Icon name="ArrowLeft" size={13} /> Кабинет
          </Link>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <Icon name="Activity" size={16} className="text-white" />
                </span>
                ADFUND Chain Explorer
              </h1>
              <p className="text-neutral-500 text-xs mt-1">Все транзакции платформы в реальном времени</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-xs font-medium">Live</span>
              <button onClick={loadAll} className="ml-2 text-neutral-600 hover:text-neutral-400 transition-colors">
                <Icon name="RefreshCw" size={14} />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Stats Bar */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Транзакций всего', value: stats.total_tx.toLocaleString(), icon: 'Hash', color: 'text-purple-400' },
            { label: 'P2P сделок', value: stats.p2p_done.toLocaleString(), icon: 'ArrowLeftRight', color: 'text-blue-400' },
            { label: 'Объём USDT', value: stats.volume_usdt.toLocaleString('ru-RU', { maximumFractionDigits: 0 }), icon: 'TrendingUp', color: 'text-emerald-400' },
            { label: 'Адресов', value: stats.active_wallets.toLocaleString(), icon: 'Wallet', color: 'text-orange-400' },
          ].map((s, i) => (
            <div key={i} className="bg-white/3 border border-white/8 rounded-2xl px-4 py-3 flex items-center gap-3">
              <Icon name={s.icon as Parameters<typeof Icon>[0]['name']} size={18} className={s.color} />
              <div>
                <p className="text-white font-bold text-base tabular-nums">{s.value}</p>
                <p className="text-neutral-600 text-xs">{s.label}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Balances */}
        {user && Object.keys(balances).length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}
            className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
            {CURRENCIES.map(cur => {
              const m = COIN_META[cur]
              const val = balances[cur] ?? 0
              return (
                <div key={cur} className={`border rounded-xl p-3 text-center ${val > 0 ? `${m.bg} ${m.border}` : 'bg-white/3 border-white/5'}`}>
                  <p className={`text-xl font-black mb-0.5 ${m.color}`}>{m.icon}</p>
                  <p className={`text-xs font-bold ${m.color}`}>{cur}</p>
                  <p className={`text-xs font-mono mt-1 ${val > 0 ? 'text-white' : 'text-neutral-700'}`}>
                    {cur === 'RUB' ? val.toFixed(2) : val.toFixed(cur === 'BTC' ? 6 : 4)}
                  </p>
                </div>
              )
            })}
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-1.5 mb-5 bg-white/3 border border-white/8 rounded-2xl p-1.5 w-fit">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === t.key ? 'bg-white/10 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'
              }`}>
              <Icon name={t.icon as Parameters<typeof Icon>[0]['name']} size={14} />
              {t.label}
              {t.key === 'my' && myOrders.length > 0 && (
                <span className="bg-purple-500/30 text-purple-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{myOrders.length}</span>
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── EXPLORER TAB ─────────────────────────────────── */}
          {tab === 'explorer' && (
            <motion.div key="explorer" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="bg-white/3 border border-white/8 rounded-2xl overflow-hidden">
                {/* Заголовок таблицы */}
                <div className="grid grid-cols-[1fr_auto_1fr_auto_auto] gap-3 px-4 py-3 border-b border-white/8 bg-white/3 text-neutral-600 text-[11px] uppercase tracking-wider font-semibold">
                  <span>Хэш / Адрес</span>
                  <span className="text-right">Отдаёт</span>
                  <span className="text-center"></span>
                  <span className="text-right">Получает</span>
                  <span className="text-right">Статус</span>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-16 text-neutral-600 gap-2">
                    <span className="w-4 h-4 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin" />
                    Загрузка ленты...
                  </div>
                ) : txFeed.length === 0 ? (
                  <p className="text-center text-neutral-600 py-16">Нет транзакций</p>
                ) : (
                  txFeed.map(tx => (
                    <TxRow key={tx.id} tx={tx} isNew={newIds.has(tx.id)} />
                  ))
                )}
              </div>
              <p className="text-neutral-700 text-xs text-center mt-3">
                Обновляется каждые 4 секунды · Боты генерируют реальные обменные операции
              </p>
            </motion.div>
          )}

          {/* ── MARKET TAB ───────────────────────────────────── */}
          {tab === 'market' && (
            <motion.div key="market" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* Фильтры */}
              <div className="flex flex-wrap gap-2 mb-4">
                {['', ...CURRENCIES].map(cur => (
                  <button key={cur || 'all-from'} onClick={() => setFilterFrom(cur)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      filterFrom === cur
                        ? (cur ? `${COIN_META[cur]?.bg} ${COIN_META[cur]?.border} ${COIN_META[cur]?.color}` : 'bg-white/10 border-white/20 text-white')
                        : 'bg-white/3 border-white/8 text-neutral-500 hover:text-neutral-300'
                    }`}>
                    {cur || 'Все'}
                  </button>
                ))}
                <span className="text-neutral-700 self-center">→</span>
                {['', ...CURRENCIES].map(cur => (
                  <button key={cur || 'all-to'} onClick={() => setFilterTo(cur)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      filterTo === cur
                        ? (cur ? `${COIN_META[cur]?.bg} ${COIN_META[cur]?.border} ${COIN_META[cur]?.color}` : 'bg-white/10 border-white/20 text-white')
                        : 'bg-white/3 border-white/8 text-neutral-500 hover:text-neutral-300'
                    }`}>
                    {cur || 'Все'}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {filteredOrders.length === 0 && !loading && (
                  <div className="text-center py-16 text-neutral-600">
                    <Icon name="ArrowLeftRight" size={32} className="mx-auto mb-3 opacity-30" />
                    <p>Открытых заявок нет</p>
                    <button onClick={() => setTab('create')} className="text-purple-400 hover:text-purple-300 text-sm mt-2 transition-colors">
                      Создать первую →
                    </button>
                  </div>
                )}
                {filteredOrders.map(o => (
                  <motion.div key={o.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-white/3 border border-white/8 rounded-2xl p-4 hover:bg-white/5 hover:border-white/12 transition-all">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        {/* Пара */}
                        <div className="flex items-center gap-1.5">
                          <CoinBadge cur={o.from_currency} />
                          <Icon name="ArrowRight" size={13} className="text-neutral-600" />
                          <CoinBadge cur={o.to_currency} />
                        </div>
                        <div>
                          <p className="text-white font-bold">
                            {fmtAmt(o.from_amount, o.from_currency)} → {fmtAmt(o.to_amount, o.to_currency)}
                          </p>
                          <p className="text-neutral-500 text-xs mt-0.5">
                            Курс: 1 {o.from_currency} = {Number(o.rate).toFixed(4)} {o.to_currency}
                            {o.creator_name && <span className="ml-2 text-neutral-600">· {o.creator_name}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {o.comment && (
                          <span className="text-neutral-600 text-xs italic max-w-[140px] truncate">"{o.comment}"</span>
                        )}
                        {o.is_mine ? (
                          <Button size="sm" variant="outline"
                            disabled={actionId === o.id}
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10 bg-transparent h-8 text-xs"
                            onClick={() => handleCancel(o.id)}>
                            {actionId === o.id ? <span className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" /> : 'Отменить'}
                          </Button>
                        ) : (
                          <Button size="sm"
                            disabled={actionId === o.id}
                            className="bg-purple-600 hover:bg-purple-500 text-white border-0 h-8 text-xs"
                            onClick={() => handleTake(o.id)}>
                            {actionId === o.id ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Принять сделку'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── CREATE TAB ───────────────────────────────────── */}
          {tab === 'create' && (
            <motion.div key="create" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="max-w-lg">
              {!user ? (
                <div className="text-center py-12">
                  <p className="text-neutral-500 mb-4">Войдите, чтобы создать заявку</p>
                  <Button asChild className="bg-purple-600 hover:bg-purple-500 border-0">
                    <Link to="/login">Войти</Link>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleCreate} className="space-y-5">
                  <div className="bg-white/3 border border-white/8 rounded-2xl p-5 space-y-4">
                    <h3 className="text-white font-semibold flex items-center gap-2">
                      <Icon name="Plus" size={16} className="text-purple-400" /> Новая P2P заявка
                    </h3>

                    {/* Отдаю */}
                    <div>
                      <label className="text-neutral-500 text-xs mb-2 block uppercase tracking-wide">Отдаю</label>
                      <div className="flex gap-2">
                        <select value={fromCur} onChange={e => setFromCur(e.target.value)}
                          className="bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50 w-28">
                          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input type="number" value={fromAmt} onChange={e => setFromAmt(e.target.value)}
                          placeholder="0.00" step="any" min="0"
                          className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder:text-neutral-700 focus:outline-none focus:border-purple-500/50 text-sm" />
                      </div>
                      {user && fromCur && (
                        <p className="text-neutral-700 text-xs mt-1.5">
                          Баланс: {fmtAmt(balances[fromCur] ?? 0, fromCur)} {fromCur}
                        </p>
                      )}
                    </div>

                    {/* Стрелка swap */}
                    <button type="button" onClick={() => { const t = fromCur; setFromCur(toCur); setToCur(t) }}
                      className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors mx-auto">
                      <Icon name="ArrowUpDown" size={14} className="text-neutral-400" />
                    </button>

                    {/* Получаю */}
                    <div>
                      <label className="text-neutral-500 text-xs mb-2 block uppercase tracking-wide">Получаю</label>
                      <div className="flex gap-2">
                        <select value={toCur} onChange={e => setToCur(e.target.value)}
                          className="bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50 w-28">
                          {CURRENCIES.filter(c => c !== fromCur).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input type="number" value={toAmt} onChange={e => setToAmt(e.target.value)}
                          placeholder="0.00" step="any" min="0"
                          className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder:text-neutral-700 focus:outline-none focus:border-purple-500/50 text-sm" />
                      </div>
                    </div>

                    {/* Курс */}
                    {fromAmt && toAmt && parseFloat(fromAmt) > 0 && parseFloat(toAmt) > 0 && (
                      <div className="bg-purple-500/8 border border-purple-500/15 rounded-xl px-4 py-2.5 flex items-center justify-between">
                        <span className="text-neutral-500 text-xs">Курс</span>
                        <span className="text-purple-300 text-xs font-mono font-semibold">
                          1 {fromCur} = {(parseFloat(toAmt) / parseFloat(fromAmt)).toFixed(6)} {toCur}
                        </span>
                      </div>
                    )}

                    <input value={comment} onChange={e => setComment(e.target.value)}
                      placeholder="Комментарий (необязательно)"
                      className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder:text-neutral-700 focus:outline-none focus:border-purple-500/50 text-sm" />
                  </div>

                  <Button type="submit" disabled={creating}
                    className="w-full h-11 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white border-0 font-bold rounded-xl">
                    {creating
                      ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><Icon name="Plus" size={16} className="mr-2" /> Разместить заявку</>}
                  </Button>
                  <p className="text-neutral-700 text-xs text-center">После создания сделка появится в Explorer и P2P Рынке</p>
                </form>
              )}
            </motion.div>
          )}

          {/* ── MY ORDERS TAB ────────────────────────────────── */}
          {tab === 'my' && (
            <motion.div key="my" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {!user ? (
                <div className="text-center py-12">
                  <p className="text-neutral-500 mb-4">Войдите для просмотра своих заявок</p>
                  <Button asChild className="bg-purple-600 hover:bg-purple-500 border-0">
                    <Link to="/login">Войти</Link>
                  </Button>
                </div>
              ) : myOrders.length === 0 ? (
                <div className="text-center py-16 text-neutral-600">
                  <Icon name="Inbox" size={32} className="mx-auto mb-3 opacity-30" />
                  <p>Заявок пока нет</p>
                  <button onClick={() => setTab('create')} className="text-purple-400 hover:text-purple-300 text-sm mt-2 transition-colors">
                    Создать заявку →
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {myOrders.map(o => (
                    <div key={o.id} className="bg-white/3 border border-white/8 rounded-2xl p-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <CoinBadge cur={o.from_currency} />
                            <Icon name="ArrowRight" size={12} className="text-neutral-600" />
                            <CoinBadge cur={o.to_currency} />
                          </div>
                          <div>
                            <p className="text-white font-bold text-sm">
                              {fmtAmt(o.from_amount, o.from_currency)} → {fmtAmt(o.to_amount, o.to_currency)}
                            </p>
                            <p className="text-neutral-600 text-xs mt-0.5">Курс: {Number(o.rate).toFixed(4)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${
                            o.status === 'open' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                            o.status === 'completed' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                            'bg-neutral-500/10 border-neutral-500/20 text-neutral-400'
                          }`}>
                            {o.status === 'open' ? 'Открыта' : o.status === 'completed' ? 'Выполнена' : 'Отменена'}
                          </span>
                          {o.status === 'open' && (
                            <Button size="sm" variant="outline" disabled={actionId === o.id}
                              className="border-red-500/30 text-red-400 hover:bg-red-500/10 bg-transparent h-7 text-xs"
                              onClick={() => handleCancel(o.id)}>
                              Отменить
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
