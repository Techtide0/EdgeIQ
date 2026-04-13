import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Filter } from 'lucide-react'
import { useBets } from '../hooks/useBets'
import BetCard from '../components/BetCard'
import AddBetForm from '../components/AddBetForm'
import { SkeletonBetCard } from '../components/ui/AnimatedLoadingSkeleton'

const FILTERS = ['all', 'pending', 'won', 'lost', 'cashout', 'void']

const STATUS_COLOR = {
  pending: { bg: 'var(--warning-dim)', text: 'var(--warning)' },
  won:     { bg: 'var(--accent-dim)',  text: 'var(--accent)'  },
  lost:    { bg: 'var(--danger-dim)',  text: 'var(--danger)'  },
  cashout: { bg: 'var(--info-dim)',    text: 'var(--info)'    },
  void:    { bg: 'var(--surface2)',    text: 'var(--text-muted)' },
}

export default function Bets({ statsKey, bumpStats }) {
  const { bets, loading, error, createBet, updateBet, deleteBet } = useBets()
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)

  const filtered = filter === 'all' ? bets : bets.filter(b => b.status === filter)

  const counts = FILTERS.reduce((acc, f) => {
    acc[f] = f === 'all' ? bets.length : bets.filter(b => b.status === f).length
    return acc
  }, {})

  async function handleCreate(payload) {
    await createBet(payload)
    bumpStats()
    setShowForm(false)
  }
  async function handleUpdate(id, p) { await updateBet(id, p); bumpStats() }
  async function handleDelete(id)    { await deleteBet(id);    bumpStats() }

  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <Filter size={14} />
          <span>{filtered.length} bets</span>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowForm(v => !v)}
          className="btn-primary">
          <Plus size={16} />
          Add Bet
        </motion.button>
      </div>

      {/* Add bet form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="card p-5">
              <AddBetForm onAdd={handleCreate} onCancel={() => setShowForm(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {FILTERS.map(f => {
          const active = filter === f
          const col = STATUS_COLOR[f] || { bg: 'var(--surface2)', text: 'var(--text-muted)' }
          return (
            <button key={f} onClick={() => setFilter(f)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all"
              style={{
                background: active ? (col.bg) : 'var(--surface2)',
                color:      active ? (col.text) : 'var(--text-muted)',
                border: active ? `1px solid ${col.text}30` : '1px solid transparent',
              }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {counts[f] > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px]"
                style={{ background: `${col.text}20`, color: col.text }}>{counts[f]}</span>}
            </button>
          )
        })}
      </div>

      {/* Bets list */}
      {loading && (
        <div className="flex flex-col gap-3">
          {[0, 0.08, 0.16, 0.24].map((delay, i) => (
            <SkeletonBetCard key={i} delay={delay} />
          ))}
        </div>
      )}
      {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>Error: {error}</p>}

      <AnimatePresence mode="popLayout">
        {filtered.length === 0 && !loading && (
          <motion.div key="empty"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="card p-10 text-center"
            style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No {filter !== 'all' ? filter : ''} bets yet
          </motion.div>
        )}
        {filtered.map((bet, i) => (
          <motion.div key={bet._id}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20, height: 0 }}
            transition={{ delay: i * 0.04, duration: 0.28 }}>
            <BetCard bet={bet} onUpdate={handleUpdate} onDelete={handleDelete} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
