import { describe, it, expect } from 'vitest'
import {
  BILLING_PLANS,
  ALL_BILLING_MODULES,
  getPlanPrice,
  getModuleCost,
  isModuleIncluded,
  isFeatureIncluded,
  getWeeklyActionLimit,
  hasUnlimitedBillingOverride,
} from '@/lib/billing'

describe('billing plans', () => {
  it('prices every paid plan yearly cheaper than 12× monthly', () => {
    for (const slug of ['starter', 'builder', 'pro', 'studio'] as const) {
      const monthly = getPlanPrice(slug, 'monthly')
      const yearly = getPlanPrice(slug, 'yearly')
      expect(yearly).toBeLessThan(monthly * 12)
      expect(monthly).toBeGreaterThan(0)
    }
  })

  it('free plan is free', () => {
    expect(getPlanPrice('free', 'monthly')).toBe(0)
    expect(getPlanPrice('free', 'yearly')).toBe(0)
  })

  it('Starter unlocks Inspiration but not CRM/Outreach (the paid-unlock decision)', () => {
    expect(isFeatureIncluded('starter', 'inspiration')).toBe(true)
    expect(isFeatureIncluded('starter', 'crm')).toBe(false)
    expect(isFeatureIncluded('starter', 'outreach')).toBe(false)
    expect(getWeeklyActionLimit('starter', 'inspiration_analyze')).toBeGreaterThan(0)
  })

  it('free plan unlocks no gated features', () => {
    expect(isFeatureIncluded('free', 'inspiration')).toBe(false)
    expect(isFeatureIncluded('free', 'crm')).toBe(false)
  })

  it('Builder+ unlock all features', () => {
    for (const slug of ['builder', 'pro', 'studio'] as const) {
      expect(isFeatureIncluded(slug, 'crm')).toBe(true)
      expect(isFeatureIncluded(slug, 'inspiration')).toBe(true)
      expect(isFeatureIncluded(slug, 'outreach')).toBe(true)
    }
  })
})

describe('billing modules', () => {
  it('every module in ALL_BILLING_MODULES has a positive credit cost', () => {
    for (const moduleId of ALL_BILLING_MODULES) {
      expect(getModuleCost(moduleId)).toBeGreaterThan(0)
    }
  })

  it('the deleted agents are gone from the module set', () => {
    expect(ALL_BILLING_MODULES).not.toContain('launch-autopilot' as never)
    expect(ALL_BILLING_MODULES).not.toContain('mvp-scalpel' as never)
  })

  it('core modules are included on every plan', () => {
    for (const slug of Object.keys(BILLING_PLANS) as Array<keyof typeof BILLING_PLANS>) {
      expect(isModuleIncluded(slug, 'landing')).toBe(true)
      expect(isModuleIncluded(slug, 'general')).toBe(true)
    }
  })
})

describe('unlimited billing override', () => {
  it('is false for empty/undefined emails', () => {
    expect(hasUnlimitedBillingOverride(undefined)).toBe(false)
    expect(hasUnlimitedBillingOverride('')).toBe(false)
    expect(hasUnlimitedBillingOverride(null)).toBe(false)
  })
})
