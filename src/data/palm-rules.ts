/**
 * 손금 rule 라이브러리 (트랙 B).
 *
 * KAG palmistry 12글 본문을 익현 톤 그대로 또는 압축한 micro-rule들.
 * 각 rule은 (feature, value) 조건 + 해석 text + KAG link.
 *
 * 사용 패턴:
 *   evaluateRules(features) → 매칭된 Rule[] → 결과 카드들로 노출
 *
 * features는 CV (트랙 A — prior-guided line detection) 또는
 * 사용자 직접 form 입력으로 채워진다. CV 미구현 시 사용자 form으로 검증 가능.
 *
 * 분량: 4 주요선 (감정·두뇌·생명·운명) 약 30 rule. 부수 4선·언덕은 후속.
 */

export type LineExistence = 'present' | 'absent' | 'unclear'

export interface HeartLineFeatures {
  exists?: boolean
  /** 끝 위치 */
  end_position?: 'index_base' | 'middle_base' | 'between_index_middle' | 'pinky_base'
  /** 모양 */
  shape?: 'curved_up' | 'straight' | 'curved_down'
  /** 깊이·굵기 */
  depth?: 'deep' | 'shallow' | 'chain'
}

export interface BrainLineFeatures {
  exists?: boolean
  /** 생명선과의 시작점 관계 */
  start_relation?: 'connected_to_life' | 'separated_from_life'
  /** 길이 */
  length?: 'short' | 'mid' | 'long'
  /** 방향·모양 */
  shape?: 'straight' | 'sloping_down'
}

export interface LifeLineFeatures {
  exists?: boolean
  length?: 'short' | 'mid' | 'long'
  depth?: 'deep' | 'shallow' | 'chain' | 'broken'
  /** 곡선 폭 — 엄지에서 얼마나 멀리 둘러쌈 */
  arc?: 'tight' | 'wide'
  branches?: 'with_branches' | 'none'
}

export interface FateLineFeatures {
  exists?: boolean
  /** 시작점 */
  start_position?: 'from_wrist' | 'from_middle_palm' | 'from_life_line' | 'multiple'
  /** 선명도·깊이 */
  clarity?: 'clear_deep' | 'faint' | 'broken_then_continues'
}

export interface PalmFeatures {
  hand_shape?: 'fire' | 'earth' | 'air' | 'water'
  heart_line?: HeartLineFeatures
  brain_line?: BrainLineFeatures
  life_line?: LifeLineFeatures
  fate_line?: FateLineFeatures
}

export interface PalmRule {
  id: string
  /** 어느 영역(KAG link 기준) */
  zone: 'heart' | 'brain' | 'life' | 'fate' | 'hand_shape' | 'combo'
  /**
   * 조건 평가 함수 — features가 이 rule의 조건을 만족하면 true.
   * 함수 형태라 'A AND B' 같은 조합 조건도 표현 가능.
   */
  matches: (f: PalmFeatures) => boolean
  /** 사용자에게 보여줄 해석 텍스트 (익현 톤) */
  text: string
  /** KAG '더 깊이' link 슬러그 */
  kag_slug?: string
}

const KAG_BASE = 'https://korean-astrology-guide.pages.dev/palmistry'

/** ============================================================
 *  감정선 rules (heart line) — 12 rule
 *  ============================================================ */
const HEART_RULES: PalmRule[] = [
  {
    id: 'heart.end.index_base',
    zone: 'heart',
    matches: (f) => f.heart_line?.end_position === 'index_base',
    text: '감정선이 검지 아래까지 길게 이어지는 손은 전통 수상학에서 감정 표현이 풍부하고 이상적인 사랑을 추구하는 성향으로 봐 왔습니다. 파트너에게 깊은 헌신을 보이는 편이며 관계에 대한 기대가 높을 수 있습니다.',
    kag_slug: 'heart-line',
  },
  {
    id: 'heart.end.middle_base',
    zone: 'heart',
    matches: (f) => f.heart_line?.end_position === 'middle_base',
    text: '감정선이 중지 아래에서 끝나는 손은 현실적이고 직접적인 감정 표현 경향으로 봅니다. 감정보다 실질적인 행동으로 애정을 표현하는 방식을 선호하는 성향과 연결됩니다.',
    kag_slug: 'heart-line',
  },
  {
    id: 'heart.end.between',
    zone: 'heart',
    matches: (f) => f.heart_line?.end_position === 'between_index_middle',
    text: '감정선이 검지와 중지 사이에서 끝나는 손은 감정적 이상과 현실 사이에서 균형을 맞추려는 성향으로 해석합니다. 지나치게 이상적이거나 지나치게 현실적이지 않은 유연한 태도를 나타냅니다.',
    kag_slug: 'heart-line',
  },
  {
    id: 'heart.end.pinky_base',
    zone: 'heart',
    matches: (f) => f.heart_line?.end_position === 'pinky_base',
    text: '감정선이 새끼 아래에서 짧게 끝나는 손은 감정을 외부에 잘 드러내지 않고 내면에서 처리하는 성향, 또는 관계에서 독립적인 공간을 중시하는 경향으로 봐 왔습니다.',
    kag_slug: 'heart-line',
  },
  {
    id: 'heart.shape.curved_up',
    zone: 'heart',
    matches: (f) => f.heart_line?.shape === 'curved_up',
    text: '위로 굽어 올라가는 감정선은 감정 표현이 따뜻하고 긍정적이며 관계에서 밝은 에너지를 발산하는 경향으로 해석합니다. 웃음과 애정 표현이 자연스러운 성향과 연결됩니다.',
    kag_slug: 'heart-line',
  },
  {
    id: 'heart.shape.straight',
    zone: 'heart',
    matches: (f) => f.heart_line?.shape === 'straight',
    text: '거의 직선으로 이어지는 감정선은 감정을 논리적으로 처리하거나 절제하는 경향이 있다고 봅니다. 관계에서 이성적 판단을 우선시하며 감정 기복이 적은 흐름과 연결됩니다.',
    kag_slug: 'heart-line',
  },
  {
    id: 'heart.shape.curved_down',
    zone: 'heart',
    matches: (f) => f.heart_line?.shape === 'curved_down',
    text: '아래로 살짝 굽어 내려가는 감정선은 감정을 안으로 담아두는 성향, 감수성이 깊지만 표현에는 신중한 편으로 해석합니다.',
    kag_slug: 'heart-line',
  },
  {
    id: 'heart.depth.deep',
    zone: 'heart',
    matches: (f) => f.heart_line?.depth === 'deep',
    text: '깊고 굵은 감정선은 감정의 강도가 높고 관계에 깊이 몰입하는 성향으로 봐 왔습니다. 한 번 사랑하면 깊게 빠져드는 경향과 함께, 감정의 기복도 클 수 있다는 점을 같이 참고합니다.',
    kag_slug: 'heart-line',
  },
  {
    id: 'heart.depth.shallow',
    zone: 'heart',
    matches: (f) => f.heart_line?.depth === 'shallow',
    text: '얕고 가는 감정선은 감정 표현이 섬세하거나 조심스러운 편으로 봅니다. 자신의 감정을 외부에 쉽게 드러내지 않거나 관계에서 신중하게 마음을 여는 성향과 연결됩니다.',
    kag_slug: 'heart-line',
  },
  {
    id: 'heart.depth.chain',
    zone: 'heart',
    matches: (f) => f.heart_line?.depth === 'chain',
    text: '사슬 모양으로 이어지는 감정선은 감정적으로 불안정하거나 관계에서 확신을 갖기 어려운 시기가 있을 수 있다는 의미로 참고합니다.',
    kag_slug: 'heart-line',
  },
]

/** ============================================================
 *  두뇌선 rules (brain line) — 8 rule
 *  ============================================================ */
const BRAIN_RULES: PalmRule[] = [
  {
    id: 'brain.start.connected',
    zone: 'brain',
    matches: (f) => f.brain_line?.start_relation === 'connected_to_life',
    text: '두뇌선이 생명선과 시작점에서 붙어 있는 손은 신중하고 가족·환경의 영향을 받으며 결정을 내리는 성향으로 봅니다. 협력적이고 안정 지향적인 사고 스타일과 연결됩니다.',
    kag_slug: 'brain-line',
  },
  {
    id: 'brain.start.separated',
    zone: 'brain',
    matches: (f) => f.brain_line?.start_relation === 'separated_from_life',
    text: '두뇌선과 생명선이 시작점에서 분리되어 있는 손은 독립적이고 자기 결정을 일찍 내리는 기질로 봐 왔습니다. 자기 길을 스스로 정하는 성향, 행동력 있는 사고와 연결됩니다.',
    kag_slug: 'brain-line',
  },
  {
    id: 'brain.length.short',
    zone: 'brain',
    matches: (f) => f.brain_line?.length === 'short',
    text: '짧게 끝나는 두뇌선은 생각보다 행동을 앞세우는 성향으로 해석합니다. 빠른 판단과 즉각적인 실행을 선호하고 긴 숙고보다 현실에서 바로 검증하는 방식을 좋아하는 편입니다.',
    kag_slug: 'brain-line',
  },
  {
    id: 'brain.length.mid',
    zone: 'brain',
    matches: (f) => f.brain_line?.length === 'mid',
    text: '손바닥 중앙까지 이어지는 두뇌선은 현실과 상상력 사이에서 균형을 이루는 사고 방식으로 봅니다. 지나치게 몽상적이거나 즉흥적이지 않은 안정적인 판단 스타일과 연결됩니다.',
    kag_slug: 'brain-line',
  },
  {
    id: 'brain.length.long',
    zone: 'brain',
    matches: (f) => f.brain_line?.length === 'long',
    text: '새끼 방향으로 길게 이어지는 두뇌선은 깊이 있는 사고, 넓은 상상력, 세부 사항에 집중하는 성향으로 봐 왔습니다. 창의적·예술적 분야에서 능력을 발휘하는 흐름과 연결됩니다.',
    kag_slug: 'brain-line',
  },
  {
    id: 'brain.shape.straight',
    zone: 'brain',
    matches: (f) => f.brain_line?.shape === 'straight',
    text: '직선으로 이어지는 두뇌선은 논리적이고 분석적인 사고 방식, 현실적인 판단을 중시하는 성향으로 해석합니다. 데이터와 근거를 바탕으로 결정하는 체계적 접근과 연결됩니다.',
    kag_slug: 'brain-line',
  },
  {
    id: 'brain.shape.sloping',
    zone: 'brain',
    matches: (f) => f.brain_line?.shape === 'sloping_down',
    text: '아래쪽으로 굽어지는 두뇌선은 직관적이고 감성적인 사고 방식으로 해석합니다. 상상력이 풍부하고 감정적 맥락에서 판단하는 경향, 예술·철학적 성향과 연결됩니다.',
    kag_slug: 'brain-line',
  },
]

/** ============================================================
 *  생명선 rules (life line) — 8 rule
 *  ============================================================ */
const LIFE_RULES: PalmRule[] = [
  {
    id: 'life.length.long',
    zone: 'life',
    matches: (f) => f.life_line?.length === 'long',
    text: '손목까지 길게 이어지는 생명선은 에너지가 꾸준하고 안정적으로 유지되는 경향으로 봅니다. 활력을 일정하게 사용하는 흐름과 연결됩니다.',
    kag_slug: 'life-line',
  },
  {
    id: 'life.length.short',
    zone: 'life',
    matches: (f) => f.life_line?.length === 'short',
    text: '짧게 끝나는 듯한 생명선은 수명이 아니라 에너지를 집중적으로 쓰거나 삶의 흐름에서 큰 전환점이 있는 경향으로 봐 왔습니다. 짧은 생명선이 짧은 인생을 뜻하지 않습니다.',
    kag_slug: 'life-line',
  },
  {
    id: 'life.depth.deep',
    zone: 'life',
    matches: (f) => f.life_line?.depth === 'deep',
    text: '깊고 굵은 생명선은 강한 생명력과 체력, 뚜렷한 방향성을 나타낸다고 봅니다. 에너지를 분명한 방향으로 사용하는 성향과 연결됩니다.',
    kag_slug: 'life-line',
  },
  {
    id: 'life.depth.shallow',
    zone: 'life',
    matches: (f) => f.life_line?.depth === 'shallow',
    text: '얕고 가느다란 생명선은 에너지가 분산되거나 민감한 체질일 수 있다는 경향으로 봅니다. 컨디션 관리와 회복에 신경 쓸 필요를 시사합니다.',
    kag_slug: 'life-line',
  },
  {
    id: 'life.depth.chain',
    zone: 'life',
    matches: (f) => f.life_line?.depth === 'chain',
    text: '사슬 모양으로 이어지는 생명선은 에너지 기복이 있거나 건강 관리에 주의가 필요한 시기가 있을 수 있다는 의미로 참고합니다.',
    kag_slug: 'life-line',
  },
  {
    id: 'life.depth.broken',
    zone: 'life',
    matches: (f) => f.life_line?.depth === 'broken',
    text: '중간에 끊겼다가 다시 이어지는 생명선은 큰 변화나 전환점, 삶의 방향이 크게 달라지는 시기를 상징한다고 보는 해석이 있습니다.',
    kag_slug: 'life-line',
  },
  {
    id: 'life.arc.wide',
    zone: 'life',
    matches: (f) => f.life_line?.arc === 'wide',
    text: '엄지에서 멀리 둘러싸는 넓은 곡선의 생명선은 활동 반경이 넓고 바깥 세상에서 에너지를 얻는 외향적 흐름으로 봐 왔습니다.',
    kag_slug: 'life-line',
  },
  {
    id: 'life.arc.tight',
    zone: 'life',
    matches: (f) => f.life_line?.arc === 'tight',
    text: '엄지에 가까운 좁은 곡선의 생명선은 내면을 깊이 다스리는 성향, 조용한 환경에서 에너지를 보존하는 흐름과 연결됩니다.',
    kag_slug: 'life-line',
  },
  {
    id: 'life.branches',
    zone: 'life',
    matches: (f) => f.life_line?.branches === 'with_branches',
    text: '생명선에서 가지처럼 분기되어 나오는 선이 있다면 에너지의 확장이나 새로운 방향으로의 전환을 나타낸다고 봅니다. 평행하게 이어지는 이중 생명선은 강한 보호 에너지나 조력자의 역할을 시사하기도 합니다.',
    kag_slug: 'life-line',
  },
]

/** ============================================================
 *  운명선 rules (fate line) — 8 rule
 *  ============================================================ */
const FATE_RULES: PalmRule[] = [
  {
    id: 'fate.absent',
    zone: 'fate',
    matches: (f) => f.fate_line?.exists === false,
    text: '운명선이 뚜렷하지 않거나 보이지 않는 손은 특정 방향에 구애받지 않고 자유롭게 자신의 길을 개척하는 성향으로 해석합니다. 운명선이 없다는 것이 불운을 의미하지 않습니다.',
    kag_slug: 'fate-line',
  },
  {
    id: 'fate.start.wrist',
    zone: 'fate',
    matches: (f) => f.fate_line?.start_position === 'from_wrist',
    text: '손목 가까이에서 길게 시작하는 운명선은 어릴 때부터 목표 의식이 뚜렷하고 일찍 진로를 잡아 꾸준히 나아가는 성향으로 봐 왔습니다. 한 방향에 오래 집중하는 흐름과 연결됩니다.',
    kag_slug: 'fate-line',
  },
  {
    id: 'fate.start.middle',
    zone: 'fate',
    matches: (f) => f.fate_line?.start_position === 'from_middle_palm',
    text: '손바닥 중간에서 시작하는 운명선은 중년 이후 방향을 잡거나 커리어 전환이 일어나는 흐름으로 참고합니다. 다양한 경험 후 자신의 길을 발견하는 경향과 연결됩니다.',
    kag_slug: 'fate-line',
  },
  {
    id: 'fate.start.life',
    zone: 'fate',
    matches: (f) => f.fate_line?.start_position === 'from_life_line',
    text: '생명선에서 분기하여 시작하는 운명선은 가족이나 주변 환경의 영향을 받으며 진로가 형성되는 성향으로 해석합니다. 가족의 기대·관계가 직업 경로와 연결되는 흐름입니다.',
    kag_slug: 'fate-line',
  },
  {
    id: 'fate.start.multiple',
    zone: 'fate',
    matches: (f) => f.fate_line?.start_position === 'multiple',
    text: '여러 개의 운명선이 나타나는 손은 다양한 분야에 관심을 두거나 부업·복수의 직업 경로를 병행하는 성향으로 참고합니다.',
    kag_slug: 'fate-line',
  },
  {
    id: 'fate.clarity.clear',
    zone: 'fate',
    matches: (f) => f.fate_line?.clarity === 'clear_deep',
    text: '선명하고 깊은 운명선은 뚜렷한 목표 의식과 직업적 추진력을 나타냅니다. 사회적 역할이나 직업 정체성을 중요하게 여기는 성향과 연결됩니다.',
    kag_slug: 'fate-line',
  },
  {
    id: 'fate.clarity.faint',
    zone: 'fate',
    matches: (f) => f.fate_line?.clarity === 'faint',
    text: '희미한 운명선은 직업적 방향의 변화나 다양한 가능성을 탐색하며 유연하게 나아가는 성향으로 해석합니다. 희미한 운명선이 나쁜 운명을 뜻하지는 않습니다.',
    kag_slug: 'fate-line',
  },
  {
    id: 'fate.clarity.broken',
    zone: 'fate',
    matches: (f) => f.fate_line?.clarity === 'broken_then_continues',
    text: '중간에 끊겼다가 다시 이어지는 운명선은 삶의 중간에 직업 전환이나 새로운 시작을 경험하는 흐름으로 참고합니다.',
    kag_slug: 'fate-line',
  },
]

/** ============================================================
 *  손 모양 rules (hand shape) — 4 rule
 *  ============================================================ */
const HAND_SHAPE_RULES: PalmRule[] = [
  {
    id: 'shape.fire',
    zone: 'hand_shape',
    matches: (f) => f.hand_shape === 'fire',
    text: '불 손 (긴 손바닥 + 짧은 손가락)은 활동적·열정적·즉흥적인 기질로 봐 왔습니다. 새 시작과 추진력이 강한 흐름과 연결됩니다.',
    kag_slug: 'hand-shape-types',
  },
  {
    id: 'shape.earth',
    zone: 'hand_shape',
    matches: (f) => f.hand_shape === 'earth',
    text: '땅 손 (사각형 손바닥 + 짧은 손가락)은 안정·실용·끈기 있는 기질로 다뤄지는 손 유형입니다. 한 분야에 꾸준히 머무는 흐름과 연결됩니다.',
    kag_slug: 'hand-shape-types',
  },
  {
    id: 'shape.air',
    zone: 'hand_shape',
    matches: (f) => f.hand_shape === 'air',
    text: '공기 손 (사각형 손바닥 + 긴 손가락)은 사고가 빠르고 분석적·사교적인 기질로 봐 온 손 유형입니다. 다양한 관계와 정보를 가꾸는 흐름과 연결됩니다.',
    kag_slug: 'hand-shape-types',
  },
  {
    id: 'shape.water',
    zone: 'hand_shape',
    matches: (f) => f.hand_shape === 'water',
    text: '물 손 (긴 손바닥 + 긴 손가락)은 감수성과 직관, 창의적 표현이 두드러지는 기질로 다뤄집니다. 감정과 영감을 자원으로 삼는 흐름과 연결됩니다.',
    kag_slug: 'hand-shape-types',
  },
]

/** ============================================================
 *  조합 rules (combo) — 두 선 이상 관계 — 4 rule
 *  ============================================================ */
const COMBO_RULES: PalmRule[] = [
  {
    id: 'combo.brain_separated_heart_curved_up',
    zone: 'combo',
    matches: (f) =>
      f.brain_line?.start_relation === 'separated_from_life' &&
      f.heart_line?.shape === 'curved_up',
    text: '두뇌선이 생명선과 분리되어 있고 감정선이 위로 굽어 올라가는 조합은 독립적인 결단력 + 따뜻한 감정 표현의 균형형으로 해석해 왔습니다. 자기 길을 가면서도 사람을 가까이 두는 흐름입니다.',
  },
  {
    id: 'combo.brain_long_heart_straight',
    zone: 'combo',
    matches: (f) => f.brain_line?.length === 'long' && f.heart_line?.shape === 'straight',
    text: '두뇌선이 길고 감정선이 직선인 조합은 분석적 사고 + 감정의 절제가 함께 작동하는 사색·논리형 기질로 봐 왔습니다. 결정에 시간이 걸리지만 흔들림이 적은 흐름입니다.',
  },
  {
    id: 'combo.life_deep_fate_clear',
    zone: 'combo',
    matches: (f) =>
      f.life_line?.depth === 'deep' && f.fate_line?.clarity === 'clear_deep',
    text: '생명선이 깊고 운명선이 선명한 조합은 활력과 방향 의식이 함께 강한 추진형으로 해석합니다. 분명한 목표를 향해 에너지를 쏟는 흐름입니다.',
  },
  {
    id: 'combo.shape_water_brain_sloping',
    zone: 'combo',
    matches: (f) =>
      f.hand_shape === 'water' && f.brain_line?.shape === 'sloping_down',
    text: '물 손 + 아래로 굽는 두뇌선의 조합은 감수성과 직관이 두드러진 예술·창의형으로 봐 왔습니다. 정보를 감정으로 흡수하고 자기 언어로 풀어내는 흐름과 연결됩니다.',
  },
]

export const PALM_RULES: PalmRule[] = [
  ...HEART_RULES,
  ...BRAIN_RULES,
  ...LIFE_RULES,
  ...FATE_RULES,
  ...HAND_SHAPE_RULES,
  ...COMBO_RULES,
]

/** features를 받아 매칭되는 rule들을 반환. */
export function evaluateRules(features: PalmFeatures): PalmRule[] {
  return PALM_RULES.filter((r) => {
    try {
      return r.matches(features)
    } catch {
      return false
    }
  })
}

/** zone 이름 → KAG 글 URL. 'combo'는 link 없음. */
export function kagUrlFor(rule: PalmRule): string | null {
  if (!rule.kag_slug) return null
  return `${KAG_BASE}/${rule.kag_slug}`
}
