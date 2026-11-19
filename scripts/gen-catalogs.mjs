// Génère src/data/*.generated.ts à partir des catalogues d3-celestial (Hipparcos, OpenNGC).
// Usage :
//   1. Télécharger dans <dlDir> depuis https://cdn.jsdelivr.net/gh/ofrohn/d3-celestial@master/data/ :
//      stars.6.json starnames.json constellations.lines.json constellations.json
//      messier.json dsos.14.json dsonames.json
//   2. node scripts/gen-catalogs.mjs <dlDir> src/data $PWD/node_modules/astronomy-engine/astronomy.js
//   3. npx vitest run (catalogs.test.ts valide effectifs, coordonnées et constellations)
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const [dl, out, aePath] = process.argv.slice(2)
const require = createRequire(import.meta.url)
const Astronomy = require(aePath)
const j = (f) => JSON.parse(fs.readFileSync(path.join(dl, f), 'utf8'))
const lonToRaDeg = (lon) => +((lon < 0 ? lon + 360 : lon).toFixed(4))
const r4 = (x) => +(+x).toFixed(4)
const constellationOf = (raDeg, decDeg) => Astronomy.Constellation(raDeg / 15, decDeg).symbol
const q = (s) => JSON.stringify(s)
const clean = (s) => (s ?? '').replace(/[ ‎ ]/g, ' ').replace(/\s+/g, ' ').trim()

const TYPE = {
  gc: 'globular-cluster', oc: 'open-cluster', pn: 'planetary-nebula', en: 'emission-nebula',
  rn: 'reflection-nebula', dn: 'dark-nebula', bn: 'emission-nebula', snr: 'supernova-remnant',
  sfr: 'cluster-nebula', g: 'galaxy', s: 'galaxy', s0: 'galaxy', e: 'galaxy', i: 'galaxy',
  gg: 'galaxy', sd: 'star-cloud', ds: 'double-star', ast: 'asterism', a: 'asterism', '*': 'double-star',
}
const header = (src) =>
  `// ⚠️ Fichier généré automatiquement — ne pas éditer à la main.\n// Source : ${src}\n// Coordonnées équatoriales J2000 (ICRS) en degrés.\n`

function parseDim(dim) {
  if (!dim) return [null, null]
  const [a, b] = String(dim).split('x').map(Number)
  return [Number.isFinite(a) ? a : null, Number.isFinite(b) ? b : Number.isFinite(a) ? a : null]
}

// ─── Noms français des objets ────────────────────────────────────────────
const dsoNames = j('dsonames.json')
const frName = (ngc) => {
  const n = dsoNames[ngc]
  return n ? clean(n.fr || n.name) : null
}

// ─── Messier ─────────────────────────────────────────────────────────────
// Corrections de noms : traductions source erronées, anglaises ou ambiguës.
const MESSIER_NAMES = {
  M12: null, M13: "Grand amas d'Hercule", M20: 'Nébuleuse Trifide', M24: 'Nuage stellaire du Sagittaire',
  M27: "Nébuleuse de l'Haltère", M29: null, M34: null, M35: null, M40: 'Winnecke 4', M43: 'Nébuleuse de Mairan',
  M44: 'Amas de la Crèche', M45: 'Pléiades', M51: 'Galaxie du Tourbillon', M61: null, M62: null,
  M64: "Galaxie de l'Œil noir", M67: null, M73: 'Astérisme de 4 étoiles', M76: 'Petite Haltère', M84: null,
  M86: null, M87: 'Virgo A', M93: null, M94: "Galaxie de l'Œil de crocodile", M99: null,
}
const messierFixups = { M40: 'double-star', M73: 'asterism', M24: 'star-cloud', M45: 'open-cluster' }
const messier = j('messier.json').features.map((f) => {
  const p = f.properties
  const [lon, decDeg] = f.geometry.coordinates
  const raDeg = lonToRaDeg(lon)
  const ngc = clean(p.desig)
  const [maj, min] = parseDim(p.dim)
  const type = messierFixups[f.id] ?? TYPE[p.type]
  if (!type) throw new Error(`type inconnu ${p.type} pour ${f.id}`)
  return {
    id: f.id, messier: Number(f.id.slice(1)), ngc: ngc || null,
    name: f.id in MESSIER_NAMES ? MESSIER_NAMES[f.id] : (ngc && frName(ngc)) || clean(p.alt) || null,
    type, raDeg, decDeg: r4(decDeg), mag: p.mag ?? null, sizeMajorArcmin: maj, sizeMinorArcmin: min,
    constellation: constellationOf(raDeg, decDeg),
  }
})
if (messier.length !== 110) throw new Error(`Messier: ${messier.length}`)

// ─── NGC/IC majeurs (hors Messier) ──────────────────────────────────────
const NGC_LIST = [
  'NGC 869', 'NGC 884', 'NGC 7000', 'NGC 6992', 'NGC 6960', 'NGC 7293', 'NGC 253', 'NGC 5139',
  'NGC 104', 'NGC 2392', 'NGC 6543', 'NGC 7009', 'NGC 7662', 'NGC 3242', 'NGC 891', 
  'NGC 4631', 'NGC 5128', 'NGC 2244', 'NGC 663', 'NGC 6231', 'NGC 1499', 'NGC 2024', 'NGC 6826', 'NGC 7331',
  'NGC 2403', 'NGC 3628', 'NGC 4038', 'NGC 2070', 'NGC 6888', 'NGC 2264', 'NGC 457', 'NGC 752',
  'NGC 7789', 'NGC 3372', 'NGC 4755', 'NGC 1300', 'NGC 1365', 'NGC 300', 'NGC 55', 'NGC 7023',
  'NGC 1977', 'NGC 6946', 'NGC 2841', 'NGC 281', 'IC 1396', 'IC 5146', 'IC 2602', 'IC 4665',
  'IC 1805', 'IC 434',
]
const NGC_FR_FALLBACK = {
  'NGC 884': 'Double amas de Persée (χ Per)', 'NGC 869': 'Double amas de Persée (h Per)',
  'NGC 5139': 'Oméga du Centaure', 'NGC 104': '47 Toucan', 'NGC 4755': 'Boîte à bijoux',
  'NGC 457': 'Amas de la Chouette', 'IC 2602': 'Pléiades du Sud', 'NGC 7789': 'Rose de Caroline',
  'IC 434': 'Nébuleuse de la Tête de Cheval', 'NGC 3628': 'Galaxie du Hamburger',
  'IC 4665': 'Amas d\'été', 'NGC 752': 'Amas de NGC 752',
}
const dsoIndex = new Map(j('dsos.14.json').features.map((f) => [f.id, f]))
const ngcObjects = NGC_LIST.map((id) => {
  const f = dsoIndex.get(id)
  if (!f) throw new Error(`absent du catalogue : ${id}`)
  const p = f.properties
  const [lon, decDeg] = f.geometry.coordinates
  const raDeg = lonToRaDeg(lon)
  const [maj, min] = parseDim(p.dim)
  const type = id === 'IC 434' ? 'dark-nebula' : TYPE[p.type]
  if (!type) throw new Error(`type inconnu ${p.type} pour ${id}`)
  const mag = Number(p.mag)
  return {
    id: id.replace(' ', ''), messier: null, ngc: id, name: NGC_FR_FALLBACK[id] || frName(id) || null,
    type, raDeg, decDeg: r4(decDeg), mag: Number.isFinite(mag) && mag < 30 ? mag : null,
    sizeMajorArcmin: maj, sizeMinorArcmin: min, constellation: constellationOf(raDeg, decDeg),
  }
})

const dsoLine = (o) =>
  `  { id: ${q(o.id)}, messier: ${o.messier}, ngc: ${q(o.ngc)}, name: ${q(o.name)}, type: ${q(o.type)}, raDeg: ${o.raDeg}, decDeg: ${o.decDeg}, mag: ${o.mag}, sizeMajorArcmin: ${o.sizeMajorArcmin}, sizeMinorArcmin: ${o.sizeMinorArcmin}, constellation: ${q(o.constellation)} },`

fs.writeFileSync(path.join(out, 'messier.generated.ts'),
  `${header('d3-celestial messier.json (SEDS) + dsonames.json (noms FR)')}import type { DeepSkyObject } from '../types/catalog'\n\n/** Les 110 objets du catalogue de Charles Messier. */\nexport const MESSIER_CATALOG: readonly DeepSkyObject[] = [\n${messier.map(dsoLine).join('\n')}\n]\n`)
fs.writeFileSync(path.join(out, 'ngcIc.generated.ts'),
  `${header('d3-celestial dsos.14.json (OpenNGC) + dsonames.json (noms FR)')}import type { DeepSkyObject } from '../types/catalog'\n\n/** 50 objets NGC/IC majeurs n'appartenant pas au catalogue Messier. */\nexport const NGC_IC_CATALOG: readonly DeepSkyObject[] = [\n${ngcObjects.map(dsoLine).join('\n')}\n]\n`)

// ─── 250 étoiles les plus brillantes ────────────────────────────────────
const starNames = j('starnames.json')
const GREEK = { α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'epsilon' }
void GREEK
const stars = j('stars.6.json').features
  .filter((f) => f.id !== 0)
  .sort((a, b) => a.properties.mag - b.properties.mag)
  .slice(0, 250)
  .map((f) => {
    const [lon, decDeg] = f.geometry.coordinates
    const raDeg = lonToRaDeg(lon)
    const n = starNames[String(f.id)] ?? {}
    const bayer = clean(n.desig || n.bayer || n.flam)
    const con = n.c || constellationOf(raDeg, decDeg)
    const bv = Number(f.properties.bv)
    return {
      hip: f.id, name: clean(n.fr || n.name) || null, designation: bayer ? `${bayer} ${con}` : `HIP ${f.id}`,
      raDeg, decDeg: r4(decDeg), mag: f.properties.mag, bv: Number.isFinite(bv) ? bv : null, constellation: con,
    }
  })
fs.writeFileSync(path.join(out, 'brightStars.generated.ts'),
  `${header('d3-celestial stars.6.json (Hipparcos, ESA 1997) + starnames.json')}import type { BrightStar } from '../types/catalog'\n\n/** Les 250 étoiles les plus brillantes du ciel, triées par magnitude visuelle croissante. */\nexport const BRIGHT_STARS: readonly BrightStar[] = [\n${stars
    .map((s) => `  { hip: ${s.hip}, name: ${q(s.name)}, designation: ${q(s.designation)}, raDeg: ${s.raDeg}, decDeg: ${s.decDeg}, mag: ${s.mag}, bv: ${s.bv}, constellation: ${q(s.constellation)} },`)
    .join('\n')}\n]\n`)

// ─── Tracés des 88 constellations ───────────────────────────────────────
const cnames = new Map(j('constellations.json').features.map((f) => [f.id, f.properties]))
const mergedFeatures = []
for (const f of j('constellations.lines.json').features) {
  const prev = mergedFeatures.find((m) => m.id === f.id)
  if (prev) prev.geometry.coordinates.push(...f.geometry.coordinates) // Serpens Caput + Cauda
  else mergedFeatures.push(f)
}
const lines = mergedFeatures.map((f) => {
  const p = cnames.get(f.id) ?? {}
  const polylines = f.geometry.coordinates.map((line) =>
    line.flatMap(([lon, dec]) => [+lonToRaDeg(lon).toFixed(3), +(+dec).toFixed(3)]))
  return { id: f.id, nameFr: clean(p.fr || p.name), nameLatin: clean(p.la || p.name), rank: Number(f.properties.rank), polylines }
})
fs.writeFileSync(path.join(out, 'constellationLines.generated.ts'),
  `${header('d3-celestial constellations.lines.json (figures IAU/Sky & Telescope)')}// Chaque polyligne est un tableau plat [raDeg0, decDeg0, raDeg1, decDeg1, …].\nimport type { ConstellationFigure } from '../types/catalog'\n\nexport const CONSTELLATION_FIGURES: readonly ConstellationFigure[] = [\n${lines
    .map((c) => `  { id: ${q(c.id)}, nameFr: ${q(c.nameFr)}, nameLatin: ${q(c.nameLatin)}, rank: ${c.rank}, polylines: ${JSON.stringify(c.polylines)} },`)
    .join('\n')}\n]\n`)

console.log({ messier: messier.length, ngc: ngcObjects.length, stars: stars.length, constellations: lines.length,
  unnamedNgc: ngcObjects.filter((o) => !o.name).map((o) => o.id), faintest: stars.at(-1).mag })
