'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import {
  BILLING_PLANS,
  PLAN_SEQUENCE,
  TOPUP_PRODUCTS,
  TOPUP_SEQUENCE,
  type BillingPeriod,
  type PlanSlug,
  type TopupSlug,
} from '@/lib/billing'
import { openRazorpayCheckout } from '@/lib/client-razorpay'

interface BillingSnapshot {
  planSlug: PlanSlug
  planLabel: string
  billingPeriod: BillingPeriod | null
  subscriptionStatus: string
  creditsRemaining: number
  allowedModules: string[]
  ventureLimit: number
  monthlyCredits: number
  activeVentureCount: number
  canCreateVenture: boolean
  nextRenewalAt: string | null
  currentSubscriptionId: string | null
  cancelAtPeriodEnd: boolean
  hasUnlimitedAccess: boolean
}

interface BillingPayment {
  id: string
  kind: 'subscription' | 'topup'
  amount_inr: number
  status: string
  plan_slug?: string | null
  topup_slug?: string | null
  created_at: string
}

interface BillingResponse extends BillingSnapshot {
  plans: typeof BILLING_PLANS[keyof typeof BILLING_PLANS][]
  topups: typeof TOPUP_PRODUCTS[keyof typeof TOPUP_PRODUCTS][]
  payments: BillingPayment[]
}

function formatInr(amount: number) {
  return `\u20B9${amount.toLocaleString('en-IN')}`
}

export function BillingPanel() {
  const [billing, setBilling] = useState<BillingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly')

  async function loadBilling() {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/me')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load billing')
      setBilling(data)
      if (data.billingPeriod === 'yearly') setBillingPeriod('yearly')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadBilling()
  }, [])

  async function startPlanCheckout(planSlug: Exclude<PlanSlug, 'free'>) {
    setActionLoading(`plan:${planSlug}`)
    setError(null)

    try {
      const createRes = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'create', kind: 'plan', planSlug, billingPeriod }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) throw new Error(createData.error || 'Failed to create checkout')

      await openRazorpayCheckout({
        key: createData.keyId,
        subscription_id: createData.subscriptionId,
        name: 'Forge',
        description: `${BILLING_PLANS[planSlug].label} plan`,
        prefill: createData.prefill,
        handler: async (response) => {
          const confirmRes = await fetch('/api/billing/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'confirm',
              kind: 'plan',
              planSlug,
              billingPeriod,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySubscriptionId: response.razorpay_subscription_id,
              razorpaySignature: response.razorpay_signature,
            }),
          })
          const confirmData = await confirmRes.json()
          if (!confirmRes.ok) throw new Error(confirmData.error || 'Payment confirmation failed')
          await loadBilling()
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
    } finally {
      setActionLoading(null)
    }
  }

  async function startTopupCheckout(topupSlug: TopupSlug) {
    setActionLoading(`topup:${topupSlug}`)
    setError(null)

    try {
      const createRes = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'create', kind: 'topup', topupSlug }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) throw new Error(createData.error || 'Failed to create top-up checkout')

      await openRazorpayCheckout({
        key: createData.keyId,
        order_id: createData.orderId,
        amount: createData.amountInr * 100,
        name: 'Forge',
        description: `${TOPUP_PRODUCTS[topupSlug].label} top-up`,
        prefill: createData.prefill,
        handler: async (response) => {
          const confirmRes = await fetch('/api/billing/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'confirm',
              kind: 'topup',
              topupSlug,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            }),
          })
          const confirmData = await confirmRes.json()
          if (!confirmRes.ok) throw new Error(confirmData.error || 'Top-up confirmation failed')
          await loadBilling()
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Top-up failed')
    } finally {
      setActionLoading(null)
    }
  }

  async function cancelAtPeriodEnd() {
    setActionLoading('cancel')
    setError(null)
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update subscription')
      await loadBilling()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subscription')
    } finally {
      setActionLoading(null)
    }
  }

  const hasUnlimitedAccess = billing?.hasUnlimitedAccess ?? false
  const currentPlan = billing ? BILLING_PLANS[billing.planSlug] : BILLING_PLANS.free
  const currentPlanLabel = hasUnlimitedAccess ? (billing?.planLabel ?? 'Unlimited') : currentPlan.label
  const nextRenewalLabel = billing?.nextRenewalAt
    ? new Date(billing.nextRenewalAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  const paymentSummary = useMemo(() => billing?.payments.slice(0, 5) ?? [], [billing])

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{
          padding: '22px 24px',
          borderRadius: 18,
          background: 'linear-gradient(135deg, var(--accent-soft), var(--glass-bg-strong))',
          border: '1px solid var(--accent-glow)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Current billing
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', marginTop: 8 }}>
              {loading ? 'Loading...' : currentPlanLabel}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 6 }}>
              {loading
                ? 'Fetching billing snapshot'
                : hasUnlimitedAccess
                  ? 'Unlimited credits enabled for this account'
                  : `${billing?.creditsRemaining ?? 0} credits remaining`}
            </div>
            {hasUnlimitedAccess ? (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                Owner override is active. Billing gates and usage debits are bypassed on the server.
              </div>
            ) : nextRenewalLabel ? (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                Renews on {nextRenewalLabel}
                {billing?.cancelAtPeriodEnd ? ' • canceling at period end' : ''}
              </div>
            ) : null}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(140px, 1fr))', gap: 10, minWidth: 280 }}>
            <MetricCard
              label="Venture limit"
              value={hasUnlimitedAccess ? `${billing?.activeVentureCount ?? 0}/Unlimited` : `${billing?.activeVentureCount ?? 0}/${currentPlan.ventureLimit}`}
            />
            <MetricCard
              label="Monthly credits"
              value={hasUnlimitedAccess ? 'Unlimited' : String(currentPlan.monthlyCredits)}
            />
            <MetricCard
              label="Status"
              value={hasUnlimitedAccess ? 'owner override' : billing?.subscriptionStatus ?? 'free'}
            />
            <MetricCard
              label="Modules"
              value={hasUnlimitedAccess ? 'All modules' : String(currentPlan.allowedModules.length)}
            />
          </div>
        </div>
        {billing && !hasUnlimitedAccess && billing.planSlug !== 'free' && !billing.cancelAtPeriodEnd && (
          <button
            type="button"
            onClick={cancelAtPeriodEnd}
            disabled={actionLoading === 'cancel'}
            style={{ ...secondaryActionBtnStyle, marginTop: 18 }}
          >
            {actionLoading === 'cancel' ? 'Updating...' : 'Cancel at period end'}
          </button>
        )}
      </motion.div>

      {error && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(224, 72, 72, 0.08)',
            border: '1px solid rgba(224, 72, 72, 0.16)',
            color: '#d85b5b',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Billing cycle
        </div>
        <div style={{ display: 'inline-flex', padding: 4, borderRadius: 12, background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
          {(['monthly', 'yearly'] as BillingPeriod[]).map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setBillingPeriod(period)}
              style={{
                border: 'none',
                cursor: 'pointer',
                background: billingPeriod === period ? 'var(--accent)' : 'transparent',
                color: billingPeriod === period ? '#fff' : 'var(--muted)',
                borderRadius: 10,
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'capitalize',
              }}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
        {PLAN_SEQUENCE.map((slug) => {
          const plan = BILLING_PLANS[slug]
          const isCurrent = !hasUnlimitedAccess && billing?.planSlug === slug
          const price = billingPeriod === 'yearly' ? plan.yearlyPriceInr : plan.monthlyPriceInr
          return (
            <div key={slug} className="glass-card" style={{ padding: 20, borderColor: isCurrent ? 'var(--accent-glow)' : 'var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{plan.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', marginTop: 8 }}>
                    {price === 0 ? 'Free' : formatInr(price)}
                  </div>
                </div>
                {isCurrent && <div style={activeBadgeStyle}>Active</div>}
              </div>
              <div style={{ marginTop: 12, display: 'grid', gap: 8, fontSize: 13, color: 'var(--text-soft)' }}>
                <div>{plan.ventureLimit} ventures</div>
                <div>{plan.monthlyCredits} credits / month</div>
                <div>{plan.allowedModules.length} unlocked modules</div>
              </div>
              <button
                type="button"
                disabled={hasUnlimitedAccess || slug === 'free' || isCurrent || actionLoading === `plan:${slug}`}
                onClick={() => startPlanCheckout(slug as Exclude<PlanSlug, 'free'>)}
                style={{
                  ...primaryActionBtnStyle,
                  marginTop: 16,
                  opacity: hasUnlimitedAccess || slug === 'free' || isCurrent ? 0.55 : 1,
                  cursor: hasUnlimitedAccess || slug === 'free' || isCurrent ? 'default' : 'pointer',
                }}
              >
                {hasUnlimitedAccess
                  ? 'Included with owner access'
                  : isCurrent
                    ? 'Current plan'
                    : actionLoading === `plan:${slug}`
                      ? 'Opening checkout...'
                      : plan.cta}
              </button>
            </div>
          )
        })}
      </div>

      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Credit top-ups</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {TOPUP_SEQUENCE.map((slug) => {
            const topup = TOPUP_PRODUCTS[slug]
            return (
              <div key={slug} style={{ padding: 16, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--glass-bg)' }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{topup.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 8 }}>{formatInr(topup.amountInr)}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{topup.credits} extra credits</div>
                <button
                  type="button"
                  disabled={hasUnlimitedAccess || billing?.planSlug === 'free' || actionLoading === `topup:${slug}`}
                  onClick={() => startTopupCheckout(slug)}
                  style={{
                    ...secondaryActionBtnStyle,
                    marginTop: 14,
                    width: '100%',
                    justifyContent: 'center',
                    opacity: hasUnlimitedAccess || billing?.planSlug === 'free' ? 0.55 : 1,
                    cursor: hasUnlimitedAccess || billing?.planSlug === 'free' ? 'default' : 'pointer',
                  }}
                >
                  {hasUnlimitedAccess
                    ? 'Not needed'
                    : actionLoading === `topup:${slug}`
                      ? 'Opening checkout...'
                      : billing?.planSlug === 'free'
                        ? 'Upgrade first'
                        : 'Buy top-up'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Recent payments</div>
        {paymentSummary.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>No payments yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {paymentSummary.map((payment) => (
              <div
                key={payment.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--border)',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>
                    {payment.kind === 'subscription' ? (payment.plan_slug ?? 'plan') : (payment.topup_slug ?? 'top-up')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    {new Date(payment.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{formatInr(payment.amount_inr)}</div>
                  <div style={{ fontSize: 11, color: payment.status === 'captured' ? '#5A8C6E' : 'var(--muted)', marginTop: 4 }}>
                    {payment.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>{value}</div>
    </div>
  )
}

const activeBadgeStyle: CSSProperties = {
  padding: '5px 10px',
  borderRadius: 999,
  background: 'var(--accent-soft)',
  border: '1px solid var(--accent-glow)',
  color: 'var(--accent)',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  height: 'fit-content',
}

const primaryActionBtnStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  width: '100%',
  padding: '11px 14px',
  borderRadius: 12,
  border: 'none',
  background: 'linear-gradient(135deg, var(--accent), #de9a4b)',
  color: '#fff',
  fontWeight: 700,
}

const secondaryActionBtnStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--glass-bg)',
  color: 'var(--text)',
  fontWeight: 700,
}
