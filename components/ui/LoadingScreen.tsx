'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

interface LoadingScreenProps {
  onComplete?: () => void
  /** Floor, so a fast load doesn't flash the screen for a single frame. */
  minimumDuration?: number
  /**
   * Whether the app actually has what it needs. Defaults true (pure-timer
   * behavior). When passed, the screen dismisses on real readiness instead of
   * on a fixed timer.
   */
  ready?: boolean
  /**
   * Hard ceiling. Never let a hung or failed request trap someone on a
   * loading screen — after this we reveal the app regardless of `ready`.
   */
  maximumDuration?: number
}

export function LoadingScreen({
  onComplete,
  minimumDuration = 800,
  ready = true,
  maximumDuration = 4000,
}: LoadingScreenProps) {
  const [visible, setVisible] = useState(true)
  const [progress, setProgress] = useState(0)
  const [mounted, setMounted] = useState(false)
  // Dismissal needs BOTH the floor elapsed and the app ready; the cap forces it.
  const [floorElapsed, setFloorElapsed] = useState(false)
  const [capReached, setCapReached] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setMounted(true)
    // Animate progress from 0 to 100
    intervalRef.current = setInterval(() => {
      setProgress(prev => {
        const remaining = 100 - prev
        const increment = remaining * 0.12 + Math.random() * 4
        return Math.min(prev + increment, 98)
      })
    }, 40)

    const floorTimer = setTimeout(() => setFloorElapsed(true), minimumDuration)
    const capTimer = setTimeout(() => setCapReached(true), maximumDuration)

    return () => {
      clearTimeout(floorTimer)
      clearTimeout(capTimer)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [minimumDuration, maximumDuration])

  useEffect(() => {
    if (!(floorElapsed && ready) && !capReached) return
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setProgress(100)
    setVisible(false)
    // Fire immediately rather than after the exit animation: the app fades in
    // underneath while the overlay fades out, so the two crossfade instead of
    // costing ~450ms of dead time in series.
    onComplete?.()
  }, [floorElapsed, ready, capReached, onComplete])

  if (!mounted) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg)',
            gap: 28,
          }}
        >
          {/* Ambient glow */}
          <motion.div
            style={{
              position: 'absolute',
              width: 350,
              height: 350,
              borderRadius: '50%',
              background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)',
              filter: 'blur(60px)',
              pointerEvents: 'none',
            }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.25, 0.4, 0.25] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Hex logo with entry animation */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, type: 'spring', stiffness: 200, damping: 15 }}
            style={{ position: 'relative', zIndex: 1 }}
          >
            <motion.div
              style={{
                width: 52,
                height: 52,
                background: 'linear-gradient(135deg, var(--accent), #e8a04e)',
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                boxShadow: '0 0 40px var(--accent-glow)',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
            />
          </motion.div>

          {/* Wordmark */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: '-0.04em',
              position: 'relative',
              zIndex: 1,
            }}
            className="gradient-text"
          >
            Forze
          </motion.div>

          {/* Progress bar */}
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 140 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            style={{
              height: 3,
              borderRadius: 3,
              background: 'var(--border)',
              overflow: 'hidden',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <motion.div
              style={{
                height: '100%',
                background: 'linear-gradient(90deg, var(--accent), #e8a04e)',
                borderRadius: 3,
                width: `${progress}%`,
                transition: 'width 80ms ease-out',
              }}
            />
          </motion.div>

          {/* Status text */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ delay: 0.6 }}
            style={{
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              fontWeight: 600,
              position: 'relative',
              zIndex: 1,
              margin: 0,
            }}
          >
            Initializing Your Startup Workforce
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
