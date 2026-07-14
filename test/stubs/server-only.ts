// Test-only stub. The real `server-only` package throws when imported outside
// a server context; under vitest we alias it here to a harmless no-op so pure
// logic inside server-guarded modules stays unit-testable.
export {}
