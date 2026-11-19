/**
 * Recherche instantanée dans l'encyclopédie : désignations Messier / NGC / IC
 * (« M42 », « m 42 », « Messier 42 », « ngc7000 », « IC 434 », « 42 »), noms
 * usuels sans accents (« andromede ») et constellations (« Ori », « Orion »).
 */
import type { DeepSkyEntry } from '../../types/encyclopedia'

/** Minuscules, sans diacritiques ni ligatures, ponctuation réduite à des espaces. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9χ]+/g, ' ')
    .trim()
}

export interface Designation {
  /** `null` : numéro seul, à chercher dans tous les catalogues. */
  readonly catalog: 'm' | 'ngc' | 'ic' | null
  readonly number: number
}

/** Désignation de catalogue contenue dans la requête, ou `null`. */
export function parseDesignation(query: string): Designation | null {
  const q = normalizeText(query)
  const m = /^(messier|m|ngc|ic)?\s*(\d{1,4})$/.exec(q)
  if (!m) return null
  const prefix = m[1] === 'messier' ? 'm' : ((m[1] as Designation['catalog'] | undefined) ?? null)
  return { catalog: prefix, number: Number(m[2]) }
}

function entryNumbers(e: DeepSkyEntry): { m: number | null; ngc: number | null; ic: number | null } {
  const o = e.object
  const n = /^(NGC|IC)\s*(\d+)/.exec(o.ngc ?? '')
  return {
    m: o.messier,
    ngc: n?.[1] === 'NGC' ? Number(n[2]) : null,
    ic: n?.[1] === 'IC' ? Number(n[2]) : null,
  }
}

/** Score d'une désignation : exacte (1000), préfixe numérique (600), sinon 0. */
function designationScore(e: DeepSkyEntry, d: Designation): number {
  const nums = entryNumbers(e)
  const catalogs = d.catalog ? [d.catalog] : (['m', 'ngc', 'ic'] as const)
  let best = 0
  for (const c of catalogs) {
    const n = nums[c]
    if (n === null) continue
    // À numéro égal, Messier passe devant NGC puis IC pour une requête sans préfixe.
    const bias = d.catalog ? 0 : c === 'm' ? 20 : c === 'ngc' ? 10 : 0
    if (n === d.number) best = Math.max(best, 1000 + bias)
    else if (String(n).startsWith(String(d.number))) best = Math.max(best, 600 + bias - String(n).length)
  }
  return best
}

/**
 * Pertinence d'une entrée pour la requête (0 = non pertinente).
 * Tous les mots de la requête doivent apparaître dans le texte indexé.
 */
export function scoreEntry(e: DeepSkyEntry, query: string): number {
  const q = normalizeText(query)
  if (!q) return 1
  const d = parseDesignation(q)
  if (d) {
    const s = designationScore(e, d)
    if (s > 0) return s
    if (d.catalog) return 0
  }
  const compact = q.replace(/\b(messier|m|ngc|ic)\s+(\d)/g, (_, p: string, n: string) => `${p === 'messier' ? 'm' : p}${n}`)
  const words = e.searchText.split(' ')
  const compactCodes = [e.code, ...e.aliases].map((c) => normalizeText(c).replace(' ', ''))
  const tokens = compact.split(' ')
  let score = 0
  for (const t of tokens) {
    if (compactCodes.includes(t)) score += 500
    else if (words.includes(t)) score += 200
    else if (words.some((w) => w.startsWith(t))) score += 120
    else if (e.searchText.includes(t)) score += 40
    else return 0
  }
  // Le nom propre prime sur la constellation (« andromede » → M31 avant M32, NGC 891…).
  const name = normalizeText(e.object.name ?? '')
  const nameWords = name.split(' ')
  if (name && name.startsWith(compact)) score += 150
  for (const t of tokens) if (nameWords.some((w) => w.startsWith(t))) score += 150
  const con = e.object.constellation.toLowerCase()
  if (tokens.length === 1 && (con === compact || normalizeText(e.constellationFr) === compact || normalizeText(e.constellationLatin) === compact)) {
    score += 100
  }
  return score
}

/** Entrées pertinentes avec leur score, dans l'ordre d'origine. */
export function searchEntries(entries: readonly DeepSkyEntry[], query: string): { entry: DeepSkyEntry; score: number }[] {
  const out: { entry: DeepSkyEntry; score: number }[] = []
  for (const entry of entries) {
    const score = scoreEntry(entry, query)
    if (score > 0) out.push({ entry, score })
  }
  return out
}
