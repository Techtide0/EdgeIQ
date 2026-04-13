import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion' // eslint-disable-line no-unused-vars
import { Plus, X, Calculator } from 'lucide-react'

export default function AddBetForm({ onAdd, onCancel, compact }) {
  const [form, setForm]     = useState({ stake: '', odds: '', bonusExpected: '' })
  const [error, setError]   = useState(null)
  const [loading, setLoading] = useState(false)

  const stake   = parseFloat(form.stake)
  const odds    = parseFloat(form.odds)
  const preview = !isNaN(stake) && !isNaN(odds) && stake > 0 && odds > 0
    ? new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(stake * odds)
    : null

  function handleChange(e) {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }))
    setError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!stake || !odds || stake <= 0 || odds <= 0) return setError('Stake and odds must be positive numbers')
    setLoading(true)
    try {
      await onAdd({ stake, odds, bonusExpected: parseFloat(form.bonusExpected) || 0 })
      setForm({ stake: '', odds: '', bonusExpected: '' })
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const inputStyle = {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    fontFamily: 'inherit',
    borderRadius: '10px',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    width: '100%',
    outline: 'none',
    transition: 'border-color 0.15s',
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {!compact && (
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>New Bet</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Stake</label>
          <input name="stake" type="number" placeholder="1000" value={form.stake}
            onChange={handleChange} min="0" step="any" style={inputStyle}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Odds</label>
          <input name="odds" type="number" placeholder="2.50" value={form.odds}
            onChange={handleChange} min="0" step="any" style={inputStyle}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Bonus Expected <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
        <input name="bonusExpected" type="number" placeholder="0" value={form.bonusExpected}
          onChange={handleChange} min="0" step="any" style={inputStyle}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'} />
      </div>

      <AnimatePresence>
        {preview && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
            <Calculator size={14} />
            <span className="font-semibold">Potential win: {preview}</span>
          </motion.div>
        )}
        {error && (
          <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-xs px-3 py-2 rounded-lg"
            style={{ background: 'var(--danger-dim)', color: 'var(--danger)' }}>
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex gap-2">
        <motion.button type="submit" disabled={loading || !preview} whileTap={preview ? { scale: 0.97 } : {}}
          className="btn-primary flex-1 justify-center py-2.5"
          style={{ opacity: loading || !preview ? 0.45 : 1, cursor: loading || !preview ? 'not-allowed' : 'pointer' }}>
          <Plus size={15} />
          {loading ? 'Adding…' : 'Add Bet'}
        </motion.button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost px-3 py-2.5">
            <X size={15} />
          </button>
        )}
      </div>
    </form>
  )
}
