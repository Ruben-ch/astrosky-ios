/**
 * Parcours iOS de l'onglet « Espace » (appelé par run.mjs pour chaque thème) :
 *   - Radar : prédiction des passages terminée, filtre ISS, sélection d'un passage,
 *     défilement complet, « Pointer dans le ciel » → guidage dans l'onglet Ciel ;
 *   - Lancements : carte dépliée (mission, image du lanceur), filtre d'opérateur ;
 *   - Image du jour : image (filtrée en red-night), jour précédent (réponse
 *     générique « NASA Science » de l'API → repli sur le flux RSS officiel : vrai
 *     titre et vraie image), retour au jour, visionneuse HD.
 * Les API à quota (NASA DEMO_KEY : 10 req/h, Launch Library 2 : 15 req/h) sont
 * servies depuis les données réelles embarquées (routeSpaceApis) sauf INSPECT_LIVE=1.
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/** Routes déterministes des API à quota, à installer une fois sur le contexte. */
export async function routeSpaceApis(ctx, root) {
  if (process.env.INSPECT_LIVE === '1') return
  const load = (f) => import(pathToFileURL(path.join(root, 'src/data', f)).href)
  const { BUNDLED_APOD_RAW } = await load('apodFallback.generated.ts')
  const { BUNDLED_LAUNCHES_RAW } = await load('launchesFallback.generated.ts')
  const generic = JSON.parse(fs.readFileSync(path.join(root, 'scripts/ios-inspect/fixtures/apod-generic-response.json'), 'utf8'))
  await ctx.route(/^https:\/\/api\.nasa\.gov\/planetary\/apod/, (route) => {
    const date = new URL(route.request().url()).searchParams.get('date') ?? BUNDLED_APOD_RAW.date
    // Jour de l'APOD embarquée (ou plus récent) : vraie entrée ; jours antérieurs : réponse générique réelle de l'API.
    const body = date >= BUNDLED_APOD_RAW.date ? BUNDLED_APOD_RAW : { ...generic, date }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })
  })
  // Flux RSS officiel de l'APOD (extrait réel, cf. src/services/__tests__/fixtures).
  const feed = fs.readFileSync(path.join(root, 'src/services/__tests__/fixtures/apod-feed.xml'), 'utf8')
  await ctx.route(/^https:\/\/science\.nasa\.gov\/feed\/apod-basic\//, (route) =>
    route.fulfill({ status: 200, contentType: 'application/rss+xml; charset=UTF-8', headers: { 'access-control-allow-origin': '*' }, body: feed }),
  )
  await ctx.route(/^https:\/\/ll\.thespacedevs\.com\/2\.2\.0\/launch\/upcoming\//, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ count: BUNDLED_LAUNCHES_RAW.length, results: BUNDLED_LAUNCHES_RAW }) }),
  )
}

export async function inspectSpace({ page, base, simTime, theme, expect, layoutAudit, capture, shots, failures }) {
  const url = (view) => `${base}/?tab=satellites&theme=${theme}&t=${simTime}&space=${view}`
  const scrollShots = async (name) => {
    const main = page.locator('main')
    const height = await main.evaluate((m) => m.scrollHeight)
    for (let y = 0, i = 0; y < height; y += 760, i++) {
      await main.evaluate((m, y) => m.scrollTo(0, y), y)
      await page.waitForTimeout(300)
      failures.push(...(await layoutAudit(`${name}-p${i}/${theme}`)))
      shots.push(await capture(`${name}-${theme}-p${i}`))
    }
    await main.evaluate((m) => m.scrollTo(0, 0))
  }

  // ─── Radar ───────────────────────────────────────────────────────────
  await page.goto(url('radar'))
  const ready = page.getByRole('status').filter({ hasText: /satellites suivis/ })
  await ready.waitFor({ timeout: 20_000 }).catch(() => failures.push(`radar/${theme}: prédiction des passages non terminée en 20 s`))
  await expect(page.getByRole('img', { name: /^Radar orbital polaire/ }).isVisible(), `radar/${theme}: canevas radar absent`)
  await expect(page.getByRole('button', { name: 'Pointer dans le ciel' }).isVisible(), `radar/${theme}: aucun passage visible sélectionné`)
  await page.waitForTimeout(600)
  await scrollShots('radar')
  await page.getByRole('radio', { name: /^ISS/ }).click()
  const issRow = page.getByRole('button', { name: /^ISS, visible à(?!.*terminé)/ }).first()
  if (await issRow.count()) {
    await issRow.click()
    await page.waitForTimeout(400)
    await expect(page.getByRole('heading', { name: 'ISS' }).isVisible(), `radar/${theme}: la fiche ne montre pas le passage ISS`)
    await expect(page.getByText('Passage terminé').isHidden(), `radar/${theme}: le passage ISS choisi est déjà terminé`)
    await page.locator('main').evaluate((m) => m.scrollTo(0, 0))
    await page.waitForTimeout(300)
    shots.push(await capture(`radar-${theme}-iss`))
  } else failures.push(`radar/${theme}: aucun passage ISS visible sur 48 h`)
  await page.getByRole('button', { name: 'Pointer dans le ciel' }).click()
  await page.waitForTimeout(1500)
  await expect(page.getByRole('tab', { name: 'Ciel', selected: true }).isVisible(), `radar→sky/${theme}: onglet Ciel inactif`)
  await expect(page.getByText(/^(Guidage · ISS|ISS pointé)$/).isVisible(), `radar→sky/${theme}: guidage vers l'ISS absent`)
  failures.push(...(await layoutAudit(`radar-sky/${theme}`)))
  shots.push(await capture(`sky-${theme}-from-radar`))

  // ─── Lancements ──────────────────────────────────────────────────────
  await page.goto(url('launches'))
  await page.getByRole('article', { name: /^Lancement / }).first().waitFor({ timeout: 10_000 }).catch(() => failures.push(`launches/${theme}: aucun lancement affiché`))
  await expect(page.getByText(/^T− /).first().isVisible(), `launches/${theme}: compte à rebours absent`)
  failures.push(...(await layoutAudit(`launches/${theme}`)))
  shots.push(await capture(`launches-${theme}`))
  await page.getByRole('article', { name: /^Lancement / }).first().getByRole('button').first().click()
  await page.waitForTimeout(1200)
  await expect(page.locator('[aria-expanded="true"]').count().then((n) => n === 1), `launches/${theme}: carte non dépliée`)
  shots.push(await capture(`launches-${theme}-expanded`))
  await page.getByRole('radio', { name: /^SpaceX/ }).click()
  await page.waitForTimeout(400)
  const names = await page.getByRole('article', { name: /^Lancement / }).evaluateAll((els) => els.map((e) => e.textContent ?? ''))
  await expect(Promise.resolve(names.length > 0 && names.every((t) => /SpaceX/.test(t))), `launches/${theme}: filtre SpaceX inopérant`)
  await scrollShots('launches-spacex')

  // ─── Image du jour ───────────────────────────────────────────────────
  await page.goto(url('apod'))
  const article = page.getByRole('article', { name: /^Image astronomique du jour/ })
  await article.waitFor({ timeout: 10_000 }).catch(() => failures.push(`apod/${theme}: APOD non affichée`))
  await page.locator('figure img').waitFor({ timeout: 10_000 }).catch(() => undefined)
  await page.waitForFunction(() => [...document.querySelectorAll('figure img')].every((i) => i.complete), null, { timeout: 15_000 }).catch(() => failures.push(`apod/${theme}: image non chargée`))
  await page.waitForTimeout(500)
  await scrollShots('apod')
  const todayName = await article.getAttribute('aria-label').catch(() => null)
  await page.getByRole('button', { name: 'Jour précédent' }).click()
  // L'API renvoie « NASA Science » + logo : l'app doit retrouver le vrai titre et la vraie image via le flux RSS.
  await page.waitForFunction((prev) => {
    const a = document.querySelector('article[aria-label^="Image astronomique du jour"]')
    const name = a?.getAttribute('aria-label') ?? ''
    return name !== prev && !/NASA Science/.test(name) && !a.classList.contains('opacity-60')
  }, todayName, { timeout: 10_000 }).catch(() => failures.push(`apod/${theme}: titre réel de la veille absent (repli RSS)`))
  await expect(page.getByRole('heading', { name: 'NASA Science' }).count().then((n) => n === 0), `apod/${theme}: titre générique « NASA Science » affiché`)
  await page.waitForFunction(() => [...document.querySelectorAll('figure img')].some((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15_000 }).catch(() => failures.push(`apod/${theme}: image de la veille non chargée`))
  await page.waitForTimeout(400)
  failures.push(...(await layoutAudit(`apod-previous/${theme}`)))
  shots.push(await capture(`apod-${theme}-previous`))
  await page.getByRole('button', { name: 'Revenir à l’image du jour' }).click()
  await page.getByRole('button', { name: 'Afficher en haute définition' }).click({ timeout: 8000 }).catch(() => failures.push(`apod/${theme}: bouton HD absent`))
  await page.waitForTimeout(1500)
  failures.push(...(await layoutAudit(`apod-hd/${theme}`)))
  shots.push(await capture(`apod-${theme}-hd`))
  await page.getByRole('button', { name: 'Fermer la haute définition' }).click().catch(() => undefined)
}
