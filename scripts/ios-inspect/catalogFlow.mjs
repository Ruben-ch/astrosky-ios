/**
 * Parcours iOS de l'encyclopédie du Catalogue (appelé par run.mjs pour chaque thème) :
 * recherche (désignation, nom sans accents), puces rapides, feuille de filtres
 * (familles, magnitude limite, tri), fiche détaillée de M31 défilée, simulateur
 * visuel (C8, oculaire, Barlow, orientation) puis photo (plein format, rotation),
 * retour à la liste et fiche de Jupiter. Les captures rejoignent `shots`
 * (auditées au pixel en red-night par run.mjs).
 */
export async function inspectCatalog({ page, base, simTime, theme, expect, layoutAudit, capture, shots, failures }) {
  // Encyclopédie : recherche, filtres combinés, fiche détaillée, simulateur de champ.
  const scrollShots = async (name) => {
    const main = page.locator('main')
    const height = await main.evaluate((m) => m.scrollHeight)
    for (let y = 0, i = 0; y < height; y += 760, i++) {
      await main.evaluate((m, y) => m.scrollTo(0, y), y)
      await page.waitForTimeout(250)
      failures.push(...(await layoutAudit(`${name}-p${i}/${theme}`)))
      shots.push(await capture(`${name}-${theme}-p${i}`))
    }
    await main.evaluate((m) => m.scrollTo(0, 0))
  }
  await page.goto(`${base}/?tab=catalog&theme=${theme}&t=${simTime}`)
  await page.waitForTimeout(2000)
  const search = page.getByRole('searchbox', { name: 'Rechercher dans le catalogue' })
  await search.fill('m 42')
  await page.waitForTimeout(300)
  await expect(page.locator('ul[aria-label="Résultats du catalogue"] > li').first().getAttribute('data-key').then((k) => k === 'M42'), `search/${theme}: M42 n'est pas en tête pour « m 42 »`)
  await search.fill('andromede')
  await page.waitForTimeout(300)
  await expect(page.locator('ul[aria-label="Résultats du catalogue"] > li').first().getAttribute('data-key').then((k) => k === 'M31'), `search/${theme}: M31 absent pour « andromede »`)
  failures.push(...(await layoutAudit(`catalog-search/${theme}`)))
  shots.push(await capture(`catalog-${theme}-search`))
  await page.getByRole('button', { name: 'Vider le champ de recherche' }).click()
  await page.getByRole('switch', { name: /^Observable maintenant/ }).click()
  await page.getByRole('group', { name: 'Filtres rapides' }).getByRole('checkbox', { name: /^Amas globulaires/ }).click()
  await page.waitForTimeout(300)
  shots.push(await capture(`catalog-${theme}-quick-filters`))
  await page.getByRole('button', { name: /^Filtres/ }).click()
  await page.waitForTimeout(300)
  const sheet = page.getByRole('dialog', { name: 'Filtres du catalogue' })
  await sheet.getByRole('checkbox', { name: /^Galaxies/ }).click()
  await sheet.getByRole('slider', { name: 'Magnitude limite' }).fill('9')
  await sheet.getByRole('radio', { name: 'Éclat' }).click()
  await page.waitForTimeout(300)
  failures.push(...(await layoutAudit(`catalog-filters/${theme}`)))
  shots.push(await capture(`catalog-${theme}-filter-sheet`))
  await sheet.getByRole('button', { name: /^Afficher \d+ objet/ }).click()
  await page.waitForTimeout(300)
  const keys = await page.locator('ul[aria-label="Résultats du catalogue"] > li').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))
  await expect(Promise.resolve(keys.includes('M31') && !keys.includes('M42') && !keys.includes('M45')), `filters/${theme}: résultat inattendu (${keys.join(',')})`)
  shots.push(await capture(`catalog-${theme}-filtered`))

  // Fiche détaillée de M31 : élévation, échelle lunaire, saison, conseils, simulateur.
  await page.goto(`${base}/?tab=catalog&theme=${theme}&t=${simTime}`)
  await page.waitForTimeout(2000)
  await page.getByRole('button', { name: /Galaxie d'Andromède/ }).click()
  await page.waitForTimeout(800)
  await expect(page.getByRole('img', { name: /^Courbe d’élévation de M31/ }).isVisible(), `detail/${theme}: courbe d'élévation absente`)
  await expect(page.getByText('Saison idéale').isVisible(), `detail/${theme}: saison idéale absente`)
  await scrollShots('detail-m31')
  const fov = page.getByRole('img', { name: /^Simulation du champ : M31/ })
  await page.getByRole('radio', { name: 'Schmidt-Cassegrain 203/2032' }).click()
  await page.getByRole('radio', { name: /^Oculaire Plössl 32 mm/ }).click()
  await page.getByRole('radio', { name: 'Barlow 2×' }).click()
  await page.getByRole('radio', { name: /image renversée/ }).click()
  await page.waitForTimeout(300)
  await expect(page.getByText('Déborde du champ', { exact: false }).isVisible(), `fov/${theme}: cadrage « déborde » attendu pour M31 au C8`)
  await fov.scrollIntoViewIfNeeded()
  failures.push(...(await layoutAudit(`fov-visual/${theme}`)))
  shots.push(await capture(`fov-${theme}-visual`))
  await page.getByRole('button', { name: 'Focale oculaire : augmenter' }).click()
  await page.getByRole('radio', { name: 'Photo · capteur' }).click()
  await page.getByRole('radio', { name: 'Lunette 80/480' }).click()
  await page.getByRole('radio', { name: /^Capteur Plein format/ }).click()
  await page.getByRole('button', { name: /Tourner le capteur de \+15°/ }).click()
  await page.getByRole('button', { name: /Tourner le capteur de \+15°/ }).click()
  await page.waitForTimeout(300)
  await expect(fov.getAttribute('aria-label').then((l) => /×/.test(l ?? '')), `fov/${theme}: champ photo non affiché`)
  await fov.scrollIntoViewIfNeeded()
  failures.push(...(await layoutAudit(`fov-photo/${theme}`)))
  shots.push(await capture(`fov-${theme}-photo`))
  await page.getByRole('button', { name: 'Retour au catalogue' }).click()
  await page.waitForTimeout(400)
  await expect(page.getByRole('searchbox', { name: 'Rechercher dans le catalogue' }).isVisible(), `detail/${theme}: retour à la liste impossible`)

  // Planète : fiche de Jupiter (disque à l'échelle dans le simulateur).
  await page.getByRole('radio', { name: /Système solaire/ }).click()
  await page.getByRole('button', { name: /^Jupiter/ }).click()
  await page.waitForTimeout(800)
  await expect(page.getByRole('img', { name: /^Simulation du champ : Jupiter/ }).isVisible(), `detail-jupiter/${theme}: simulateur absent`)
  await scrollShots('detail-jupiter')
}
