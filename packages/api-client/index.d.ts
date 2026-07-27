export type ApiResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; kind?: "http" | "network" | "abort" | "stale" | "backend" | "unsupported" };

export interface TierRow {
  tier: string;
  form: string;
  monthly_cost: number;
  cover_rate: number;
  cover_mild: number;
  cover_severe: number;
  cover_mild_months: number;
  cover_severe_months: number;
  expected_loss: number;
  gross_annual: number;
  monthly_premium: number;
  remaining_months: number;
}

export interface TiersResponse {
  tiers: TierRow[];
  remaining_months: number;
  late: number;
  theta: number;
  cover_rate: number;
}

export interface QuoteWindow {
  window: string;
  remaining_months: number;
  late: number;
  theta: number;
  premiums: Record<string, number>;
}

export interface RegionChoice {
  value: string;
  label: string;
  desc: string;
  density: number;
}

export interface PremiumComponents {
  risk_premium: number;
  expense: number;
  risk_margin: number;
}

export interface PremiumBreakdown {
  tier: string;
  monthly_premium: number;
  gross_annual: number;
  remaining_months: number;
  late: number;
  theta: number;
  coverage: { mild: number; severe: number };
  components: PremiumComponents;
  monthly_components: PremiumComponents;
  ratios: {
    loss_ratio: number;
    expense_ratio: number;
    risk_margin_ratio: number;
    combined_ratio: number;
  };
  loss_ratio_split: { mild: number; severe: number };
  late_surcharge: number;
  expense_detail: { fixed: number; commission: number; variable: number };
}

export interface Eligibility {
  status: "determined" | "pending" | "insufficient_data";
  result?: "none" | "mild" | "severe";
  severity?: string;
  eligible?: boolean;
  predicted_percentile?: number;
  actual_percentile?: number;
  mild_threshold_percentile?: number;
  severe_threshold_percentile?: number;
  predicted_grade?: number;
  actual_grade?: number;
  z?: number;
  sigma: number;
  sigma_provisional: boolean;
  mild_threshold_z: number;
  severe_threshold_z: number;
  mild_threshold_grade?: number;
  severe_threshold_grade?: number;
  coverage_limit?: number;
  cover_mild: number;
  cover_severe: number;
  judged_subjects: string[];
  subject_weights: Record<string, number>;
  observed_rounds?: number;
  required_rounds?: number;
  message?: string;
}

export interface ScoreRow {
  seq: number;
  label: string;
  /** 서비스 기준 단위 */
  percentile: number | null;
  /** 계리 판정용 환산값 (참고) */
  grade: number | null;
}

export interface ScoresResponse {
  scores: Record<string, ScoreRow[]>;
  rounds: string[];
  judged_subjects: string[];
  subject_weights: Record<string, number>;
  scale: "percentile";
}

export interface ChatSource {
  anchor: string;
  title: string;
  page: number;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  llm: boolean;
  suggestions: string[];
  provider?: string | null;
  error?: string | null;
}

export interface PolicySection {
  anchor: string;
  title: string;
  section_title?: string;
  parent_anchor?: string | null;
  text: string;
  full_text: string;
  subsections: Array<{ anchor: string; title: string; text: string }>;
  index: number;
  found: boolean;
}

/** 지역계수 분해 — 시도계수 × 구보정계수. 서울 밖은 구보정계수 1.0. */
export interface RegionCoefficient {
  sido: string | null;
  gu: string | null;
  sido_coefficient: number;
  gu_coefficient: number;
  coefficient: number;
  /** 계수 표에서 실제로 찾았는가. false 면 1.0(전국 평균)으로 떨어진 것 */
  matched_sido: boolean;
  matched_gu: boolean;
  /** 계수 캐시 자체가 없어 전부 1.0 인가 */
  fallback: boolean;
}

/** 돈워리 각주에 쓰는 출처·갱신시점. */
export interface RegionSources {
  sido: {
    provider: string;
    dataset: string;
    table_id?: string | null;
    item_name?: string | null;
    /** 사교육비조사 기준연도 */
    period?: string | null;
  };
  gu: {
    provider: string;
    dataset: string;
    realm_filter?: string | null;
    sample_size?: number | null;
  };
  /** 배치가 계수를 만든 시점 (ISO8601) */
  generated_at: string | null;
  available: boolean;
  note: string;
}

export interface RegionCoefficientTable {
  sido_coefficients: Record<string, number>;
  seoul_gu_coefficients: Record<string, number>;
  default: number;
  sources: RegionSources;
  selected?: RegionCoefficient;
}

/** 거주지 선택지 — /api/cost-forms 의 region_coefficients. */
export interface RegionCatalog {
  sido: Array<{ name: string; coefficient: number }>;
  seoul_gu: Array<{ name: string; coefficient: number }>;
  default_sido: string | null;
  default_coefficient: number;
  available: boolean;
  sources: RegionSources;
}

/** 돈워리 "왜 이 금액인가요?" 설명 + 그 근거. */
export interface DontworryExplain {
  answer: string | null;
  /** cache = 서버 캐시 히트 · llm = 새로 생성 · fallback = 템플릿 · error = 입력 오류 */
  source: "cache" | "llm" | "fallback" | "error";
  error?: string;
  breakdown?: {
    시도: string | null;
    구: string | null;
    재수유형: string;
    시도계수: number;
    구보정계수: number;
    최종지역계수: number;
    전국평균비용_만원: number;
    최종예상비용_만원: number;
    비율_퍼센트: number;
    학군지여부: boolean;
    /** 지역계수 기준시점 'YYYY-MM' */
    기준시점: string;
    지역매핑성공: boolean;
  };
}

export interface CostEstimate {
  form: string;
  note: string;
  region: string;
  adjust_pct: number;
  total: number;
  monthly: number;
  cap_monthly: number;
  covered: number;
  self_pay: number;
  voucher_pct: number;
  conversions: {
    saving_months: number;
    income_months: number;
    opportunity_ratio: number;
    tuition_semesters?: number;
    retirement_pct?: number;
  };
  used_average: { monthly_saving: boolean; monthly_income: boolean };
  unit: string;
  /** 시도(+구)를 넘겼을 때만 온다. 레거시 region 배율 경로에는 없다. */
  region_coefficient?: RegionCoefficient;
  /** 지역계수 1.0 기준(전국 평균) 총액 */
  national_total?: number;
  /** 전국 평균 대비 배율 — "O.OO배" 표시용 */
  vs_national?: number;
}

/** 등록 카드 (jaesoo_registered_cards) — 청구 1단계에서 고르는 대상. */
export interface RegisteredCard {
  id: number;
  user_id: number;
  card_company: string;
  card_last4: string;
  card_holder_name: string;
  relationship_to_student: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EnrollPayload {
  name: string;
  school?: string | null;
  grade_year?: string | null;
  track?: string | null;
  target_univ?: string | null;
  source_site?: string | null;
  tier?: string;
  region?: string;
  household_income_manwon?: number | null;
  monthly_edu_cost_manwon?: number | null;
  enrolled_at_remaining_months?: number;
  declared_subjects?: string[] | null;
  surrender_type?: string;
  monthly_saving?: number | null;
  retire_goal?: number | null;
  terms_agreed?: boolean;
  gender?: string | null;
  survey?: Record<string, unknown> | null;
}

export interface EnrollResponse {
  ok: boolean;
  student_id?: string;
  monthly_premium?: number | null;
  coverage?: { mild: number; severe: number } | null;
  remaining_months?: number;
  error?: string;
}

export declare class ApiClient {
  constructor(opts?: { base?: string; timeout?: number; fetchImpl?: typeof fetch });
  base: string;
  timeout: number;
  request<T = unknown>(
    path: string,
    opts?: {
      method?: string;
      params?: Record<string, unknown>;
      body?: unknown;
      signal?: AbortSignal;
      timeout?: number;
    },
  ): Promise<ApiResult<T>>;
  sequence<T>(key: string, fn: () => Promise<ApiResult<T>>): Promise<ApiResult<T>>;

  health(): Promise<ApiResult<{ status: string; llm: boolean; provider: string; db: boolean }>>;
  tiers(remainingMonths?: number): Promise<ApiResult<TiersResponse>>;
  quote(): Promise<ApiResult<{ windows: QuoteWindow[]; deadline: string }>>;
  regions(): Promise<ApiResult<{ regions: RegionChoice[]; default: string }>>;
  enroll(payload: EnrollPayload): Promise<ApiResult<EnrollResponse>>;
  students(): Promise<ApiResult<{ students: Array<Record<string, unknown>> }>>;
  student(id: string): Promise<ApiResult<Record<string, unknown>>>;
  scores(id: string): Promise<ApiResult<ScoresResponse>>;
  premiumBreakdown(id: string): Promise<ApiResult<PremiumBreakdown>>;
  eligibility(id: string, actualGrade?: number): Promise<ApiResult<Eligibility>>;
  renewals(id: string): Promise<ApiResult<Record<string, unknown>>>;
  costForms(): Promise<ApiResult<Record<string, unknown>>>;
  costEstimate(params?: Record<string, unknown>): Promise<ApiResult<CostEstimate>>;
  regionCoefficients(opts?: {
    sido?: string | null;
    gu?: string | null;
  }): Promise<ApiResult<RegionCoefficientTable>>;
  dontworryExplain(opts: {
    userId: string;
    재수유형: string;
    sido?: string | null;
    gu?: string | null;
    signal?: AbortSignal;
  }): Promise<ApiResult<DontworryExplain>>;
  chat(opts: {
    message: string;
    history?: Array<{ role: string; content: string }>;
    studentId?: string | null;
    signal?: AbortSignal;
  }): Promise<ApiResult<ChatResponse>>;
  policySections(anchors?: string[]): Promise<ApiResult<{ sections: PolicySection[]; toc?: unknown[] }>>;
  registerCard(payload: unknown): Promise<ApiResult<Record<string, unknown>>>;
  activeCard(userId: string): Promise<ApiResult<Record<string, unknown>>>;
  userCards(
    userId: number | string,
    opts?: { activeOnly?: boolean; limit?: number },
  ): Promise<ApiResult<{ cards: RegisteredCard[]; user_id: number }>>;
  updateCard(cardId: string, payload: unknown): Promise<ApiResult<Record<string, unknown>>>;
  createClaim(payload: unknown): Promise<ApiResult<Record<string, unknown>>>;
  claim(claimId: string): Promise<ApiResult<Record<string, unknown>>>;
  claimVerification(claimId: string): Promise<ApiResult<Record<string, unknown>>>;
  uploadReceipt(
    claimId: string | number,
    file: File | Blob,
    opts?: { kind?: "receipt" | "proof"; signal?: AbortSignal },
  ): Promise<ApiResult<Record<string, unknown>>>;
}

export declare const api: ApiClient;
export declare function resolveBase(explicit?: string): string;
export declare function won(n: number | null | undefined): string;
export declare function manwon(n: number | null | undefined): string;
export declare const SCORE_SCALE: { min: number; max: number; betterIsHigher: true; unit: "percentile" };
export declare const SEVERITY_LABEL: Record<"none" | "mild" | "severe", string>;
export declare const CLAIM_VARIANT: Record<string, string>;
export declare const CLAIM_STATUS_VARIANT: Record<string, string>;
