import { motion, AnimatePresence } from 'framer-motion' // eslint-disable-line no-unused-vars
import { AlertTriangle, Bell } from 'lucide-react'

const STALE_MS = 24 * 60 * 60 * 1000

export default function PendingAlert({ bets }) {
  const pending = bets.filter(b => b.status === 'pending')
  const stale   = pending.filter(b => Date.now() - new Date(b.createdAt) > STALE_MS)

  return (
    <AnimatePresence>
      {pending.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden">
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
            style={{
              background: stale.length > 0 ? 'var(--warning-dim)' : 'var(--info-dim)',
              border: `1px solid ${stale.length > 0 ? 'var(--warning)' : 'var(--info)'}30`,
            }}>
            {stale.length > 0
              ? <AlertTriangle size={16} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
              : <Bell size={16} style={{ color: 'var(--info)', flexShrink: 0, marginTop: 1 }} />}
            <div>
              <p className="text-sm font-semibold"
                style={{ color: stale.length > 0 ? 'var(--warning)' : 'var(--info)' }}>
                {pending.length} unresolved {pending.length === 1 ? 'bet' : 'bets'}
                {stale.length > 0 && ` — ${stale.length} older than 24h`}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Resolve your bets to keep your stats accurate
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
