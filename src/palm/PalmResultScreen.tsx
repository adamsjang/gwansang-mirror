import { useEffect, useRef, useState } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import {
  PALM_ZONES,
  HAND_SHAPE_KAG_SLUG,
  KAG_BASE_URL,
  META_LINKS,
} from '../data/palm-zones'
import type { HandShapeResult, HandAdvancedMeasurement } from '../lib/hand-shape'
import { ADVANCED_INTERPRETATIONS } from '../data/palm-interpretations'
import { track } from '../lib/analytics'
import { buildPalmShareImage } from '../lib/share-image-palm'
import { shareOrDownload } from '../lib/share-image'

interface Props {
  handShape: HandShapeResult
  advanced: HandAdvancedMeasurement[]
  captureDataUrl: string
  landmarks: NormalizedLandmark[]
  onRetake: () => void
  onExit: () => void
}

function advLevelColor(level: 'low' | 'mid' | 'high') {
  if (level === 'mid') return '#6B5744'
  return '#8B6914'
}

/**
 * 라운드 3 골격 — 손 모양 분류 카드 + 8 손금선 placeholder 카드들 +
 * 메타 3 카드 + 재촬영/종료. 도식·자체 해석·정밀 측정·통합 잠금·공유 PNG는
 * 후속 라운드(4~6).
 */
export default function PalmResultScreen({
  handShape,
  advanced,
  captureDataUrl,
  landmarks,
  onRetake,
  onExit,
}: Props) {
  const [hoverZone, setHoverZone] = useState<string | null>(null)
  const [imageReady, setImageReady] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)

  // 공유 PNG 상태
  const [sharing, setSharing] = useState(false)
  const [shareNotice, setShareNotice] = useState('')

  // 관심 등록 상태
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [emailError, setEmailError] = useState('')

  // R&D 익명 데이터 기여 상태
  const [contribConsent, setContribConsent] = useState(false)
  const [contribSubmitting, setContribSubmitting] = useState(false)
  const [contribSubmitted, setContribSubmitted] = useState(false)
  const [contribError, setContribError] = useState('')

  async function handleContribute() {
    if (!contribConsent || contribSubmitting) return
    setContribSubmitting(true)
    setContribError('')
    track('palm_contribute_attempt', { hand_shape: handArchetype })
    try {
      const res = await fetch('/api/contribute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl: captureDataUrl,
          landmarks: landmarks.map((p) => ({ x: p.x, y: p.y, z: p.z })),
          handShape: handArchetype,
        }),
      })
      if (res.ok) {
        track('palm_contribute_completed', { hand_shape: handArchetype })
        setContribSubmitted(true)
        return
      }
      throw new Error(`server ${res.status}`)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      track('palm_contribute_failed', { message: message.slice(0, 200) })
      setContribError('기여 전송에 실패했습니다. 잠시 후 다시 시도하세요.')
    } finally {
      setContribSubmitting(false)
    }
  }

  const handArchetype = handShape.shape.id // fire/earth/air/water

  useEffect(() => {
    track('palm_interest_form_shown', { hand_shape: handArchetype })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleInterestSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setEmailError('이메일 형식을 확인해 주세요.')
      return
    }
    setEmailError('')
    setSubmitting(true)
    track('palm_interest_submit_attempt', { hand_shape: handArchetype })
    try {
      const res = await fetch('/api/interest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          source: 'palm',
          archetype: handArchetype,
        }),
      })
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { status?: string }
        track('palm_interest_submitted', {
          hand_shape: handArchetype,
          storage: 'backend',
          status: data.status ?? 'ok',
        })
        setSubmitted(true)
        return
      }
      throw new Error(`server ${res.status}`)
    } catch {
      try {
        const existing = JSON.parse(
          localStorage.getItem('interest_emails_palm') ?? '[]'
        ) as string[]
        if (!existing.includes(trimmed)) existing.push(trimmed)
        localStorage.setItem('interest_emails_palm', JSON.stringify(existing))
      } catch {
        /* ignore */
      }
      track('palm_interest_submitted', { hand_shape: handArchetype, storage: 'localStorage' })
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  const PREVIEW_BY_SHAPE: Record<string, string> = {
    fire: '활동적·열정적 기질의 손입니다. 손금 8선이 빠른 호흡과 짧은 결단으로 모이는 양상이 전통 수상학에서 자주 다뤄지는데, 이 조합이 인생 어디서 어떻게 풀려나가는지는…',
    earth:
      '안정·실용의 기질이 두드러진 손입니다. 손금이 깊고 일정한 양상으로 다뤄지는 경향이 있는데, 이 흐름이 한 사람의 삶에서 어떻게 두꺼워지는지는…',
    air: '사고·분석이 두드러진 손입니다. 손금이 가늘고 다양한 갈래로 뻗는 양상으로 봐 왔는데, 이 분포가 어느 시기에 어떻게 발현되는지는…',
    water:
      '감수성·직관의 기질이 두드러진 손입니다. 손금이 길고 부드럽게 흐르는 양상으로 다뤄지는데, 이 흐름이 인생의 어디서 깊어지는지는…',
  }

  async function handleShare() {
    if (sharing) return
    setSharing(true)
    setShareNotice('')
    track('palm_share_clicked', { hand_shape: handShape.shape.id })
    try {
      const blob = await buildPalmShareImage({
        captureDataUrl,
        handShape: handShape.shape,
      })
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const result = await shareOrDownload(blob, `sugeum-${stamp}.png`)
      track('palm_share_completed', { result, hand_shape: handShape.shape.id })
      if (result === 'downloaded') setShareNotice('이미지를 저장했습니다.')
      else if (result === 'cancelled') setShareNotice('공유가 취소되었습니다.')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      track('palm_share_failed', { message: message.slice(0, 200) })
      setShareNotice('이미지 생성에 실패했습니다.')
    } finally {
      setSharing(false)
    }
  }

  useEffect(() => {
    const canvas = overlayRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const w = img.clientWidth
    const h = img.clientHeight
    if (w === 0 || h === 0) return
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, w, h)
    ctx.lineCap = 'round'

    // 모든 8 선을 항상 옅게 표시 — hover 안 해도 손금선 위치 보임
    // hover된 선만 굵고 진하게 강조 (양방향 매칭)
    for (const zone of PALM_ZONES) {
      const [aIdx, bIdx] = zone.anchorBetween
      const a = landmarks[aIdx]
      const b = landmarks[bIdx]
      if (!a || !b) continue
      // 캡처 이미지 mirror 보정 (x = 1 - lm.x)
      const ax = (1 - a.x) * w
      const ay = a.y * h
      const bx = (1 - b.x) * w
      const by = b.y * h

      const isActive = hoverZone === zone.id
      ctx.strokeStyle = isActive
        ? 'rgba(192, 57, 43, 0.9)'
        : 'rgba(139, 105, 20, 0.45)'
      ctx.lineWidth = isActive ? 5 : 2
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
      ctx.stroke()

      // 활성 선의 양 끝에만 흰 ring 점
      if (isActive) {
        ctx.fillStyle = 'rgba(192, 57, 43, 0.95)'
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.lineWidth = 2
        for (const [px, py] of [
          [ax, ay],
          [bx, by],
        ]) {
          ctx.beginPath()
          ctx.arc(px, py, 7, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        }
      }
    }
  }, [hoverZone, landmarks, imageReady])

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest mb-2 text-[var(--color-accent)]">
        3단계 · 결과 (β)
      </p>
      <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--color-primary)] mb-2">
        손 측정 결과
      </h1>
      <p className="text-sm text-[var(--color-secondary)] leading-relaxed mb-6">
        촬영한 한 장에서 추출한 손 모양 분류와 손금선 안내입니다. 손금선의 형태·길이는
        직접 측정하지 않으며, 각 선의 자세한 해석은 운세 참고서 글로 안내됩니다.
      </p>

      {captureDataUrl && (
        <figure className="mb-8 rounded-xl overflow-hidden border border-[var(--color-border)] bg-black">
          <div className="relative">
            <img
              ref={imgRef}
              src={captureDataUrl}
              alt="분석에 사용된 손 사진"
              onLoad={() => setImageReady(true)}
              className="w-full h-auto block"
            />
            <canvas
              ref={overlayRef}
              aria-hidden="true"
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          </div>
          <figcaption className="px-4 py-2 text-xs text-[var(--color-secondary)] bg-[var(--color-surface)]">
            노란 점 = 측정에 사용된 21 keypoint. 옅은 갈색 직선 = 8 손금선의 일반적
            위치(가이드 도식). 아래 카드에 마우스 hover/탭하면 해당 선이 빨강으로
            강조됩니다. 실제 손금 선 검출은 아닙니다.
          </figcaption>
        </figure>
      )}

      <section className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <p className="text-xs uppercase tracking-wider text-[var(--color-accent)] mb-2 font-semibold">
          손 모양
        </p>
        <div className="flex items-baseline gap-3 mb-1">
          <h2 className="text-xl font-semibold text-[var(--color-primary)]">
            {handShape.shape.name}
          </h2>
          <span className="text-2xl text-[var(--color-accent)]">{handShape.shape.hanja}</span>
        </div>
        <p className="text-sm text-[var(--color-secondary)] leading-relaxed mb-3">
          {handShape.shape.description}
        </p>
        <p className="text-xs text-[var(--color-secondary)] mb-3 tabular-nums">
          손바닥 종횡비 {handShape.palmAspect.toFixed(2)} · 손가락 비율{' '}
          {handShape.fingerRatio.toFixed(2)}
        </p>
        <a
          href={`${KAG_BASE_URL}/${HAND_SHAPE_KAG_SLUG}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-secondary)] hover:text-[var(--color-accent)] underline underline-offset-2"
        >
          손 모양 4분류 자세히 보기 →
        </a>
      </section>

      <section aria-label="여덟 손금선" className="grid sm:grid-cols-2 gap-3 mb-8">
        {[...PALM_ZONES]
          .sort((a, b) => a.order - b.order)
          .map((z) => {
            const isActive = hoverZone === z.id
            return (
              <article
                key={z.id}
                onMouseEnter={() => setHoverZone(z.id)}
                onMouseLeave={() => setHoverZone((cur) => (cur === z.id ? null : cur))}
                onTouchStart={() => setHoverZone(z.id)}
                className="rounded-xl border bg-[var(--color-surface)] p-5 transition-colors cursor-pointer"
                style={{
                  borderColor: isActive ? 'var(--color-accent)' : 'var(--color-border)',
                }}
              >
                <h2 className="text-base font-semibold text-[var(--color-primary)] mb-2">
                  {z.name}
                </h2>
                <p className="text-sm text-[var(--color-primary)] leading-relaxed mb-3">
                  {z.meaning}
                </p>
                <a
                  href={`${KAG_BASE_URL}/${z.kagSlug}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => track('palm_kag_link_clicked', { zone: z.id })}
                  className="text-xs text-[var(--color-secondary)] hover:text-[var(--color-accent)] underline underline-offset-2"
                >
                  이 선 전통 해석 더 깊이 보기 →
                </a>
              </article>
            )
          })}
      </section>

      {/* 정밀 측정 (β) */}
      {advanced.length > 0 && (
        <section aria-label="정밀 측정" className="mb-8">
          <div className="flex items-baseline gap-2 mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
              정밀 측정
            </p>
            <span className="text-xs text-[var(--color-secondary)]">β</span>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {advanced.map((a) => {
              const interpretation = ADVANCED_INTERPRETATIONS[a.id]?.[a.level]
              return (
                <article
                  key={a.id}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
                >
                  <p className="text-xs text-[var(--color-secondary)] mb-1">{a.name}</p>
                  <p
                    className="text-base font-semibold mb-2"
                    style={{ color: advLevelColor(a.level) }}
                  >
                    {a.levelLabel}
                  </p>
                  {interpretation && (
                    <p className="text-xs text-[var(--color-primary)] leading-relaxed">
                      {interpretation}
                    </p>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      )}

      {/* 결과 이미지 공유 */}
      <section
        aria-label="결과 공유"
        className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)] mb-2">
          결과 공유
        </p>
        <p className="text-sm text-[var(--color-secondary)] leading-relaxed mb-3">
          캡처 손 사진과 손 모양 분류·8 손금선 안내를 한 장 이미지로 저장하거나
          SNS·메신저로 공유할 수 있습니다. 손금 선 형태는 측정하지 않은 가이드
          도식입니다.
        </p>
        <button
          type="button"
          onClick={handleShare}
          disabled={sharing}
          className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          {sharing ? '이미지 생성 중…' : '이미지 저장 / 공유'}
        </button>
        {shareNotice && (
          <p role="status" aria-live="polite" className="mt-2 text-xs text-[var(--color-secondary)]">
            {shareNotice}
          </p>
        )}
      </section>

      {/* Phase B1 — 통합 해석 잠금 + 관심 등록 */}
      <section
        aria-label="통합 해석 (정식 리포트)"
        className="mb-8 rounded-xl border-2 border-dashed border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_4%,transparent)] p-5"
      >
        <div className="flex items-center gap-2 mb-3">
          <span aria-hidden="true" className="text-[var(--color-accent)]">🔒</span>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
            통합 해석 (정식 리포트, 준비 중)
          </p>
        </div>
        <p className="text-sm font-semibold text-[var(--color-primary)] mb-3">
          손 모양 × 손금 8선 조합 — 진짜 수상가가 보는 통변(通變)
        </p>

        <div className="mb-4 p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
          <p className="text-sm text-[var(--color-secondary)] leading-relaxed">
            당신의 손은{' '}
            <strong className="text-[var(--color-primary)]">
              {handShape.shape.name} ({handShape.shape.hanja})
            </strong>{' '}
            — {PREVIEW_BY_SHAPE[handArchetype] ?? '이 조합이 전통 수상학에서 어떻게 통변되는지는…'}
          </p>
          <p className="mt-2 text-xs text-[var(--color-secondary)] italic">
            이 뒤로 손 모양과 8선 조합의 통합 해석 + 캡처 이미지 + 측정값을 정리한
            정식 리포트(PDF/PNG)가 이어집니다. 관심 있으시면 출시 안내를 받아 보세요.
          </p>
        </div>

        {submitted ? (
          <p className="text-sm text-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] border border-[var(--color-accent)] rounded-lg px-4 py-3">
            관심 등록되었습니다. 정식 리포트가 준비되면 안내드리겠습니다.
          </p>
        ) : (
          <form onSubmit={handleInterestSubmit} className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              required
              placeholder="이메일 (출시 안내용)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              aria-label="관심 등록 이메일"
              className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              {submitting ? '등록 중…' : '관심 등록'}
            </button>
            {emailError && (
              <p role="alert" className="text-xs text-red-700 self-center">
                {emailError}
              </p>
            )}
          </form>
        )}
      </section>

      {/* R&D 익명 데이터 기여 */}
      <section
        aria-label="R&D 데이터 기여"
        className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-base)] p-5"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)] mb-2">
          R&D 데이터 기여 (선택)
        </p>
        <p className="text-sm text-[var(--color-secondary)] leading-relaxed mb-3">
          손금 선 직접 인식을 위한 R&D 데이터셋에 본 분석의 손 사진과 키포인트를
          익명으로 기여하실 수 있습니다. 사용자 식별 정보(이메일·IP 정확값)는
          저장하지 않으며, 학습 모델 개발 외 용도로 사용하지 않습니다.
        </p>
        <dl className="text-xs text-[var(--color-secondary)] leading-relaxed space-y-1 mb-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3">
          <div className="flex gap-2">
            <dt className="shrink-0 w-20 font-medium text-[var(--color-primary)]">처리 항목</dt>
            <dd>손 사진(JPEG) + 21 keypoint 좌표 + 손 모양 분류</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 w-20 font-medium text-[var(--color-primary)]">처리 목적</dt>
            <dd>손금 인식 모델 학습용 데이터셋 구성</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 w-20 font-medium text-[var(--color-primary)]">익명화</dt>
            <dd>이메일·IP·User-Agent 정확값 미저장 (국가코드·해시만)</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 w-20 font-medium text-[var(--color-primary)]">외부 제공</dt>
            <dd>제3자 제공·외부 공개 없음. 학습 후 mask annotation 추가 가능</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 w-20 font-medium text-[var(--color-primary)]">철회</dt>
            <dd>익명 저장이라 개별 철회 불가 — 동의는 신중히</dd>
          </div>
        </dl>

        {contribSubmitted ? (
          <p className="text-sm text-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] border border-[var(--color-accent)] rounded-lg px-4 py-3">
            기여 감사합니다. 손금 인식 모델 개발에 활용되겠습니다.
          </p>
        ) : (
          <>
            <label className="flex items-start gap-3 text-sm text-[var(--color-primary)] mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={contribConsent}
                onChange={(e) => setContribConsent(e.target.checked)}
                disabled={contribSubmitting}
                className="mt-1 w-4 h-4 accent-[var(--color-accent)] shrink-0"
              />
              <span>
                위 처리 항목·익명화·철회 불가 조건을 확인하였으며 익명 데이터 기여에
                동의합니다.
              </span>
            </label>
            <button
              type="button"
              onClick={handleContribute}
              disabled={!contribConsent || contribSubmitting}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-semibold border border-[var(--color-accent)] text-[var(--color-accent)] transition-opacity disabled:opacity-40 hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]"
            >
              {contribSubmitting ? '기여 전송 중…' : '익명 기여 보내기'}
            </button>
            {contribError && (
              <p role="alert" className="mt-2 text-xs text-red-700">
                {contribError}
              </p>
            )}
          </>
        )}
      </section>

      <section
        aria-label="손금 관점"
        className="grid sm:grid-cols-3 gap-3 mb-8 pt-6 border-t border-[var(--color-border)]"
      >
        {[META_LINKS.basics, META_LINKS.mounts, META_LINKS.change].map((mi) => (
          <a
            key={mi.slug}
            href={`${KAG_BASE_URL}/${mi.slug}`}
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl border border-dashed border-[var(--color-border)] p-4 hover:border-[var(--color-accent)] transition-colors"
          >
            <p className="text-sm font-semibold text-[var(--color-primary)] mb-1">{mi.name}</p>
            <p className="text-xs text-[var(--color-secondary)] leading-relaxed">{mi.blurb}</p>
          </a>
        ))}
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={onRetake}
          className="flex-1 px-6 py-3 rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          다시 촬영
        </button>
        <button
          type="button"
          onClick={onExit}
          className="px-6 py-3 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
        >
          종료
        </button>
      </div>

      <p className="mt-8 text-xs text-[var(--color-secondary)] leading-relaxed">
        손금은 단정의 잣대가 아니라 자기 이해의 한 관점입니다. 본 결과를 외모 평가나
        차별에 사용하지 마세요. 카메라 영상은 본 페이지 내에서만 처리되어 외부로
        전송되지 않았습니다.
      </p>
    </div>
  )
}
