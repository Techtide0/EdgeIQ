import { useState, useEffect } from 'react'

const DISMISSED_KEY = 'edgeiq_install_dismissed'

/**
 * Captures the browser's beforeinstallprompt event so you can trigger
 * the install dialog at the right moment instead of the browser's default timing.
 *
 * Returns:
 *   canInstall   — true when the prompt is ready and not yet dismissed
 *   isStandalone — true when the app is already installed / running as PWA
 *   install()    — triggers the native install dialog
 *   dismiss()    — hides the banner for this session
 */
export function useInstallPrompt() {
  const [prompt,       setPrompt]       = useState(null)
  const [canInstall,   setCanInstall]   = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Already installed — don't show the banner at all
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true   // iOS Safari
    setIsStandalone(standalone)
    if (standalone) return

    // User dismissed it earlier this session
    if (sessionStorage.getItem(DISMISSED_KEY)) return

    function handler(e) {
      e.preventDefault()      // stop the mini-infobar
      setPrompt(e)
      setCanInstall(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Also handle when the app gets installed (hide banner)
    window.addEventListener('appinstalled', () => {
      setCanInstall(false)
      setPrompt(null)
    })

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function install() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setCanInstall(false)
      setPrompt(null)
    }
  }

  function dismiss() {
    sessionStorage.setItem(DISMISSED_KEY, '1')
    setCanInstall(false)
  }

  return { canInstall, isStandalone, install, dismiss }
}
