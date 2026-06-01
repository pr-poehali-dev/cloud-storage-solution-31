import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from "recharts"

interface Coin {
  id: string
  symbol: string
  name: string
  current_price: number
  price_change_percentage_24h: number
  image: string
  sparkline_in_7d: { price: number[] }
}

interface CryptoSectionProps {
  isActive: boolean
}

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=true&price_change_percentage=24h"

function formatPrice(price: number) {
  if (price >= 1000) return price.toLocaleString("en-US", { maximumFractionDigits: 0 })
  if (price >= 1) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return price.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })
}

export default function CryptoSection({ isActive }: CryptoSectionProps) {
  const [coins, setCoins] = useState<Coin[]>([])
  const [selected, setSelected] = useState<Coin | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string>("")

  const fetchCoins = async () => {
    try {
      const res = await fetch(COINGECKO_URL)
      const data: Coin[] = await res.json()
      setCoins(data)
      if (!selected) setSelected(data[0])
      else setSelected(data.find(c => c.id === selected.id) || data[0])
      const now = new Date()
      setLastUpdated(now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
    } catch (_e) {
      // сетевая ошибка — пробуем при следующем обновлении
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCoins()
    const interval = setInterval(fetchCoins, 30000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const chartData = selected?.sparkline_in_7d?.price?.map((price, i) => ({ i, price })) ?? []
  const isPositive = (selected?.price_change_percentage_24h ?? 0) >= 0

  return (
    <section className="relative h-screen w-full snap-start flex flex-col justify-center p-6 md:p-12 lg:p-16 overflow-hidden rounded-0 py-3 px-3 mx-0 my-0">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={isActive ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        className="w-full max-w-6xl mx-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-white">Крипторынок</h2>
            <p className="text-neutral-500 text-sm mt-1">Топ-10 криптовалют в реальном времени</p>
          </div>
          {lastUpdated && (
            <span className="text-neutral-600 text-xs">Обновлено: {lastUpdated}</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-[#FF4D00] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Список монет */}
            <div className="lg:col-span-2 space-y-1 overflow-y-auto max-h-[420px] pr-1">
              {coins.map((coin, idx) => {
                const pos = (coin.price_change_percentage_24h ?? 0) >= 0
                const isSelected = selected?.id === coin.id
                return (
                  <button
                    key={coin.id}
                    onClick={() => setSelected(coin)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                      isSelected
                        ? "bg-white/10 border border-white/20"
                        : "bg-white/5 border border-transparent hover:bg-white/8"
                    }`}
                  >
                    <span className="text-neutral-600 text-xs w-4">{idx + 1}</span>
                    <img src={coin.image} alt={coin.name} className="w-7 h-7 rounded-full" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{coin.name}</p>
                      <p className="text-neutral-500 text-xs uppercase">{coin.symbol}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white text-sm font-mono">${formatPrice(coin.current_price)}</p>
                      <p className={`text-xs font-medium ${pos ? "text-green-400" : "text-red-400"}`}>
                        {pos ? "+" : ""}{(coin.price_change_percentage_24h ?? 0).toFixed(2)}%
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* График */}
            {selected && (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="lg:col-span-3 bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col"
              >
                <div className="flex items-center gap-3 mb-4">
                  <img src={selected.image} alt={selected.name} className="w-9 h-9 rounded-full" />
                  <div>
                    <p className="text-white font-semibold">{selected.name}</p>
                    <p className="text-neutral-500 text-xs uppercase">{selected.symbol}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-white text-2xl font-bold font-mono">${formatPrice(selected.current_price)}</p>
                    <p className={`text-sm font-medium ${isPositive ? "text-green-400" : "text-red-400"}`}>
                      {isPositive ? "▲" : "▼"} {Math.abs(selected.price_change_percentage_24h).toFixed(2)}% за 24ч
                    </p>
                  </div>
                </div>

                <div className="flex-1 min-h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <defs>
                        <linearGradient id="cryptoGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <YAxis domain={["auto", "auto"]} hide />
                      <Tooltip
                        contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ display: "none" }}
                        formatter={(val: number) => [`$${formatPrice(val)}`, ""]}
                      />
                      <Area
                        type="monotone"
                        dataKey="price"
                        stroke={isPositive ? "#22c55e" : "#ef4444"}
                        strokeWidth={2}
                        fill="url(#cryptoGrad)"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-neutral-600 text-xs mt-2 text-center">График за 7 дней</p>
              </motion.div>
            )}
          </div>
        )}
      </motion.div>
    </section>
  )
}