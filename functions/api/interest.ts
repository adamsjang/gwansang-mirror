/// <reference types="@cloudflare/workers-types" />

/**
 * Cloudflare Pages Function — POST /api/interest
 *
 * 통합 해석 정식 리포트 출시 시 안내받을 이메일을 KV에 저장.
 * - 이메일은 lowercase로 normalize 후 키 'email:{addr}'에 저장
 * - 중복 방지: 이미 있으면 already 응답
 * - 카운터: '_meta:count' 키에 누적 카운트 (총 demand 신호)
 * - 마지막 30개 archetype/timestamp는 옵션으로 같이 저장 — funnel 디버깅용
 */

interface Env {
  INTEREST_KV: KVNamespace
}

interface InterestBody {
  email?: string
  archetype?: string // 'balance' | 'single' | 'cumulative' | 'mismatch' | undefined
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: InterestBody
  try {
    body = (await context.request.json()) as InterestBody
  } catch {
    return jsonResponse({ error: 'invalid json' }, 400)
  }

  const rawEmail = (body.email ?? '').trim().toLowerCase()
  if (!rawEmail || !EMAIL_RE.test(rawEmail) || rawEmail.length > 254) {
    return jsonResponse({ error: 'invalid email' }, 400)
  }

  const key = `email:${rawEmail}`
  const existing = await context.env.INTEREST_KV.get(key)
  if (existing) {
    return jsonResponse({ status: 'already' }, 200)
  }

  const record = {
    email: rawEmail,
    archetype: typeof body.archetype === 'string' ? body.archetype.slice(0, 32) : null,
    ts: new Date().toISOString(),
    ua: (context.request.headers.get('user-agent') ?? '').slice(0, 256),
    ip_country: context.request.headers.get('cf-ipcountry') ?? '',
  }
  await context.env.INTEREST_KV.put(key, JSON.stringify(record))

  // 누적 카운터 — 단순한 read-then-write로 충분 (Pages Functions 동시성 낮음)
  const countKey = '_meta:count'
  const prev = parseInt((await context.env.INTEREST_KV.get(countKey)) ?? '0', 10)
  await context.env.INTEREST_KV.put(countKey, String(prev + 1))

  return jsonResponse({ status: 'ok', count: prev + 1 }, 200)
}

/** 다른 HTTP method는 405 */
export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405)
  }
  // 위 onRequestPost가 처리하지만 fallthrough 시 호출되므로 forward
  return onRequestPost(context)
}
