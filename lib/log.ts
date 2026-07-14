import 'server-only'

// Structured server-side logging. One choke point so error/warn events are
// emitted as single-line JSON (grep-able + machine-parseable in Vercel logs)
// and so a real sink (Sentry, Axiom, a log drain) can be wired in later WITHOUT
// touching the ~200 call sites. Adopt incrementally: new/edited error paths use
// logError; the rest can migrate over time.

type LogContext = Record<string, unknown>

function serializeError(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) return { message: err.message, stack: err.stack }
  return { message: typeof err === 'string' ? err : JSON.stringify(err) }
}

// `scope` is a short stable tag for the subsystem, e.g. 'agent-run',
// 'cron/weekly-digest', 'billing-webhook'. `context` is any extra structured
// fields (ids, module, etc.) — keep it free of secrets/tokens.
export function logError(scope: string, err: unknown, context: LogContext = {}): void {
  const { message, stack } = serializeError(err)
  // console.error is preserved in production builds (next.config removeConsole
  // excludes error/warn), so this always reaches the platform logs.
  console.error(JSON.stringify({ level: 'error', scope, message, ...context, stack }))
}

export function logWarn(scope: string, message: string, context: LogContext = {}): void {
  console.warn(JSON.stringify({ level: 'warn', scope, message, ...context }))
}
