// Lightweight replacement for date-fns' formatDistanceToNow. Avoids pulling in
// another dependency for what is effectively display-only copy on blog cards.
const UNITS: Array<{ limit: number; divisor: number; singular: string; plural: string }> = [
  { limit: 60, divisor: 1, singular: 'second', plural: 'seconds' },
  { limit: 3600, divisor: 60, singular: 'minute', plural: 'minutes' },
  { limit: 86400, divisor: 3600, singular: 'hour', plural: 'hours' },
  { limit: 604800, divisor: 86400, singular: 'day', plural: 'days' },
  { limit: 2629800, divisor: 604800, singular: 'week', plural: 'weeks' },
  { limit: 31557600, divisor: 2629800, singular: 'month', plural: 'months' },
]

export function formatRelativeDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))

  for (const unit of UNITS) {
    if (seconds < unit.limit) {
      const value = Math.max(1, Math.floor(seconds / unit.divisor))
      return `${value} ${value === 1 ? unit.singular : unit.plural} ago`
    }
  }

  const years = Math.max(1, Math.floor(seconds / 31557600))
  return `${years} ${years === 1 ? 'year' : 'years'} ago`
}

export function formatAbsoluteDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}
