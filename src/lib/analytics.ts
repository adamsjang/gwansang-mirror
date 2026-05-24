import posthog from 'posthog-js'

let initialized = false

/** PostHog 초기화. 키가 없으면 no-op (개발 환경 등에서 안전). */
export function initAnalytics(): void {
  if (initialized) return
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined
  if (!key) return
  const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://eu.i.posthog.com'
  try {
    posthog.init(key, {
      api_host: host,
      capture_pageview: true,
      autocapture: false,
      person_profiles: 'identified_only',
    })
    initialized = true
  } catch {
    // PostHog init 실패해도 앱은 정상 동작해야 함
  }
}

export function track(event: string, props?: Record<string, unknown>): void {
  if (!initialized) return
  try {
    posthog.capture(event, props)
  } catch {
    /* ignore */
  }
}
