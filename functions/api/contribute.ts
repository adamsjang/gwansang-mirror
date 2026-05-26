/// <reference types="@cloudflare/workers-types" />

/**
 * Cloudflare Pages Function — POST /api/contribute
 *
 * 사용자가 명시 동의 후 손금 R&D 데이터셋용 익명 기여.
 * - 익명 ID = timestamp + random (사용자 식별 X)
 * - 사진(JPEG base64) + 21 keypoint + 손 모양 분류 저장
 * - KV CONTRIB_KV에 'palm:{anonId}' 키로 저장
 * - 카운터: '_meta:palm_count'
 * - 단순 비율 가드: ratelimit 없음 (라이트 트래픽 가정). 추후 필요 시 추가
 */

interface Env {
  CONTRIB_KV: KVNamespace
}

interface ContributeBody {
  imageDataUrl?: string // 'data:image/jpeg;base64,...'
  landmarks?: Array<{ x: number; y: number; z?: number }>
  handShape?: string // 'fire' | 'earth' | 'air' | 'water'
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

// 최대 사진 크기 (KV 값 25MB 한도 안전 마진)
const MAX_IMAGE_BYTES = 1_000_000 // 1MB

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: ContributeBody
  try {
    body = (await context.request.json()) as ContributeBody
  } catch {
    return jsonResponse({ error: 'invalid json' }, 400)
  }

  const img = (body.imageDataUrl ?? '').trim()
  if (!img.startsWith('data:image/jpeg;base64,') && !img.startsWith('data:image/png;base64,')) {
    return jsonResponse({ error: 'invalid image format' }, 400)
  }
  if (img.length > MAX_IMAGE_BYTES) {
    return jsonResponse({ error: 'image too large' }, 413)
  }
  if (!Array.isArray(body.landmarks) || body.landmarks.length < 21) {
    return jsonResponse({ error: 'invalid landmarks' }, 400)
  }
  if (typeof body.handShape !== 'string' || body.handShape.length > 16) {
    return jsonResponse({ error: 'invalid handShape' }, 400)
  }

  // 익명 ID
  const ts = Date.now()
  const rand = Math.random().toString(36).slice(2, 10)
  const anonId = `${ts}-${rand}`
  const key = `palm:${anonId}`

  const record = {
    anonId,
    imageDataUrl: img,
    landmarks: body.landmarks.slice(0, 21).map((p) => ({
      x: Math.round(p.x * 10000) / 10000,
      y: Math.round(p.y * 10000) / 10000,
      z: p.z !== undefined ? Math.round(p.z * 10000) / 10000 : 0,
    })),
    handShape: body.handShape,
    ts: new Date(ts).toISOString(),
    ip_country: context.request.headers.get('cf-ipcountry') ?? '',
    ua_hash: simpleHash((context.request.headers.get('user-agent') ?? '').slice(0, 256)),
  }
  await context.env.CONTRIB_KV.put(key, JSON.stringify(record))

  // 누적 카운터
  const countKey = '_meta:palm_count'
  const prev = parseInt((await context.env.CONTRIB_KV.get(countKey)) ?? '0', 10)
  await context.env.CONTRIB_KV.put(countKey, String(prev + 1))

  return jsonResponse({ status: 'ok', anonId, count: prev + 1 }, 200)
}

/** 단순 djb2 hash — UA를 그대로 저장 안 함 (익명화) */
function simpleHash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i)
  }
  return h >>> 0
}

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405)
  }
  return onRequestPost(context)
}
