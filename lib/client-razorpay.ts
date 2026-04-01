export interface RazorpayCheckoutOptions {
  key: string
  amount?: number
  currency?: string
  name: string
  description: string
  order_id?: string
  subscription_id?: string
  prefill?: {
    name?: string
    email?: string
  }
  notes?: Record<string, string>
  handler: (response: Record<string, string>) => void | Promise<void>
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void
    }
  }
}

let razorpayLoader: Promise<void> | null = null

export function loadRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay checkout is only available in the browser'))
  }

  if (window.Razorpay) return Promise.resolve()
  if (razorpayLoader) return razorpayLoader

  razorpayLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout script'))
    document.body.appendChild(script)
  })

  return razorpayLoader
}

export async function openRazorpayCheckout(options: RazorpayCheckoutOptions) {
  await loadRazorpayScript()

  if (!window.Razorpay) {
    throw new Error('Razorpay checkout is unavailable')
  }

  const instance = new window.Razorpay({
    key: options.key,
    amount: options.amount,
    currency: options.currency ?? 'INR',
    name: options.name,
    description: options.description,
    order_id: options.order_id,
    subscription_id: options.subscription_id,
    prefill: options.prefill,
    notes: options.notes,
    handler: options.handler,
    method: {
      upi: true,
      card: true,
      netbanking: true,
      wallet: true,
      emi: false,
    },
    config: {
      display: {
        preferences: {
          show_default_blocks: true,
        },
      },
    },
    theme: {
      color: '#C47A3A',
    },
  })

  instance.open()
}
