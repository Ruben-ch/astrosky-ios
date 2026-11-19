/**
 * Thème d'affichage : OLED sombre ou vision nocturne rouge. Applique
 * `data-theme` sur <html> (CSS) et expose la palette des moteurs Canvas/WebGL.
 */
import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { paletteFor, type ThemeName } from '../theme/palette'
import { ThemeContext, type ThemeApi } from './contexts'
import { hapticSelection } from '../services/haptics'
import { applyThemeStatusBar } from '../services/statusBar'

const STORAGE_KEY = 'astrosky:theme'

function readInitialTheme(): ThemeName {
  try {
    const fromUrl = new URLSearchParams(globalThis.location?.search ?? '').get('theme')
    if (fromUrl === 'red-night' || fromUrl === 'dark') return fromUrl
    return globalThis.localStorage?.getItem(STORAGE_KEY) === 'red-night' ? 'red-night' : 'dark'
  } catch {
    return 'dark'
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(readInitialTheme)

  // Avant le premier affichage : aucune image en thème sombre (lumière bleue) en vision nocturne.
  useLayoutEffect(() => {
    const root = document.documentElement
    if (theme === 'red-night') root.setAttribute('data-theme', 'red-night')
    else root.removeAttribute('data-theme')
    const color = theme === 'red-night' ? '#FF2A2A' : '#F8FAFC'
    root.style.color = color
    document.body.style.color = color
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#000000')
    void applyThemeStatusBar(theme === 'red-night')
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, theme)
    } catch {
      /* stockage indisponible : préférence non persistée */
    }
  }, [theme])

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next)
    void hapticSelection()
  }, [])
  const toggleRedNight = useCallback(() => setTheme(theme === 'red-night' ? 'dark' : 'red-night'), [theme, setTheme])

  const api = useMemo<ThemeApi>(
    () => ({ theme, palette: paletteFor(theme), setTheme, toggleRedNight }),
    [theme, setTheme, toggleRedNight],
  )
  return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>
}
