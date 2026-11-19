/**
 * Barre d'état iOS selon le thème. Le texte de la barre d'état système ne peut
 * être que blanc ou noir : en vision nocturne rouge on la masque pour ne laisser
 * fuir aucune lumière blanche. Fallback silencieux sur navigateur web.
 */
import { Capacitor } from '@capacitor/core'
import { Animation, StatusBar, Style } from '@capacitor/status-bar'

export async function applyThemeStatusBar(redNight: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    if (redNight) {
      await StatusBar.hide({ animation: Animation.Fade })
    } else {
      await StatusBar.setStyle({ style: Style.Dark })
      await StatusBar.show({ animation: Animation.Fade })
    }
  } catch {
    /* plugin indisponible : on reste silencieux */
  }
}
