import type { Theme } from './types'

export const themeLocalStorageKey = 'payload-theme'

export const defaultTheme = 'light'

export const getImplicitPreference = (): Theme | null => {
  // Kiuli frontend uses a fixed light theme - never respond to system dark mode
  return 'light'
}
