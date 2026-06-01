import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import Icon from '@/components/ui/icon'
import { useAuth } from '@/context/AuthContext'
import { apiGetBoosts, apiCreateBoost, apiGetWheelSpins, type WheelSpin } from '@/lib/api'
import FortuneWheel from '@/components/FortuneWheel'

function useOnlineCount() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const base = Math.floor(Math.random() * (590 - 250 + 1)) + 250
    setCount(base)
    const iv = setInterval(() => {
      setCount(prev => {
        const delta = Math.floor(Math.random() * 7) - 3
        const next = prev + delta
        return Math.max(250, Math.min(590, next))
      })
    }, 4000)
    return () => clearInterval(iv)
  }, [])
  return count
}

const WEEKLY_SECONDS = 7 * 24 * 3600
const ANCHOR_KEY = 'div_anchor'

function getWeekStart(): number {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = day === 0 ? 6 : day - 1
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff)
}

function calcNow(): number {
  try {
    const raw = localStorage.getItem(ANCHOR_KEY)
    if (!raw) return 0
    const { base, ts, perSecond } = JSON.parse(raw)
    return base + perSecond * ((Date.now() - ts) / 1000)
  } catch { return 0 }
}

function buildChartData(deposit: number, rate: number) {
  const weeklyIncome = deposit * (rate / 100)
  return Array.from({ length: 8 }, (_, i) => ({
    week: i === 0 ? 'Сейчас' : `+${i} нед`,
    value: Math.round(deposit + weeklyIncome * i),
  }))
}

function buildDayChart(perSecond: number) {
  const now = Date.now()
  return Array.from({ length: 25 }, (_, i) => {
    const secsAgo = (24 - i) * 3600
    return {
      h: i === 24 ? 'Сейчас' : `${i}ч`,
      v: parseFloat((calcNow() - perSecond * secsAgo).toFixed(4)),
    }
  })
}

type BoostItem = { id: number; amount: number; bonus_pct: number; created_at: string }

export default function DashboardPage() {
  const { user, loading, logout, refresh } = useAuth()
  const navigate = useNavigate()
  const onlineCount = useOnlineCount()
  const [tick, setTick] = useState(0)
  const [copied, setCopied] = useState(false)

  // Boost
  const [showBoost, setShowBoost] = useState(false)
  const [boostAmount, setBoostAmount] = useState('')
  const [boostLoading, setBoostLoading] = useState(false)
  const [boostError, setBoostError] = useState('')
  const [boostSuccess, setBoostSuccess] = useState('')
  const [boostHistory, setBoostHistory] = useState<BoostItem[]>([])
  const [boostPercent, setBoostPercent] = useState(0)
  const [showWheel, setShowWheel] = useState(false)
  const [wheelHistory, setWheelHistory] = useState<WheelSpin[]>([])

  useEffect(() => {
    if (!loading && !user) navigate('/login')
  }, [user, loading, navigate])

  useEffect(() => {
    if (!user) return
    const perSecond = (user.deposit * user.rate / 100) / WEEKLY_SECONDS
    const secondsFromWeekStart = (Date.now() - getWeekStart()) / 1000
    const freshBase = user.dividends_total + perSecond * secondsFromWeekStart
    const saved = calcNow()
    const base = Math.max(freshBase, saved)
    localStorage.setItem(ANCHOR_KEY, JSON.stringify({ base, ts: Date.now(), perSecond }))
  }, [user])

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const loadBoosts = useCallback(async () => {
    try {
      const res = await apiGetBoosts()
      setBoostHistory(res.boosts)
      setBoostPercent(res.boost_percent)
    } catch { /* ignore */ }
  }, [])

  const loadWheelHistory = useCallback(async () => {
    try {
      const res = await apiGetWheelSpins()
      setWheelHistory(res.spins)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (user) { loadBoosts(); loadWheelHistory() }
  }, [user, loadBoosts, loadWheelHistory])

  const handleBoost = async () => {
    setBoostError('')
    setBoostSuccess('')
    const amt = parseFloat(boostAmount)
    if (isNaN(amt) || amt < 5000) { setBoostError('Минимальная сумма буста — 5 000 ₽'); return }
    setBoostLoading(true)
    try {
      const res = await apiCreateBoost(amt)
      setBoostSuccess(`Буст активирован! +${res.bonus_pct}% к дивидендам`)
      setBoostAmount('')
      await refresh()
      await loadBoosts()
      setTimeout(() => { setShowBoost(false); setBoostSuccess('') }, 2500)
    } catch (e: unknown) {
      setBoostError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBoostLoading(false)
    }
  }

  const handleLogout = () => { logout(); navigate('/') }
  const copyRefLink = () => {
    if (!user) return
    navigator.clipboard.writeText(`${window.location.origin}/register?ref=${user.referral_code}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  void tick
  const liveDividends = calcNow()
  const balance = liveDividends + (user?.referral_total ?? 0)
  const perSecond = user ? (user.deposit * user.rate / 100) / WEEKLY_SECONDS : 0
  const chartData = user ? buildChartData(user.deposit, user.rate) : []
  const dayData = buildDayChart(perSecond)

  const boostBonusPct = parseFloat(boostAmount) >= 100000 ? 10 : 5
  const available = liveDividends + (user?.referral_total ?? 0)

  if (!loading && !user && !localStorage.getItem('session_id')) return null

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-4">

        {/* ── Header ─────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF4D00] to-orange-700 flex items-center justify-center shadow-lg shadow-orange-900/40">
              <Icon name="User" size={18} className="text-white" />
            </div>
            <div>
              <p className="text-white font-semibold leading-none">{user?.name ?? '...'}</p>
              <p className="text-neutral-500 text-xs mt-0.5">{user?.email ?? ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Онлайн-счётчик */}
            <div className="flex items-center gap-1.5 bg-green-500/8 border border-green-500/20 rounded-xl px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-xs font-semibold tabular-nums">{onlineCount.toLocaleString('ru-RU')}</span>
              <span className="text-green-600 text-xs">онлайн</span>
            </div>

            <Button variant="outline" size="sm" onClick={() => navigate('/chat')}
              className="border-purple-500/30 text-purple-400 bg-purple-500/8 hover:bg-purple-500/15 hover:border-purple-500/50 text-xs relative">
              <Icon name="MessageSquare" size={13} className="mr-1.5" /> Чат
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            </Button>

            {user?.is_admin && (
              <Button variant="outline" size="sm" onClick={() => navigate('/admin')}
                className="border-white/20 text-white bg-white/5 hover:bg-white/10 text-xs">
                <Icon name="Settings" size={13} className="mr-1.5" /> Админка
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout}
              className="border-white/10 text-neutral-500 bg-transparent hover:bg-white/5 hover:text-white text-xs">
              <Icon name="LogOut" size={13} className="mr-1.5" /> Выйти
            </Button>
          </div>
        </motion.div>

        {/* ── Balance Hero ────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="relative overflow-hidden rounded-3xl border border-[#FF4D00]/25 bg-gradient-to-br from-[#FF4D00]/15 via-orange-950/10 to-[#080808] p-6 md:p-8">
          {/* Glow */}
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-[#FF4D00]/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-orange-700/10 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-400 text-xs font-medium">Начисляется каждую секунду</span>
              </div>
              <p className="text-neutral-400 text-sm mb-1">Общий баланс</p>
              <div className="flex items-end gap-2">
                <span className="text-5xl md:text-6xl font-black text-white tabular-nums tracking-tight">
                  {balance.toFixed(4)}
                </span>
                <span className="text-2xl text-[#FF4D00] font-bold mb-1">₽</span>
              </div>
              <div className="flex flex-wrap gap-4 mt-3">
                <div className="text-xs text-neutral-500">
                  Дивиденды: <span className="text-white font-medium">{liveDividends.toFixed(4)} ₽</span>
                </div>
                <div className="text-xs text-neutral-500">
                  Реф. бонусы: <span className="text-green-400 font-medium">+{(user?.referral_total ?? 0).toFixed(2)} ₽</span>
                </div>
              </div>
            </div>

            {/* Rate badge */}
            <div className="flex flex-col gap-2 shrink-0">
              <div className="flex items-center gap-2 bg-[#FF4D00]/10 border border-[#FF4D00]/30 rounded-2xl px-4 py-3">
                <Icon name="TrendingUp" size={18} className="text-[#FF4D00]" />
                <div>
                  <p className="text-[#FF4D00] font-black text-xl leading-none">{user?.rate ?? 10}%</p>
                  <p className="text-neutral-500 text-xs">в неделю</p>
                </div>
              </div>
              {boostPercent > 0 && (
                <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/25 rounded-2xl px-4 py-2">
                  <Icon name="Zap" size={14} className="text-purple-400" />
                  <p className="text-purple-400 text-xs font-semibold">Буст +{boostPercent}%</p>
                </div>
              )}
            </div>
          </div>

          {/* Мини-график роста дня */}
          <div className="relative z-10 mt-6 h-16">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dayData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF4D00" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FF4D00" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke="#FF4D00" strokeWidth={1.5}
                  fill="url(#balGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* ── Stats ──────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Депозит', value: `${(user?.deposit ?? 0).toLocaleString('ru-RU')} ₽`, icon: 'Wallet', color: 'text-blue-400', bg: 'bg-blue-500/8 border-blue-500/15' },
            { label: 'Ставка', value: `${user?.rate ?? 10}% / нед`, icon: 'TrendingUp', color: 'text-[#FF4D00]', bg: 'bg-[#FF4D00]/8 border-[#FF4D00]/15' },
            { label: 'Рефералы', value: `${user?.referral_count ?? 0} чел.`, icon: 'Users', color: 'text-purple-400', bg: 'bg-purple-500/8 border-purple-500/15' },
            { label: 'Реф. бонусы', value: `+${(user?.referral_total ?? 0).toFixed(2)} ₽`, icon: 'Gift', color: 'text-green-400', bg: 'bg-green-500/8 border-green-500/15' },
          ].map((item, i) => (
            <motion.div key={item.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.04 }}
              className={`border rounded-2xl p-4 ${item.bg}`}>
              <Icon name={item.icon as Parameters<typeof Icon>[0]['name']} size={16} className={`${item.color} mb-2`} />
              <p className="text-neutral-500 text-xs mb-1">{item.label}</p>
              <p className="text-white font-bold text-base">{item.value}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Actions ────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="grid grid-cols-4 gap-3">
          {[
            { label: 'Пополнить', icon: 'PlusCircle', action: () => navigate('/deposit'), style: 'bg-[#FF4D00]/10 border-[#FF4D00]/30 hover:bg-[#FF4D00]/20 hover:border-[#FF4D00]/50', iconBg: 'bg-[#FF4D00]', iconColor: 'text-white' },
            { label: 'Вывести', icon: 'ArrowUpFromLine', action: () => navigate('/withdraw'), style: 'bg-white/3 border-white/10 hover:bg-white/6 hover:border-white/20', iconBg: 'bg-white/10', iconColor: 'text-white' },
            { label: 'Обменник', icon: 'ArrowLeftRight', action: () => navigate('/exchange'), style: 'bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/15 hover:border-purple-500/40', iconBg: 'bg-purple-600', iconColor: 'text-white' },
            { label: 'Обновить', icon: 'RefreshCw', action: refresh, style: 'bg-white/3 border-white/10 hover:bg-white/6 hover:border-white/20', iconBg: 'bg-white/10', iconColor: 'text-neutral-400' },
          ].map(btn => (
            <button key={btn.label} onClick={btn.action}
              className={`group flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${btn.style}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${btn.iconBg}`}>
                <Icon name={btn.icon as Parameters<typeof Icon>[0]['name']} size={16} className={btn.iconColor} />
              </div>
              <span className="text-white text-xs font-medium">{btn.label}</span>
            </button>
          ))}
        </motion.div>

        {/* ── Charts Row ─────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="grid md:grid-cols-2 gap-4">

          {/* Рост капитала */}
          <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white font-semibold text-sm">Рост капитала</p>
                <p className="text-neutral-600 text-xs mt-0.5">Прогноз на 8 недель</p>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-2.5 py-1 text-green-400 text-xs font-medium">
                +{user?.rate ?? 10}% / нед
              </div>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="growGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="week" tick={{ fill: '#525252', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#525252', fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 12, fontSize: 12 }}
                    labelStyle={{ color: '#999' }}
                    formatter={(v: number) => [`${v.toLocaleString('ru-RU')} ₽`, 'Капитал']}
                  />
                  <Area type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2}
                    fill="url(#growGrad)" dot={{ fill: '#22c55e', r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Дивиденды за сутки */}
          <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white font-semibold text-sm">Дивиденды сегодня</p>
                <p className="text-neutral-600 text-xs mt-0.5">Начисления за 24 часа</p>
              </div>
              <div className="text-[#FF4D00] font-bold text-sm">
                +{(perSecond * 86400).toFixed(2)} ₽
              </div>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dayData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="divGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF4D00" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#FF4D00" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="h" tick={{ fill: '#525252', fontSize: 10 }} axisLine={false} tickLine={false}
                    interval={5} />
                  <YAxis tick={{ fill: '#525252', fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={v => v.toFixed(1)} />
                  <Tooltip
                    contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 12, fontSize: 12 }}
                    labelStyle={{ color: '#999' }}
                    formatter={(v: number) => [`${v.toFixed(4)} ₽`, 'Дивиденды']}
                  />
                  <Area type="monotone" dataKey="v" stroke="#FF4D00" strokeWidth={2}
                    fill="url(#divGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>

        {/* ── Wheel & Boost Banners ───────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.23 }}
          className="grid md:grid-cols-2 gap-4">

          {/* Колесо фортуны */}
          <button onClick={() => setShowWheel(true)}
            className="group relative overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-900/30 via-pink-900/20 to-[#080808] p-5 text-left hover:border-purple-500/50 transition-all">
            <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-purple-500/10 blur-2xl pointer-events-none group-hover:bg-purple-500/20 transition-all" />
            <div className="absolute -right-2 -bottom-2 text-7xl opacity-10 select-none pointer-events-none">🎡</div>
            <div className="relative z-10 flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30 shrink-0 group-hover:scale-110 transition-transform">
                <Icon name="Dices" size={22} className="text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-base">Колесо Фортуны</p>
                <p className="text-neutral-400 text-xs mt-0.5 leading-relaxed">Крути от 100 ₽ и выигрывай ×2, ×5 или ×10 к ставке</p>
                <div className="flex gap-2 mt-3">
                  {['×2', '×5', '×10'].map((m, i) => (
                    <span key={i} className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                      i === 0 ? 'bg-green-500/15 border-green-500/25 text-green-400' :
                      i === 1 ? 'bg-yellow-500/15 border-yellow-500/25 text-yellow-400' :
                      'bg-red-500/15 border-red-500/25 text-red-400'
                    }`}>{m}</span>
                  ))}
                  <span className="text-neutral-600 text-xs py-0.5">20% шанс</span>
                </div>
              </div>
            </div>
          </button>

          {/* Буст */}
          <button onClick={() => setShowBoost(true)}
            className="group relative overflow-hidden rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-900/20 via-orange-900/15 to-[#080808] p-5 text-left hover:border-yellow-500/50 transition-all">
            <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-yellow-500/10 blur-2xl pointer-events-none group-hover:bg-yellow-500/20 transition-all" />
            <div className="absolute -right-2 -bottom-2 text-7xl opacity-10 select-none pointer-events-none">⚡</div>
            <div className="relative z-10 flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-yellow-500/30 shrink-0 group-hover:scale-110 transition-transform">
                <Icon name="Zap" size={22} className="text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-base">Буст аккаунта</p>
                <p className="text-neutral-400 text-xs mt-0.5 leading-relaxed">Прокачай ставку дивидендов на +5% или +10%</p>
                <div className="flex gap-2 mt-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-yellow-500/15 border-yellow-500/25 text-yellow-400">от 5 000 ₽ → +5%</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-orange-500/15 border-orange-500/25 text-orange-400">от 100к ₽ → +10%</span>
                </div>
                {boostPercent > 0 && (
                  <p className="text-green-400 text-xs mt-2 font-semibold">Активно: +{boostPercent}% к ставке</p>
                )}
              </div>
            </div>
          </button>
        </motion.div>

        {/* ── Boost History ───────────────────────────────────── */}
        {boostHistory.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="bg-gradient-to-br from-yellow-500/8 to-orange-600/5 border border-yellow-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="Zap" size={16} className="text-yellow-400" />
              <p className="text-white font-semibold text-sm">Активные бусты</p>
              <span className="ml-auto bg-yellow-500/15 border border-yellow-500/25 text-yellow-400 text-xs font-bold px-2.5 py-0.5 rounded-full">
                +{boostPercent}% к ставке
              </span>
            </div>
            <div className="space-y-2">
              {boostHistory.slice(0, 3).map(b => (
                <div key={b.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-white text-sm font-medium">{b.amount.toLocaleString('ru-RU')} ₽</p>
                    <p className="text-neutral-500 text-xs">{new Date(b.created_at).toLocaleDateString('ru-RU')}</p>
                  </div>
                  <span className="bg-yellow-500/15 border border-yellow-500/25 text-yellow-400 text-xs font-bold px-2.5 py-0.5 rounded-full">
                    +{b.bonus_pct}%
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Transaction History ─────────────────────────────── */}
        {(wheelHistory.length > 0 || boostHistory.length > 0) && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
            className="bg-white/3 border border-white/8 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <div className="flex items-center gap-2">
                <Icon name="ClockArrowDown" size={16} className="text-neutral-400" />
                <p className="text-white font-semibold text-sm">История транзакций</p>
              </div>
              <span className="text-neutral-600 text-xs">{wheelHistory.length + boostHistory.length} записей</span>
            </div>
            <div className="divide-y divide-white/5">
              {[
                ...wheelHistory.map(s => ({
                  id: `w${s.id}`,
                  type: 'wheel' as const,
                  date: s.created_at,
                  amount: s.multiplier > 0 ? s.bet * s.multiplier : -s.bet,
                  label: s.multiplier > 0 ? `Колесо фортуны — ${s.segment}` : 'Колесо фортуны — Проигрыш',
                  sub: `Ставка ${s.bet.toLocaleString('ru-RU')} ₽`,
                  win: s.multiplier > 0,
                  icon: s.multiplier > 0 ? 'Trophy' : 'Dices',
                  color: s.multiplier > 0 ? 'text-green-400' : 'text-red-400',
                  iconBg: s.multiplier > 0 ? 'bg-green-500/15' : 'bg-red-500/10',
                  iconColor: s.multiplier > 0 ? 'text-green-400' : 'text-red-500',
                  badge: s.multiplier > 0 ? { text: `×${s.multiplier}`, style: 'bg-green-500/15 border-green-500/25 text-green-400' } : null,
                })),
                ...boostHistory.map(b => ({
                  id: `b${b.id}`,
                  type: 'boost' as const,
                  date: b.created_at,
                  amount: -b.amount,
                  label: 'Буст аккаунта',
                  sub: `+${b.bonus_pct}% к ставке`,
                  win: false,
                  icon: 'Zap',
                  color: 'text-yellow-400',
                  iconBg: 'bg-yellow-500/10',
                  iconColor: 'text-yellow-400',
                  badge: { text: `+${b.bonus_pct}%`, style: 'bg-yellow-500/15 border-yellow-500/25 text-yellow-400' },
                })),
              ]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 10)
                .map(tx => (
                  <div key={tx.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/3 transition-colors">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tx.iconBg}`}>
                      <Icon name={tx.icon as Parameters<typeof Icon>[0]['name']} size={15} className={tx.iconColor} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{tx.label}</p>
                      <p className="text-neutral-600 text-xs mt-0.5">{tx.sub} · {new Date(tx.date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {tx.badge && (
                        <span className={`text-[11px] border rounded-full px-2 py-0.5 font-bold ${tx.badge.style}`}>
                          {tx.badge.text}
                        </span>
                      )}
                      <p className={`text-sm font-bold tabular-nums ${tx.color}`}>
                        {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </motion.div>
        )}

        {/* ── Referral ───────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
          className="bg-gradient-to-br from-purple-900/20 via-blue-900/10 to-transparent border border-purple-500/20 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-white font-semibold flex items-center gap-2">
                <Icon name="Users" size={16} className="text-purple-400" />
                Реферальная программа
              </p>
              <p className="text-neutral-500 text-xs mt-1">Получайте 5% от депозитов каждую неделю</p>
            </div>
            <span className="bg-purple-500/15 border border-purple-500/25 text-purple-400 text-xs font-bold px-2.5 py-1 rounded-full">
              {user?.referral_count ?? 0} реф.
            </span>
          </div>
          <div className="flex gap-2 mt-3">
            <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-neutral-400 text-xs font-mono truncate">
              {user ? `${window.location.origin}/register?ref=${user.referral_code}` : '...'}
            </div>
            <button onClick={copyRefLink}
              className="bg-purple-600/20 border border-purple-500/30 hover:bg-purple-600/30 rounded-xl px-3 py-2.5 transition-colors">
              <Icon name={copied ? 'Check' : 'Copy'} size={15} className={copied ? 'text-green-400' : 'text-purple-400'} />
            </button>
          </div>
        </motion.div>

      </div>

      {/* ── Boost Modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {showBoost && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowBoost(false)}>
            <motion.div initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }} transition={{ duration: 0.22 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-[#111] border border-white/12 rounded-3xl overflow-hidden shadow-2xl">

              {/* Header */}
              <div className="bg-gradient-to-r from-yellow-500/15 to-orange-600/10 border-b border-white/8 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-yellow-500/30">
                      <Icon name="Zap" size={20} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg">Буст аккаунта</h3>
                      <p className="text-neutral-400 text-xs">Увеличьте ставку дивидендов</p>
                    </div>
                  </div>
                  <button onClick={() => setShowBoost(false)}
                    className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors">
                    <Icon name="X" size={15} />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Тарифы */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'от 5 000 ₽', bonus: '+5%', desc: 'к ставке', color: 'border-yellow-500/30 bg-yellow-500/8', textColor: 'text-yellow-400', active: parseFloat(boostAmount) >= 5000 && parseFloat(boostAmount) < 100000 },
                    { label: 'от 100 000 ₽', bonus: '+10%', desc: 'к ставке', color: 'border-orange-500/40 bg-orange-500/10', textColor: 'text-orange-400', badge: 'Топ', active: parseFloat(boostAmount) >= 100000 },
                  ].map((t, i) => (
                    <button key={i}
                      onClick={() => setBoostAmount(i === 0 ? '5000' : '100000')}
                      className={`relative rounded-2xl border p-4 text-left transition-all ${t.color} ${t.active ? 'ring-2 ring-yellow-400/40' : 'hover:opacity-80'}`}>
                      {t.badge && (
                        <span className="absolute top-2 right-2 bg-orange-500/20 border border-orange-500/30 text-orange-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{t.badge}</span>
                      )}
                      <p className="text-neutral-400 text-xs mb-1">{t.label}</p>
                      <p className={`text-2xl font-black ${t.textColor}`}>{t.bonus}</p>
                      <p className="text-neutral-500 text-xs">{t.desc}</p>
                    </button>
                  ))}
                </div>

                {/* Ввод суммы */}
                <div>
                  <label className="text-neutral-400 text-xs mb-2 block">Сумма буста</label>
                  <div className="relative">
                    <input
                      type="number" value={boostAmount}
                      onChange={e => { setBoostAmount(e.target.value); setBoostError('') }}
                      placeholder="от 5 000"
                      className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-neutral-600 focus:outline-none focus:border-yellow-500/50 text-lg font-bold pr-10"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold">₽</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-neutral-600 text-xs">Доступно: {available.toFixed(2)} ₽</p>
                    {parseFloat(boostAmount) >= 5000 && (
                      <p className="text-yellow-400 text-xs font-semibold">
                        Бонус: +{boostBonusPct}% → ставка станет {(user?.rate ?? 10) + boostBonusPct}% / нед
                      </p>
                    )}
                  </div>
                </div>

                {/* Ошибка / успех */}
                {boostError && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                    <Icon name="AlertCircle" size={15} />
                    {boostError}
                  </div>
                )}
                {boostSuccess && (
                  <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-green-400 text-sm">
                    <Icon name="CheckCircle" size={15} />
                    {boostSuccess}
                  </div>
                )}

                {/* Кнопка */}
                <Button
                  onClick={handleBoost} disabled={boostLoading || !boostAmount}
                  className="w-full h-12 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-black font-bold border-0 text-base rounded-xl shadow-lg shadow-yellow-500/20">
                  {boostLoading
                    ? <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    : <><Icon name="Zap" size={18} className="mr-2" /> Активировать буст</>}
                </Button>

                <p className="text-neutral-600 text-xs text-center leading-relaxed">
                  Сумма буста списывается с вашего баланса. Эффект суммируется при повторных бустах.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Wheel Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showWheel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowWheel(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.25 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-2xl bg-[#0e0e0e] border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-purple-900/20"
              style={{ maxHeight: '92vh' }}>
              <FortuneWheel
                balance={balance}
                onClose={() => setShowWheel(false)}
                onResult={() => { refresh(); loadWheelHistory() }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}