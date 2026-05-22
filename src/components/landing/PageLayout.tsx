import { ReactNode } from 'react'
import { Squares } from './squares-background'

const BG_IMAGES = [
  "https://cdn.poehali.dev/projects/2b5d3111-5d96-4cb5-b82b-dd13610cf019/files/c02c5244-689c-45f3-b6f9-ae72d0685e81.jpg",
  "https://cdn.poehali.dev/projects/2b5d3111-5d96-4cb5-b82b-dd13610cf019/files/0f8fb352-4461-434e-be40-3744632aa07a.jpg",
]

interface PageLayoutProps {
  children: ReactNode
  imgIndex?: number
}

export default function PageLayout({ children, imgIndex = 0 }: PageLayoutProps) {
  const img = BG_IMAGES[imgIndex % BG_IMAGES.length]
  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Фоновое изображение */}
      <div className="absolute inset-0 z-0">
        <img src={img} alt="" className="w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-br from-black via-black/80 to-black/60" />
      </div>
      {/* Сетка */}
      <div className="absolute inset-0 z-10 opacity-40">
        <Squares direction="diagonal" speed={0.3} squareSize={40} borderColor="#222" hoverFillColor="#1a1a1a" />
      </div>
      {/* Декоративное свечение */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#FF4D00]/10 blur-[120px] rounded-full z-10 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-orange-900/10 blur-[100px] rounded-full z-10 pointer-events-none" />
      {/* Контент */}
      <div className="relative z-20 min-h-screen">
        {children}
      </div>
    </div>
  )
}
