import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Icon from '@/components/ui/icon'
import { useAuth } from '@/context/AuthContext'
import { apiCreatePayment } from '@/lib/api'
import Layout from '@/components/landing/Layout'

const QUICK_AMOUNTS = [500, 1000, 5000, 10000, 50000]

const CRYPTO_WALLETS = [
  { name: 'USDT TRC20', icon: '💚', address: 'TYourUSDTTRC20WalletAddressHere' },
  { name: 'Bitcoin', icon: '🟠', address: '1YourBitcoinWalletAddressHere' },
  { name: 'Ethereum', icon: '🔵', address: '0xYourEthereumWalletAddressHere' },
]

type Tab = 'card' | 'sbp' | 'crypto'

export default function DepositPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('card')
  const [amount, setAmount] = useState('1000')
  const [error, setError] = useState('')
  const [paying, setPaying] = useState(false)
  const [copiedWallet, setCopiedWallet] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) navigate('/login')
  }, [user, loading, navigate])

  const handlePay = async () => {
    setError('')
    const num = parseFloat(amount)
    if (!num || num < 100) { setError('Минимальная сумма 100 ₽'); return }
    setPaying(true)
    try {
      const method = tab === 'sbp' ? 'sbp' : 'card'
      const returnUrl = `${window.location.origin}/dashboard?deposit=success`
      const { confirmation_url } = await apiCreatePayment({ amount: num, method, return_url: returnUrl })
      window.location.href = confirmation_url
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка')
      setPaying(false)
    }
  }

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address)
    setCopiedWallet(address)
    setTimeout(() => setCopiedWallet(null), 2000)
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'card', label: 'Карта', icon: 'CreditCard' },
    { key: 'sbp', label: 'СБП', icon: 'Zap' },
    { key: 'crypto', label: 'Крипто', icon: 'Bitcoin' },
  ]

  if (loading || !user) {
    return <Layout><div className="h-full flex items-center justify-center"><p className="text-neutral-400">Загрузка...</p></div></Layout>
  }

  return (
    <Layout>
      <div className="h-full overflow-y-auto">
        <div className="max-w-lg mx-auto p-6 md:p-10">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <Link to="/dashboard" className="text-neutral-500 hover:text-neutral-300 text-sm flex items-center gap-1 mb-6">
              <Icon name="ArrowLeft" size={14} /> Назад в кабинет
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold text-white">Пополнение депозита</h1>
            <p className="text-neutral-400 mt-1">Текущий депозит: <span className="text-white">{user.deposit.toLocaleString('ru-RU')} ₽</span></p>
          </motion.div>

          {/* Tabs */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="flex gap-2 mb-6">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  tab === t.key
                    ? 'bg-[#FF4D00] text-white'
                    : 'bg-white/5 text-neutral-400 hover:bg-white/10 border border-white/10'
                }`}>
                <Icon name={t.icon as Parameters<typeof Icon>[0]['name']} size={15} />
                {t.label}
              </button>
            ))}
          </motion.div>

          {/* Card / СБП */}
          {(tab === 'card' || tab === 'sbp') && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <Label className="text-neutral-300 mb-3 block">Сумма пополнения (₽)</Label>
              <div className="flex flex-wrap gap-2 mb-4">
                {QUICK_AMOUNTS.map(q => (
                  <button key={q} onClick={() => setAmount(String(q))}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                      amount === String(q)
                        ? 'bg-[#FF4D00] text-white'
                        : 'bg-white/5 border border-white/10 text-neutral-400 hover:border-[#FF4D00]/50'
                    }`}>
                    {q.toLocaleString('ru-RU')} ₽
                  </button>
                ))}
              </div>
              <Input
                type="number" value={amount} onChange={e => setAmount(e.target.value)}
                min={100} placeholder="Введите сумму"
                className="bg-white/5 border-white/20 text-white placeholder:text-neutral-600 focus:border-[#FF4D00] mb-4"
              />

              {tab === 'sbp' && (
                <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                  <Icon name="Zap" size={16} className="text-green-400" />
                  <p className="text-green-400 text-sm">Оплата через СБП — мгновенно, без комиссии</p>
                </div>
              )}

              {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

              <Button onClick={handlePay} disabled={paying} size="lg"
                className="w-full bg-[#FF4D00] hover:bg-[#e64500] text-white border-0">
                {paying ? 'Переходим к оплате...' : `Оплатить ${parseFloat(amount || '0').toLocaleString('ru-RU')} ₽`}
              </Button>
              <p className="text-neutral-600 text-xs mt-3 text-center">
                Вы будете перенаправлены на страницу ЮKassa
              </p>
            </motion.div>
          )}

          {/* Crypto */}
          {tab === 'crypto' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="space-y-3">
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex gap-2">
                <Icon name="AlertTriangle" size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-yellow-400 text-sm">После оплаты отправьте скриншот в поддержку. Депозит будет зачислен вручную в течение 24 часов.</p>
              </div>
              {CRYPTO_WALLETS.map(wallet => (
                <div key={wallet.name} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">{wallet.icon}</span>
                    <p className="text-white font-semibold">{wallet.name}</p>
                  </div>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-black/30 rounded-lg px-3 py-2 text-neutral-300 text-xs break-all">
                      {wallet.address}
                    </code>
                    <Button variant="outline" size="sm" onClick={() => copyAddress(wallet.address)}
                      className="border-white/20 text-white bg-transparent hover:bg-white/10 shrink-0">
                      {copiedWallet === wallet.address
                        ? <Icon name="Check" size={14} />
                        : <Icon name="Copy" size={14} />}
                    </Button>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </Layout>
  )
}
