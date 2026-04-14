import { motion, AnimatePresence } from 'framer-motion'
import { X, Download } from 'lucide-react'

/**
 * Slim install banner — slides up from the bottom on mobile,
 * appears as an inline card on desktop.
 *
 * Props:
 *   onInstall  — calls useInstallPrompt().install()
 *   onDismiss  — calls useInstallPrompt().dismiss()
 */
export default function InstallBanner({ onInstall, onDismiss }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{    opacity: 0, y: 32 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="fixed bottom-20 md:bottom-6 left-3 right-3 md:left-auto md:right-6 md:w-80 z-50"
      >
        <div
          className="card flex items-center gap-3 px-4 py-3 shadow-xl"
          style={{ borderColor: 'var(--accent)', boxShadow: '0 8px 32px -8px rgba(34,197,94,0.25)' }}
        >
          {/* Logo */}
          <img src="/edgeiq.png" alt="EdgeIQ" className="w-10 h-10 rounded-xl object-cover shrink-0" />

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight" style={{ color: 'var(--text)' }}>
              Install EdgeIQ
            </p>
            <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>
              Add to home screen for faster insights ⚡
            </p>
          </div>

          {/* Install button */}
          <button
            type="button"
            onClick={onInstall}
            className="btn-primary shrink-0 text-xs py-1.5 px-3 gap-1.5"
          >
            <Download size={13} />
            Install
          </button>

          {/* Dismiss */}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss install banner"
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
