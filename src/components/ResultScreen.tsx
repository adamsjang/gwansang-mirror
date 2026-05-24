import { useEffect, useState } from 'react'
import {
  ZONES,
  FACE_SHAPE_KAG_SLUG,
  KAG_BASE_URL,
  META_LINKS,
  type FaceShape,
} from '../data/physiognomy-zones'
import {
  getZoneInterpretation,
  NO_MEASUREMENT_INTERPRETATION,
  FACE_SHAPE_INTERPRETATIONS,
  ADVANCED_INTERPRETATIONS,
} from '../data/interpretations'
import type { ZoneMeasurement, AdvancedMeasurement } from '../lib/measurements'
import { track } from '../lib/analytics'
import { buildShareImage, shareOrDownload } from '../lib/share-image'

interface Props {
  faceShape: FaceShape
  measurements: ZoneMeasurement[]
  advanced: AdvancedMeasurement[]
  captureDataUrl: string
  onRetake: () => void
  onExit: () => void
}

type Archetype = 'balance' | 'single' | 'cumulative' | 'mismatch'

interface DerivedArchetype {
  archetype: Archetype
  primary?: ZoneMeasurement
  secondary?: ZoneMeasurement
}

const ZONE_PERIOD: Record<string, string> = {
  forehead: '초년',
  eyebrow: '30대 초',
  eyes: '30~40대',
  cheekbone: '40대',
  nose: '중년',
  philtrum: '50대',
  mouth: '50대 후',
  jaw: '말년',
}

const ZONE_SHORT_NAME: Record<string, string> = {
  forehead: '이마',
  eyebrow: '눈썹 간격',
  eyes: '눈',
  cheekbone: '광대',
  nose: '코',
  philtrum: '인중',
  mouth: '입',
  jaw: '턱',
}

function zoneTag(zoneId: string): string {
  const name = ZONE_SHORT_NAME[zoneId] ?? zoneId
  const period = ZONE_PERIOD[zoneId]
  return period ? `${name}(${period})` : name
}

function levelTone(level: 'low' | 'mid' | 'high'): string {
  if (level === 'low') return '평균보다 조용한 편'
  if (level === 'high') return '평균보다 두드러진 편'
  return '평균'
}

function deriveArchetype(measurements: ZoneMeasurement[]): DerivedArchetype {
  const offMid = measurements
    .filter((m) => m.level !== 'mid')
    .sort((a, b) => Math.abs(b.ratio - 0.5) - Math.abs(a.ratio - 0.5))
  if (offMid.length === 0) return { archetype: 'balance' }
  if (offMid.length === 1) return { archetype: 'single', primary: offMid[0] }
  const sameDir = offMid[0].level === offMid[1].level
  return {
    archetype: sameDir ? 'cumulative' : 'mismatch',
    primary: offMid[0],
    secondary: offMid[1],
  }
}

function levelDotColor(level: 'low' | 'mid' | 'high') {
  if (level === 'mid') return '#6B5744'
  return '#8B6914'
}

function CombinatorialPreview({ derived }: { derived: DerivedArchetype }) {
  const { archetype, primary, secondary } = derived

  if (archetype === 'balance') {
    return (
      <p className="text-sm text-[var(--color-secondary)] leading-relaxed">
        모든 부위가 평균 범위 안에 머무는 <strong className="text-[var(--color-primary)]">조화로운 균형형</strong>입니다.
        전통 관상에서는 이런 균형이 오히려 드물게 다뤄지는데 — 한 사람의 삶 어디서 그 균형이
        흔들리거나 깊어지는지를…
      </p>
    )
  }

  if (archetype === 'single' && primary) {
    return (
      <p className="text-sm text-[var(--color-secondary)] leading-relaxed">
        <strong className="text-[var(--color-primary)]">{zoneTag(primary.zoneId)}</strong>만 평균에서 뚜렷이 벗어났고
        나머지는 균형 — 한 부위가 혼자 자기 색을 강하게 드러내는 조합입니다. 전통 관상에서는 이런 단일 강조가
        그 시기에 어떻게 발현되고, 다른 시기와는 어떻게 어긋나는지를…
      </p>
    )
  }

  if (archetype === 'cumulative' && primary && secondary) {
    return (
      <p className="text-sm text-[var(--color-secondary)] leading-relaxed">
        <strong className="text-[var(--color-primary)]">{zoneTag(primary.zoneId)}</strong>와{' '}
        <strong className="text-[var(--color-primary)]">{zoneTag(secondary.zoneId)}</strong>가 같은 방향으로 기운{' '}
        <strong className="text-[var(--color-primary)]">누적형 조합</strong>입니다.
        두 시기가 같은 흐름을 가리킬 때 전통 관상에서는 그 흐름이 한 사람의 삶에서 어떻게 두꺼워지고,
        어디서 한계로 작용하는지를…
      </p>
    )
  }

  if (archetype === 'mismatch' && primary && secondary) {
    return (
      <p className="text-sm text-[var(--color-secondary)] leading-relaxed">
        <strong className="text-[var(--color-primary)]">{zoneTag(primary.zoneId)}</strong>는 {levelTone(primary.level)}인데{' '}
        <strong className="text-[var(--color-primary)]">{zoneTag(secondary.zoneId)}</strong>는 {levelTone(secondary.level)} —
        두 시기가 정반대 방향을 가리키는 <strong className="text-[var(--color-primary)]">어긋남 조합</strong>입니다.
        통변(通變)은 바로 이런 어긋남이 인생 어디서 어떻게 풀려나가는지를 읽는 일인데요…
      </p>
    )
  }

  return null
}

function InterestForm({ archetype }: { archetype: Archetype }) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    track('interest_form_shown', { archetype })
  }, [archetype])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setErrorMsg('이메일 형식을 확인해 주세요.')
      return
    }
    setErrorMsg('')
    setSubmitting(true)
    track('interest_submit_attempt', { archetype })

    try {
      const res = await fetch('/api/interest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: trimmed, archetype }),
      })
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { status?: string }
        track('interest_submitted', {
          archetype,
          storage: 'backend',
          status: data.status ?? 'ok',
        })
        setSubmitted(true)
        return
      }
      // 4xx/5xx — 백엔드 거부 또는 장애. 로컬 백업.
      throw new Error(`server ${res.status}`)
    } catch {
      try {
        const existing = JSON.parse(
          localStorage.getItem('interest_emails') ?? '[]'
        ) as string[]
        if (!existing.includes(trimmed)) existing.push(trimmed)
        localStorage.setItem('interest_emails', JSON.stringify(existing))
      } catch {
        /* ignore */
      }
      track('interest_submitted', { archetype, storage: 'localStorage' })
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <p className="text-sm text-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] border border-[var(--color-accent)] rounded-lg px-4 py-3">
        관심 등록되었습니다. 정식 리포트가 준비되면 안내드리겠습니다.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
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
      {errorMsg && (
        <p role="alert" className="text-xs text-red-700 self-center">
          {errorMsg}
        </p>
      )}
    </form>
  )
}

export default function ResultScreen({
  faceShape,
  measurements,
  advanced,
  captureDataUrl,
  onRetake,
  onExit,
}: Props) {
  const measureByZone = new Map(measurements.map((m) => [m.zoneId, m]))
  const derived = deriveArchetype(measurements)
  const [sharing, setSharing] = useState(false)
  const [shareNotice, setShareNotice] = useState<string>('')

  async function handleShare() {
    if (sharing) return
    setSharing(true)
    setShareNotice('')
    track('share_clicked', { archetype: derived.archetype })
    try {
      const blob = await buildShareImage({
        captureDataUrl,
        faceShape,
        measurements,
        advanced,
      })
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const result = await shareOrDownload(blob, `gwansang-${stamp}.png`)
      track('share_completed', { result, archetype: derived.archetype })
      if (result === 'downloaded') setShareNotice('이미지를 저장했습니다.')
      else if (result === 'cancelled') setShareNotice('공유가 취소되었습니다.')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      track('share_failed', { message: message.slice(0, 200) })
      setShareNotice('이미지 생성에 실패했습니다.')
    } finally {
      setSharing(false)
    }
  }

  useEffect(() => {
    track('result_screen_viewed', {
      face_shape: faceShape.id,
      measurement_count: measurements.length,
      archetype: derived.archetype,
      primary_zone: derived.primary?.zoneId,
      primary_level: derived.primary?.level,
    })
    // measurements는 한 분석 사이클 안에서 stable. ResultScreen 마운트 시 한 번만 발화.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest mb-2 text-[var(--color-accent)]">
        3단계 · 결과
      </p>
      <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--color-primary)] mb-2">
        부위 측정 결과
      </h1>
      <p className="text-sm text-[var(--color-secondary)] leading-relaxed mb-6">
        촬영한 한 장에서 추출한 비율 측정값과 분류, 그리고 전통 관상의 해석입니다.
        학술적 정확도가 아니라 분포 기준의 상대적 위치이므로 참고용으로 보시고,
        결과를 외모 평가나 단정에 사용하지 마세요.
      </p>

      {captureDataUrl && (
        <figure className="mb-8 rounded-xl overflow-hidden border border-[var(--color-border)] bg-black">
          <img
            src={captureDataUrl}
            alt="분석에 사용된 사진 — 부위 강조 점 표시"
            className="w-full h-auto block"
          />
          <figcaption className="px-4 py-2 text-xs text-[var(--color-secondary)] bg-[var(--color-surface)]">
            노란 점 = 측정에 사용된 얼굴 부위 좌표 (브라우저 내 처리, 저장되지 않음)
          </figcaption>
        </figure>
      )}

      <section className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <p className="text-xs uppercase tracking-wider text-[var(--color-accent)] mb-2 font-semibold">
          얼굴형
        </p>
        <h2 className="text-xl font-semibold text-[var(--color-primary)] mb-1">
          {faceShape.name}
        </h2>
        <p className="text-sm text-[var(--color-secondary)] leading-relaxed mb-3">
          {FACE_SHAPE_INTERPRETATIONS[faceShape.id] ?? faceShape.description}
        </p>
        <a
          href={`${KAG_BASE_URL}/${FACE_SHAPE_KAG_SLUG}`}
          target="_blank"
          rel="noreferrer"
          onClick={() => track('kag_link_clicked', { zone: 'faceShape' })}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-secondary)] hover:text-[var(--color-accent)] underline underline-offset-2"
        >
          이 부위 전통 해석 더 깊이 보기 →
        </a>
      </section>

      <section aria-label="아홉 부위" className="grid sm:grid-cols-2 gap-3 mb-8">
        {[...ZONES]
          .sort((a, b) => a.order - b.order)
          .map((z) => {
            const m = measureByZone.get(z.id)
            const interpretation = m
              ? getZoneInterpretation(z.id, m.level)
              : NO_MEASUREMENT_INTERPRETATION[z.id] ?? null
            return (
              <article
                key={z.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
              >
                <h2 className="text-base font-semibold text-[var(--color-primary)] mb-2">
                  {z.name}
                </h2>

                {m && (
                  <div
                    className="mb-3 border-l-2 pl-3"
                    style={{ borderColor: levelDotColor(m.level) }}
                  >
                    <p className="text-xs text-[var(--color-secondary)] mb-0.5">{m.ratioLabel}</p>
                    <p className="text-sm text-[var(--color-primary)]">
                      <span className="font-semibold tabular-nums">{(m.ratio * 100).toFixed(1)}%</span>
                      <span className="mx-2 text-[var(--color-secondary)]">·</span>
                      <span style={{ color: levelDotColor(m.level), fontWeight: 600 }}>
                        {m.description}
                      </span>
                    </p>
                  </div>
                )}

                {interpretation && (
                  <p className="text-sm text-[var(--color-primary)] leading-relaxed mb-3">
                    {interpretation}
                  </p>
                )}

                <a
                  href={`${KAG_BASE_URL}/${z.kagSlug}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => track('kag_link_clicked', { zone: z.id })}
                  className="text-xs text-[var(--color-secondary)] hover:text-[var(--color-accent)] underline underline-offset-2"
                >
                  이 부위 전통 해석 더 깊이 보기 →
                </a>
              </article>
            )
          })}
      </section>

      {/* 정밀 측정 (β) — 각도 기반 sub-measurements */}
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
                    style={{ color: levelDotColor(a.level) }}
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
          캡처 사진과 부위 분류 결과를 한 장의 이미지로 저장하거나 SNS·메신저로
          공유할 수 있습니다. 이미지에 통합 해석 텍스트는 포함되지 않습니다.
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
          <p
            role="status"
            aria-live="polite"
            className="mt-2 text-xs text-[var(--color-secondary)]"
          >
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
          여러 부위의 조합 — 진짜 관상가가 보는 통변(通變)
        </p>

        <div className="mb-4 p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
          <CombinatorialPreview derived={derived} />
          <p className="mt-2 text-xs text-[var(--color-secondary)] italic">
            이 뒤로 부위 조합 해석 + 캡처 이미지 + 측정값을 정리한 정식 리포트(PDF/PNG)가
            이어집니다. 관심 있으시면 출시 안내를 받아 보세요.
          </p>
        </div>

        <InterestForm archetype={derived.archetype} />
      </section>

      <section
        aria-label="관상 관점"
        className="grid sm:grid-cols-2 gap-3 mb-8 pt-6 border-t border-[var(--color-border)]"
      >
        {[META_LINKS.whatIs, META_LINKS.selfUnderstanding].map((mi) => (
          <a
            key={mi.slug}
            href={`${KAG_BASE_URL}/${mi.slug}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => track('kag_link_clicked', { zone: `meta:${mi.slug}` })}
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
        측정값은 한국인 평균 분포를 기준으로 한 대략 비교일 뿐, 학술적 정확도가
        아닙니다. 관상은 단정의 잣대가 아니라 자기 이해의 한 관점입니다. 본 결과를
        외모 평가나 차별에 사용하지 마세요. 카메라 영상은 본 페이지 내에서만
        처리되어 외부로 전송되지 않았습니다.
      </p>
    </div>
  )
}
