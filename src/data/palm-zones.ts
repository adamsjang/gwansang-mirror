/**
 * 손금 부위 ↔ KAG palmistry 글 매핑.
 *
 * MediaPipe Hand Landmarker 21 keypoint 기반 도식. Phase 1은 손금 "선" 자체를
 * 직접 측정하지 않고, 손 모양 분류(4종) + 일반적 손금 위치 가이드 + KAG 글로의
 * 진입점만 제공한다. 손금 선 직접 인식(segmentation)은 Phase 2/3 R&D 트랙.
 *
 * KAG palmistry 글의 톤을 그대로 따른다 (익현 체).
 */

export interface PalmZone {
  id: string
  /** 한국어 부위/선 이름 */
  name: string
  /** KAG palmistry slug ('/palmistry/{slug}' 경로) */
  kagSlug: string
  /** 1줄 전통 해석 — 결과 카드 안에 들어가는 텍스트 */
  meaning: string
  /** 결과 카드 정렬 순서 */
  order: number
  /**
   * 도식 anchor — MediaPipe 21 landmark 중 두 점 인덱스의 중간점으로 표시.
   * Phase 1 가이드 도식에서 해당 선의 대표 위치 표시용 (선 자체는 그리지 않음).
   *
   * Hand Landmarker keypoint 참고:
   *  - 0: 손목
   *  - 1: 엄지 CMC, 2-4: 엄지 MCP/IP/tip
   *  - 5: 검지 base, 6-8: PIP/DIP/tip
   *  - 9: 중지 base, 10-12: PIP/DIP/tip
   *  - 13: 약지 base, 14-16: PIP/DIP/tip
   *  - 17: 새끼 base, 18-20: PIP/DIP/tip
   */
  anchorBetween: [number, number]
}

export const PALM_ZONES: PalmZone[] = [
  {
    id: 'life-line',
    name: '생명선',
    kagSlug: 'life-line',
    meaning:
      '엄지뿌리 금성구를 감싸는 선. 수명이 아니라 생명력의 질·에너지 흐름·삶의 전환점을 보는 자리입니다.',
    order: 1,
    anchorBetween: [1, 0], // 엄지 CMC ~ 손목 중간
  },
  {
    id: 'brain-line',
    name: '두뇌선',
    kagSlug: 'brain-line',
    meaning: '손바닥 가운데를 가로지르는 선. 사고 패턴과 판단 스타일을 비추는 자리입니다.',
    order: 2,
    anchorBetween: [5, 17], // 검지 base ~ 새끼 base (가로)
  },
  {
    id: 'heart-line',
    name: '감정선',
    kagSlug: 'heart-line',
    meaning: '두뇌선 위 손가락 base 아래 가로선. 감정 표현 방식과 연애 성향을 보는 자리입니다.',
    order: 3,
    anchorBetween: [8, 20], // 검지 tip ~ 새끼 tip 근처 (위쪽 가로)
  },
  {
    id: 'fate-line',
    name: '운명선',
    kagSlug: 'fate-line',
    meaning: '손목에서 중지로 올라가는 세로선. 직업 성향과 인생 방향의 흐름을 보는 자리입니다.',
    order: 4,
    anchorBetween: [0, 9], // 손목 ~ 중지 base
  },
  {
    id: 'sun-line',
    name: '태양선',
    kagSlug: 'sun-line',
    meaning: '약지 아래로 올라가는 세로선. 사회적 성취와 인정에 대한 흐름을 보는 자리입니다.',
    order: 5,
    anchorBetween: [0, 13], // 손목 ~ 약지 base
  },
  {
    id: 'mercury-line',
    name: '수성선 (건강선)',
    kagSlug: 'mercury-line-pinky',
    meaning:
      '새끼 아래로 올라가는 세로선. 의사소통과 건강을 함께 다루는 자리이며 없을 수도 있습니다.',
    order: 6,
    anchorBetween: [0, 17], // 손목 ~ 새끼 base
  },
  {
    id: 'money-line',
    name: '재물선',
    kagSlug: 'money-line',
    meaning: '약지 아래쪽의 짧은 세로선들. 재물 감각과 금전 흐름의 패턴을 보는 자리입니다.',
    order: 7,
    anchorBetween: [13, 14], // 약지 base ~ 약지 PIP 근처
  },
  {
    id: 'marriage-line',
    name: '결혼선',
    kagSlug: 'marriage-line',
    meaning:
      '새끼 base 옆 짧은 가로선들. 결혼 횟수가 아니라 관계 성향을 참고하는 자리입니다.',
    order: 8,
    anchorBetween: [17, 18], // 새끼 base ~ 새끼 PIP 근처
  },
]

/**
 * 손 모양 4분류 (서양 수상학 — Fire/Earth/Air/Water).
 * KAG hand-shape-types 글이 직접 다루는 체계.
 *
 * MediaPipe 21 keypoint로 분류:
 *  - 손바닥 종횡비 (길이/폭): 0(wrist) ↔ 9(중지 base) / 5(검지 base) ↔ 17(새끼 base)
 *      ~1.0 = 사각형 / >1.2 = 직사각형(긴)
 *  - 손가락 비율 (중지 길이 / 손바닥 길이): 9 ↔ 12 / 0 ↔ 9
 *      <0.9 = 짧음 / >0.9 = 김
 *
 *   | 손바닥 \ 손가락 | 짧음 | 김 |
 *   | 사각형           | Earth(땅) | Air(공기) |
 *   | 직사각형(긴)     | Fire(불) | Water(물) |
 */
export interface HandShape {
  id: 'fire' | 'earth' | 'air' | 'water'
  name: string
  hanja: string
  description: string
}

export const HAND_SHAPES: Record<HandShape['id'], HandShape> = {
  fire: {
    id: 'fire',
    name: '불 손',
    hanja: '火',
    description:
      '긴 손바닥과 짧은 손가락. 전통 수상학에서 활동적·열정적·즉흥적인 기질로 봐 왔습니다.',
  },
  earth: {
    id: 'earth',
    name: '땅 손',
    hanja: '土',
    description:
      '사각형 손바닥과 짧은 손가락. 안정·실용·끈기 있는 기질로 다뤄지는 손 유형입니다.',
  },
  air: {
    id: 'air',
    name: '공기 손',
    hanja: '風',
    description:
      '사각형 손바닥과 긴 손가락. 사고가 빠르고 분석적·사교적인 기질로 봐 온 손 유형입니다.',
  },
  water: {
    id: 'water',
    name: '물 손',
    hanja: '水',
    description:
      '긴 손바닥과 긴 손가락. 감수성과 직관, 창의적 표현이 두드러지는 기질로 다뤄집니다.',
  },
}

export const HAND_SHAPE_KAG_SLUG = 'hand-shape-types'

/** 메타 카드 — 항상 결과 화면 하단에 노출 */
export const META_LINKS = {
  basics: {
    slug: 'palmistry-basics',
    name: '손금 보는 법 기초 (3대 선)',
    blurb: '생명·두뇌·감정 3대 선을 처음 보는 법.',
  },
  mounts: {
    slug: 'hand-mounts-guide',
    name: '손의 언덕 (8 mounts)',
    blurb: '엄지뿌리 금성구·각 손가락 아래의 의미.',
  },
  change: {
    slug: 'palmistry-change',
    name: '손금은 바뀔까',
    blurb: '시간에 따라 변하는 손금과 그 의미.',
  },
} as const

export const KAG_BASE_URL = 'https://korean-astrology-guide.pages.dev/palmistry'
