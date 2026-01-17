import React from 'react'

import { defaultTheme, themeLocalStorageKey } from '../ThemeSelector/types'

/**
 * InitTheme - Prevents theme flash by setting data-theme before first paint.
 * Uses a regular script tag (not next/script) to avoid eslint false positive
 * for beforeInteractive strategy. In App Router layouts, inline scripts in
 * <head> execute synchronously before paint, achieving the same effect.
 */
export const InitTheme: React.FC = () => {
  const themeScript = `
(function () {
  function getImplicitPreference() {
    var mediaQuery = '(prefers-color-scheme: dark)'
    var mql = window.matchMedia(mediaQuery)
    var hasImplicitPreference = typeof mql.matches === 'boolean'
    if (hasImplicitPreference) {
      return mql.matches ? 'dark' : 'light'
    }
    return null
  }
  function themeIsValid(theme) {
    return theme === 'light' || theme === 'dark'
  }
  var themeToSet = '${defaultTheme}'
  var preference = window.localStorage.getItem('${themeLocalStorageKey}')
  if (themeIsValid(preference)) {
    themeToSet = preference
  } else {
    var implicitPreference = getImplicitPreference()
    if (implicitPreference) {
      themeToSet = implicitPreference
    }
  }
  document.documentElement.setAttribute('data-theme', themeToSet)
})();
`

  return (
    <script
      dangerouslySetInnerHTML={{ __html: themeScript }}
      id="theme-script"
    />
  )
}
