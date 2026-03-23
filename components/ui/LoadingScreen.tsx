'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

interface LoadingScreenProps {
  onComplete?: () => void
  minimumDuration?: number
}

export function LoadingScreen({ onComplete, minimumDuration = 800 }: LoadingScreenProps) {
  const [visible, setVisible] = useState(true)
  const [progress, setProgress] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Animate progress from 0 to 100
    const interval = setInterval(() => {
      setProgress(prev => {
        const remaining = 100 - prev
        const increment = remaining * 0.12 + Math.random() * 4
        return Math.min(prev + increment, 98)
      })
    }, 40)

    const timer = setTimeout(() => {
      clearInterval(interval)
      setProgress(100)
      setTimeout(() => {
        setVisible(false)
        setTimeout(() => onComplete?.(), 300)
      }, 150)
    }, minimumDuration)

    return () => {
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [minimumDuration, onComplete])

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
            Initializing Silicon Workforce
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
