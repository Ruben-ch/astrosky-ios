/**
 * Moteur de rendu Canvas 2D du planétarium. Les vecteurs J2000 → horizontal
 * (étoiles, Voie lactée, figures, grilles, écliptique) sont recalculés au plus
 * une fois par seconde simulée ; à 60 fps, seule la projection est refaite.
 * Ordre de dessin : Voie lactée → grilles → figures → étoiles → ciel profond →
 * système solaire → sol → horizon → surcouches.
 */
import { MoonPhase } from 'astronomy-engine'
import { BODY_NAME_FR, SOLAR_SYSTEM_BODIES, getBodyEphemeris, getBodyHorizontal } from '../../services/astroEngine'
import { createProjector } from '../../services/sky/projection'
import type { SkyCatalog } from '../../services/sky/skyCatalog'
import { eqjToEnuMatrix, transformVectors, type Mat3 } from '../../services/sky/skyFrame'
import { pickNearest, type PickCandidate } from '../../services/sky/skyStyle'
import { fromHorizontal } from '../../services/sky/vector'
import type { RenderPalette, ThemeName } from '../../theme/palette'
import type { ObserverLocation } from '../../types/astro'
import type { ProjectionKind, SkyLayers, SkyObjectRef, SkyView, Vec3 } from '../../types/sky'
import { drawAltAzGrid, drawEcliptic, drawEquatorialGrid, drawMilkyWay } from './drawBackdrop'
import { drawGround, drawHorizonLine } from './drawHorizon'
import { drawDeepSky, drawDeepSkyLabels, drawSolarSystem, type BodyFrame, type DeferredLabel } from './drawObjects'
import { drawGuidance, drawReticle, drawSelection } from './drawOverlay'
import { bvBin, drawConstellationLines, drawConstellationNames, drawStars } from './drawStars'
import { LabelPlacer, freeBounds, type FrameContext, type ScreenRect } from './frame'

export interface RenderInput {
  readonly width: number
  readonly height: number
  readonly view: SkyView
  readonly projection: ProjectionKind
  readonly layers: SkyLayers
  readonly palette: RenderPalette
  readonly theme: ThemeName
  readonly simMs: number
  readonly loc: ObserverLocation
  readonly timeSec: number
  readonly selected: SkyObjectRef | null
  readonly target: SkyObjectRef | null
  readonly targetLocked: boolean
  /** Surcouches d'interface : aucune étiquette n'y est placée, la flèche les évite. */
  readonly hud: readonly ScreenRect[]
  /** Caméra AR : fond, Voie lactée et sol omis pour laisser voir la vidéo. */
  readonly transparent?: boolean
}

export class SkyEngine {
  private readonly cat: SkyCatalog
  private readonly starEnu: Float64Array
  private readonly starBins: Uint8Array
  private readonly starRaDec: Float32Array
  private readonly mwEnu: Float64Array
  private readonly dsoEnu: Float64Array
  private readonly lineEnu: Float64Array[]
  private readonly labelEnu: { name: string; enu: Float64Array }[]
  private readonly gridEnu: { enu: Float64Array; label: string; isEquator: boolean }[]
  private readonly eclEnu: Float64Array
  private transformKey = ''
  private bodiesKey = ''
  private ephemKey = ''
  private matrix: Mat3 | null = null
  private bodies: BodyFrame[] = []
  private ephem = new Map<string, { magnitude: number; diameter: number; ref: SkyObjectRef }>()
  private readonly labels = new LabelPlacer()
  private candidates: PickCandidate[] = []

  constructor(cat: SkyCatalog) {
    this.cat = cat
    const n = cat.stars.count
    this.starEnu = new Float64Array(n * 3)
    this.starBins = Uint8Array.from(cat.stars.bv, (bv) => bvBin(bv))
    this.starRaDec = new Float32Array(n * 2)
    for (let i = 0; i < n; i++) {
      const [x, y, z] = [cat.stars.eqj[i * 3], cat.stars.eqj[i * 3 + 1], cat.stars.eqj[i * 3 + 2]]
      this.starRaDec[i * 2] = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
      this.starRaDec[i * 2 + 1] = (Math.asin(z) * 180) / Math.PI
    }
    this.mwEnu = new Float64Array(cat.milkyWay.eqj.length)
    this.dsoEnu = new Float64Array(cat.deepSkyEqj.length)
    this.lineEnu = cat.constellationLines.map((l) => new Float64Array(l.eqj.length))
    this.labelEnu = cat.constellationLabels.map((l) => ({ name: l.name, enu: new Float64Array(3) }))
    this.gridEnu = cat.equatorialGrid.map((g) => ({ enu: new Float64Array(g.eqj.length), label: g.label, isEquator: g.isEquator }))
    this.eclEnu = new Float64Array(cat.ecliptic.eqj.length)
  }

  /** Matrice EQJ → ENU de la dernière mise à jour (pour les directions de cibles). */
  get eqjToEnu(): Mat3 | null {
    return this.matrix
  }

  private update(simMs: number, loc: ObserverLocation): void {
    const locKey = `${loc.latitudeDeg},${loc.longitudeDeg},${loc.elevationM}`
    const tKey = `${Math.floor(simMs / 1000)}|${locKey}`
    if (tKey !== this.transformKey) {
      this.transformKey = tKey
      const m = eqjToEnuMatrix(new Date(simMs), loc)
      this.matrix = m
      const c = this.cat
      transformVectors(m, c.stars.eqj, this.starEnu)
      transformVectors(m, c.milkyWay.eqj, this.mwEnu, false)
      transformVectors(m, c.deepSkyEqj, this.dsoEnu)
      c.constellationLines.forEach((l, i) => transformVectors(m, l.eqj, this.lineEnu[i]))
      c.constellationLabels.forEach((l, i) => transformVectors(m, l.eqj, this.labelEnu[i].enu, false))
      c.equatorialGrid.forEach((g, i) => transformVectors(m, g.eqj, this.gridEnu[i].enu))
      transformVectors(m, c.ecliptic.eqj, this.eclEnu)
    }
    const date = new Date(simMs)
    const eKey = `${Math.floor(simMs / 60_000)}|${locKey}`
    if (eKey !== this.ephemKey) {
      this.ephemKey = eKey
      for (const id of SOLAR_SYSTEM_BODIES) {
        const e = getBodyEphemeris(id, date, loc)
        this.ephem.set(id, {
          magnitude: e.magnitude, diameter: e.angularDiameterArcsec,
          ref: { key: id, kind: id === 'Moon' ? 'moon' : id === 'Sun' ? 'sun' : 'planet', label: BODY_NAME_FR[id], magnitude: e.magnitude, raDeg: e.raHours * 15, decDeg: e.decDeg, bodyId: id, deepSkyType: null },
        })
      }
    }
    if (tKey !== this.bodiesKey) {
      this.bodiesKey = tKey
      const phase = MoonPhase(date)
      this.bodies = SOLAR_SYSTEM_BODIES.map((id) => {
        const h = getBodyHorizontal(id, date, loc)
        const e = this.ephem.get(id)!
        return { id, ref: e.ref, enu: fromHorizontal(h.azimuthDeg, h.altitudeDeg), magnitude: e.magnitude, angularDiameterArcsec: e.diameter, phaseAngleDeg: phase }
      })
    }
  }

  /** Direction ENU courante d'un astre mobile déjà calculé, ou `null`. */
  bodyDirection(key: string): Vec3 | null {
    return this.bodies.find((b) => b.id === key)?.enu ?? null
  }

  render(ctx: CanvasRenderingContext2D, input: RenderInput, targetDir: Vec3 | null, selectedDir: Vec3 | null): void {
    this.update(input.simMs, input.loc)
    const { width, height, layers: L, palette: p } = input
    this.labels.reset()
    for (const r of input.hud) this.labels.reserve(r.x - 4, r.y - 4, r.w + 8, r.h + 8)
    const candidates: PickCandidate[] = []
    const f: FrameContext = {
      ctx, width, height, view: input.view, proj: createProjector(input.view, input.projection, { width, height }),
      layers: L, p, theme: input.theme, timeSec: input.timeSec, labels: this.labels, candidates, transparent: input.transparent === true,
    }
    if (f.transparent) ctx.clearRect(0, 0, width, height)
    else {
      ctx.fillStyle = p.background
      ctx.fillRect(0, 0, width, height)
    }
    if (L.milkyWay && !f.transparent) drawMilkyWay(f, this.mwEnu, this.cat.milkyWay.level, this.cat.milkyWay.stepDeg)
    if (L.equatorialGrid) drawEquatorialGrid(f, this.gridEnu)
    if (L.altAzGrid) drawAltAzGrid(f)
    if (L.ecliptic) drawEcliptic(f, this.eclEnu)
    if (L.constellationLines) drawConstellationLines(f, this.lineEnu)
    drawStars(f, this.cat, this.starEnu, this.starBins, this.starRaDec)
    const dsoLabels: DeferredLabel[] = L.deepSky ? drawDeepSky(f, this.cat.deepSky, this.dsoEnu) : []
    // Lune et planètes par-dessus les étoiles (la Lune occulte ce qui est derrière elle).
    if (L.planets) drawSolarSystem(f, this.bodies)
    // Priorité des étiquettes : astres → constellations → ciel profond (jamais superposées).
    if (L.constellationNames) drawConstellationNames(f, this.labelEnu)
    drawDeepSkyLabels(f, dsoLabels)
    if (L.horizon) {
      drawGround(f)
      drawHorizonLine(f)
    }
    if (selectedDir) drawSelection(f, selectedDir)
    drawReticle(f, input.targetLocked)
    if (targetDir) drawGuidance(f, targetDir, input.targetLocked, freeBounds(width, height, input.hud))
    this.candidates = candidates
  }

  /** Objet sélectionnable le plus proche d'un toucher (coordonnées CSS). */
  pick(x: number, y: number): SkyObjectRef | null {
    return pickNearest(this.candidates, x, y)
  }
}
