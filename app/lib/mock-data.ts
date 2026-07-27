import type {
  CostEstimate,
  Eligibility,
  PremiumBreakdown,
  RegisteredCard,
  ScoresResponse,
} from "@jaesoo/api-client";

/**
 * 발표·시연 전용 계정.
 *
 * 실제 가입자 DB에는 만들지 않는다. 이 student_id 를 선택한 경우에만 화면 데이터
 * 훅과 청구 훅이 아래 로컬 데이터를 사용하며, 다른 student_id 는 기존 API·DB 경로를
 * 그대로 탄다.
 */
export const MOCK_DEMO_ACCOUNT = {
  id: "miyoung_parent",
  password: "jaesoo1234",
  studentId: "mock_jimin",
  userId: 10001,
  contractorName: "김미영",
  studentName: "김지민",
} as const;

export const isMockStudentId = (studentId: string | null | undefined) =>
  studentId === MOCK_DEMO_ACCOUNT.studentId;

export const MOCK_PREMIUM_BREAKDOWN: PremiumBreakdown = {
  tier: "플러스",
  monthly_premium: 28_517,
  gross_annual: 256_656,
  remaining_months: 9,
  late: 0.8889,
  theta: 0.3733,
  coverage: { mild: 7_014_000, severe: 14_028_000 },
  components: {
    risk_premium: 151_607,
    expense: 48_448,
    risk_margin: 56_600,
  },
  monthly_components: {
    risk_premium: 16_845,
    expense: 5_383,
    risk_margin: 6_289,
  },
  ratios: {
    loss_ratio: 0.5907,
    expense_ratio: 0.1888,
    risk_margin_ratio: 0.2205,
    combined_ratio: 0.7795,
  },
  loss_ratio_split: { mild: 0.1908, severe: 0.3999 },
  late_surcharge: 20_214,
  expense_detail: {
    fixed: 9_950,
    commission: 30_799,
    variable: 7_700,
  },
};

const ROUND_ORDER = [
  "고1_3월",
  "고1_6월",
  "고1_9월",
  "고2_3월",
  "고2_6월",
  "고2_9월",
  "고3_5월",
  "고3_6월",
  "고3_9월모평",
] as const;

const scoreRows = (
  percentiles: number[],
  grades: number[],
): ScoresResponse["scores"][string] =>
  ROUND_ORDER.map((label, index) => ({
    seq: index + 1,
    label,
    percentile: percentiles[index],
    grade: grades[index],
  }));

export const MOCK_SCORES: ScoresResponse = {
  scores: {
    국어: scoreRows(
      [80.3, 72.6, 84.6, 84.4, 76.5, 84.7, 87.0, 84.9, 83.9],
      [3.2643, 3.8143, 2.9333, 2.9556, 3.5357, 2.9222, 2.6667, 2.9, 3.0071],
    ),
    수학: scoreRows(
      [76.7, 79.2, 85.8, 83.9, 83.1, 86.9, 90.8, 99.0, 91.2],
      [3.5214, 3.3429, 2.8, 3.0071, 3.0643, 2.6778, 2.2444, 1.0, 2.2],
    ),
    영어: scoreRows(
      [69.4, 76.9, 72.2, 82.6, 86.8, 83.8, 79.4, 87.7, 96.5],
      [4.03, 3.5071, 3.8429, 3.1, 2.6889, 3.0143, 3.3286, 2.5889, 1.3],
    ),
    탐구: scoreRows(
      [75.7, 83.8, 87.6, 84.2, 84.5, 86.8, 86.4, 93.7, 86.5],
      [3.5929, 3.0143, 2.6, 2.9778, 2.9444, 2.6889, 2.7333, 1.86, 2.7222],
    ),
  },
  rounds: [...ROUND_ORDER],
  judged_subjects: ["국어", "수학", "영어", "탐구"],
  subject_weights: {
    국어: 0.2558,
    수학: 0.2745,
    영어: 0.2198,
    탐구: 0.25,
  },
  scale: "percentile",
};

export const MOCK_STUDENT_PROFILE = {
  student: {
    student_id: MOCK_DEMO_ACCOUNT.studentId,
    user_id: MOCK_DEMO_ACCOUNT.userId,
    name: MOCK_DEMO_ACCOUNT.studentName,
    contractor_name: MOCK_DEMO_ACCOUNT.contractorName,
    birth_date: "2008-04-12",
    school: "목동고등학교",
    grade_year: "고3",
    track: "자연",
    target_univ: "서울대학교 경영학과",
    source_site: "에듀패스",
    enrollment: {
      tier: "플러스",
      region: "특별시",
      academy_density_index: 4,
      household_income_manwon: 700,
      monthly_edu_cost_manwon: 90,
      enrolled_at_remaining_months: 9,
      declared_subjects: ["국어", "수학", "영어", "탐구"],
      surrender_type: "표준형",
      monthly_saving: 200,
      retire_goal: 40_000,
      terms_agreed: true,
      created_at: "2026-03-02T09:00:00+09:00",
    },
  },
  analysis: {
    subjects: {
      국어: {
        series: [80.3, 72.6, 84.6, 84.4, 76.5, 84.7, 87.0, 84.9, 83.9],
        mean: 82.1,
        volatility: 4.5,
        trend: 0.94,
        latest: 83.9,
        judged: true,
        unit: "percentile" as const,
      },
      수학: {
        series: [76.7, 79.2, 85.8, 83.9, 83.1, 86.9, 90.8, 99.0, 91.2],
        mean: 86.3,
        volatility: 6.4,
        trend: 2.17,
        latest: 91.2,
        judged: true,
        unit: "percentile" as const,
      },
      영어: {
        series: [69.4, 76.9, 72.2, 82.6, 86.8, 83.8, 79.4, 87.7, 96.5],
        mean: 81.7,
        volatility: 7.9,
        trend: 2.61,
        latest: 96.5,
        judged: true,
        unit: "percentile" as const,
      },
      탐구: {
        series: [75.7, 83.8, 87.6, 84.2, 84.5, 86.8, 86.4, 93.7, 86.5],
        mean: 85.5,
        volatility: 4.4,
        trend: 1.22,
        latest: 86.5,
        judged: true,
        unit: "percentile" as const,
      },
    },
    weak_subjects: [
      { subject: "국어", volatility: 4.5, trend: 0.94, risk_score: 1.68 },
      { subject: "탐구", volatility: 4.4, trend: 1.22, risk_score: 0.74 },
      { subject: "영어", volatility: 7.9, trend: 2.61, risk_score: 0.07 },
      { subject: "수학", volatility: 6.4, trend: 2.17, risk_score: -0.11 },
    ],
    rounds: {
      고1_3월: 75.81,
      고1_6월: 78.16,
      고1_9월: 83.81,
      고2_3월: 83.9,
      고2_6월: 82.99,
      고2_9월: 85.65,
      고3_5월: 86.58,
      고3_6월: 92.55,
      고3_9월모평: 89.95,
    },
    rounds_grade: {
      고1_3월: 3.585,
      고1_6월: 3.417,
      고1_9월: 3.013,
      고2_3월: 3.007,
      고2_6월: 3.072,
      고2_9월: 2.817,
      고3_5월: 2.713,
      고3_6월: 2.05,
      고3_9월모평: 2.339,
    },
    round_order: [...ROUND_ORDER],
    observed_rounds: 9,
    renewable: true,
    unit: "percentile" as const,
    band: {
      predicted_percentile: 86.46,
      mild_threshold_percentile: 70.63,
      severe_threshold_percentile: 63.88,
      predicted_grade: 2.726,
      mild_threshold_grade: 3.955,
      severe_threshold_grade: 4.306,
      sigma: 0.702,
      sigma_unit: "grade" as const,
      sigma_provisional: true,
      z_mild: -1.75,
      z_severe: -2.25,
    },
    judged_subjects: ["국어", "수학", "영어", "탐구"],
    subject_weights: {
      국어: 0.2558,
      수학: 0.2745,
      영어: 0.2198,
      탐구: 0.25,
    },
  },
  pricing: {
    tier: "플러스",
    remaining_months: 9,
    monthly_premium: 28_517,
    gross_annual: 256_656,
    cover_mild: 7_014_000,
    cover_severe: 14_028_000,
    breakdown: MOCK_PREMIUM_BREAKDOWN,
  },
};

export const MOCK_ELIGIBILITY: Eligibility = {
  status: "determined",
  result: "severe",
  severity: "중증",
  eligible: true,
  predicted_percentile: 86.46,
  actual_percentile: 61.8,
  mild_threshold_percentile: 70.63,
  severe_threshold_percentile: 63.88,
  predicted_grade: 2.726,
  actual_grade: 4.41,
  z: -2.399,
  sigma: 0.702,
  sigma_provisional: true,
  mild_threshold_z: -1.75,
  severe_threshold_z: -2.25,
  mild_threshold_grade: 3.955,
  severe_threshold_grade: 4.306,
  coverage_limit: 14_028_000,
  cover_mild: 7_014_000,
  cover_severe: 14_028_000,
  judged_subjects: ["국어", "수학", "영어", "탐구"],
  subject_weights: {
    국어: 0.2558,
    수학: 0.2745,
    영어: 0.2198,
    탐구: 0.25,
  },
};

export const MOCK_REGISTERED_CARDS: RegisteredCard[] = [
  {
    id: 1001,
    user_id: MOCK_DEMO_ACCOUNT.userId,
    card_company: "신한카드",
    card_last4: "4821",
    card_holder_name: MOCK_DEMO_ACCOUNT.contractorName,
    relationship_to_student: "학부모",
    is_active: true,
    created_at: "2026-03-02T09:00:00+09:00",
    updated_at: "2026-03-02T09:00:00+09:00",
  },
];

/**
 * 지역계수 스냅샷 — 월 1회 배치가 만드는 config/region_coefficients_final.json 을
 * 시연용으로 굳혀 둔 것이다. 백엔드 없이도 지역 4탭이 그려져야 해서 넣는다.
 */
const REGION_COEFFICIENTS_SNAPSHOT =
  {
    "sido": [
      {
        "name": "서울",
        "coefficient": 1.45
      },
      {
        "name": "경기",
        "coefficient": 1.0906
      },
      {
        "name": "세종",
        "coefficient": 1.0017
      },
      {
        "name": "부산",
        "coefficient": 0.9961
      },
      {
        "name": "대구",
        "coefficient": 0.9767
      },
      {
        "name": "대전",
        "coefficient": 0.9692
      },
      {
        "name": "인천",
        "coefficient": 0.9572
      },
      {
        "name": "울산",
        "coefficient": 0.8695
      },
      {
        "name": "광주",
        "coefficient": 0.814
      },
      {
        "name": "제주",
        "coefficient": 0.8072
      },
      {
        "name": "경남",
        "coefficient": 0.7724
      },
      {
        "name": "충남",
        "coefficient": 0.7549
      },
      {
        "name": "충북",
        "coefficient": 0.741
      },
      {
        "name": "강원",
        "coefficient": 0.7277
      },
      {
        "name": "전북",
        "coefficient": 0.7255
      },
      {
        "name": "경북",
        "coefficient": 0.7186
      },
      {
        "name": "전남",
        "coefficient": 0.6752
      }
    ],
    "seoul_gu": [
      {
        "name": "강남구",
        "coefficient": 1.4242
      },
      {
        "name": "서초구",
        "coefficient": 1.3166
      },
      {
        "name": "양천구",
        "coefficient": 1.153
      },
      {
        "name": "종로구",
        "coefficient": 1.0964
      },
      {
        "name": "중구",
        "coefficient": 1.0008
      },
      {
        "name": "마포구",
        "coefficient": 0.9998
      },
      {
        "name": "성동구",
        "coefficient": 0.9742
      },
      {
        "name": "서대문구",
        "coefficient": 0.9647
      },
      {
        "name": "노원구",
        "coefficient": 0.9581
      },
      {
        "name": "송파구",
        "coefficient": 0.9343
      },
      {
        "name": "성북구",
        "coefficient": 0.9298
      },
      {
        "name": "동대문구",
        "coefficient": 0.9227
      },
      {
        "name": "강서구",
        "coefficient": 0.9225
      },
      {
        "name": "동작구",
        "coefficient": 0.9199
      },
      {
        "name": "광진구",
        "coefficient": 0.9154
      },
      {
        "name": "영등포구",
        "coefficient": 0.9106
      },
      {
        "name": "강동구",
        "coefficient": 0.9085
      },
      {
        "name": "용산구",
        "coefficient": 0.9002
      },
      {
        "name": "은평구",
        "coefficient": 0.8859
      },
      {
        "name": "금천구",
        "coefficient": 0.8574
      },
      {
        "name": "관악구",
        "coefficient": 0.8507
      },
      {
        "name": "중랑구",
        "coefficient": 0.8378
      },
      {
        "name": "도봉구",
        "coefficient": 0.8189
      },
      {
        "name": "구로구",
        "coefficient": 0.7827
      },
      {
        "name": "강북구",
        "coefficient": 0.7818
      }
    ],
    "default_sido": "경기",
    "default_coefficient": 1.0,
    "available": true,
    "sources": {
      "sido": {
        "provider": "통계청 KOSIS",
        "dataset": "학교급 및 시도별 학생 1인당 월평균 사교육비",
        "table_id": "DT_1PE105",
        "item_name": "평균",
        "period": "2025"
      },
      "gu": {
        "provider": "서울 열린데이터광장",
        "dataset": "neisAcademyInfo",
        "realm_filter": "입시.검정 및 보습",
        "sample_size": 3449
      },
      "generated_at": "2026-07-27T17:17:48+09:00",
      "available": true,
      "note": "시도 배율은 연 1회 공표되는 사교육비조사, 서울 내 구간 보정은 월 1회 재수집한다."
    },
    "groups": [
      {
        "key": "seoul_edu",
        "label": "서울 학군지",
        "desc": "강남·서초·목동 등",
        "sido": "서울",
        "items": [
          {
            "name": "강남구",
            "coefficient": 1.4242
          },
          {
            "name": "서초구",
            "coefficient": 1.3166
          },
          {
            "name": "양천구",
            "coefficient": 1.153
          }
        ]
      },
      {
        "key": "seoul_other",
        "label": "서울 비학군지",
        "desc": "서울 그 외 자치구",
        "sido": "서울",
        "items": [
          {
            "name": "종로구",
            "coefficient": 1.0964
          },
          {
            "name": "중구",
            "coefficient": 1.0008
          },
          {
            "name": "마포구",
            "coefficient": 0.9998
          },
          {
            "name": "성동구",
            "coefficient": 0.9742
          },
          {
            "name": "서대문구",
            "coefficient": 0.9647
          },
          {
            "name": "노원구",
            "coefficient": 0.9581
          },
          {
            "name": "송파구",
            "coefficient": 0.9343
          },
          {
            "name": "성북구",
            "coefficient": 0.9298
          },
          {
            "name": "동대문구",
            "coefficient": 0.9227
          },
          {
            "name": "강서구",
            "coefficient": 0.9225
          },
          {
            "name": "동작구",
            "coefficient": 0.9199
          },
          {
            "name": "광진구",
            "coefficient": 0.9154
          },
          {
            "name": "영등포구",
            "coefficient": 0.9106
          },
          {
            "name": "강동구",
            "coefficient": 0.9085
          },
          {
            "name": "용산구",
            "coefficient": 0.9002
          },
          {
            "name": "은평구",
            "coefficient": 0.8859
          },
          {
            "name": "금천구",
            "coefficient": 0.8574
          },
          {
            "name": "관악구",
            "coefficient": 0.8507
          },
          {
            "name": "중랑구",
            "coefficient": 0.8378
          },
          {
            "name": "도봉구",
            "coefficient": 0.8189
          },
          {
            "name": "구로구",
            "coefficient": 0.7827
          },
          {
            "name": "강북구",
            "coefficient": 0.7818
          }
        ]
      },
      {
        "key": "metro",
        "label": "수도권",
        "desc": "경기·인천",
        "sido": null,
        "items": [
          {
            "name": "경기",
            "coefficient": 1.0906
          },
          {
            "name": "인천",
            "coefficient": 0.9572
          }
        ]
      },
      {
        "key": "local",
        "label": "지방",
        "desc": "광역시·지방권",
        "sido": null,
        "items": [
          {
            "name": "세종",
            "coefficient": 1.0017
          },
          {
            "name": "부산",
            "coefficient": 0.9961
          },
          {
            "name": "대구",
            "coefficient": 0.9767
          },
          {
            "name": "대전",
            "coefficient": 0.9692
          },
          {
            "name": "울산",
            "coefficient": 0.8695
          },
          {
            "name": "광주",
            "coefficient": 0.814
          },
          {
            "name": "제주",
            "coefficient": 0.8072
          },
          {
            "name": "경남",
            "coefficient": 0.7724
          },
          {
            "name": "충남",
            "coefficient": 0.7549
          },
          {
            "name": "충북",
            "coefficient": 0.741
          },
          {
            "name": "강원",
            "coefficient": 0.7277
          },
          {
            "name": "전북",
            "coefficient": 0.7255
          },
          {
            "name": "경북",
            "coefficient": 0.7186
          },
          {
            "name": "전남",
            "coefficient": 0.6752
          }
        ]
      }
    ]
  } as const;

export const MOCK_COST_CATALOG = {
  forms: [
    {
      name: "독학재수(독서실·인강)",
      monthly: 3.6,
      total: 36,
      cap: 70,
      voucher_pct: 100,
      note: "인강 패스 평균 기준",
    },
    {
      name: "단과 통학",
      monthly: 58.6,
      total: 586,
      cap: 100,
      voucher_pct: 60,
      note: "단과 강의료와 교재 등 부대비용 평균",
    },
    {
      name: "재수종합학원",
      monthly: 191,
      total: 1_910,
      cap: 140,
      voucher_pct: 40,
      note: "메이저 재수종합학원 평균",
    },
    {
      name: "기숙학원",
      monthly: 360,
      total: 3_600,
      cap: 200,
      voucher_pct: 20,
      note: "상위 기숙학원 평균",
    },
  ],
  default_form: "재수종합학원",
  regions: [
    { name: "서울 학군지", pct: 120, desc: "강남·목동·중계 등" },
    { name: "서울 비학군지", pct: 105, desc: "서울 그 외 지역" },
    { name: "수도권", pct: 100, desc: "경기·인천 기준" },
    { name: "지방", pct: 85, desc: "광역시·지방권" },
  ],
  default_region: "수도권",
  averages: {
    monthly_saving: 180,
    monthly_income: 660,
    semester_tuition: 355.3,
    opportunity_cost: 3_800,
  },
  options: {
    saving: [
      { label: "선택안함", value: null },
      { label: "50만원 미만", value: 25 },
      { label: "50~100", value: 75 },
      { label: "100~150", value: 125 },
      { label: "150~250", value: 200 },
      { label: "250만원 이상", value: 300 },
    ],
    sibling: [
      { label: "선택안함", value: null },
      { label: "1명", value: 1 },
      { label: "2명", value: 2 },
      { label: "3명 이상", value: 3 },
    ],
    retirement: [
      { label: "선택안함", value: null },
      { label: "1억 미만", value: 7_500 },
      { label: "1~3억", value: 20_000 },
      { label: "3~5억", value: 40_000 },
      { label: "5~7억", value: 60_000 },
      { label: "7억 이상", value: 80_000 },
    ],
    income: [
      { label: "선택안함", value: null },
      { label: "300만원 미만", value: 250 },
      { label: "300~450", value: 375 },
      { label: "450~600", value: 525 },
      { label: "600~800", value: 700 },
      { label: "800만원 이상", value: 900 },
    ],
  },
  unit: "만원",
  // 실행에 필요한 나머지 필드 — 목업이어도 CostCatalog 타입을 온전히 만족해야
  // 돈워리 지역 4탭과 "왜 이 금액인가요?" 설명이 오프라인 시연에서도 동작한다.
  // 값은 2026-07 배치 산출물(config/region_coefficients_final.json)을 그대로 옮긴 것.
  months_per_year: 10,
  region_coefficients: REGION_COEFFICIENTS_SNAPSHOT,
};

const numberOrNull = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** 돈워리 목업 계산 — 실제 costs.py 와 같은 계산식으로 입력 선택에 반응한다. */
export function getMockCostEstimate(params: Record<string, unknown>): CostEstimate {
  const form =
    MOCK_COST_CATALOG.forms.find((item) => item.name === params.form) ??
    MOCK_COST_CATALOG.forms.find((item) => item.name === MOCK_COST_CATALOG.default_form)!;
  const region =
    MOCK_COST_CATALOG.regions.find((item) => item.name === params.region) ??
    MOCK_COST_CATALOG.regions.find((item) => item.name === MOCK_COST_CATALOG.default_region)!;
  const adjustPct = numberOrNull(params.adjust_pct) ?? region.pct;
  const total = Math.round((form.total * adjustPct) / 100);
  const monthly = total / 10;
  const coveredMonth = Math.min(monthly, form.cap);
  const selfPay = Math.round((monthly - coveredMonth) * 10);
  const monthlySaving = numberOrNull(params.monthly_saving);
  const monthlyIncome = numberOrNull(params.monthly_income);
  const siblingCount = numberOrNull(params.sibling_count);
  const retireGoal = numberOrNull(params.retire_goal);
  const savingBase = monthlySaving || MOCK_COST_CATALOG.averages.monthly_saving;
  const incomeBase = monthlyIncome || MOCK_COST_CATALOG.averages.monthly_income;

  return {
    form: form.name,
    note: form.note,
    region: region.name,
    adjust_pct: adjustPct,
    total,
    monthly: Math.round(monthly * 10) / 10,
    cap_monthly: form.cap,
    covered: total - selfPay,
    self_pay: selfPay,
    voucher_pct: form.voucher_pct,
    conversions: {
      saving_months: Math.max(Math.round(total / savingBase), 1),
      income_months: Math.round(total / incomeBase),
      opportunity_ratio: Math.round((total / MOCK_COST_CATALOG.averages.opportunity_cost) * 1_000) / 10,
      ...(siblingCount && siblingCount >= 2
        ? {
            tuition_semesters:
              Math.round((total / MOCK_COST_CATALOG.averages.semester_tuition) * 2) / 2,
          }
        : {}),
      ...(retireGoal ? { retirement_pct: Math.round((total / retireGoal) * 100) } : {}),
    },
    used_average: {
      monthly_saving: !monthlySaving,
      monthly_income: !monthlyIncome,
    },
    unit: "만원",
  };
}
