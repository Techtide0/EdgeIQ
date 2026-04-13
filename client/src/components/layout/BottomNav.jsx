import { motion } from 'framer-motion'
import { LayoutDashboard, Wallet, Tv2, Lightbulb, UserCircle } from 'lucide-react'

const NAV = [
  { id: 'dashboard', label: 'Home',     Icon: LayoutDashboard },
  { id: 'bets',      label: 'Bets',     Icon: Wallet },
  { id: 'matches',   label: 'Matches',  Icon: Tv2 },
  { id: 'insights',  label: 'Insights', Icon: Lightbulb },
  { id: 'profile',   label: 'Profile',  Icon: UserCircle },
]

export default function BottomNav({ page, setPage }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t z-40"
      style={{ borderColor: 'var(--border)' }}>
      <div className="flex">
        {NAV.map(({ id, label, Icon }) => {
          const active = page === id
          return (
            <button key={id} onClick={() => setPage(id)}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors"
              style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}>
              <motion.div whileTap={{ scale: 0.85 }} className="relative">
                <Icon size={22} />
              </motion.div>
              <span className="text-[10px] font-medium">{label}</span>
              {active && (
                <motion.div layoutId="bottom-indicator"
                  className="absolute bottom-0 w-10 h-0.5 rounded-full"
                  style={{ background: 'var(--accent)' }} />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
