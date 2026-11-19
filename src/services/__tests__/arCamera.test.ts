/**
 * Mode Caméra AR : calage manuel de la boussole, champ optique, projection
 * gnomonique (rectilinéaire), traitement des pixels de la photo et cycle de vie
 * strict des pistes vidéo (voyant caméra éteint).
 */
import { describe, expect, it, vi } from 'vitest'
import {
  AR_DEFAULT_FOV_DEG, AR_MAX_OFFSET_DEG, AR_VIDEO_CONSTRAINTS, ArCameraSession, applyAzimuthOffset, cameraErrorReason, clampArFov,
  classifyCameraError, dragAngleDeg, formatOffset, normalizeOffsetDeg, offsetAfterDrag, stopStream,
} from '../sky/arCamera'
import { AR_BOOST_BRIGHTNESS, AR_BOOST_CONTRAST, arVideoFilter, coverRect, transformPixels } from '../sky/arImage'
import { createProjector, panView, pixelScale, project, unproject, zoomView } from '../sky/projection'
import { angleBetweenDeg, fromHorizontal, toHorizontal } from '../sky/vector'
import type { SkyView } from '../../types/sky'
import { fakeStream } from './fakeMedia'


describe('AR : calage de l’azimut', () => {
  it('angle balayé par un glissement en projection gnomonique', () => {
    // Glisser d'une demi-largeur = demi-champ.
    expect(dragAngleDeg(196.5, 393, 65)).toBeCloseTo(32.5, 9)
    expect(dragAngleDeg(-196.5, 393, 65)).toBeCloseTo(-32.5, 9)
    expect(dragAngleDeg(0, 393, 65)).toBe(0)
    expect(dragAngleDeg(10, 0, 65)).toBe(0)
  })

  it('glisser vers la droite réduit l’azimut de visée (les astres suivent le doigt)', () => {
    const f = 393 / 2 / Math.tan((65 / 2) * Math.PI / 180)
    const dx = f * Math.tan(6 * Math.PI / 180) // 6° exactement
    expect(offsetAfterDrag(0, dx, 393, 65)).toBeCloseTo(-6, 9)
    expect(offsetAfterDrag(-6, -dx, 393, 65)).toBeCloseTo(0, 9)
  })

  it('décalage normalisé et borné, appliqué modulo 360°', () => {
    expect(normalizeOffsetDeg(370)).toBe(10)
    expect(normalizeOffsetDeg(-190)).toBe(AR_MAX_OFFSET_DEG) // −190° ≡ +170°, borné
    expect(normalizeOffsetDeg(200)).toBe(-AR_MAX_OFFSET_DEG)
    expect(normalizeOffsetDeg(-12.5)).toBe(-12.5)
    const v: SkyView = { azimuthDeg: 355, altitudeDeg: 20, fovDeg: 65, rollDeg: 3 }
    expect(applyAzimuthOffset(v, 8)).toEqual({ ...v, azimuthDeg: 3 })
    expect(applyAzimuthOffset(v, -10).azimuthDeg).toBeCloseTo(345, 9)
  })

  it('badge compact et champ optique de l’iPhone', () => {
    expect(formatOffset(6.2)).toBe('Calage +6°')
    expect(formatOffset(-3.4)).toBe('Calage −3°')
    expect(formatOffset(0.3)).toBe('Calage 0°')
    expect(AR_DEFAULT_FOV_DEG).toBe(65)
    expect(clampArFov(20)).toBe(40)
    expect(clampArFov(120)).toBe(85)
    expect(clampArFov(70)).toBe(70)
  })
})

describe('AR : projection gnomonique (rectilinéaire)', () => {
  const VP = { width: 393, height: 700 }
  const view: SkyView = { azimuthDeg: 200, altitudeDeg: 30, fovDeg: 65, rollDeg: 0 }
  const p = createProjector(view, 'gnomonic', VP)

  it('le champ horizontal remplit exactement la largeur', () => {
    expect(pixelScale('gnomonic', 65, 393)).toBeCloseTo(196.5 / Math.tan(32.5 * Math.PI / 180), 9)
    const edge = project(p, unproject(p, 393, 350))!
    expect(edge.x).toBeCloseTo(393, 6)
    expect(angleBetweenDeg(unproject(p, 0, 350), unproject(p, 393, 350))).toBeCloseTo(65, 6)
  })

  it('aller-retour écran → ciel → écran exact', () => {
    for (const [x, y] of [[10, 20], [196.5, 350], [380, 690], [50, 600]]) {
      const s = project(p, unproject(p, x, y))!
      expect(s.x).toBeCloseTo(x, 6)
      expect(s.y).toBeCloseTo(y, 6)
    }
  })

  it('un grand cercle (ligne de constellation) reste une droite à l’écran', () => {
    // Points d'un même grand cercle : l'horizon (az 170° → 230°).
    const pts = [170, 185, 200, 215, 230].map((az) => project(p, fromHorizontal(az, 0))!)
    const [a, b] = [pts[0], pts[4]]
    for (const q of pts.slice(1, 4)) {
      const cross = (b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x)
      expect(Math.abs(cross) / Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(1e-6)
    }
  })

  it('n’affiche rien au-delà de 78° du centre, pan et zoom cohérents', () => {
    expect(project(p, fromHorizontal(20, -30))).toBeNull()
    const panned = panView(view, 'gnomonic', VP, 100, 300, 160, 300)
    expect(toHorizontal(unproject(createProjector(panned, 'gnomonic', VP), 160, 300)).azimuthDeg)
      .toBeCloseTo(toHorizontal(unproject(p, 100, 300)).azimuthDeg, 3)
    expect(zoomView(view, 'gnomonic', VP, 1.3, 196.5, 350).fovDeg).toBeCloseTo(50, 6)
  })
})

describe('AR : photo annotée', () => {
  it('vision nocturne : chaque pixel réduit au canal rouge (G = B = 0)', () => {
    const d = new Uint8ClampedArray([30, 200, 255, 255, 255, 255, 255, 128, 0, 0, 0, 255])
    transformPixels(d, { boost: false, redNight: true })
    expect([...d]).toEqual([Math.round(0.299 * 30 + 0.587 * 200 + 0.114 * 255), 0, 0, 255, 255, 0, 0, 128, 0, 0, 0, 255])
  })

  it('renfort de visibilité identique à brightness(1.45) contrast(1.2)', () => {
    const d = new Uint8ClampedArray([40, 80, 200, 255])
    transformPixels(d, { boost: true, redNight: false })
    const css = (v: number) => Math.max(0, Math.min(255, (v * AR_BOOST_BRIGHTNESS - 127.5) * AR_BOOST_CONTRAST + 127.5))
    expect([...d.slice(0, 3)]).toEqual([40, 80, 200].map((v) => Math.round(css(v))))
    const e = new Uint8ClampedArray([10, 20, 30, 255])
    transformPixels(e, { boost: true, redNight: true })
    expect(e[1]).toBe(0)
    expect(e[2]).toBe(0)
  })

  it('filtre CSS du flux en direct : renfort puis rouge pur', () => {
    expect(arVideoFilter(false, false)).toBe('none')
    expect(arVideoFilter(true, false)).toBe('brightness(1.45) contrast(1.2)')
    expect(arVideoFilter(true, true)).toBe('brightness(1.45) contrast(1.2) url(#astrosky-red-night-video)')
  })

  it('recadrage object-cover d’une vidéo 1920×1080 sur un écran portrait', () => {
    const r = coverRect(1920, 1080, 1179, 2100)
    expect(r.h).toBeCloseTo(2100, 9)
    expect(r.w).toBeCloseTo(1920 * (2100 / 1080), 9)
    expect(r.x).toBeCloseTo((1179 - r.w) / 2, 9)
    expect(r.y).toBe(0)
  })
})

describe('AR : session caméra', () => {
  it('demande la caméra arrière 1080p sans micro', async () => {
    const { stream } = fakeStream()
    const getUserMedia = vi.fn(async () => stream)
    const s = new ArCameraSession(() => ({ getUserMedia }))
    await s.start()
    expect(getUserMedia).toHaveBeenCalledWith(AR_VIDEO_CONSTRAINTS)
    expect(AR_VIDEO_CONSTRAINTS).toMatchObject({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
    expect(s.active).toBe(true)
    await s.start() // idempotent
    expect(getUserMedia).toHaveBeenCalledTimes(1)
  })

  it('stop() arrête toutes les pistes et reste sans effet ensuite', async () => {
    const { stream, tracks } = fakeStream(2)
    const s = new ArCameraSession(() => ({ getUserMedia: async () => stream }))
    await s.start()
    s.stop()
    for (const t of tracks) expect(t.stop).toHaveBeenCalledTimes(1)
    expect(s.active).toBe(false)
    expect(s.current).toBeNull()
    s.stop()
    for (const t of tracks) expect(t.stop).toHaveBeenCalledTimes(1)
    stopStream(null)
  })

  it('arrêt pendant la demande d’autorisation : le flux arrivé ensuite est éteint aussitôt', async () => {
    const { stream, tracks } = fakeStream()
    let resolve!: (s: MediaStream) => void
    const s = new ArCameraSession(() => ({ getUserMedia: () => new Promise<MediaStream>((r) => { resolve = r }) }))
    const pending = s.start()
    s.stop() // l'utilisateur quitte l'onglet avant d'avoir répondu
    resolve(stream)
    await expect(pending).rejects.toMatchObject({ cancelled: true })
    expect(tracks[0].stop).toHaveBeenCalled()
    expect(s.active).toBe(false)
  })

  it('refus, absence de caméra et API absente sont distingués', async () => {
    const fail = (name: string) => new ArCameraSession(() => ({ getUserMedia: async () => { throw Object.assign(new Error(name), { name }) } }))
    await expect(fail('NotAllowedError').start()).rejects.toMatchObject({ reason: 'denied' })
    await expect(fail('NotFoundError').start()).rejects.toMatchObject({ reason: 'unavailable' })
    await expect(fail('AbortError').start()).rejects.toMatchObject({ reason: 'failed' })
    await expect(new ArCameraSession(() => undefined).start()).rejects.toMatchObject({ reason: 'unavailable' })
    expect(classifyCameraError({ name: 'OverconstrainedError' })).toBe('unavailable')
    expect(cameraErrorReason(new Error('x'))).toBe('failed')
  })
})
