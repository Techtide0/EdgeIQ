import { useEffect, useState } from 'react'
import { motion, useAnimation } from 'framer-motion'
import { Search } from 'lucide-react'

// ─── Shimmer bar — reusable primitive ────────────────────────────────────────

export function SkeletonBar({ width = '100%', height = 12, rounded = 'rounded-md', delay = 0, style = {} }) {
  return (
    <motion.div
      animate={{ opacity: [0.45, 1, 0.45] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay }}
      className={rounded}
      style={{ width, height, background: 'var(--border)', ...style }}
    />
  )
}

// ─── Bet card skeleton ────────────────────────────────────────────────────────

export function SkeletonBetCard({ delay = 0 }) {
  return (
    <motion.div
      className="card p-4 flex flex-col gap-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}>
      <div className="flex items-center justify-between">
        <SkeletonBar width="45%" height={13} delay={delay} />
        <SkeletonBar width={60} height={22} rounded="rounded-full" delay={delay + 0.1} />
      </div>
      <SkeletonBar width="65%" height={11} delay={delay + 0.15} />
      <SkeletonBar width="40%" height={10} delay={delay + 0.2} />
      <div className="flex gap-2 pt-1">
        <SkeletonBar width={72} height={30} rounded="rounded-lg" delay={delay + 0.25} />
        <SkeletonBar width={72} height={30} rounded="rounded-lg" delay={delay + 0.3} />
      </div>
    </motion.div>
  )
}

// ─── Stat card skeleton ───────────────────────────────────────────────────────

export function SkeletonStatCard({ delay = 0 }) {
  return (
    <motion.div
      className="card p-5 flex flex-col gap-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}>
      <div className="flex items-center justify-between">
        <SkeletonBar width="50%" height={10} delay={delay} />
        <motion.div
          animate={{ opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay }}
          className="w-9 h-9 rounded-xl"
          style={{ background: 'var(--border)' }} />
      </div>
      <SkeletonBar width="60%" height={28} rounded="rounded-lg" delay={delay + 0.1} />
      <SkeletonBar width="35%" height={10} delay={delay + 0.2} />
    </motion.div>
  )
}

// ─── Profile stat row skeleton ────────────────────────────────────────────────

export function SkeletonProfileRow({ delay = 0 }) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0"
      style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-3">
        <motion.div
          animate={{ opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay }}
          className="w-8 h-8 rounded-lg"
          style={{ background: 'var(--border)' }} />
        <SkeletonBar width={100} height={12} delay={delay + 0.1} />
      </div>
      <SkeletonBar width={70} height={12} delay={delay + 0.2} />
    </div>
  )
}

// ─── Match card skeleton ──────────────────────────────────────────────────────

function SkeletonMatchCard({ delay = 0 }) {
  return (
    <motion.div
      variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { delay, duration: 0.4 } } }}
      initial="hidden"
      animate="visible"
      className="rounded-xl p-4"
      style={{ background: 'var(--surface2)' }}>
      {/* Score / time bar */}
      <motion.div
        className="h-24 rounded-lg mb-3"
        animate={{ opacity: [0.45, 1, 0.45] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay }}
        style={{ background: 'var(--border)' }} />
      <SkeletonBar width="75%" height={11} rounded="rounded" delay={delay + 0.1} style={{ marginBottom: 8 }} />
      <SkeletonBar width="50%" height={10} rounded="rounded" delay={delay + 0.25} />
    </motion.div>
  )
}

// ─── Main animated skeleton (Matches / Insights pages) ───────────────────────

export default function AnimatedLoadingSkeleton({ numCards = 6, label = 'Loading matches…' }) {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  )
  const controls = useAnimation()

  function getGridConfig(width) {
    const cols = width >= 1024 ? 3 : width >= 640 ? 2 : 1
    return { numCards, cols, xBase: 36, yBase: 56, xStep: 205, yStep: 190 }
  }

  function generateSearchPath(config) {
    const { numCards, cols, xBase, yBase, xStep, yStep } = config
    const rows = Math.ceil(numCards / cols)
    const positions = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (r * cols + c < numCards) {
          positions.push({ x: xBase + c * xStep, y: yBase + r * yStep })
        }
      }
    }
    const picks = positions.sort(() => Math.random() - 0.5).slice(0, 4)
    picks.push(picks[0]) // close the loop
    return {
      x: picks.map(p => p.x),
      y: picks.map(p => p.y),
      scale: Array(picks.length).fill(1.15),
      transition: {
        duration: picks.length * 2.2,
        repeat: Infinity,
        ease: [0.4, 0, 0.2, 1],
        times: picks.map((_, i) => i / (picks.length - 1)),
      },
    }
  }

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    controls.start(generateSearchPath(getGridConfig(windowWidth)))
  }, [windowWidth, controls]) // eslint-disable-line react-hooks/exhaustive-deps

  const config = getGridConfig(windowWidth)
  const gridClass =
    config.cols === 3 ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
    : config.cols === 2 ? 'grid grid-cols-1 sm:grid-cols-2 gap-4'
    : 'flex flex-col gap-4'

  const glowVariants = {
    animate: {
      boxShadow: [
        '0 0 20px var(--accent-dim)',
        '0 0 38px var(--accent-dim)',
        '0 0 20px var(--accent-dim)',
      ],
      scale: [1, 1.1, 1],
      transition: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' },
    },
  }

  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}>
      <div className="relative overflow-hidden rounded-xl p-6" style={{ background: 'var(--surface)' }}>

        {/* Animated search icon */}
        <motion.div
          className="absolute z-10 pointer-events-none"
          animate={controls}
          style={{ left: 20, top: 20 }}>
          <motion.div
            className="p-3 rounded-full"
            style={{ background: 'var(--accent-dim)' }}
            variants={glowVariants}
            animate="animate">
            <Search size={18} style={{ color: 'var(--accent)' }} />
          </motion.div>
        </motion.div>

        {/* Card grid */}
        <div className={gridClass}>
          {Array.from({ length: numCards }).map((_, i) => (
            <SkeletonMatchCard key={i} delay={i * 0.08} />
          ))}
        </div>

        {/* Status label */}
        <motion.p
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="text-center text-xs mt-5"
          style={{ color: 'var(--text-muted)' }}>
          {label}
        </motion.p>
      </div>
    </motion.div>
  )
}
