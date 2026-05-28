'use client'

import { useEffect, useState } from 'react'
import { Navbar } from './Navbar'
import { Hero } from './Hero'
import { Marquee } from './Marquee'
import { HowItWorks } from './HowItWorks'
import { AgentGrid } from './AgentGrid'
import { OutputTabs } from './OutputTabs'
import { ModuleShowcase } from './ModuleShowcase'
import { ComparisonTable } from './ComparisonTable'
import { PricingSection } from './PricingSection'
import { Testimonials } from './Testimonials'
import { FAQ } from './FAQ'
import { CTABlock } from './CTABlock'
import { Footer } from './Footer'

export function LandingPage() {
  const [scrollPct, setScrollPct] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement
      const pct = el.scrollTop / (el.scrollHeight - el.clientHeight)
      setScrollPct(Math.min(pct * 100, 100))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      fontFamily: 'var(--font-dm-sans), sans-serif',
      overflowX: 'hidden',
    }}>
      {/* Scroll progress bar */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 200,
        height: '2px',
        width: `${scrollPct}%`,
        background: 'linear-gradient(to right, var(--accent), #e8a04e)',
        transition: 'width 0.1s linear',
        pointerEvents: 'none',
        boxShadow: '0 0 8px hsla(28,62%,42%,0.6)',
      }} />
      <Navbar />
      <Hero />
      <Marquee />
      <HowItWorks />
      <AgentGrid />
      <OutputTabs />
      <ModuleShowcase />
      <Testimonials />
      <ComparisonTable />
      <PricingSection />
      <FAQ />
      <CTABlock />
      <Footer />
    </div>
  )
}
