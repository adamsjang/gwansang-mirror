import { useState } from 'react'
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
} from '../data/interpretations'
import type { ZoneMeasurement } from '../lib/measurements'

interface Props {
  faceShape: FaceShape
  measurements: ZoneMeasurement[]
  captureDataUrl: string
  onRetake: () => void
  onExit: () => void
}

function levelDotColor(level: 'low' | 'mid' | 'high') {
  if (level === 'mid') return '#6B5744'
  return '#8B6914'
}

function InterestForm() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !email.includes('@')) return
    // MVP: localStorage 저장 (demand 측정용 backend는 후속)
    try {
      const existing = JSON.parse(localStorage.getItem('interest_emails') ?? '[]') as string[]
      if (!existing.includes(email)) existing.push(email)
      localStorage.setItem('interest_emails', JSON.stringify(existing))
    } catch {
      /* ignore */
    }
    setSubmitted(true)
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
        aria-label="관심 등록 이메일"
        className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
      />
      <button
        type="submit"
        className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
        style={{ backgroundColor: 'var(--color-accent)' }}
      >
        관심 등록
      </button>
    </form>
  )
}

/**
 * 부위별 전통 관상의 발현 시기 — 통변 미리보기에 시간성을 부여하기 위함.
 * (관상학 통설; 단정 아닌 참고 기준)
 */
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

function CombinatorialPreview({ measurements }: { measurements: ZoneMeasurement[] }) {
  // 평균에서 벗어난 부위를 강한 순으로 정렬 — 단일 강조 / 같은 방향 누적 / 양방향 어긋남
  // 세 가지 패턴으로 미리보기 한 줄을 다르게 짠다.
  const offMid = measurements
    .filter((m) => m.level !== 'mid')
    .sort((a, b) => Math.abs(b.ratio - 0.5) - Math.abs(a.ratio - 0.5))

  if (offMid.length === 0) {
    return (
      <p className="text-sm text-[var(--color-secondary)] leading-relaxed">
        모든 부위가 평균 범위 안에 머무는 <strong className="text-[var(--color-primary)]">조화로운 균형형</strong>입니다.
        전통 관상에서는 이런 균형이 오히려 드물게 다뤄지는데 — 한 사람의 삶 어디서 그 균형이
        흔들리거나 깊어지는지를…
      </p>
    )
  }

  const a = offMid[0]
  const b = offMid[1]

  if (!b) {
    return (
      <p className="text-sm text-[var(--color-secondary)] leading-relaxed">
        <strong className="text-[var(--color-primary)]">{zoneTag(a.zoneId)}</strong>만 평균에서 뚜렷이 벗어났고 나머지는 균형 —
        한 부위가 혼자 자기 색을 강하게 드러내는 조합입니다. 전통 관상에서는 이런 단일 강조가
        그 시기에 어떻게 발현되고, 다른 시기와는 어떻게 어긋나는지를…
      </p>
    )
  }

  const sameDirection = a.level === b.level
  if (sameDirection) {
    return (
      <p className="text-sm text-[var(--color-secondary)] leading-relaxed">
        <strong className="text-[var(--color-primary)]">{zoneTag(a.zoneId)}</strong>와{' '}
        <strong className="text-[var(--color-primary)]">{zoneTag(b.zoneId)}</strong>가 같은 방향으로 기운{' '}
        <strong className="text-[var(--color-primary)]">누적형 조합</strong>입니다.
        두 시기가 같은 흐름을 가리킬 때 전통 관상에서는 그 흐름이 한 사람의 삶에서 어떻게 두꺼워지고,
        어디서 한계로 작용하는지를…
      </p>
    )
  }

  return (
    <p className="text-sm text-[var(--color-secondary)] leading-relaxed">
      <strong className="text-[var(--color-primary)]">{zoneTag(a.zoneId)}</strong>는 {levelTone(a.level)}인데{' '}
      <strong className="text-[var(--color-primary)]">{zoneTag(b.zoneId)}</strong>는 {levelTone(b.level)} —
      두 시기가 정반대 방향을 가리키는 <strong className="text-[var(--color-primary)]">어긋남 조합</strong>입니다.
      통변(通變)은 바로 이런 어긋남이 인생 어디서 어떻게 풀려나가는지를 읽는 일인데요…
    </p>
  )
}

export default function ResultScreen({
  faceShape,
  measurements,
  captureDataUrl,
  onRetake,
  onExit,
}: Props) {
  const measureByZone = new Map(measurements.map((m) => [m.zoneId, m]))

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
                  className="text-xs text-[var(--color-secondary)] hover:text-[var(--color-accent)] underline underline-offset-2"
                >
                  이 부위 전통 해석 더 깊이 보기 →
                </a>
              </article>
            )
          })}
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
          <CombinatorialPreview measurements={measurements} />
          <p className="mt-2 text-xs text-[var(--color-secondary)] italic">
            이 뒤로 부위 조합 해석 + 캡처 이미지 + 측정값을 정리한 정식 리포트(PDF/PNG)가
            이어집니다. 관심 있으시면 출시 안내를 받아 보세요.
          </p>
        </div>

        <InterestForm />
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
