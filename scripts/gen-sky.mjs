// Génère src/data/sky.generated.ts (données du planétarium) à partir de d3-celestial.
// Usage :
//   1. Télécharger dans <dlDir> depuis https://cdn.jsdelivr.net/gh/ofrohn/d3-celestial@master/data/ :
//      stars.6.json  mw.json  constellations.json
//   2. node scripts/gen-sky.mjs <dlDir> src/data
//   3. npx vitest run (skyCatalog.test.ts valide effectifs et positions)
//
// - Étoiles : catalogue Hipparcos complet jusqu'à mag 6 (ESA 1997).
// - Voie lactée : les 5 niveaux d'isophotes (ol1 = contour pâle → ol5 = cœur) sont
//   échantillonnés tous les ~2° sur une grille de Fibonacci sphérique. L'appartenance
//   est décidée par parité sphérique : nombre de croisements entre l'arc de grand cercle
//   pôle nord galactique → point et les arêtes des contours (les anneaux traversent
//   l'antiméridien et encerclent la sphère : un test plan serait faux).
// - Constellations : ancres officielles des étiquettes (géométrie `Point` de constellations.json).
import fs from 'node:fs'
import path from 'node:path'

const [dl, out] = process.argv.slice(2)
if (!dl || !out) throw new Error('usage: node scripts/gen-sky.mjs <dlDir> <outDir>')
const j = (f) => JSON.parse(fs.readFileSync(path.join(dl, f), 'utf8'))
const rad = Math.PI / 180
const lonToRa = (lon) => (lon < 0 ? lon + 360 : lon)
const r2 = (x) => Math.round(x * 100) / 100
const r1 = (x) => Math.round(x * 10) / 10

// ─── Étoiles ────────────────────────────────────────────────────────────
const stars = j('stars.6.json').features
  .map((f) => {
    const bv = Number.parseFloat(f.properties.bv)
    return [f.id, r2(lonToRa(f.geometry.coordinates[0])), r2(f.geometry.coordinates[1]), f.properties.mag, Number.isFinite(bv) ? r2(bv) : NaN]
  })
  .sort((a, b) => a[3] - b[3])

// ─── Voie lactée ────────────────────────────────────────────────────────
const vec = (raDeg, decDeg) => [Math.cos(decDeg * rad) * Math.cos(raDeg * rad), Math.cos(decDeg * rad) * Math.sin(raDeg * rad), Math.sin(decDeg * rad)]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2])
  return [a[0] / l, a[1] / l, a[2] / l]
}

/** Pôle nord galactique (IAU 1958, J2000) : hors de toute isophote de la Voie lactée. */
const NGP = vec(192.85948, 27.12825)

const levels = j('mw.json').features.map((f) => {
  const edges = []
  for (const poly of f.geometry.coordinates) {
    for (const ring of poly) {
      for (let i = 0; i < ring.length - 1; i++) {
        const a = vec(lonToRa(ring[i][0]), ring[i][1])
        const b = vec(lonToRa(ring[i + 1][0]), ring[i + 1][1])
        if (dot(a, b) > 0.9999999999) continue
        edges.push([a, b, cross(a, b)])
      }
    }
  }
  return { id: f.id, level: Number(f.id.slice(2)), edges }
})

/** L'arc court AB (normale nab) croise-t-il l'arc court CD (normale ncd) ? */
function arcsCross(a, b, nab, c, d, ncd) {
  const sc = dot(nab, c)
  const sd = dot(nab, d)
  if ((sc > 0) === (sd > 0)) return false
  const sa = dot(ncd, a)
  const sb = dot(ncd, b)
  if ((sa > 0) === (sb > 0)) return false
  // Les deux arcs étant < 180°, les tests de plans suffisent à une ambiguïté près :
  // l'intersection candidate doit être dans l'hémisphère commun des deux arcs.
  const x = norm(cross(nab, ncd))
  const mid1 = norm([a[0] + b[0], a[1] + b[1], a[2] + b[2]])
  const mid2 = norm([c[0] + d[0], c[1] + d[1], c[2] + d[2]])
  const s = dot(x, mid1) > 0 ? 1 : -1
  return dot([x[0] * s, x[1] * s, x[2] * s], mid2) > 0
}

function insideLevel(p, edges) {
  // Arc NGP → P découpé en deux demi-arcs (< 90° chacun) via le point milieu.
  let m = [NGP[0] + p[0], NGP[1] + p[1], NGP[2] + p[2]]
  if (Math.hypot(...m) < 1e-6) return false
  m = norm(m)
  let crossings = 0
  for (const [a, b] of [[NGP, m], [m, p]]) {
    const nab = cross(a, b)
    for (const [c, d, ncd] of edges) if (arcsCross(a, b, nab, c, d, ncd)) crossings++
  }
  return crossings % 2 === 1
}

const STEP_DEG = 2
const N = Math.round((4 * Math.PI) / (STEP_DEG * rad) ** 2)
const golden = Math.PI * (3 - Math.sqrt(5))
const milkyWay = []
for (let i = 0; i < N; i++) {
  const z = 1 - (2 * (i + 0.5)) / N
  const r = Math.sqrt(1 - z * z)
  const theta = golden * i
  const p = [r * Math.cos(theta), r * Math.sin(theta), z]
  let level = 0
  for (const lv of levels) if (lv.level > level && insideLevel(p, lv.edges)) level = lv.level
  if (level === 0) continue
  const raDeg = (Math.atan2(p[1], p[0]) / rad + 360) % 360
  milkyWay.push([r1(raDeg), r1(Math.asin(z) / rad), level])
}

// Contrôles : le centre galactique est dans la Voie lactée, le pôle sud galactique hors.
const GC = vec(266.405, -28.936)
const SGP = vec(12.85948, -27.12825)
if (!insideLevel(GC, levels[0].edges)) throw new Error('centre galactique hors de ol1')
if (insideLevel(SGP, levels[0].edges)) throw new Error('pôle sud galactique dans ol1')

// ─── Étiquettes de constellations ───────────────────────────────────────
const labels = j('constellations.json').features.map((f) => [f.id, r2(lonToRa(f.geometry.coordinates[0])), r2(f.geometry.coordinates[1])])
// 89 ancres : le Serpent (Ser) en a deux, une pour la Tête et une pour la Queue.
if (new Set(labels.map((l) => l[0])).size !== 88) throw new Error(`constellations : ${labels.length}`)

const num = (x) => (Number.isNaN(x) ? 'NaN' : String(x))
const body = `// ⚠️ Fichier généré automatiquement par scripts/gen-sky.mjs — ne pas éditer à la main.
// Sources : d3-celestial stars.6.json (Hipparcos, ESA 1997), mw.json (isophotes de la Voie lactée),
// constellations.json (ancres des étiquettes). Coordonnées équatoriales J2000 (ICRS) en degrés.

/**
 * ${stars.length} étoiles jusqu'à la magnitude 6, triées par éclat décroissant.
 * Tableau plat de 5-uplets : [hip, raDeg, decDeg, mag, bv] (bv = NaN si inconnu).
 */
export const SKY_STARS: readonly number[] = [
${stars.map((s) => s.map(num).join(',')).join(',\n')},
]

export const SKY_STAR_STRIDE = 5

/**
 * Voie lactée échantillonnée tous les ~${STEP_DEG}° (${milkyWay.length} points).
 * Tableau plat de triplets : [raDeg, decDeg, niveau 1 (pâle) → 5 (cœur)].
 */
export const MILKY_WAY_POINTS: readonly number[] = [
${milkyWay.map((m) => m.join(',')).join(',\n')},
]

export const MILKY_WAY_STEP_DEG = ${STEP_DEG}

/** Ancres des noms des 88 constellations (Ser : Tête et Queue) : [abréviation IAU, raDeg, decDeg]. */
export const CONSTELLATION_LABELS: readonly (readonly [string, number, number])[] = [
${labels.map((l) => `[${JSON.stringify(l[0])},${l[1]},${l[2]}]`).join(',\n')},
]
`
fs.writeFileSync(path.join(out, 'sky.generated.ts'), body)
const perLevel = [1, 2, 3, 4, 5].map((l) => milkyWay.filter((m) => m[2] === l).length)
console.log(`sky.generated.ts : ${stars.length} étoiles, ${milkyWay.length} points Voie lactée ${JSON.stringify(perLevel)}, ${(body.length / 1024).toFixed(0)} Ko`)
