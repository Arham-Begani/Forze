'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'

const CREEP_CEILING = 85
const CREEP_INTERVAL_MS = 80
const FAILSAFE_MS = 8000
const SETTLE_MS = 350

function pathnameOf(url: unknown): string | null {
  if (typeof url !== 'string' && !(url instanceof URL)) return null
  try {
    return new URL(String(url), window.location.href).pathname
  } catch {
    return null
  }
}

export function NavigationProgress() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(0)
  const [mounted, setMounted] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const failsafeRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runningRef = useRef(false)
  const prevPathname = useRef(pathname)

  useEffect(() => {
    setMounted(true)
  }, [])

  const clearTimers = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (settleRef.current) { clearTimeout(settleRef.current); settleRef.current = null }
    if (failsafeRef.current) { clearTimeout(failsafeRef.current); failsafeRef.current = null }
  }, [])

  const completeBar = useCallback(() => {
    if (!runningRef.current) return
    runningRef.current = false
    clearTimers()
    setWidth(100)
    settleRef.current = setTimeout(() => {
      setVisible(false)
      setWidth(0)
    }, SETTLE_MS)
  }, [clearTimers])

  const startBar = useCallback(() => {
    clearTimers()
    runningRef.current = true
    setVisible(true)
    setWidth(0)

    requestAnimationFrame(() => {
      if (!runningRef.current) return
      setWidth(15)
      intervalRef.current = setInterval(() => {
        setWidth(prev => {
          if (prev >= CREEP_CEILING) {
            if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
            return prev
          }
          const increment = (CREEP_CEILING - prev) * 0.12 + 0.5
          return Math.min(prev + increment, CREEP_CEILING)
        })
      }, CREEP_INTERVAL_MS)
    })

    failsafeRef.current = setTimeout(completeBar, FAILSAFE_MS)
  }, [clearTimers, completeBar])

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      completeBar()
    }
  }, [pathname, completeBar])

  useEffect(() => {
    const originalPush = window.history.pushState.bind(window.history)
    const originalReplace = window.history.replaceState.bind(window.history)

    function handle(url: unknown, run: () => void) {
      const nextPath = pathnameOf(url)
      const samePath = nextPath === null || nextPath === window.location.pathname
      run()
      if (samePath) {
        if (runningRef.current) completeBar()
        return
      }
      startBar()
    }

    window.history.pushState = function (this: History, ...args: Parameters<History['pushState']>) {
      let result: void = undefined as void
      handle(args[2], () => { result = originalPush(...args) })
      return result
    }

    window.history.replaceState = function (this: History, ...args: Parameters<History['replaceState']>) {
      let result: void = undefined as void
      handle(args[2], () => { result = originalReplace(...args) })
      return result
    }

    function onPopState() { startBar() }
    function onPageHide() { completeBar() }

    window.addEventListener('popstate', onPopState)
    window.addEventListener('pagehide', onPageHide)

    return () => {
      window.history.pushState = originalPush
      window.history.replaceState = originalReplace
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('pagehide', onPageHide)
      runningRef.current = false
      clearTimers()
    }
  }, [startBar, completeBar, clearTimers])

  if (!mounted) return null
  if (!visible && width === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 2.5,
        zIndex: 99999,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${width}%`,
          background: 'linear-gradient(90deg, var(--accent), #e8a04e, var(--accent))',
          backgroundSize: '200% 100%',
          borderRadius: '0 2px 2px 0',
          boxShadow: '0 0 8px var(--accent-glow), 0 0 16px var(--accent-glow)',
          transition: width === 100
            ? 'width 0.2s ease-out'
            : width <= 15
            ? 'width 0.15s ease-out'
            : 'width 0.35s ease-out',
          animation: 'nprogress-shimmer 1.5s linear infinite',
          willChange: 'width',
        }}
      />
    </div>
  )
}
