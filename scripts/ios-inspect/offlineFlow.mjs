/**
 * Hors-ligne sur le build de production servi en local (équivalent des assets
 * embarqués par Capacitor). Seuls les hôtes externes (API) sont coupés, sauf en (b)
 * où le réseau entier l'est via context.setOffline(true) :
 *   (a) premier lancement sans réseau, stockage vide → données embarquées partout ;
 *   (b) session chargée en ligne puis setOffline(true) → navigation complète sur les caches ;
 *   (c) relance de l'app sans réseau avec les caches de (b) → prévisions et TLE restitués.
 */
import fs from 'node:fs'
import path from 'node:path'
import { routeSpaceApis } from './spaceFlow.mjs'
import { openPage } from './devicePage.mjs'

const LOCAL = /^http:\/\/127\.0\.0\.1[:/]/
/** Origine des TLE après coupure : cache de la session, ou embarqués si CelesTrak refusait déjà (quota). */
const TLE_ANY = /TLE (à jour|cache|cache périmé|embarqués)/
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' }
/** Assets de l'app servis depuis le disque (capacitor://localhost) : indépendants du réseau, même hors-ligne. */
const serveBundle = (ctx, root) => ctx.route(LOCAL, (route) => {
  const rel = new URL(route.request().url()).pathname.replace(/^\/+/, '') || 'index.html'
  const file = path.join(root, '.playwright/dist', rel)
  const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(root, '.playwright/dist/index.html')
  return route.fulfill({ status: 200, contentType: MIME[path.extname(target)] ?? 'application/octet-stream', body: fs.readFileSync(target) })
})
const cutExternal = (ctx) => ctx.route('**/*', (route) => (LOCAL.test(route.request().url()) ? route.continue() : route.abort('internetdisconnected')))

/** Parcourt les onglets par la barre d'onglets (sans rechargement) et vérifie leur contenu. */
async function tour(page, label, expectations, capture) {
  const fail = (m) => expectations.failures.push(`${label}: ${m}`)
  const visible = (loc, timeout = 8000) => loc.first().waitFor({ state: 'visible', timeout }).then(() => true, () => false)
  const tab = (name) => page.getByRole('tab', { name }).click()

  await tab('Ce soir')
  await page.waitForTimeout(1500)
  if (!(await visible(page.getByText(/Nuit noire|Crépuscule|Jour/)))) fail('Ce soir : frise de la nuit absente')
  if (expectations.weather === 'forecast' && !(await visible(page.getByRole('slider', { name: /Conditions heure par heure/ })))) fail('Ce soir : prévision en cache non restituée')
  if (expectations.weather === 'unavailable' && !(await visible(page.getByText(/Météo indisponible hors-ligne/)))) fail('Ce soir : avis « Météo indisponible hors-ligne » absent')
  await capture(page, `${label.replaceAll('/', '-')}-tonight`)

  await tab('Ciel')
  await page.waitForTimeout(1200)
  if (!(await visible(page.getByRole('img', { name: /Carte du ciel interactive/ })))) fail('Ciel : carte absente')
  await capture(page, `${label.replaceAll('/', '-')}-sky`)

  await tab('Système')
  await page.waitForTimeout(1500)
  if ((await page.locator('[data-orrery-root] canvas').count()) !== 1) fail('Système : canevas WebGL absent')

  await tab('Catalogue')
  await page.waitForTimeout(800)
  if (!(await visible(page.getByRole('button', { name: /Galaxie d'Andromède/ })))) fail('Catalogue : liste absente')
  await page.getByRole('button', { name: /Galaxie d'Andromède/ }).first().click()
  if (!(await visible(page.getByRole('img', { name: /^Courbe d’élévation de M31/ })))) fail('Catalogue : fiche M31 incomplète')
  await page.getByRole('button', { name: 'Retour au catalogue' }).click()

  await tab('Espace')
  if (!(await visible(page.getByText(expectations.tle), 8000))) fail(`Espace : badge TLE « ${expectations.tle.source} » absent`)
  if (!(await visible(page.getByRole('status').filter({ hasText: /satellites suivis/ }), 25_000))) fail('Espace : prédiction des passages non terminée')
  await capture(page, `${label.replaceAll('/', '-')}-radar`)
  await page.getByText('Lancements', { exact: true }).click()
  if (!(await visible(page.getByRole('article', { name: /^Lancement / })))) fail('Lancements : aucun lancement affiché')
  await page.getByText('Image du jour', { exact: true }).click()
  if (!(await visible(page.getByRole('article', { name: /^Image astronomique du jour/ })))) fail('Image du jour : notice absente')
  await capture(page, `${label.replaceAll('/', '-')}-apod`)

  // Recherche de ville : base embarquée hors-ligne.
  await tab('Ce soir')
  await page.getByRole('button', { name: /Site d'observation/ }).click()
  await page.getByRole('searchbox', { name: 'Rechercher une ville' }).fill('Lyon')
  if (!(await visible(page.getByRole('button', { name: /^Choisir Lyon/ })))) fail('Lieu : recherche de ville hors-ligne sans résultat')
  await capture(page, `${label.replaceAll('/', '-')}-city`)
}

export async function inspectOffline({ browser, root, base, simTime, theme, failures, warnings = [], capture }) {
  const start = `${base}/?tab=tonight&theme=${theme}&t=${simTime}`

  // (a) Premier lancement sans réseau.
  {
    const label = `offline-cold/${theme}`
    const { ctx, page } = await openPage(browser, { failures, warnings }, label)
    await cutExternal(ctx)
    await page.goto(start)
    await page.waitForTimeout(2500)
    await tour(page, label, { failures, weather: 'unavailable', tle: /TLE embarqués/ }, capture)
    await ctx.close()
  }

  // (b) Session chaude puis coupure totale du réseau.
  const label = `offline-live/${theme}`
  const { ctx, page } = await openPage(browser, { failures, warnings }, label)
  await routeSpaceApis(ctx, root)
  await page.goto(start)
  // Préparation dépendante d'Open-Meteo : sans prévision en ligne, rien à restituer hors-ligne
  // (avertissement, comme les autres refus d'API externes) ; la météo n'est alors pas vérifiée.
  const warmWeather = await page.getByRole('slider', { name: /Conditions heure par heure/ }).waitFor({ timeout: 20_000 }).then(() => true, () => false)
  if (!warmWeather) warnings.push(`${label}: prévision Open-Meteo non obtenue en ligne, restitution hors-ligne non vérifiée`)
  const weather = warmWeather ? 'forecast' : 'any'
  for (const name of ['Ciel', 'Système', 'Catalogue', 'Espace']) {
    await page.getByRole('tab', { name }).click()
    await page.waitForTimeout(1500)
  }
  await page.getByRole('status').filter({ hasText: /satellites suivis/ }).waitFor({ timeout: 25_000 }).catch(() => undefined)
  await page.getByText('Lancements', { exact: true }).click()
  await page.waitForTimeout(1500)
  await page.getByText('Image du jour', { exact: true }).click()
  await page.waitForTimeout(1500)
  await ctx.unrouteAll({ behavior: 'ignoreErrors' })
  await ctx.setOffline(true)
  await serveBundle(ctx, root)
  if (!(await page.evaluate(() => navigator.onLine === false))) failures.push(`${label}: navigator.onLine reste vrai`)
  await tour(page, label, { failures, weather, tle: TLE_ANY }, capture)

  // (c) Relance sans réseau avec les caches de la session (b).
  await ctx.unrouteAll({ behavior: 'ignoreErrors' })
  await ctx.setOffline(false)
  await cutExternal(ctx)
  const restart = await ctx.newPage()
  restart.on('pageerror', (e) => failures.push(`offline-restart/${theme}: pageerror ${e.message}`))
  await page.close()
  await restart.goto(start)
  await restart.waitForTimeout(2500)
  await tour(restart, `offline-restart/${theme}`, { failures, weather, tle: TLE_ANY }, capture)
  await ctx.close()
}
