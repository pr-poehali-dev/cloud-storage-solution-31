import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Icon from '@/components/ui/icon'
import { useAuth } from '@/context/AuthContext'
import { apiWithdraw } from '@/lib/api'
import Layout from '@/components/landing/Layout'

type Method = 'bank_card' | 'sbp' | 'crypto'

const CRYPTO_COINS = ['USDT TRC20', 'Bitcoin', 'Ethereum']

export default function WithdrawPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  const [method, setMethod] = useState<Method>('bank_card')
  const [amount, setAmount] = useState('1000')
  const [cardNumber, setCardNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [cryptoCoin, setCryptoCoin] = useState('USDT TRC20')
  const [cryptoAddress, setCryptoAddress] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading2, setLoading2] = useState(false)

  useEffect(() => {
    if (!loading && !user) navigate('/login')
  }, [user, loading, navigate])

  const balance = user ? user.balance : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const num = parseFloat(amount)
    if (!num || num < 1000) { setError('Минимальная сумма вывода 1 000 ₽'); return }
    if (num > balance) { setError(`Недостаточно средств. Доступно: ${balance.toFixed(2)} ₽`); return }

    let details: Record<string, string> = {}
    if (method === 'bank_card') {
      if (!cardNumber || cardNumber.replace(/\s/g, '').length < 16) { setError('Введите номер карты (16 цифр)'); return }
      details = { card_number: cardNumber.replace(/\s/g, '') }
    } else if (method === 'sbp') {
      if (!phone || phone.length < 10) { setError('Введите номер телефона'); return }
      details = { phone }
    } else {
      if (!cryptoAddress) { setError('Введите адрес кошелька'); return }
      details = { coin: cryptoCoin, address: cryptoAddress }
    }

    setLoading2(true)
    try {
      const res = await apiWithdraw({ amount: num, method, details })
      setSuccess(res.message || `Вывод на ${num.toLocaleString('ru-RU')} ₽ оформлен! Статус: ${res.status}`)
      setAmount('1000')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка вывода')
    } finally {
      setLoading2(false)
    }
  }

  const methods: { key: Method; label: string; icon: string }[] = [
    { key: 'bank_card', label: 'Карта', icon: 'CreditCard' },
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
            <h1 className="text-3xl md:text-4xl font-bold text-white">Вывод средств</h1>
            <p className="text-neutral-400 mt-1">
              Доступно: <span className="text-[#FF4D00] font-semibold">{balance.toFixed(2)} ₽</span>
              <span className="text-neutral-600 text-sm ml-2">· мин. 1 000 ₽</span>
            </p>
          </motion.div>

          {/* Tabs */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="flex gap-2 mb-6">
            {methods.map(m => (
              <button key={m.key} onClick={() => setMethod(m.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  method === m.key
                    ? 'bg-[#FF4D00] text-white'
                    : 'bg-white/5 text-neutral-400 hover:bg-white/10 border border-white/10'
                }`}>
                <Icon name={m.icon as Parameters<typeof Icon>[0]['name']} size={15} />
                {m.label}
              </button>
            ))}
          </motion.div>

          <motion.form onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">

            {/* Сумма */}
            <div>
              <Label className="text-neutral-300 mb-1.5 block">Сумма (₽)</Label>
              <Input
                type="number" value={amount} onChange={e => setAmount(e.target.value)}
                min={1000} max={balance} placeholder="Минимум 1 000 ₽"
                className="bg-white/5 border-white/20 text-white placeholder:text-neutral-600 focus:border-[#FF4D00]"
              />
              <div className="flex gap-2 mt-2">
                {[1000, 5000, 10000].filter(v => v <= balance).map(v => (
                  <button key={v} type="button" onClick={() => setAmount(String(v))}
                    className={`px-3 py-1 rounded-lg text-xs transition-all ${
                      amount === String(v) ? 'bg-[#FF4D00] text-white' : 'bg-white/5 border border-white/10 text-neutral-400'
                    }`}>
                    {v.toLocaleString('ru-RU')} ₽
                  </button>
                ))}
                <button type="button" onClick={() => setAmount(String(Math.floor(balance)))}
                  className="px-3 py-1 rounded-lg text-xs bg-white/5 border border-white/10 text-neutral-400">
                  Всё
                </button>
              </div>
            </div>

            {/* Реквизиты */}
            {method === 'bank_card' && (
              <div>
                <Label className="text-neutral-300 mb-1.5 block">Номер карты</Label>
                <Input
                  value={cardNumber} onChange={e => setCardNumber(e.target.value)}
                  placeholder="0000 0000 0000 0000" maxLength={19}
                  className="bg-white/5 border-white/20 text-white placeholder:text-neutral-600 focus:border-[#FF4D00] font-mono"
                />
              </div>
            )}

            {method === 'sbp' && (
              <div>
                <Label className="text-neutral-300 mb-1.5 block">Номер телефона</Label>
                <Input
                  value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+7 900 000 00 00" type="tel"
                  className="bg-white/5 border-white/20 text-white placeholder:text-neutral-600 focus:border-[#FF4D00]"
                />
              </div>
            )}

            {method === 'crypto' && (
              <>
                <div>
                  <Label className="text-neutral-300 mb-1.5 block">Монета</Label>
                  <div className="flex gap-2">
                    {CRYPTO_COINS.map(c => (
                      <button key={c} type="button" onClick={() => setCryptoCoin(c)}
                        className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                          cryptoCoin === c ? 'bg-[#FF4D00] text-white' : 'bg-white/5 border border-white/10 text-neutral-400'
                        }`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-neutral-300 mb-1.5 block">Адрес кошелька</Label>
                  <Input
                    value={cryptoAddress} onChange={e => setCryptoAddress(e.target.value)}
                    placeholder="Вставьте адрес..."
                    className="bg-white/5 border-white/20 text-white placeholder:text-neutral-600 focus:border-[#FF4D00] font-mono text-sm"
                  />
                </div>
                <div className="flex items-start gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                  <Icon name="Clock" size={15} className="text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-yellow-400 text-xs">Крипто-выплаты обрабатываются вручную в течение 24 часов</p>
                </div>
              </>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <Icon name="AlertCircle" size={15} className="text-red-400 shrink-0" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                <Icon name="CheckCircle" size={15} className="text-green-400 shrink-0" />
                <p className="text-green-400 text-sm">{success}</p>
              </div>
            )}

            <Button type="submit" disabled={loading2} size="lg"
              className="w-full bg-[#FF4D00] hover:bg-[#e64500] text-white border-0">
              {loading2 ? 'Обрабатываем...' : `Вывести ${parseFloat(amount || '0').toLocaleString('ru-RU')} ₽`}
            </Button>
          </motion.form>
        </div>
      </div>
    </Layout>
  )
}
