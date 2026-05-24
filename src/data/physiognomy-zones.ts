/**
 * 관상 부위 ↔ KAG physiognomy 글 매핑.
 *
 * MediaPipe Face Landmarker 468 mesh 기준 좌표. 본 도구의 결과 텍스트는
 * 자체 생성하지 않고 KAG(korean-astrology-guide.pages.dev/physiognomy/*) 글로
 * 진입점을 제공한다.
 */

export interface PhysZone {
  id: string;
  /** 한국어 부위명 (사용자에게 보이는 라벨) */
  name: string;
  /** KAG physiognomy slug ('/physiognomy/{slug}' 경로) */
  kagSlug: string;
  /** 1줄 전통 해석 — 카메라가 보여주는 한 줄 (KAG 글의 description 압축) */
  meaning: string;
  /** MediaPipe 468 mesh 중 해당 부위의 대표 landmark indices */
  landmarkIndices: number[];
  /** 결과 카드 정렬 순서 (위→아래 얼굴 순서) */
  order: number;
}

/**
 * MediaPipe Face Landmarker 468-point mesh 참고:
 *  - 이마/이마 상단: 10 (top center), 109, 67, 297, 338, 151, 9
 *  - 눈썹 (왼/오른): 70, 63, 105, 66, 107 / 336, 296, 334, 293, 300
 *  - 눈 (왼/오른): 33, 133, 159, 145 / 263, 362, 386, 374
 *  - 코: 1 (tip), 4, 5, 6, 168, 19, 197
 *  - 입: 61 (좌끝), 291 (우끝), 13 (상중심), 14 (하중심), 17
 *  - 턱: 152 (턱끝), 175, 199, 200, 18
 *  - 광대 (왼/오른): 116, 117, 118 / 345, 346, 347
 *  - 인중: 0 (윗입술 위), 164 (코 바로 아래) — 두 점 사이 거리
 *  - 얼굴 윤곽: 10 (이마 정점), 152 (턱끝), 234 (좌 측), 454 (우 측)
 */

export const ZONES: PhysZone[] = [
  {
    id: 'forehead',
    name: '이마',
    kagSlug: 'forehead-physiognomy',
    meaning: '전통 관상에서 이마는 초년운과 사고방식이 드러나는 자리로 봅니다.',
    landmarkIndices: [10, 109, 67, 297, 338, 151, 9],
    order: 1,
  },
  {
    id: 'eyebrow',
    name: '눈썹',
    kagSlug: 'eyebrow-physiognomy',
    meaning: '눈썹은 인간관계와 추진력의 흐름을 비추는 자리로 다뤄집니다.',
    landmarkIndices: [70, 63, 105, 66, 107, 336, 296, 334, 293, 300],
    order: 2,
  },
  {
    id: 'eyes',
    name: '눈',
    kagSlug: 'eyes-physiognomy',
    meaning: '눈은 집중력과 감정 표현이 가장 분명히 드러나는 부위로 봅니다.',
    landmarkIndices: [33, 133, 159, 145, 263, 362, 386, 374],
    order: 3,
  },
  {
    id: 'ear',
    name: '귀',
    kagSlug: 'ear-physiognomy',
    meaning: '전통 관상에서 귀는 복귀(福耳)와 건강운의 자리로 다뤄집니다.',
    landmarkIndices: [234, 454, 93, 323, 132, 361],
    order: 4,
  },
  {
    id: 'nose',
    name: '코',
    kagSlug: 'nose-physiognomy',
    meaning: '코는 단순한 재물운이 아니라 의지와 자존의 자리로 해석됩니다.',
    landmarkIndices: [1, 4, 5, 6, 168, 19, 197],
    order: 5,
  },
  {
    id: 'cheekbone',
    name: '광대',
    kagSlug: 'cheekbone-reading',
    meaning: '광대는 추진력과 사회적 존재감을 드러내는 자리로 봅니다.',
    landmarkIndices: [116, 117, 118, 345, 346, 347, 50, 280],
    order: 6,
  },
  {
    id: 'philtrum',
    name: '인중',
    kagSlug: 'philtrum-reading',
    meaning: '코와 입 사이 인중은 생명력과 자녀운의 자리로 다뤄집니다.',
    landmarkIndices: [0, 164],
    order: 7,
  },
  {
    id: 'mouth',
    name: '입',
    kagSlug: 'mouth-physiognomy',
    meaning: '입은 말과 관계의 상징, 표현 방식이 드러나는 자리로 봅니다.',
    landmarkIndices: [61, 291, 13, 14, 17],
    order: 8,
  },
  {
    id: 'jaw',
    name: '턱',
    kagSlug: 'jaw-physiognomy',
    meaning: '턱은 말년운과 안정감의 자리로 해석됩니다.',
    landmarkIndices: [152, 175, 199, 200, 18, 377, 148],
    order: 9,
  },
];

/** 얼굴형은 부위 카드와 별도 — 비율 분류 결과로 매핑한다. */
export interface FaceShape {
  id: 'round' | 'oval' | 'long' | 'square';
  name: string;
  description: string;
}

export const FACE_SHAPES: Record<FaceShape['id'], FaceShape> = {
  round: {
    id: 'round',
    name: '둥근형',
    description: '얼굴 폭과 길이가 비슷하고 윤곽이 부드러운 형태.',
  },
  oval: {
    id: 'oval',
    name: '타원형',
    description: '얼굴 길이가 폭보다 조금 길고 윤곽이 부드러운 형태.',
  },
  long: {
    id: 'long',
    name: '긴 형',
    description: '얼굴 길이가 폭보다 뚜렷이 긴 형태.',
  },
  square: {
    id: 'square',
    name: '각형',
    description: '얼굴 폭이 넓고 턱선이 각진 형태.',
  },
};

export const FACE_SHAPE_KAG_SLUG = 'face-shape-reading';

/** 메타 카드 — 관상이란 / 자기이해 관점 — 결과 페이지에 항상 노출 */
export const META_LINKS = {
  whatIs: {
    slug: 'what-is-physiognomy',
    name: '관상이란 무엇인가',
    blurb: '전통 관상학의 기본 개념과 현대적 의미를 먼저 보세요.',
  },
  selfUnderstanding: {
    slug: 'physiognomy-self-understanding',
    name: '관상을 자기이해 도구로 보는 법',
    blurb: '관상은 외모 평가나 차별이 아니라 자기 성찰의 관점입니다.',
  },
} as const;

/** KAG physiognomy 글의 절대 URL 기반 (배포 시 환경 변수로도 오버라이드 가능) */
export const KAG_BASE_URL = 'https://korean-astrology-guide.pages.dev/physiognomy';
