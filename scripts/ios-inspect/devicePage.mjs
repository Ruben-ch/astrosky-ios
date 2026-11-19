/** Contexte iPhone 393×852 @3x commun aux parcours appareil (safe-areas, capteurs, hors-ligne). */
export const DEVICE = { viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' }

/**
 * Nouveau contexte iPhone avec collecte des erreurs. Comme dans run.mjs, un refus
 * ou un échec de chargement d'une API externe (quota CelesTrak, Open-Meteo…) est
 * une condition hors-ligne gérée par l'app : avertissement, jamais un échec.
 * Toute autre erreur console (y compris un asset local manquant) reste bloquante.
 */
export async function openPage(browser, { failures, warnings }, label) {
  const ctx = await browser.newContext(DEVICE)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => failures.push(`${label}: pageerror ${e.message}`))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const url = m.location()?.url ?? ''
    const msg = `${label}: console ${m.text()}${url ? ` (${url})` : ''}`
    const external = url !== '' && !url.startsWith('http://127.0.0.1')
    if (external && /Failed to load resource|ERR_INTERNET_DISCONNECTED|ERR_FAILED/.test(m.text())) warnings.push(msg)
    else failures.push(msg)
  })
  return { ctx, page }
}
