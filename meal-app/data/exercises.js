// F3 MET 카탈로그 — 계획서 3.4
//
// 필수 12종은 기능명세서에 명시된 MET 값을 그대로 옮겼다. 변경 금지.
// 확장 12종은 Compendium of Physical Activities 기준값이며 출처 재확인 대상이다
// (verified: false). 검증이 끝나면 플래그만 지운다.

export const CATALOG = [
  // ── 필수 12종 (명세 표) ─────────────────────────────────
  { id: 'walk_48',     name: '걷기 (평지 4.8km/h)',   met: 3.5,  type: 'cardio',   verified: true,  keywords: ['걷기', '산책', '워킹', 'walk'] },
  { id: 'walk_64',     name: '빠르게 걷기 (6.4km/h)', met: 5.0,  type: 'cardio',   verified: true,  keywords: ['빠르게걷기', '속보', '파워워킹', 'walk'] },
  { id: 'jog_8',       name: '조깅 (8km/h)',          met: 8.3,  type: 'cardio',   verified: true,  keywords: ['조깅', '러닝', '달리기', 'jog', 'jogging'] },
  { id: 'run_97',      name: '달리기 (9.7km/h)',      met: 9.8,  type: 'cardio',   verified: true,  keywords: ['달리기', '러닝', '전력질주', 'run'] },
  { id: 'cycle_flat',  name: '자전거 (평지)',         met: 7.5,  type: 'cardio',   verified: true,  keywords: ['자전거', '사이클', '라이딩', 'cycle', 'bike'] },
  { id: 'swim_free',   name: '수영 (자유형)',         met: 5.8,  type: 'cardio',   verified: true,  keywords: ['수영', '자유형', '접영', 'swim'] },
  { id: 'hiking',      name: '등산',                  met: 6.0,  type: 'cardio',   verified: true,  keywords: ['등산', '하이킹', '산행', 'hiking'] },
  { id: 'jumprope',    name: '줄넘기',                met: 11.8, type: 'cardio',   verified: true,  keywords: ['줄넘기', '점핑', 'jumprope'] },
  { id: 'yoga',        name: '요가',                  met: 2.5,  type: 'cardio',   verified: true,  keywords: ['요가', 'yoga'] },
  { id: 'weight_mod',  name: '웨이트 (보통 강도)',    met: 3.5,  type: 'strength', verified: true,  keywords: ['웨이트', '근력', '헬스', '기구', 'weight'] },
  { id: 'weight_high', name: '웨이트 (고강도)',       met: 6.0,  type: 'strength', verified: true,  keywords: ['웨이트', '고강도', '근력', '헬스', 'weight'] },
  { id: 'bodyweight',  name: '맨몸운동',              met: 3.8,  type: 'strength', verified: true,  keywords: ['맨몸', '푸시업', '스쿼트', '홈트', 'bodyweight'] },

  // ── 확장 후보 12종 (출처 재확인 필요) ────────────────────
  { id: 'badminton',   name: '배드민턴',              met: 5.5,  type: 'cardio',   verified: false, keywords: ['배드민턴', 'badminton'] },
  { id: 'tennis',      name: '테니스',                met: 7.3,  type: 'cardio',   verified: false, keywords: ['테니스', 'tennis'] },
  { id: 'soccer',      name: '축구',                  met: 7.0,  type: 'cardio',   verified: false, keywords: ['축구', '풋살', 'soccer'] },
  { id: 'basketball',  name: '농구',                  met: 6.5,  type: 'cardio',   verified: false, keywords: ['농구', 'basketball'] },
  { id: 'volleyball',  name: '배구',                  met: 4.0,  type: 'cardio',   verified: false, keywords: ['배구', 'volleyball'] },
  { id: 'pilates',     name: '필라테스',              met: 3.0,  type: 'cardio',   verified: false, keywords: ['필라테스', 'pilates'] },
  { id: 'spinning',    name: '스피닝',                met: 8.5,  type: 'cardio',   verified: false, keywords: ['스피닝', '실내자전거', 'spinning'] },
  { id: 'rowing',      name: '로잉머신',              met: 7.0,  type: 'cardio',   verified: false, keywords: ['로잉', '로잉머신', 'rowing'] },
  { id: 'stairs',      name: '계단 오르기',           met: 8.8,  type: 'cardio',   verified: false, keywords: ['계단', '계단오르기', 'stairs'] },
  { id: 'stretching',  name: '스트레칭',              met: 2.3,  type: 'cardio',   verified: false, keywords: ['스트레칭', 'stretching'] },
  { id: 'boxing',      name: '복싱',                  met: 7.8,  type: 'cardio',   verified: false, keywords: ['복싱', '복싱미트', 'boxing'] },
  { id: 'crossfit',    name: '크로스핏',              met: 8.0,  type: 'strength', verified: false, keywords: ['크로스핏', 'crossfit', '서킷'] },
];

export const CATALOG_BY_ID = new Map(CATALOG.map((e) => [e.id, e]));

/** keywords·name 부분 일치 검색. 로컬 데이터라 디바운스 없이 매 입력마다 호출한다. */
export function searchCatalog(query) {
  const q = String(query ?? '').trim().toLowerCase().replace(/\s/g, '');
  if (!q) return CATALOG;
  return CATALOG.filter(
    (e) =>
      e.name.toLowerCase().replace(/\s/g, '').includes(q) ||
      e.keywords.some((k) => k.toLowerCase().includes(q)),
  );
}
