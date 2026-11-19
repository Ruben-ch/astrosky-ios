/**
 * Constructeurs des objets Three.js du Système Solaire 3D : Soleil (globe à
 * assombrissement centre-bord + couronne additive), planètes et lunes (globe
 * texturé orienté sur l'axe de rotation IAU), anneaux de Saturne dans le plan
 * équatorial, orbites (lignes épaisses en px), grille de l'écliptique et étoiles
 * brillantes réelles en fond. Chaque ressource GPU est enregistrée via `track`
 * pour être libérée au démontage.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector2,
  type Texture,
} from 'three'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { BRIGHT_STARS } from '../../data'
import { BODY_RADIUS_KM, SATURN_RING_BANDS } from '../../data/solarSystemPhysical'
import { eqjToEcl } from '../../services/orrery/positions'
import { compressHelioDistance, eclToSceneAxes } from '../../services/orrery/visualScale'
import { eqjVectors } from '../../services/sky/skyFrame'
import { starColor } from '../../theme/starColor'
import type { ThemeName } from '../../theme/palette'
import { MakeTime } from 'astronomy-engine'
import { parseColor } from './textures'

export interface Disposable {
  dispose(): void
}
export type Track = <T extends Disposable>(resource: T) => T

/** Rayon de la sphère céleste de fond (unités de scène). */
export const STAR_SPHERE_RADIUS = 900

/** Couleur Three.js (sans alpha) et opacité depuis une couleur de palette. */
export function threeColor(color: string): { color: Color; opacity: number } {
  const c = parseColor(color)
  return { color: new Color(`rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`), opacity: c.a }
}

const SUN_VERTEX = /* glsl */ `
varying vec3 vNormalV;
varying vec3 vViewDir;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`

// Assombrissement centre-bord (loi en μ^0,5) entre la teinte du cœur et celle du limbe.
const SUN_FRAGMENT = /* glsl */ `
uniform vec3 uCore;
uniform vec3 uLimb;
varying vec3 vNormalV;
varying vec3 vViewDir;
void main() {
  float mu = clamp(dot(normalize(vNormalV), normalize(vViewDir)), 0.0, 1.0);
  gl_FragColor = vec4(mix(uLimb, uCore, pow(mu, 0.5)), 1.0);
  #include <colorspace_fragment>
}`

export interface SunObject {
  readonly group: Group
  readonly globe: Mesh<SphereGeometry, ShaderMaterial>
  readonly corona: Sprite
  readonly coronaOuter: Sprite
}

export function createSun(sphere: SphereGeometry, track: Track): SunObject {
  const material = track(new ShaderMaterial({
    uniforms: { uCore: { value: new Color() }, uLimb: { value: new Color() } },
    vertexShader: SUN_VERTEX,
    fragmentShader: SUN_FRAGMENT,
  }))
  const globe = new Mesh(sphere, material)
  const sprite = (scale: number) => {
    const s = new Sprite(track(new SpriteMaterial({ blending: AdditiveBlending, depthWrite: false, transparent: true })))
    s.scale.setScalar(scale)
    return s
  }
  const corona = sprite(4.2)
  const coronaOuter = sprite(9)
  const group = new Group()
  group.add(coronaOuter, corona, globe)
  return { group, globe, corona, coronaOuter }
}

export interface GlobeObject {
  /** Nœud positionné à chaque frame. */
  readonly node: Group
  /** Orienté sur l'axe de rotation ; son échelle = rayon visuel × gonflement. */
  readonly tilt: Group
  readonly globe: Mesh<SphereGeometry, MeshStandardMaterial>
  readonly axis: Line2
  readonly rings: Mesh<RingGeometry, MeshLambertMaterial> | null
}

/** Géométrie des anneaux en rayons de Saturne, UV radiales (u = 0 bord interne C, 1 bord externe A). */
function ringGeometry(): RingGeometry {
  const inner = SATURN_RING_BANDS[0].innerKm / BODY_RADIUS_KM.Saturn
  const outer = SATURN_RING_BANDS[SATURN_RING_BANDS.length - 1].outerKm / BODY_RADIUS_KM.Saturn
  const geo = new RingGeometry(inner, outer, 160, 1)
  const pos = geo.getAttribute('position')
  const uv = geo.getAttribute('uv')
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - inner) / (outer - inner), 0.5)
  }
  // Plan XY → plan équatorial XZ du groupe incliné.
  geo.rotateX(-Math.PI / 2)
  return geo
}

export function createGlobe(sphere: SphereGeometry, withRings: boolean, track: Track): GlobeObject {
  const globe = new Mesh(sphere, track(new MeshStandardMaterial({ roughness: 1, metalness: 0 })))
  const axisGeo = track(new LineGeometry())
  axisGeo.setPositions([0, -1.9, 0, 0, 1.9, 0])
  const axis = new Line2(axisGeo, track(new LineMaterial({ linewidth: 1.2, transparent: true, depthWrite: false })))
  axis.visible = false
  const tilt = new Group()
  tilt.add(globe, axis)
  let rings: GlobeObject['rings'] = null
  if (withRings) {
    rings = new Mesh(track(ringGeometry()), track(new MeshLambertMaterial({ transparent: true, side: DoubleSide, depthWrite: false })))
    tilt.add(rings)
  }
  const node = new Group()
  node.add(tilt)
  return { node, tilt, globe, axis, rings }
}

/** Ligne épaisse (px CSS) pour une orbite fermée. */
export function createOrbitLine(points: Float32Array, track: Track): Line2 {
  const geo = track(new LineGeometry())
  geo.setPositions(points)
  const line = new Line2(geo, track(new LineMaterial({ linewidth: 1, transparent: true, depthWrite: false })))
  line.computeLineDistances()
  return line
}

export function setLineStyle(line: Line2, color: string, widthPx: number, resolution: Vector2): void {
  const { color: c, opacity } = threeColor(color)
  line.material.color.copy(c)
  line.material.opacity = opacity
  line.material.linewidth = widthPx
  line.material.resolution.copy(resolution)
}

/**
 * Grille de l'écliptique : cercles de distance héliocentrique (1, 5, 10, 20, 30 UA,
 * à l'échelle compressée), rayons tous les 30° de longitude et graduations de 10°.
 */
export const GRID_RINGS_AU = [1, 5, 10, 20, 30] as const

export function createEclipticGrid(track: Track): LineSegments<BufferGeometry, LineBasicMaterial> {
  const v: number[] = []
  const seg = 180
  for (const au of GRID_RINGS_AU) {
    const r = compressHelioDistance(au)
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2
      const a1 = ((i + 1) / seg) * Math.PI * 2
      // Longitude écliptique λ → scène (cos λ, 0, −sin λ).
      v.push(r * Math.cos(a0), 0, -r * Math.sin(a0), r * Math.cos(a1), 0, -r * Math.sin(a1))
    }
  }
  const rIn = compressHelioDistance(0.6)
  const rOut = compressHelioDistance(30)
  for (let lonDeg = 0; lonDeg < 360; lonDeg += 10) {
    const a = (lonDeg * Math.PI) / 180
    const [c, s] = [Math.cos(a), -Math.sin(a)]
    if (lonDeg % 30 === 0) v.push(rIn * c, 0, rIn * s, rOut * c, 0, rOut * s)
    else v.push(rOut * 0.975 * c, 0, rOut * 0.975 * s, rOut * c, 0, rOut * s)
  }
  const geo = track(new BufferGeometry())
  geo.setAttribute('position', new Float32BufferAttribute(v, 3))
  return new LineSegments(geo, track(new LineBasicMaterial({ transparent: true, depthWrite: false })))
}

/** Étoiles brillantes (Hipparcos) placées sur la sphère céleste dans leur direction écliptique J2000. */
export function createStarfield(dot: Texture, track: Track): Points<BufferGeometry, PointsMaterial> {
  const t = MakeTime(new Date(Date.UTC(2000, 0, 1, 12)))
  const eqj = eqjVectors(BRIGHT_STARS.flatMap((s) => [s.raDeg, s.decDeg]))
  const pos = new Float32Array(BRIGHT_STARS.length * 3)
  for (let i = 0; i < BRIGHT_STARS.length; i++) {
    const s = eclToSceneAxes(eqjToEcl(eqj[i * 3], eqj[i * 3 + 1], eqj[i * 3 + 2], t))
    pos.set([s[0] * STAR_SPHERE_RADIUS, s[1] * STAR_SPHERE_RADIUS, s[2] * STAR_SPHERE_RADIUS], i * 3)
  }
  const geo = track(new BufferGeometry())
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.setAttribute('color', new Float32BufferAttribute(new Float32Array(BRIGHT_STARS.length * 3), 3))
  const mat = track(new PointsMaterial({ size: 2.6, sizeAttenuation: false, map: dot, vertexColors: true, transparent: true, depthWrite: false }))
  return new Points(geo, mat)
}

/** Couleurs des étoiles de fond : teinte B−V (ou rouge pur en vision nocturne) atténuée par la magnitude. */
export function paintStarfield(points: Points, theme: ThemeName): void {
  const attr = points.geometry.getAttribute('color')
  const c = new Color()
  for (let i = 0; i < BRIGHT_STARS.length; i++) {
    const s = BRIGHT_STARS[i]
    const { color } = threeColor(starColor(s.bv, theme))
    // Atténuation : mag −1,5 → 1 ; mag 3,5 → 0,25.
    const k = Math.min(1, Math.max(0.2, 1 - (s.mag + 1.5) * 0.15))
    c.copy(color).multiplyScalar(k)
    attr.setXYZ(i, c.r, c.g, c.b)
  }
  attr.needsUpdate = true
}
