/**
 * Moteur Three.js du Système Solaire 3D. Possède le renderer, la scène et la
 * caméra ; à chaque frame il recalcule les positions héliocentriques
 * (astronomy-engine) pour le temps simulé, oriente les globes sur leur axe IAU,
 * garantit une taille apparente minimale lisible, pilote la caméra et renvoie les
 * projections écran (sélection au toucher, étiquettes). `dispose()` libère
 * chaque ressource GPU et le contexte WebGL.
 */
import { AmbientLight, Group, PerspectiveCamera, PointLight, Scene, SphereGeometry, Vector2, Vector3, WebGLRenderer, type Texture } from 'three'
import { GALILEAN_MOONS, ORRERY_PLANETS } from '../../data/solarSystemPhysical'
import { cameraPosition, CAMERA_FOV_DEG, focusDistance, viewModeOf } from '../../services/orrery/cameraRig'
import type { OrbitSet } from '../../services/orrery/orbits'
import { computeOrrerySnapshot } from '../../services/orrery/positions'
import { compressHelioDistance, compressJovicentricDistance, visualRadius } from '../../services/orrery/visualScale'
import type { RenderPalette, ThemeName } from '../../theme/palette'
import type { OrreryBodyId, OrrerySnapshot, OrreryViewMode, ScreenPick, Vec3 } from '../../types/orrery'
import { CameraController } from './cameraController'
import {
  createEclipticGrid, createGlobe, createOrbitLine, createStarfield, createSun, paintStarfield, setLineStyle, threeColor,
  type Disposable, type GlobeObject, type SunObject,
} from './sceneObjects'
import { makeCoronaTexture, makeDotTexture, makeRingTexture, makeSurfaceTexture } from './textures'

/** Taille apparente minimale (rayon, px CSS) : un astre reste toujours visible. */
const MIN_RADIUS_PX: Readonly<Record<'star' | 'planet' | 'moon', number>> = { star: 7, planet: 3.2, moon: 2.2 }
/**
 * Les lunes galiléennes n'apparaissent que si leur système dépasse ce rayon à
 * l'écran (zoom vers Jupiter) : masquées en vue d'ensemble, sauf lune sélectionnée.
 */
const MOON_SYSTEM_MIN_PX = 60
const CALLISTO_RJ = 26.3
/** Vue d'ensemble : cadrée sur l'orbite de Jupiter (aphélie 5,46 UA). */
const OVERVIEW_AU = 5.5
const UP = new Vector3(0, 1, 0)

type OrbitBodyId = (typeof ORRERY_PLANETS)[number] | (typeof GALILEAN_MOONS)[number]

export class OrreryEngine {
  readonly camera: PerspectiveCamera
  readonly controller: CameraController
  snapshot: OrrerySnapshot
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly resources = new Set<Disposable>()
  private readonly textures = new Set<Texture>()
  private readonly sun: SunObject
  private readonly globes = new Map<OrreryBodyId, GlobeObject>()
  private readonly orbitLines = new Map<OrbitBodyId, ReturnType<typeof createOrbitLine>>()
  private readonly planetOrbits = new Group()
  private readonly moonOrbits = new Group()
  private readonly grid: ReturnType<typeof createEclipticGrid>
  private readonly stars: ReturnType<typeof createStarfield>
  private readonly light: PointLight
  private readonly ambient: AmbientLight
  private readonly resolution = new Vector2(1, 1)
  private readonly tmp = new Vector3()
  private palette: RenderPalette
  private size = { width: 1, height: 1 }
  private selected: OrreryBodyId | null = null
  private showOrbits = true
  private lastSimMs = NaN
  private picks: ScreenPick[] = []
  private moonsVisible = false
  private moonSystemRadiusPx = 0
  private contextLost = false

  private readonly canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement, palette: RenderPalette, theme: ThemeName, mode: OrreryViewMode, simMs: number) {
    this.canvas = canvas
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.camera = new PerspectiveCamera(CAMERA_FOV_DEG, 1, 0.005, 4000)
    const track = <T extends Disposable>(r: T): T => (this.resources.add(r), r)
    const sphere = track(new SphereGeometry(1, 48, 32))
    this.light = new PointLight(0xffffff, 3.4, 0, 0)
    this.ambient = new AmbientLight(0xffffff, 0.5)
    this.sun = createSun(sphere, track)
    this.sun.group.add(this.light)
    for (const id of [...ORRERY_PLANETS, ...GALILEAN_MOONS]) {
      const g = createGlobe(sphere, id === 'Saturn', track)
      this.globes.set(id, g)
      this.scene.add(g.node)
    }
    this.grid = createEclipticGrid(track)
    const dot = makeDotTexture()
    this.resources.add(dot)
    this.stars = createStarfield(dot, track)
    this.scene.add(this.stars, this.grid, this.planetOrbits, this.moonOrbits, this.sun.group, this.ambient)
    this.snapshot = computeOrrerySnapshot(new Date(simMs))
    this.controller = new CameraController(mode, compressHelioDistance(OVERVIEW_AU), 0.5)
    this.palette = palette
    this.setPalette(palette, theme)
    canvas.addEventListener('webglcontextlost', this.onContextLost)
    canvas.addEventListener('webglcontextrestored', this.onContextRestored)
  }

  private onContextLost = (e: Event) => {
    e.preventDefault()
    this.contextLost = true
  }

  private onContextRestored = () => {
    this.contextLost = false
  }

  resize(width: number, height: number, dpr: number): void {
    this.size = { width: Math.max(1, width), height: Math.max(1, height) }
    this.renderer.setPixelRatio(Math.min(dpr, 3))
    this.renderer.setSize(this.size.width, this.size.height, false)
    this.camera.aspect = this.size.width / this.size.height
    this.camera.updateProjectionMatrix()
    this.resolution.set(this.size.width, this.size.height)
    this.restyleOrbits()
  }

  /** Applique la palette (thème sombre ou vision nocturne rouge) à tous les matériaux, lumières et textures. */
  setPalette(p: RenderPalette, theme: ThemeName): void {
    this.palette = p
    const o = p.orrery
    for (const t of this.textures) t.dispose()
    this.textures.clear()
    const tex = <T extends Texture>(t: T): T => (this.textures.add(t), t)
    this.renderer.setClearColor(threeColor(p.background).color, 1)
    this.light.color.copy(threeColor(o.light).color)
    this.ambient.color.copy(threeColor(o.ambient).color)
    this.sun.globe.material.uniforms.uCore.value.copy(threeColor(o.sunCore).color)
    this.sun.globe.material.uniforms.uLimb.value.copy(threeColor(o.sunLimb).color)
    this.sun.corona.material.map = tex(makeCoronaTexture(o.corona, o.coronaOuter, false))
    this.sun.coronaOuter.material.map = tex(makeCoronaTexture(o.coronaOuter, o.coronaOuter, true))
    for (const [id, g] of this.globes) {
      g.globe.material.map = tex(makeSurfaceTexture(id, o))
      g.globe.material.needsUpdate = true
      if (g.rings) {
        const ringTex = tex(makeRingTexture(o.ring))
        g.rings.material.map = ringTex
        // Diffusion multiple dans les anneaux : ils restent lisibles sous un éclairage rasant (vue polaire).
        g.rings.material.emissiveMap = ringTex
        g.rings.material.emissive.copy(threeColor(o.ring).color)
        g.rings.material.emissiveIntensity = 0.4
        g.rings.material.needsUpdate = true
      }
      setLineStyle(g.axis, o.axis, 1.2, this.resolution)
    }
    for (const s of [this.sun.corona, this.sun.coronaOuter]) s.material.needsUpdate = true
    const grid = threeColor(o.eclipticGrid)
    this.grid.material.color.copy(grid.color)
    this.grid.material.opacity = grid.opacity
    paintStarfield(this.stars, theme)
    this.restyleOrbits()
  }

  setOrbits(set: OrbitSet): void {
    for (const line of this.orbitLines.values()) {
      line.geometry.dispose()
      line.material.dispose()
      this.resources.delete(line.geometry)
      this.resources.delete(line.material)
      line.removeFromParent()
    }
    this.orbitLines.clear()
    const track = <T extends Disposable>(r: T): T => (this.resources.add(r), r)
    for (const t of set.planets) {
      const line = createOrbitLine(t.points, track)
      this.orbitLines.set(t.id, line)
      this.planetOrbits.add(line)
    }
    for (const t of set.moons) {
      const line = createOrbitLine(t.points, track)
      this.orbitLines.set(t.id, line)
      this.moonOrbits.add(line)
    }
    this.restyleOrbits()
  }

  private restyleOrbits(): void {
    const o = this.palette.orrery
    for (const [id, line] of this.orbitLines) {
      const isMoon = (GALILEAN_MOONS as readonly string[]).includes(id)
      const sel = id === this.selected
      setLineStyle(line, sel ? o.orbitSelected : isMoon ? o.moonOrbit : o.orbit, sel ? 1.8 : 1, this.resolution)
    }
  }

  setOptions(opts: { showOrbits: boolean; follow: boolean }): void {
    this.showOrbits = opts.showOrbits
    this.controller.follow = opts.follow
  }

  setSelected(id: OrreryBodyId | null): void {
    this.selected = id
    for (const [gid, g] of this.globes) g.axis.visible = gid === id
    this.restyleOrbits()
  }

  /** Centre la caméra sur un astre (double-tap) avec un cadrage adapté à sa taille. */
  focusOn(id: OrreryBodyId, nowMs: number): void {
    const aspect = this.size.width / this.size.height
    const r = visualRadius(id)
    const system = id === 'Jupiter' ? compressJovicentricDistance(CALLISTO_RJ) * 1.05 : id === 'Saturn' ? r * 2.6 : id === 'Sun' ? compressHelioDistance(1.7) : r * 2.2
    this.controller.focus(id, this.snapshot.bodies[id].scene, focusDistance(r, system, aspect), nowMs, r * 1.8)
  }

  /** Vue d'ensemble centrée sur le Soleil. */
  recenter(nowMs: number): void {
    const aspect = this.size.width / this.size.height
    this.controller.focus(null, [0, 0, 0], focusDistance(visualRadius('Sun'), compressHelioDistance(OVERVIEW_AU), aspect), nowMs)
  }

  get viewMode(): OrreryViewMode {
    return viewModeOf(this.controller.state.elevationRad)
  }

  /** Projections écran des astres visibles, mises à jour à chaque frame. */
  getPicks(): readonly ScreenPick[] {
    return this.picks
  }

  /** Rayon apparent (px CSS) de l'orbite de Callisto : sert à n'étiqueter les lunes qu'en vue rapprochée. */
  get moonSystemPx(): number {
    return this.moonSystemRadiusPx
  }

  get moonsShown(): boolean {
    return this.moonsVisible
  }

  /** Rendu d'une frame pour le temps simulé `simMs`. */
  render(simMs: number, nowMs: number, dtS: number): void {
    if (this.contextLost) return
    if (simMs !== this.lastSimMs) {
      this.snapshot = computeOrrerySnapshot(new Date(simMs))
      this.lastSimMs = simMs
    }
    const bodies = this.snapshot.bodies
    const focusPos = this.controller.focusId ? bodies[this.controller.focusId].scene : null
    const cam = this.controller.step(dtS, nowMs, focusPos)
    const p = cameraPosition(cam)
    this.camera.position.set(p[0], p[1], p[2])
    this.camera.up.copy(UP)
    this.camera.lookAt(cam.target[0], cam.target[1], cam.target[2])
    this.camera.updateMatrixWorld()

    const pxPerWorldAt = (pos: Vec3) => {
      const d = Math.max(1e-6, this.tmp.set(pos[0], pos[1], pos[2]).distanceTo(this.camera.position))
      return this.size.height / (2 * d * Math.tan((CAMERA_FOV_DEG * Math.PI) / 360))
    }
    const jupiter = bodies.Jupiter.scene
    this.moonSystemRadiusPx = compressJovicentricDistance(CALLISTO_RJ) * pxPerWorldAt(jupiter)
    const moonSelected = this.selected !== null && (GALILEAN_MOONS as readonly string[]).includes(this.selected)
    this.moonsVisible = this.moonSystemRadiusPx >= MOON_SYSTEM_MIN_PX || moonSelected
    this.moonOrbits.position.set(jupiter[0], jupiter[1], jupiter[2])
    this.moonOrbits.visible = this.showOrbits && this.moonsVisible
    this.planetOrbits.visible = this.showOrbits
    this.grid.visible = this.showOrbits

    const picks: ScreenPick[] = []
    const sunPx = pxPerWorldAt([0, 0, 0])
    const sunScale = Math.max(visualRadius('Sun'), MIN_RADIUS_PX.star / sunPx)
    this.sun.group.scale.setScalar(sunScale)
    this.sun.group.rotation.y = (bodies.Sun.spinDeg * Math.PI) / 180
    this.pushPick(picks, 'Sun', [0, 0, 0], sunScale * sunPx)

    for (const [id, g] of this.globes) {
      const b = bodies[id]
      const isMoon = (GALILEAN_MOONS as readonly string[]).includes(id)
      g.node.visible = !isMoon || this.moonsVisible
      if (!g.node.visible) continue
      g.node.position.set(b.scene[0], b.scene[1], b.scene[2])
      g.tilt.quaternion.setFromUnitVectors(UP, this.tmp.set(b.northScene[0], b.northScene[1], b.northScene[2]))
      g.globe.rotation.y = (b.spinDeg * Math.PI) / 180
      const px = pxPerWorldAt(b.scene)
      const scale = Math.max(visualRadius(id), MIN_RADIUS_PX[isMoon ? 'moon' : 'planet'] / px)
      g.tilt.scale.setScalar(scale)
      this.pushPick(picks, id, b.scene, scale * px)
    }
    this.picks = picks
    this.renderer.render(this.scene, this.camera)
  }

  private pushPick(out: ScreenPick[], id: OrreryBodyId, pos: Vec3, radiusPx: number): void {
    const v = this.tmp.set(pos[0], pos[1], pos[2]).project(this.camera)
    if (v.z < -1 || v.z > 1) return
    const depth = this.camera.position.distanceTo(new Vector3(pos[0], pos[1], pos[2]))
    out.push({ id, x: ((v.x + 1) / 2) * this.size.width, y: ((1 - v.y) / 2) * this.size.height, radiusPx, depth })
  }

  /** Libère toutes les ressources GPU, les écouteurs et le contexte WebGL. */
  dispose(): void {
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost)
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored)
    for (const t of this.textures) t.dispose()
    for (const r of this.resources) r.dispose()
    this.textures.clear()
    this.resources.clear()
    this.scene.clear()
    this.renderer.renderLists.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }
}
