/**
 * Caméra orbitale du Système Solaire 3D (calcul pur, sans Three.js) :
 * position sphérique autour d'une cible, gestes (glisser = orbite, pincer =
 * zoom), inertie à amortissement exponentiel, préréglages écliptique / polaire
 * et transitions animées (centrage d'un astre au double-tap).
 * Angles en radians (suffixe `Rad`), distances en unités de scène.
 */
import type { OrbitCameraState, OrreryViewMode, Vec3 } from '../../types/orrery'

export const MIN_DISTANCE = 0.25
export const MAX_DISTANCE = 140
/** Élévation maximale : juste sous le pôle pour garder un vecteur « haut » stable. */
export const MAX_ELEVATION_RAD = (89.5 * Math.PI) / 180
export const VIEW_ELEVATION_RAD: Readonly<Record<OrreryViewMode, number>> = {
  ecliptic: (22 * Math.PI) / 180,
  polar: MAX_ELEVATION_RAD,
}
/** Champ vertical de la caméra, en degrés. */
export const CAMERA_FOV_DEG = 45
/** Constante de temps de l'inertie, en secondes. */
export const INERTIA_TAU_S = 0.32
/** Rotation appliquée pour un glissement d'une hauteur d'écran. */
const RAD_PER_SCREEN = Math.PI * 1.1

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

export function clampElevation(elevationRad: number): number {
  return clamp(elevationRad, -MAX_ELEVATION_RAD, MAX_ELEVATION_RAD)
}

export function clampDistance(distance: number, minDistance = MIN_DISTANCE): number {
  return clamp(distance, minDistance, MAX_DISTANCE)
}

/** Ramène un angle dans ]−π, π]. */
export function wrapPi(angleRad: number): number {
  const a = ((angleRad + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI
  return a === -Math.PI ? Math.PI : a
}

/** Position de la caméra dans la scène. */
export function cameraPosition(s: OrbitCameraState): Vec3 {
  const c = Math.cos(s.elevationRad)
  return [
    s.target[0] + s.distance * c * Math.sin(s.azimuthRad),
    s.target[1] + s.distance * Math.sin(s.elevationRad),
    s.target[2] + s.distance * c * Math.cos(s.azimuthRad),
  ]
}

/**
 * Distance pour qu'une sphère de rayon `radius` tienne dans le cadre
 * (contrainte sur la plus petite dimension, aspect = largeur / hauteur).
 */
export function fitDistance(radius: number, aspect: number, fovDeg = CAMERA_FOV_DEG, margin = 1.08): number {
  const halfV = (fovDeg * Math.PI) / 360
  const halfH = Math.atan(Math.tan(halfV) * aspect)
  return (radius * margin) / Math.sin(Math.min(halfV, halfH))
}

/** Glissement d'un doigt (px CSS) → variations d'azimut et d'élévation. */
export function dragToAngles(dxPx: number, dyPx: number, viewportHeightPx: number): { dAzimuthRad: number; dElevationRad: number } {
  const k = RAD_PER_SCREEN / Math.max(1, viewportHeightPx)
  return { dAzimuthRad: -dxPx * k, dElevationRad: dyPx * k }
}

export function applyOrbit(s: OrbitCameraState, dAzimuthRad: number, dElevationRad: number): OrbitCameraState {
  return { ...s, azimuthRad: wrapPi(s.azimuthRad + dAzimuthRad), elevationRad: clampElevation(s.elevationRad + dElevationRad) }
}

/** Zoom multiplicatif (pincement : `factor` = écart précédent / écart actuel). */
export function applyZoom(s: OrbitCameraState, factor: number, minDistance = MIN_DISTANCE): OrbitCameraState {
  if (!Number.isFinite(factor) || factor <= 0) return s
  return { ...s, distance: clampDistance(s.distance * factor, minDistance) }
}

/** Amortissement exponentiel d'une vitesse angulaire sur `dtS` secondes (indépendant du taux de frames). */
export function decay(velocity: number, dtS: number, tauS = INERTIA_TAU_S): number {
  const v = velocity * Math.exp(-Math.max(0, dtS) / tauS)
  return Math.abs(v) < 1e-4 ? 0 : v
}

/** Courbe d'animation douce (accélération puis décélération cubiques). */
export function easeInOutCubic(t: number): number {
  const x = clamp(t, 0, 1)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

/** Interpolation entre deux états, azimut par le plus court chemin et distance en échelle logarithmique. */
export function interpolateCamera(from: OrbitCameraState, to: OrbitCameraState, t: number): OrbitCameraState {
  const k = easeInOutCubic(t)
  const lerp = (a: number, b: number) => a + (b - a) * k
  return {
    target: [lerp(from.target[0], to.target[0]), lerp(from.target[1], to.target[1]), lerp(from.target[2], to.target[2])],
    distance: Math.exp(lerp(Math.log(from.distance), Math.log(to.distance))),
    azimuthRad: wrapPi(from.azimuthRad + wrapPi(to.azimuthRad - from.azimuthRad) * k),
    elevationRad: lerp(from.elevationRad, to.elevationRad),
  }
}

/** Distance de cadrage d'un astre : son globe (ou son système de lunes) occupe une part lisible de l'écran. */
export function focusDistance(bodyRadius: number, systemRadius: number, aspect: number): number {
  return clampDistance(Math.max(fitDistance(systemRadius, aspect), bodyRadius * 7))
}

/** État de départ : vue d'ensemble jusqu'à `fitRadius`, centrée sur le Soleil. */
export function initialCamera(mode: OrreryViewMode, fitRadius: number, aspect: number): OrbitCameraState {
  return { target: [0, 0, 0], distance: clampDistance(fitDistance(fitRadius, aspect)), azimuthRad: 0.35, elevationRad: VIEW_ELEVATION_RAD[mode] }
}

/** Quel préréglage la vue courante représente-t-elle (pour l'état du sélecteur) ? */
export function viewModeOf(elevationRad: number): OrreryViewMode {
  return elevationRad > (60 * Math.PI) / 180 ? 'polar' : 'ecliptic'
}
