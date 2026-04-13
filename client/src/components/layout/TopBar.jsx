import { Bell, Sun, Moon } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../context/ThemeContext'
import { motion } from 'framer-motion'

const PAGE_LABELS = {
  dashboard: 'Dashboard',
  bets: 'My Bets',
  matches: 'Matches',
  insights: 'Insights',
  profile: 'Profile',
}

export default function TopBar({ page, pendingCount }) {
  const { currentUser } = useAuth()
  const { theme, toggle } = useTheme()
  const initials = currentUser?.email?.[0]?.toUpperCase() || 'U'

  return (
    <header className="glass sticky top-0 z-30 flex items-center justify-between px-5 py-3 border-b"
      style={{ borderColor: 'var(--border)' }}>

      <div>
        <h1 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
          {PAGE_LABELS[page]}
        </h1>
      </div>

      <div className="flex items-center gap-2">

        {/* Pending badge */}
        {pendingCount > 0 && (
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="relative"
          >
            <Bell size={20} style={{ color: 'var(--text-muted)' }} />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center text-[10px] font-bold"
              style={{ background: 'var(--danger)' }}>
              {pendingCount}
            </span>
          </motion.div>
        )}

        {/* Theme toggle (mobile) */}
        <button type="button" onClick={toggle}
          className="btn-ghost p-2 md:hidden"
          style={{ padding: '6px' }}>
          {theme === 'dark'
            ? <Sun size={17} style={{ color: 'var(--text-muted)' }} />
            : <Moon size={17} style={{ color: 'var(--text-muted)' }} />}
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
          style={{ background: 'var(--accent)' }}>
          {initials}
        </div>
      </div>
    </header>
  )
}
