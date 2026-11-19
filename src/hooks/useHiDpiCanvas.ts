/**
 * Canvas 2D net sur écran Retina : suit la taille CSS du conteneur
 * (ResizeObserver) et applique `devicePixelRatio`. Le dessin se fait en
 * pixels CSS ; `draw` est rappelé à chaque redimensionnement ou changement de dépendances.
 */
import { useEffect, useRef, type DependencyList } from 'react'

export interface CanvasSize {
  readonly width: number
  readonly height: number
  readonly dpr: number
}

export function useHiDpiCanvas(
  draw: (ctx: CanvasRenderingContext2D, size: CanvasSize) => void,
  deps: DependencyList,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sizeRef = useRef<CanvasSize>({ width: 0, height: 0, dpr: 1 })
  const drawRef = useRef(draw)
  useEffect(() => {
    drawRef.current = draw
  })

  const render = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || sizeRef.current.width === 0) return
    const { dpr } = sizeRef.current
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, sizeRef.current.width, sizeRef.current.height)
    drawRef.current(ctx, sizeRef.current)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      sizeRef.current = { width, height, dpr }
      render()
    })
    observer.observe(canvas)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(render, deps)

  return canvasRef
}
