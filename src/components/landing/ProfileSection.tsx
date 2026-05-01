import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import Icon from "@/components/ui/icon"

interface ProfileSectionProps {
  isActive: boolean
}

const DEPOSIT = 1000
const RATE = 0.10
const WEEKLY_RATE = RATE / (7 * 24 * 3600)

export default function ProfileSection({ isActive }: ProfileSectionProps) {
  const [dividends, setDividends] = useState(0)
  const [confirmed, setConfirmed] = useState(false)
  const [lastConfirmed, setLastConfirmed] = useState<string | null>(null)
  const [canConfirm, setCanConfirm] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setDividends(prev => prev + DEPOSIT * WEEKLY_RATE)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleConfirm = () => {
    const now = new Date()
    const time = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    const date = now.toLocaleDateString("ru-RU")
    setLastConfirmed(`${date} в ${time}`)
    setConfirmed(true)
    setCanConfirm(false)
    setTimeout(() => setConfirmed(false), 3000)
  }

  return (
    <section className="relative h-screen w-full snap-start flex flex-col justify-center p-8 md:p-16 lg:p-24">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={isActive ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        className="max-w-2xl"
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-full bg-[#FF4D00] flex items-center justify-center">
            <Icon name="User" size={24} className="text-white" />
          </div>
          <div>
            <p className="text-neutral-400 text-sm">Личный кабинет</p>
            <p className="text-white font-semibold">Александр И.</p>
          </div>
        </div>

        <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-2">
          Ваши дивиденды
        </h2>
        <p className="text-neutral-400 mb-8">Начислений за рекламу в реальном времени</p>

        <motion.div
          className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-6"
          animate={isActive ? { opacity: 1 } : {}}
        >
          <p className="text-neutral-400 text-sm mb-2">Накоплено дивидендов</p>
          <div className="flex items-end gap-2">
            <span className="text-5xl md:text-6xl font-bold text-[#FF4D00] tabular-nums">
              {dividends.toFixed(4)}
            </span>
            <span className="text-2xl text-white mb-1">₽</span>
          </div>
          <p className="text-neutral-500 text-xs mt-2">
            Начисляется каждую секунду • 10% в неделю от депозита {DEPOSIT} ₽
          </p>
        </motion.div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-neutral-400 text-xs mb-1">Ваш депозит</p>
            <p className="text-white text-xl font-bold">{DEPOSIT} ₽</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-neutral-400 text-xs mb-1">Доходность</p>
            <p className="text-[#FF4D00] text-xl font-bold">10% / нед</p>
          </div>
        </div>

        {lastConfirmed && (
          <p className="text-neutral-500 text-sm mb-3">
            Последнее подтверждение: {lastConfirmed}
          </p>
        )}

        <Button
          onClick={handleConfirm}
          disabled={!canConfirm}
          size="lg"
          className={`w-full md:w-auto transition-all ${
            confirmed
              ? "bg-green-500 text-white border-green-500"
              : canConfirm
              ? "bg-transparent border border-[#FF4D00] text-[#FF4D00] hover:bg-[#FF4D00] hover:text-black"
              : "bg-transparent border border-neutral-600 text-neutral-600 cursor-not-allowed"
          }`}
        >
          {confirmed ? (
            <span className="flex items-center gap-2">
              <Icon name="Check" size={18} />
              Баланс зафиксирован!
            </span>
          ) : canConfirm ? (
            <span className="flex items-center gap-2">
              <Icon name="ShieldCheck" size={18} />
              Подтвердить баланс сегодня
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Icon name="Clock" size={18} />
              Подтверждено на сегодня
            </span>
          )}
        </Button>
      </motion.div>
    </section>
  )
}
