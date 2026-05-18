import { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  z: number
  px: number
  py: number
}

export default function Starfield({ count = 350 }: { count?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const W = () => canvas.width
    const H = () => canvas.height
    const CX = () => W() / 2
    const CY = () => H() / 2

    const stars: Star[] = Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * W() * 2,
      y: (Math.random() - 0.5) * H() * 2,
      z: Math.random() * W(),
      px: 0,
      py: 0,
    }))

    let animId: number
    const speed = 3

    const tick = () => {
      ctx.fillStyle = 'rgba(2, 4, 8, 0.25)'
      ctx.fillRect(0, 0, W(), H())

      stars.forEach(star => {
        const sx = (star.x / star.z) * W() + CX()
        const sy = (star.y / star.z) * H() + CY()

        star.px = sx
        star.py = sy
        star.z -= speed

        if (star.z <= 0 || sx < 0 || sx > W() || sy < 0 || sy > H()) {
          star.x = (Math.random() - 0.5) * W() * 2
          star.y = (Math.random() - 0.5) * H() * 2
          star.z = W()
          star.px = (star.x / star.z) * W() + CX()
          star.py = (star.y / star.z) * H() + CY()
          return
        }

        const nx = (star.x / star.z) * W() + CX()
        const ny = (star.y / star.z) * H() + CY()
        const brightness = 1 - star.z / W()
        const radius = brightness * 1.8

        ctx.strokeStyle = `rgba(180, 200, 255, ${brightness * 0.9})`
        ctx.lineWidth = radius
        ctx.beginPath()
        ctx.moveTo(star.px, star.py)
        ctx.lineTo(nx, ny)
        ctx.stroke()

        ctx.fillStyle = `rgba(220, 235, 255, ${brightness})`
        ctx.beginPath()
        ctx.arc(nx, ny, radius * 0.6, 0, Math.PI * 2)
        ctx.fill()
      })

      animId = requestAnimationFrame(tick)
    }

    tick()
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [count])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}
