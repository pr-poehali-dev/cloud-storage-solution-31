import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Link } from "react-router-dom"

const IMAGES = [
  "https://cdn.poehali.dev/projects/2b5d3111-5d96-4cb5-b82b-dd13610cf019/files/ff1b9472-f8e0-42bf-a526-b848cfa17399.jpg",
  "https://cdn.poehali.dev/projects/2b5d3111-5d96-4cb5-b82b-dd13610cf019/files/0169ef28-a4ff-4ba1-9cc6-b55fd08f4bca.jpg",
  "https://cdn.poehali.dev/projects/2b5d3111-5d96-4cb5-b82b-dd13610cf019/files/b2126f7d-ed5b-4cb1-b958-66a5a34e8b67.jpg",
]

const STATS = [
  { label: "Доходность", value: "10% / нед" },
  { label: "Минимальный вход", value: "от 100 ₽" },
  { label: "Начисление", value: "каждую секунду" },
]

interface HeroSectionProps {
  isActive: boolean
}

export default function HeroSection({ isActive }: HeroSectionProps) {
  const [imgIndex, setImgIndex] = useState(0)

  useEffect(() => {
    const t = setInterval(() => {
      setImgIndex(i => (i + 1) % IMAGES.length)
    }, 3500)
    return () => clearInterval(t)
  }, [])

  return (
    <section className="relative h-screen w-full snap-start flex flex-col justify-center overflow-hidden">
      {/* Фоновый слайдер */}
      <AnimatePresence mode="sync">
        <motion.div
          key={imgIndex}
          className="absolute inset-0 z-0"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
        >
          <img
            src={IMAGES[imgIndex]}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Контент */}
      <div className="relative z-10 px-8 md:px-16 lg:px-24 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isActive ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <Badge variant="outline" className="text-white border-white/50 backdrop-blur-sm">
            Регистрация открыта
          </Badge>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 50 }}
          animate={isActive ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold leading-[1.05] tracking-tight text-white"
        >
          Реклама,<br />
          <span className="text-[#FF4D00]">которая</span><br />
          приносит доход.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={isActive ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-6 text-lg md:text-xl text-neutral-300 max-w-xl"
        >
          Вкладывайте в рекламу — получайте 10% дивидендов в неделю. Начисления идут каждую секунду.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isActive ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-10 flex gap-4"
        >
          <Button
            asChild
            size="lg"
            className="bg-[#FF4D00] hover:bg-[#e64400] text-white border-0 text-base px-8"
          >
            <Link to="/register">Начать зарабатывать</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="lg"
            className="text-neutral-300 hover:text-white text-base"
          >
            <Link to="/login">Войти</Link>
          </Button>
        </motion.div>

        {/* Статы */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isActive ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mt-12 flex flex-wrap gap-6"
        >
          {STATS.map(stat => (
            <div key={stat.label} className="border-l-2 border-[#FF4D00] pl-3">
              <p className="text-white font-bold text-lg">{stat.value}</p>
              <p className="text-neutral-500 text-xs">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Индикаторы слайдера */}
      <div className="absolute bottom-8 left-8 md:left-16 z-10 flex gap-2">
        {IMAGES.map((_, i) => (
          <button
            key={i}
            onClick={() => setImgIndex(i)}
            className={`h-0.5 transition-all duration-500 rounded-full ${
              i === imgIndex ? "w-8 bg-[#FF4D00]" : "w-4 bg-white/30"
            }`}
          />
        ))}
      </div>
    </section>
  )
}
