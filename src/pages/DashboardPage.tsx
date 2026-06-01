import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import Icon from '@/components/ui/icon'
import { useAuth } from '@/context/AuthContext'
import PageLayout from '@/components/landing/PageLayout'

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

export default function DashboardPage() {
  const { user, loading, logout, refresh } = useAuth()
  const navigate = useNavigate()
  const [tick, setTick] = useState(0)
  const [copied, setCopied] = useState(false)

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

  const liveDividends = calcNow()
  void tick
  const balance = liveDividends + (user?.referral_total ?? 0)

  if (!loading && !user && !localStorage.getItem('session_id')) return null

  return (
    <PageLayout imgIndex={0}>
      <div className="min-h-screen overflow-y-auto">
        <div className="max-w-4xl mx-auto p-5 md:p-8">

          {/* Header */}
          <motion.div
            className="flex items-center justify-between py-4 mb-6"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF4D00] to-orange-700 flex items-center justify-center shadow-lg shadow-orange-900/30">
                <Icon name="User" size={18} className="text-white" />
              </div>
              <div>
                <p className="text-white font-semibold leading-none">{user?.name ?? '...'}</p>
                <p className="text-neutral-500 text-xs mt-0.5">{user?.email ?? ''}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {user?.is_admin && (
                <Button variant="outline" size="sm" onClick={() => navigate('/admin')}
                  className="border-white/20 text-white bg-white/5 hover:bg-white/10">
                  <Icon name="Settings" size={13} className="mr-1.5" /> Админка
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleLogout}
                className="border-white/10 text-neutral-500 bg-transparent hover:bg-white/5 hover:text-white">
                <Icon name="LogOut" size={13} className="mr-1.5" /> Выйти
              </Button>
            </div>
          </motion.div>

          {/* Balance hero */}
          <motion.div
            className="relative overflow-hidden bg-gradient-to-br from-[#FF4D00]/20 via-orange-900/10 to-transparent border border-[#FF4D00]/30 rounded-3xl p-7 mb-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF4D00]/10 blur-3xl rounded-full pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-neutral-400 text-sm mb-1">Общий баланс</p>
                  <div className="flex items-end gap-2">
                    <span className="text-5xl md:text-6xl font-bold text-white tabular-nums">
                      {balance.toFixed(4)}
                    </span>
                    <span className="text-2xl text-[#FF4D00] mb-1 font-bold">₽</span>
                  </div>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-green-400 text-xs font-medium">Начисляется</span>
                </div>
              </div>
              <p className="text-neutral-500 text-xs">{user?.rate ?? 10}% в неделю · каждую секунду</p>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {[
              { label: 'Депозит', value: `${(user?.deposit ?? 0).toLocaleString('ru-RU')} ₽`, icon: 'Wallet', color: 'text-blue-400' },
              { label: 'Доходность', value: `${user?.rate ?? 10}% / нед`, icon: 'TrendingUp', color: 'text-[#FF4D00]' },
              { label: 'Рефералы', value: `${user?.referral_count ?? 0} чел.`, icon: 'Users', color: 'text-purple-400' },
              { label: 'Реф. бонусы', value: `${(user?.referral_total ?? 0).toFixed(2)} ₽`, icon: 'Gift', color: 'text-green-400' },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.05 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/8 transition-colors"
              >
                <Icon name={item.icon as Parameters<typeof Icon>[0]['name']} size={16} className={`${item.color} mb-2`} />
                <p className="text-neutral-500 text-xs mb-1">{item.label}</p>
                <p className="text-white font-semibold">{item.value}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Actions */}
          <motion.div
            className="grid grid-cols-4 gap-3 mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <button
              onClick={() => navigate('/deposit')}
              className="group flex flex-col items-center gap-2 p-5 rounded-2xl bg-[#FF4D00]/10 border border-[#FF4D00]/30 hover:bg-[#FF4D00]/20 hover:border-[#FF4D00]/50 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-[#FF4D00] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Icon name="PlusCircle" size={18} className="text-white" />
              </div>
              <span className="text-white text-sm font-medium">Пополнить</span>
            </button>
            <button
              onClick={() => navigate('/withdraw')}
              className="group flex flex-col items-center gap-2 p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Icon name="ArrowUpFromLine" size={18} className="text-white" />
              </div>
              <span className="text-white text-sm font-medium">Вывести</span>
            </button>
            <button
              onClick={() => navigate('/exchange')}
              className="group flex flex-col items-center gap-2 p-5 rounded-2xl bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 hover:border-purple-500/50 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Icon name="ArrowLeftRight" size={18} className="text-purple-300" />
              </div>
              <span className="text-purple-300 text-sm font-medium">Обменник</span>
            </button>
            <button
              onClick={() => refresh()}
              className="group flex flex-col items-center gap-2 p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:rotate-180 transition-transform duration-500">
                <Icon name="RefreshCw" size={18} className="text-neutral-400" />
              </div>
              <span className="text-neutral-400 text-sm font-medium">Обновить</span>
            </button>
          </motion.div>

          {/* Referral */}
          {user && (
            <motion.div
              className="bg-gradient-to-r from-purple-900/20 to-blue-900/10 border border-purple-500/20 rounded-2xl p-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon name="Gift" size={16} className="text-purple-400" />
                <p className="text-white font-semibold text-sm">Ваша реферальная ссылка</p>
              </div>
              <p className="text-neutral-500 text-xs mb-3">Получайте 5% от депозитов каждую неделю</p>
              <div className="flex gap-2">
                <code className="flex-1 bg-black/30 rounded-xl px-3 py-2.5 text-neutral-300 text-xs truncate border border-white/5">
                  {window.location.origin}/register?ref={user.referral_code}
                </code>
                <Button variant="outline" size="sm" onClick={copyRefLink}
                  className="border-purple-500/30 text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 shrink-0 h-auto px-3">
                  {copied ? <Icon name="Check" size={14} /> : <Icon name="Copy" size={14} />}
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </PageLayout>
  )
}