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

/** 청구에 쓰는 등록 카드 (jaesoo_registered_cards). 뒤 4자리만 저장한다. */
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
      /** 200 + { error } 응답이라도 쓸 만한 본문이면 성공으로 넘긴다 (폴백 결과 보존) */
      keepBodyOnError?: (data: Record<string, unknown>) => boolean;
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
    userId: string | number,
    opts?: { activeOnly?: boolean },
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
