import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion' // eslint-disable-line no-unused-vars
import { Edit2, Trash2, Check, X, Trophy, XCircle, DollarSign, Clock } from 'lucide-react'

const STATUS_CONFIG = {
  pending: { label: 'Pending',    bg: 'var(--warning-dim)', color: 'var(--warning)' },
  won:     { label: 'Won',        bg: 'var(--accent-dim)',  color: 'var(--accent)'  },
  lost:    { label: 'Lost',       bg: 'var(--danger-dim)',  color: 'var(--danger)'  },
  cashout: { label: 'Cashed Out', bg: 'var(--info-dim)',    color: 'var(--info)'    },
  void:    { label: 'Void',       bg: 'var(--surface2)',    color: 'var(--text-muted)' },
}

const STATUS_OPTIONS = ['pending', 'won', 'lost', 'cashout', 'void']

const STALE_MS = 24 * 60 * 60 * 1000
const isStale  = b => b.status === 'pending' && Date.now() - new Date(b.createdAt) > STALE_MS

function fmt(n) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n)
}

export default function BetCard({ bet, onUpdate, onDelete, compact }) {
  const [editing, setEditing]         = useState(false)
  const [form, setForm]               = useState({ stake: bet.stake, odds: bet.odds, status: bet.status })
  const [cashoutMode, setCashoutMode] = useState(false)
  const [cashoutInput, setCashoutInput] = useState('')
  const [cashoutError, setCashoutError] = useState(null)
  const [loading, setLoading]         = useState(false)

  const stale   = isStale(bet)
  const pending = bet.status === 'pending'
  const cfg     = STATUS_CONFIG[bet.status] || STATUS_CONFIG.pending

  async function resolve(status) {
    setLoading(true)
    try { await onUpdate(bet._id, { status }) }
    finally { setLoading(false) }
  }

  async function handleCashout() {
    const amount = parseFloat(cashoutInput)
    if (!amount || amount <= 0) return setCashoutError('Enter a valid amount')
    if (amount > bet.potentialWin) return setCashoutError(`Max: ${fmt(bet.potentialWin)}`)
    setLoading(true)
    try {
      await onUpdate(bet._id, { status: 'cashout', cashoutAmount: amount })
      setCashoutMode(false)
    } finally { setLoading(false) }
  }

  async function handleSave() {
    setLoading(true)
    try {
      await onUpdate(bet._id, { stake: parseFloat(form.stake), odds: parseFloat(form.odds), status: form.status })
      setEditing(false)
    } finally { setLoading(false) }
  }

  async function handleDelete() {
    setLoading(true)
    try { await onDelete(bet._id) }
    finally { setLoading(false) }
  }

  if (editing) {
    return (
      <motion.div layout className="card p-4 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          {['stake', 'odds'].map(field => (
            <input key={field}
              type="number" value={form[field]} min="0" step="any"
              placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
              onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit' }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'} />
          ))}
        </div>
        <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit' }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>)}
        </select>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={loading} className="btn-primary text-xs py-1.5 flex-1">
            <Check size={13} /> Save
          </button>
          <button onClick={() => setEditing(false)} className="btn-ghost text-xs py-1.5 flex-1">
            <X size={13} /> Cancel
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div layout
      className="card overflow-hidden"
      style={{ borderColor: stale ? 'var(--warning)' : 'var(--border)' }}>

      {stale && (
        <div className="flex items-center gap-2 px-4 py-2 text-xs font-medium"
          style={{ background: 'var(--warning-dim)', color: 'var(--warning)' }}>
          <Clock size={12} /> Over 24h — please resolve this bet
        </div>
      )}

      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                style={{ background: cfg.bg, color: cfg.color }}>
                {cfg.label}
              </span>
              {bet.createdAt && (
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {new Date(bet.createdAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => setEditing(true)} disabled={loading}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: 'var(--surface2)', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <Edit2 size={13} />
            </button>
            <button type="button" onClick={handleDelete} disabled={loading}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: 'var(--danger-dim)', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className={`grid gap-3 mb-3 ${compact ? 'grid-cols-3' : 'grid-cols-3'}`}>
          {[
            { label: 'Stake',     value: fmt(bet.stake) },
            { label: 'Odds',      value: `×${bet.odds}` },
            { label: 'Potential', value: fmt(bet.potentialWin) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl p-2.5" style={{ background: 'var(--surface2)' }}>
              <p className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
              <p className="text-sm font-bold truncate" style={{ color: 'var(--text)' }}>{value}</p>
            </div>
          ))}
        </div>

        {bet.status === 'cashout' && bet.cashoutAmount != null && (
          <p className="text-xs mb-2" style={{ color: 'var(--info)' }}>
            Returned: {fmt(bet.cashoutAmount)}
          </p>
        )}

        {/* Quick resolve */}
        <AnimatePresence>
          {pending && !cashoutMode && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              className="flex gap-2">
              <button type="button" onClick={() => resolve('won')} disabled={loading}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white transition-opacity"
                style={{ background: 'var(--accent)', border: 'none', cursor: 'pointer' }}>
                <Trophy size={12} /> Won
              </button>
              <button type="button" onClick={() => resolve('lost')} disabled={loading}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white transition-opacity"
                style={{ background: 'var(--danger)', border: 'none', cursor: 'pointer' }}>
                <XCircle size={12} /> Lost
              </button>
              <button type="button" onClick={() => setCashoutMode(true)} disabled={loading}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white transition-opacity"
                style={{ background: 'var(--info)', border: 'none', cursor: 'pointer' }}>
                <DollarSign size={12} /> Cashout
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cashout input */}
        <AnimatePresence>
          {cashoutMode && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              className="flex flex-col gap-2">
              <input type="number" placeholder={`Amount (max ${fmt(bet.potentialWin)})`}
                value={cashoutInput} min="0" max={bet.potentialWin} step="any"
                onChange={e => { setCashoutInput(e.target.value); setCashoutError(null) }}
                className="px-3 py-2 rounded-xl text-sm outline-none w-full"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit' }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'} />
              {cashoutError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{cashoutError}</p>}
              <div className="flex gap-2">
                <button onClick={handleCashout} disabled={loading}
                  className="btn-primary flex-1 text-xs py-2 justify-center"
                  style={{ background: 'var(--info)' }}>
                  Confirm
                </button>
                <button onClick={() => { setCashoutMode(false); setCashoutError(null) }}
                  className="btn-ghost flex-1 text-xs py-2 justify-center">
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
