import { useMemo, useState } from 'react'
import {
  evaluateRules,
  kagUrlFor,
  type PalmFeatures,
  type PalmRule,
} from '../data/palm-rules'
import { track } from '../lib/analytics'

interface Props {
  /** 자동 분류된 손 모양 — form 초기값으로 자동 채움 */
  initialHandShape: PalmFeatures['hand_shape']
}

/** 옵션 라벨 정의 — 사용자에게 보일 한국어 + rule features 값 매핑 */
const HEART_END = [
  { value: 'index_base', label: '검지 아래까지 길게' },
  { value: 'middle_base', label: '중지 아래' },
  { value: 'between_index_middle', label: '검지와 중지 사이' },
  { value: 'pinky_base', label: '새끼 아래 짧게' },
] as const

const HEART_SHAPE = [
  { value: 'curved_up', label: '위로 굽어 올라감' },
  { value: 'straight', label: '거의 직선' },
  { value: 'curved_down', label: '아래로 살짝 굽음' },
] as const

const HEART_DEPTH = [
  { value: 'deep', label: '깊고 굵음' },
  { value: 'shallow', label: '얕고 가늘음' },
  { value: 'chain', label: '사슬 모양' },
] as const

const BRAIN_START = [
  { value: 'connected_to_life', label: '생명선과 붙어 시작' },
  { value: 'separated_from_life', label: '생명선과 분리되어 시작' },
] as const

const BRAIN_LENGTH = [
  { value: 'short', label: '짧게 끝남' },
  { value: 'mid', label: '손바닥 중앙까지' },
  { value: 'long', label: '새끼 방향으로 길게' },
] as const

const BRAIN_SHAPE = [
  { value: 'straight', label: '직선' },
  { value: 'sloping_down', label: '아래로 굽어짐' },
] as const

const LIFE_LENGTH = [
  { value: 'long', label: '손목까지 길게' },
  { value: 'short', label: '중간에 짧게 끝나는 듯' },
] as const

const LIFE_DEPTH = [
  { value: 'deep', label: '깊고 굵음' },
  { value: 'shallow', label: '얕고 가늘음' },
  { value: 'chain', label: '사슬 모양' },
  { value: 'broken', label: '중간에 끊겼다 이어짐' },
] as const

const LIFE_ARC = [
  { value: 'wide', label: '엄지에서 멀리 넓게 둘러쌈' },
  { value: 'tight', label: '엄지에 가깝게 좁게' },
] as const

const LIFE_BRANCHES = [
  { value: 'with_branches', label: '가지처럼 분기됨' },
  { value: 'none', label: '특별한 분기 없음' },
] as const

const FATE_START = [
  { value: 'from_wrist', label: '손목 근처에서 길게' },
  { value: 'from_middle_palm', label: '손바닥 중간에서' },
  { value: 'from_life_line', label: '생명선에서 분기' },
  { value: 'multiple', label: '여러 개 보임' },
] as const

const FATE_CLARITY = [
  { value: 'clear_deep', label: '선명하고 깊음' },
  { value: 'faint', label: '희미함' },
  { value: 'broken_then_continues', label: '끊겼다가 다시 이어짐' },
] as const

interface SelectRowProps<T extends string> {
  label: string
  value: T | undefined
  options: readonly { value: T; label: string }[]
  onChange: (v: T | undefined) => void
}

function SelectRow<T extends string>({ label, value, options, onChange }: SelectRowProps<T>) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-[var(--color-secondary)]">{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}
        className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
      >
        <option value="">— 선택 —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function PalmSelfInputForm({ initialHandShape }: Props) {
  const [features, setFeatures] = useState<PalmFeatures>({
    hand_shape: initialHandShape,
  })
  const [open, setOpen] = useState(false)
  const [trackedOpen, setTrackedOpen] = useState(false)

  // form open 시 1회 PostHog
  function handleToggle() {
    const next = !open
    setOpen(next)
    if (next && !trackedOpen) {
      track('palm_self_form_opened')
      setTrackedOpen(true)
    }
  }

  const matched = useMemo<PalmRule[]>(() => evaluateRules(features), [features])

  function patch<T>(set: (prev: PalmFeatures) => PalmFeatures) {
    setFeatures((prev) => set(prev))
  }

  // fate exists 별도 처리 — 'present' / 'absent' / undefined
  const fateExists = features.fate_line?.exists

  return (
    <section
      aria-label="내 손금 직접 선택"
      className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)] mb-1">
            내 손금 직접 보고 해석하기 (β)
          </p>
          <p className="text-sm text-[var(--color-primary)]">
            각 선의 모양·끝 위치를 직접 선택하면 즉시 해석이 표시됩니다.
          </p>
        </div>
        <span aria-hidden="true" className="ml-3 text-[var(--color-secondary)]">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div className="mt-5">
          <p className="text-xs text-[var(--color-secondary)] leading-relaxed mb-4">
            선의 위치·모양이 헷갈리면{' '}
            <a
              href="https://korean-astrology-guide.pages.dev/palmistry/palmistry-basics"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-accent)] underline underline-offset-2"
            >
              손금 보는 법 기초
            </a>{' '}
            글을 참고하세요. 모르는 항목은 "— 선택 —"으로 두면 됩니다.
          </p>

          {/* 감정선 */}
          <fieldset className="mb-5 border border-[var(--color-border)] rounded-lg p-4">
            <legend className="text-sm font-semibold text-[var(--color-primary)] px-2">
              감정선 (Heart line)
            </legend>
            <div className="grid sm:grid-cols-3 gap-3">
              <SelectRow
                label="끝 위치"
                value={features.heart_line?.end_position}
                options={HEART_END}
                onChange={(v) =>
                  patch((p) => ({
                    ...p,
                    heart_line: { ...p.heart_line, end_position: v },
                  }))
                }
              />
              <SelectRow
                label="모양"
                value={features.heart_line?.shape}
                options={HEART_SHAPE}
                onChange={(v) =>
                  patch((p) => ({
                    ...p,
                    heart_line: { ...p.heart_line, shape: v },
                  }))
                }
              />
              <SelectRow
                label="깊이/굵기"
                value={features.heart_line?.depth}
                options={HEART_DEPTH}
                onChange={(v) =>
                  patch((p) => ({
                    ...p,
                    heart_line: { ...p.heart_line, depth: v },
                  }))
                }
              />
            </div>
          </fieldset>

          {/* 두뇌선 */}
          <fieldset className="mb-5 border border-[var(--color-border)] rounded-lg p-4">
            <legend className="text-sm font-semibold text-[var(--color-primary)] px-2">
              두뇌선 (Head line)
            </legend>
            <div className="grid sm:grid-cols-3 gap-3">
              <SelectRow
                label="생명선과의 시작점"
                value={features.brain_line?.start_relation}
                options={BRAIN_START}
                onChange={(v) =>
                  patch((p) => ({
                    ...p,
                    brain_line: { ...p.brain_line, start_relation: v },
                  }))
                }
              />
              <SelectRow
                label="길이"
                value={features.brain_line?.length}
                options={BRAIN_LENGTH}
                onChange={(v) =>
                  patch((p) => ({
                    ...p,
                    brain_line: { ...p.brain_line, length: v },
                  }))
                }
              />
              <SelectRow
                label="모양"
                value={features.brain_line?.shape}
                options={BRAIN_SHAPE}
                onChange={(v) =>
                  patch((p) => ({
                    ...p,
                    brain_line: { ...p.brain_line, shape: v },
                  }))
                }
              />
            </div>
          </fieldset>

          {/* 생명선 */}
          <fieldset className="mb-5 border border-[var(--color-border)] rounded-lg p-4">
            <legend className="text-sm font-semibold text-[var(--color-primary)] px-2">
              생명선 (Life line)
            </legend>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <SelectRow
                label="길이"
                value={features.life_line?.length}
                options={LIFE_LENGTH}
                onChange={(v) =>
                  patch((p) => ({
                    ...p,
                    life_line: { ...p.life_line, length: v },
                  }))
                }
              />
              <SelectRow
                label="깊이/굵기"
                value={features.life_line?.depth}
                options={LIFE_DEPTH}
                onChange={(v) =>
                  patch((p) => ({
                    ...p,
                    life_line: { ...p.life_line, depth: v },
                  }))
                }
              />
              <SelectRow
                label="곡선 폭"
                value={features.life_line?.arc}
                options={LIFE_ARC}
                onChange={(v) =>
                  patch((p) => ({
                    ...p,
                    life_line: { ...p.life_line, arc: v },
                  }))
                }
              />
              <SelectRow
                label="분기"
                value={features.life_line?.branches}
                options={LIFE_BRANCHES}
                onChange={(v) =>
                  patch((p) => ({
                    ...p,
                    life_line: { ...p.life_line, branches: v },
                  }))
                }
              />
            </div>
          </fieldset>

          {/* 운명선 */}
          <fieldset className="mb-5 border border-[var(--color-border)] rounded-lg p-4">
            <legend className="text-sm font-semibold text-[var(--color-primary)] px-2">
              운명선 (Fate line)
            </legend>
            <div className="mb-3">
              <span className="text-xs font-medium text-[var(--color-secondary)] mr-3">존재 여부</span>
              <label className="mr-3 text-sm">
                <input
                  type="radio"
                  className="mr-1 accent-[var(--color-accent)]"
                  name="fate-exists"
                  checked={fateExists === true}
                  onChange={() =>
                    patch((p) => ({ ...p, fate_line: { ...p.fate_line, exists: true } }))
                  }
                />
                있음
              </label>
              <label className="mr-3 text-sm">
                <input
                  type="radio"
                  className="mr-1 accent-[var(--color-accent)]"
                  name="fate-exists"
                  checked={fateExists === false}
                  onChange={() =>
                    patch((p) => ({
                      ...p,
                      fate_line: { exists: false }, // 없으면 다른 fate 값 초기화
                    }))
                  }
                />
                없거나 안 보임
              </label>
              <label className="text-sm">
                <input
                  type="radio"
                  className="mr-1 accent-[var(--color-accent)]"
                  name="fate-exists"
                  checked={fateExists === undefined}
                  onChange={() =>
                    patch((p) => ({ ...p, fate_line: { ...p.fate_line, exists: undefined } }))
                  }
                />
                모름
              </label>
            </div>
            {fateExists === true && (
              <div className="grid sm:grid-cols-2 gap-3">
                <SelectRow
                  label="시작 위치"
                  value={features.fate_line?.start_position}
                  options={FATE_START}
                  onChange={(v) =>
                    patch((p) => ({
                      ...p,
                      fate_line: { ...p.fate_line, start_position: v },
                    }))
                  }
                />
                <SelectRow
                  label="선명도"
                  value={features.fate_line?.clarity}
                  options={FATE_CLARITY}
                  onChange={(v) =>
                    patch((p) => ({
                      ...p,
                      fate_line: { ...p.fate_line, clarity: v },
                    }))
                  }
                />
              </div>
            )}
          </fieldset>

          {/* 매칭 결과 */}
          {matched.length === 0 ? (
            <p className="text-sm text-[var(--color-secondary)] italic">
              위 항목을 선택하면 해당 손금에 대응되는 해석이 여기 표시됩니다.
            </p>
          ) : (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)] mb-3">
                선택에 따른 해석 ({matched.length})
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {matched.map((r) => {
                  const url = kagUrlFor(r)
                  return (
                    <article
                      key={r.id}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-base)] p-4"
                    >
                      <p className="text-sm text-[var(--color-primary)] leading-relaxed mb-2">
                        {r.text}
                      </p>
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => track('palm_self_rule_kag_clicked', { rule: r.id })}
                          className="text-xs text-[var(--color-secondary)] hover:text-[var(--color-accent)] underline underline-offset-2"
                        >
                          이 선 더 깊이 보기 →
                        </a>
                      )}
                    </article>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
