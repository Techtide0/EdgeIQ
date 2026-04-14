import { motion } from 'framer-motion'
import { LayoutDashboard, Wallet, Tv2, Lightbulb, UserCircle, Download } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

const NAV = [
  { id: 'dashboard', label: 'Dashboard',  Icon: LayoutDashboard },
  { id: 'bets',      label: 'My Bets',    Icon: Wallet },
  { id: 'matches',   label: 'Matches',    Icon: Tv2 },
  { id: 'insights',  label: 'Insights',   Icon: Lightbulb },
  { id: 'profile',   label: 'Profile',    Icon: UserCircle },
]

export default function Sidebar({ page, setPage, canInstall, onInstall }) {
  const { theme, toggle } = useTheme()

  return (
    <aside style={{ width: 'var(--sidebar-w)', background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      className="hidden md:flex flex-col fixed left-0 top-0 h-full rounded-none z-40">

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <img src="/edgeiq.png" alt="EdgeIQ mark" className="w-9 h-9 rounded-lg object-cover" />
        <span className="text-base font-bold tracking-tight" style={{ color: 'var(--text)' }}>EdgeIQ</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
        {NAV.map(({ id, label, Icon }) => {
          const active = page === id
          return (
            <motion.button
              key={id}
              onClick={() => setPage(id)}
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left"
              style={{
                background: active ? 'var(--accent-dim)' : 'transparent',
                color:      active ? 'var(--accent)'    : 'var(--text-muted)',
              }}
            >
              <Icon size={18} style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }} />
              {label}
              {active && (
                <motion.div layoutId="sidebar-indicator"
                  className="ml-auto w-1.5 h-1.5 rounded-full"
                  style={{ background: 'var(--accent)' }} />
              )}
            </motion.button>
          )
        })}
      </nav>

      {/* Theme toggle + Install */}
      <div className="px-4 pb-5 pt-4 flex flex-col gap-2">
        {canInstall && (
          <button type="button" onClick={onInstall}
            className="btn-primary w-full justify-center text-xs gap-1.5">
            <Download size={13} />
            Install App
          </button>
        )}
        <button type="button" onClick={toggle}
          className="btn-ghost w-full justify-center text-xs"
          style={{ color: 'var(--text-muted)' }}>
          {theme === 'dark' ? '☀ Light mode' : '🌙 Dark mode'}
        </button>
      </div>
    </aside>
  )
}
