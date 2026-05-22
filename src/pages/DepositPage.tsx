import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Icon from '@/components/ui/icon'
import { useAuth } from '@/context/AuthContext'
import { apiCreatePayment } from '@/lib/api'
import PageLayout from '@/components/landing/PageLayout'

const QUICK_AMOUNTS = [500, 1000, 5000, 10000, 50000]

const CRYPTO_WALLETS = [
  { name: 'USDT TRC20', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', address: 'TYourUSDTTRC20WalletAddressHere' },
  { name: 'Bitcoin', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', address: '1YourBitcoinWalletAddressHere' },
  { name: 'Ethereum', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', address: '0xYourEthereumWalletAddressHere' },
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

  const tabs: { key: Tab; label: string; icon: string; desc: string }[] = [
    { key: 'card', label: 'Банковская карта', icon: 'CreditCard', desc: 'Visa, МИР, Mastercard' },
    { key: 'sbp', label: 'СБП', icon: 'Zap', desc: 'Мгновенно, без комиссии' },
    { key: 'crypto', label: 'Криптовалюта', icon: 'Bitcoin', desc: 'USDT, BTC, ETH' },
  ]

  if (loading || !user) {
    return (
      <PageLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#FF4D00] border-t-transparent rounded-full animate-spin" />
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout imgIndex={1}>
      <div className="min-h-screen overflow-y-auto">
        <div className="max-w-xl mx-auto p-5 md:p-8">

          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <Link to="/dashboard" className="text-neutral-500 hover:text-neutral-300 text-sm flex items-center gap-1.5 mb-6 transition-colors">
              <Icon name="ArrowLeft" size={14} /> Назад в кабинет
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold text-white">Пополнение</h1>
            <p className="text-neutral-400 mt-1 text-sm">
              Текущий депозит: <span className="text-white font-medium">{user.deposit.toLocaleString('ru-RU')} ₽</span>
            </p>
          </motion.div>

          {/* Tabs */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="grid grid-cols-3 gap-2 mb-6">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl text-xs font-medium transition-all ${
                  tab === t.key
                    ? 'bg-[#FF4D00] text-white shadow-lg shadow-orange-900/30'
                    : 'bg-white/5 text-neutral-400 hover:bg-white/10 border border-white/10'
                }`}>
                <Icon name={t.icon as Parameters<typeof Icon>[0]['name']} size={18} />
                <span className="font-semibold">{t.label}</span>
                <span className={`text-xs ${tab === t.key ? 'text-orange-200' : 'text-neutral-600'}`}>{t.desc}</span>
              </button>
            ))}
          </motion.div>

          {/* Card / СБП */}
          {(tab === 'card' || tab === 'sbp') && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-6">

              {tab === 'sbp' && (
                <div className="flex items-center gap-2 mb-5 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                  <Icon name="Zap" size={15} className="text-green-400 shrink-0" />
                  <p className="text-green-400 text-sm">Мгновенно, без комиссии</p>
                </div>
              )}

              <Label className="text-neutral-300 mb-3 block text-sm">Сумма пополнения</Label>
              <div className="flex flex-wrap gap-2 mb-4">
                {QUICK_AMOUNTS.map(q => (
                  <button key={q} onClick={() => setAmount(String(q))}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                      amount === String(q)
                        ? 'bg-[#FF4D00] text-white shadow-md shadow-orange-900/30'
                        : 'bg-white/5 border border-white/10 text-neutral-400 hover:border-[#FF4D00]/40 hover:text-white'
                    }`}>
                    {q.toLocaleString('ru-RU')} ₽
                  </button>
                ))}
              </div>
              <Input
                type="number" value={amount} onChange={e => setAmount(e.target.value)}
                min={100} placeholder="Введите сумму"
                className="bg-white/5 border-white/20 text-white placeholder:text-neutral-600 focus:border-[#FF4D00] mb-5 h-12 text-lg"
              />

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
                  <Icon name="AlertCircle" size={14} className="text-red-400 shrink-0" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <Button onClick={handlePay} disabled={paying} size="lg"
                className="w-full bg-[#FF4D00] hover:bg-[#e64500] text-white border-0 h-12 text-base">
                {paying ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Переходим к оплате...
                  </span>
                ) : `Оплатить ${parseFloat(amount || '0').toLocaleString('ru-RU')} ₽`}
              </Button>
              <p className="text-neutral-600 text-xs mt-3 text-center">Перенаправление на страницу ЮKassa</p>
            </motion.div>
          )}

          {/* Crypto */}
          {tab === 'crypto' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="space-y-3">
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex gap-3">
                <Icon name="AlertTriangle" size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-yellow-400 text-sm">После оплаты отправьте скриншот в поддержку. Депозит зачисляется вручную в течение 24 часов.</p>
              </div>
              {CRYPTO_WALLETS.map(wallet => (
                <div key={wallet.name} className={`${wallet.bg} border rounded-2xl p-5`}>
                  <p className={`font-semibold mb-3 ${wallet.color}`}>{wallet.name}</p>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-black/40 rounded-xl px-3 py-2.5 text-neutral-300 text-xs break-all border border-white/5">
                      {wallet.address}
                    </code>
                    <Button variant="outline" size="sm" onClick={() => copyAddress(wallet.address)}
                      className="border-white/20 text-white bg-white/5 hover:bg-white/10 shrink-0 h-auto px-3">
                      {copiedWallet === wallet.address
                        ? <Icon name="Check" size={14} className="text-green-400" />
                        : <Icon name="Copy" size={14} />}
                    </Button>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </PageLayout>
  )
}
