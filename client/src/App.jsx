import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion' // eslint-disable-line no-unused-vars
import { useAuth } from './hooks/useAuth'
import { useBets } from './hooks/useBets'
import { useInstallPrompt } from './hooks/useInstallPrompt'

import Sidebar       from './components/layout/Sidebar'
import TopBar        from './components/layout/TopBar'
import BottomNav     from './components/layout/BottomNav'
import InstallBanner from './components/InstallBanner'

import Auth        from './pages/Auth'
import Dashboard   from './pages/Dashboard'
import Bets        from './pages/Bets'
import Matches     from './pages/Matches'
import Insights    from './pages/Insights'
import Profile     from './pages/Profile'
import MatchDetail from './pages/MatchDetail'

import './App.css'

function Shell() {
  const [page, setPage]           = useState('dashboard')
  const [statsKey, setStatsKey]   = useState(0)
  const [activeMatchId, setActiveMatchId]   = useState(null)
  const [activeMatchTab, setActiveMatchTab] = useState(null)
  const { bets }                  = useBets()

  // ── Deep-link from push notification ────────────────────────────────────────
  useEffect(() => {
    // Case 1: app was opened cold via ?match=XXX URL (from SW openWindow)
    const params = new URLSearchParams(window.location.search)
    const matchParam = params.get('match')
    if (matchParam) {
      setActiveMatchId(Number(matchParam))
      // Clean the URL so back-navigation works normally
      window.history.replaceState({}, '', '/')
    }

    // Case 2: app was already open — SW sends a postMessage
    function handleSwMessage(event) {
      if (event.data?.type === 'OPEN_MATCH' && event.data.matchId) {
        setActiveMatchId(Number(event.data.matchId))
        setActiveMatchTab(null)
      }
    }
    navigator.serviceWorker?.addEventListener('message', handleSwMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', handleSwMessage)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { canInstall, install, dismiss } = useInstallPrompt()

  const pendingCount = bets.filter(b => b.status === 'pending').length
  function bumpStats() { setStatsKey(k => k + 1) }

  function openMatch(matchId, tab) { setActiveMatchId(matchId); setActiveMatchTab(tab || null) }
  function closeMatch()            { setActiveMatchId(null); setActiveMatchTab(null) }

  // Match detail overrides everything else
  if (activeMatchId) {
    return (
      <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
        <Sidebar page={page} setPage={(p) => { setPage(p); closeMatch() }} canInstall={canInstall} onInstall={install} />
        <div className="flex-1 flex flex-col min-w-0">
          <div className="md:ml-(--sidebar-w) flex flex-col min-h-screen">
            <AnimatePresence mode="wait">
              <motion.div key={`match-${activeMatchId}`}
                initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }}>
                <MatchDetail matchId={activeMatchId} onBack={closeMatch} defaultTab={activeMatchTab} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <BottomNav page={page} setPage={(p) => { setPage(p); closeMatch() }} />
        {canInstall && <InstallBanner onInstall={install} onDismiss={dismiss} />}
      </div>
    )
  }

  const PAGES = {
    dashboard: <Dashboard statsKey={statsKey} bumpStats={bumpStats} setPage={setPage} openMatch={openMatch} />,
    bets:      <Bets      statsKey={statsKey} bumpStats={bumpStats} />,
    matches:   <Matches   openMatch={openMatch} />,
    insights:  <Insights openMatch={openMatch} />,
    profile:   <Profile />,
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar page={page} setPage={setPage} canInstall={canInstall} onInstall={install} />

      <div className="flex-1 flex flex-col min-w-0" style={{ marginLeft: 0 }}
        data-main="true">
        <div className="md:ml-(--sidebar-w) flex flex-col min-h-screen">
          <TopBar page={page} pendingCount={pendingCount} />

          <main className="flex-1 px-4 py-5 md:px-8 md:py-6 max-w-5xl w-full mx-auto">
            <AnimatePresence mode="wait">
              <motion.div key={page}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}>
                {PAGES[page]}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      <BottomNav page={page} setPage={setPage} />
      {canInstall && <InstallBanner onInstall={install} onDismiss={dismiss} />}
    </div>
  )
}

export default function App() {
  const { currentUser } = useAuth()
  return currentUser ? <Shell /> : <Auth />
}
