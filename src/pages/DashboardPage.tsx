import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import Icon from '@/components/ui/icon'
import { useAuth } from '@/context/AuthContext'
import Layout from '@/components/landing/Layout'

const WEEKLY_SECONDS = 7 * 24 * 3600

function getWeekStart(): Date {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = day === 0 ? 6 : day - 1
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff))
}

const LIVE_KEY = 'live_dividends_snapshot'

// Сохраняем снапшот: значение + время сохранения
function saveSnapshot(value: number) {
  localStorage.setItem(LIVE_KEY, JSON.stringify({ value, ts: Date.now() }))
}

// Восстанавливаем с учётом прошедшего времени
function loadSnapshot(perSecond: number): number | null {
  try {
    const raw = localStorage.getItem(LIVE_KEY)
    if (!raw) return null
    const { value, ts } = JSON.parse(raw)
    const elapsed = (Date.now() - ts) / 1000
    return value + perSecond * elapsed
  } catch {
    return null
  }
}

export default function DashboardPage() {
  const { user, loading, logout, refresh } = useAuth()
  const navigate = useNavigate()

  // Стартуем сразу со значения из localStorage (без мигания 0)
  const [liveDividends, setLiveDividends] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(LIVE_KEY)
      if (!raw) return 0
      const { value } = JSON.parse(raw)
      return value
    } catch { return 0 }
  })

  const [copied, setCopied] = useState(false)
  const startedRef = useRef(false)

  useEffect(() => {
    if (!loading && !user) navigate('/login')
  }, [user, loading, navigate])

  useEffect(() => {
    if (!user) return
    if (startedRef.current) return
    startedRef.current = true

    const weeklyRate = (user.deposit * user.rate) / 100
    const perSecond = weeklyRate / WEEKLY_SECONDS

    const snapshot = loadSnapshot(perSecond)
    const secondsElapsed = (Date.now() - getWeekStart().getTime()) / 1000
    const accruedThisWeek = user.dividends_total + perSecond * secondsElapsed
    const startValue = snapshot !== null ? Math.max(snapshot, accruedThisWeek) : accruedThisWeek

    console.log('[counter] deposit:', user.deposit, 'rate:', user.rate, 'dividends_total:', user.dividends_total)
    console.log('[counter] perSecond:', perSecond, 'accruedThisWeek:', accruedThisWeek, 'snapshot:', snapshot, 'startValue:', startValue)

    setLiveDividends(startValue)

    const interval = setInterval(() => {
      setLiveDividends(prev => {
        const next = prev + perSecond
        saveSnapshot(next)
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [user])

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const copyRefLink = () => {
    if (!user) return
    navigator.clipboard.writeText(`${window.location.origin}/register?ref=${user.referral_code}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading || !user) {
    return (
      <Layout>
        <div className="h-full flex items-center justify-center">
          <p className="text-neutral-400">Загрузка...</p>
        </div>
      </Layout>
    )
  }

  const balance = liveDividends + user.referral_total

  return (
    <Layout>
      <div className="h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6 md:p-10">
          {/* Header */}
          <motion.div
            className="flex items-center justify-between mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FF4D00] flex items-center justify-center">
                <Icon name="User" size={20} className="text-white" />
              </div>
              <div>
                <p className="text-white font-semibold">{user.name}</p>
                <p className="text-neutral-500 text-xs">{user.email}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {user.is_admin && (
                <Button variant="outline" size="sm" onClick={() => navigate('/admin')}
                  className="border-white/20 text-white bg-transparent hover:bg-white/10">
                  <Icon name="Settings" size={14} className="mr-1" /> Админка
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleLogout}
                className="border-white/20 text-neutral-400 bg-transparent hover:bg-white/10">
                <Icon name="LogOut" size={14} className="mr-1" /> Выйти
              </Button>
            </div>
          </motion.div>

          {/* Balance card */}
          <motion.div
            className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <p className="text-neutral-400 text-sm mb-1">Общий баланс</p>
            <div className="flex items-end gap-2 mb-1">
              <span className="text-5xl font-bold text-[#FF4D00] tabular-nums">
                {balance.toFixed(4)}
              </span>
              <span className="text-2xl text-white mb-1">₽</span>
            </div>
            <p className="text-neutral-500 text-xs">Начисляется каждую секунду · {user.rate}% в неделю</p>
          </motion.div>

          {/* Stats grid */}
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {[
              { label: 'Депозит', value: `${user.deposit.toLocaleString('ru-RU')} ₽`, icon: 'Wallet' },
              { label: 'Доходность', value: `${user.rate}% / нед`, icon: 'TrendingUp' },
              { label: 'Рефералы', value: `${user.referral_count} чел.`, icon: 'Users' },
              { label: 'Реф. бонусы', value: `${user.referral_total.toFixed(2)} ₽`, icon: 'Gift' },
            ].map(item => (
              <div key={item.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <Icon name={item.icon as Parameters<typeof Icon>[0]['name']} size={16} className="text-neutral-500 mb-2" />
                <p className="text-neutral-400 text-xs mb-1">{item.label}</p>
                <p className="text-white font-semibold text-sm">{item.value}</p>
              </div>
            ))}
          </motion.div>

          {/* Actions */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Button size="lg" className="bg-[#FF4D00] hover:bg-[#e64500] text-white border-0"
              onClick={() => navigate('/deposit')}>
              <Icon name="PlusCircle" size={16} className="mr-2" /> Пополнить
            </Button>
            <Button size="lg" variant="outline"
              className="border-white/20 text-white bg-transparent hover:bg-white/10"
              onClick={() => navigate('/withdraw')}>
              <Icon name="ArrowUpFromLine" size={16} className="mr-2" /> Вывести
            </Button>
            <Button size="lg" variant="outline"
              className="border-white/20 text-white bg-transparent hover:bg-white/10"
              onClick={() => refresh()}>
              <Icon name="RefreshCw" size={16} className="mr-2" /> Обновить
            </Button>
          </motion.div>

          {/* Referral */}
          <motion.div
            className="bg-white/5 border border-white/10 rounded-2xl p-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <p className="text-white font-semibold mb-1">Ваша реферальная ссылка</p>
            <p className="text-neutral-400 text-sm mb-3">Получайте 5% от депозитов каждую неделю</p>
            <div className="flex gap-2">
              <code className="flex-1 bg-black/30 rounded-lg px-3 py-2 text-neutral-300 text-sm truncate">
                {window.location.origin}/register?ref={user.referral_code}
              </code>
              <Button variant="outline" size="sm" onClick={copyRefLink}
                className="border-white/20 text-white bg-transparent hover:bg-white/10 shrink-0">
                {copied ? <Icon name="Check" size={14} /> : <Icon name="Copy" size={14} />}
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </Layout>
  )
}