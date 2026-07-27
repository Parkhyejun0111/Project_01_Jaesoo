"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@jaesoo/api-client";
import type {
  ApiResult,
  ChatResponse,
  ChatSource,
  CostEstimate,
  Eligibility,
  PremiumBreakdown,
  RegisteredCard,
  ScoresResponse,
} from "@jaesoo/api-client";

/**
 * 화면이 쓰는 데이터 훅.
 *
 * 원칙
 *  · 백엔드가 없거나 느려도 화면은 뜬다 — 로딩/오류/폴백을 값으로 돌려주고,
 *    화면은 그 상태를 표시만 한다.
 *  · 목업 상수를 화면에서 지우는 대신 훅의 `fallback` 으로 옮긴다. 데모에서
 *    백엔드가 꺼져 있어도 기존 화면이 그대로 보이되, "데모 데이터" 임을 알린다.
 */

export type Loadable<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** 백엔드 응답이 아니라 폴백(데모) 값을 보고 있는가 */
  isFallback: boolean;
  reload: () => void;
};

function useLoadable<T>(
  fetcher: (() => Promise<ApiResult<T>>) | null,
  deps: unknown[],
): Loadable<T> {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({
    data: null,
    loading: Boolean(fetcher),
    error: null,
  });
  const [tick, setTick] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!fetcher) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    fetcher().then((res) => {
      if (!alive.current) return;
      if (res.ok) setState({ data: res.data, loading: false, error: null });
      else setState({ data: null, loading: false, error: res.error });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return {
    ...state,
    isFallback: !state.loading && state.data === null,
    reload: useCallback(() => setTick((t) => t + 1), []),
  };
}

// ── 학생 목록 (데모 로그인) ────────────────────────────────────────────────
export type StudentSummary = {
  student_id: string;
  name: string;
  school?: string | null;
  grade_year?: string | null;
  target_univ?: string | null;
  tier?: string | null;
};

export function useStudents() {
  const fetcher = useCallback(
    () => api.students() as Promise<ApiResult<{ students: StudentSummary[] }>>,
    [],
  );
  const res = useLoadable<{ students: StudentSummary[] }>(fetcher, []);
  return { ...res, students: res.data?.students ?? [] };
}

// ── 프로필 + 보험료 ────────────────────────────────────────────────────────
export type StudentProfile = {
  student: Record<string, unknown> & { name?: string; school?: string; target_univ?: string };
  analysis: {
    // 성적 값은 모두 백분위(0~100, 높을수록 우수)다.
    subjects: Record<
      string,
      { series: number[]; mean: number; volatility: number; trend: number; latest: number; judged: boolean; unit: "percentile" }
    >;
    weak_subjects: Array<{ subject: string; volatility: number; trend: number; risk_score: number }>;
    rounds: Record<string, number | null>;
    rounds_grade: Record<string, number | null>;
    round_order: string[];
    observed_rounds: number;
    renewable: boolean;
    unit: "percentile";
    band: {
      predicted_percentile: number | null;
      mild_threshold_percentile: number | null;
      severe_threshold_percentile: number | null;
      // 계리 판정 근거 — σ·임계값은 약관상 등급 단위다
      predicted_grade: number | null;
      mild_threshold_grade: number | null;
      severe_threshold_grade: number | null;
      sigma: number;
      sigma_unit: "grade";
      sigma_provisional: boolean;
      z_mild: number;
      z_severe: number;
    };
    judged_subjects: string[];
    subject_weights: Record<string, number>;
  };
  pricing: {
    tier: string;
    remaining_months: number;
    monthly_premium: number;
    gross_annual: number;
    cover_mild: number;
    cover_severe: number;
    breakdown: PremiumBreakdown;
  };
};

export function useStudentProfile(studentId: string | null) {
  const fetcher = useMemo(
    () => (studentId ? () => api.student(studentId) as Promise<ApiResult<StudentProfile>> : null),
    [studentId],
  );
  return useLoadable<StudentProfile>(fetcher, [studentId]);
}

export function useScores(studentId: string | null) {
  const fetcher = useMemo(
    () => (studentId ? () => api.scores(studentId) : null),
    [studentId],
  );
  return useLoadable<ScoresResponse>(fetcher, [studentId]);
}

export function usePremiumBreakdown(studentId: string | null) {
  const fetcher = useMemo(
    () => (studentId ? () => api.premiumBreakdown(studentId) : null),
    [studentId],
  );
  return useLoadable<PremiumBreakdown>(fetcher, [studentId]);
}

export function useEligibility(studentId: string | null, actualGrade?: number) {
  const fetcher = useMemo(
    () => (studentId ? () => api.eligibility(studentId, actualGrade) : null),
    [studentId, actualGrade],
  );
  return useLoadable<Eligibility>(fetcher, [studentId, actualGrade]);
}

// ── 청구 등록 카드 ─────────────────────────────────────────────────────────
/**
 * 가입자 ID — 청구 API(jaesoo_registered_cards.user_id, jaesoo_claims.user_id)가
 * 정수를 쓰는데 앱이 아는 식별자는 student_id(문자열)뿐이다. 프로필에 user_id 가
 * 있으면 그것을 쓰고, 없으면 student_id 를 해시해 안정적인 정수로 만든다.
 * 같은 학생은 항상 같은 값이 나와야 카드·청구가 이어진다.
 *
 * TODO(인증 연동): 실제 로그인이 붙으면 이 파생은 통째로 사라진다.
 */
export function deriveUserId(
  studentId: string | null,
  student?: Record<string, unknown>,
): number | null {
  if (!studentId) return null;
  const raw = student?.user_id;
  if (typeof raw === "number" && Number.isInteger(raw)) return raw;
  const hash = Array.from(studentId).reduce(
    (acc, character) => (acc * 31 + character.charCodeAt(0)) >>> 0,
    17,
  );
  return hash || 1;
}

/** 청구 1단계에서 고를 등록 카드 목록 — DB(jaesoo_registered_cards) 조회. */
export function useRegisteredCards(userId: number | null) {
  const fetcher = useMemo(
    () =>
      userId === null
        ? null
        : () => api.userCards(userId) as Promise<ApiResult<{ cards: RegisteredCard[] }>>,
    [userId],
  );
  const res = useLoadable<{ cards: RegisteredCard[] }>(fetcher, [userId]);
  return { ...res, cards: res.data?.cards ?? [] };
}

// ── 돈워리 계산기 ──────────────────────────────────────────────────────────
export type CostCatalog = {
  forms: Array<{ name: string; monthly: number; total: number; cap: number; voucher_pct: number; note: string }>;
  default_form: string;
  regions: Array<{ name: string; pct: number; desc: string }>;
  default_region: string;
  averages: Record<string, number>;
  options: Record<string, Array<{ label: string; value: number | null }>>;
  unit: string;
};

export function useCostForms() {
  const fetcher = useCallback(() => api.costForms() as Promise<ApiResult<CostCatalog>>, []);
  return useLoadable<CostCatalog>(fetcher, []);
}

export function useCostEstimate(params: Record<string, unknown> | null) {
  // 객체 아이덴티티가 매 렌더 바뀌는 것을 막기 위해 직렬화 키로 의존성을 건다
  const key = params ? JSON.stringify(params) : "";
  const fetcher = useMemo(
    () => (params ? () => api.costEstimate(params) : null),
    [key], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return useLoadable<CostEstimate>(fetcher, [key]);
}

// ── 약관 챗봇 ──────────────────────────────────────────────────────────────
export type ChatTurn = {
  who: "ai" | "me";
  text: string;
  sources?: ChatSource[];
  suggestions?: string[];
  status?: "loading" | "complete" | "error";
  /** LLM 없이 약관 발췌만으로 만든 답변인가 (백엔드 llm:false 폴백) */
  fallback?: boolean;
};

export function useChat(studentId: string | null) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const historyRef = useRef<Array<{ role: string; content: string }>>([]);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || busy) return;
      setBusy(true);
      setTurns((t) => [...t, { who: "me", text: q }, { who: "ai", text: "", status: "loading" }]);

      const res = await api.chat({ message: q, history: historyRef.current, studentId });

      setTurns((t) => {
        const next = [...t];
        const i = next.findLastIndex((x) => x.who === "ai" && x.status === "loading");
        if (i < 0) return next;
        if (!res.ok) {
          // 취소된(오래된) 요청이면 조용히 지운다
          if (res.kind === "stale") return next.slice(0, i).concat(next.slice(i + 1));
          next[i] = {
            who: "ai",
            text: "지금은 답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.",
            status: "error",
          };
          return next;
        }
        const d: ChatResponse = res.data;
        next[i] = {
          who: "ai",
          text: d.answer,
          sources: d.sources ?? [],
          suggestions: d.suggestions ?? [],
          status: "complete",
          // llm:false = LLM 호출이 실패해 약관 발췌 폴백으로 답한 경우
          fallback: d.llm === false,
        };
        return next;
      });

      if (res.ok) {
        historyRef.current = [
          ...historyRef.current,
          { role: "user", content: q },
          { role: "assistant", content: res.data.answer },
        ].slice(-8); // 최근 4턴만 유지
      }
      setBusy(false);
    },
    [busy, studentId],
  );

  const reset = useCallback(() => {
    setTurns([]);
    historyRef.current = [];
  }, []);

  return { turns, busy, ask, reset };
}

// ── 화면 전환 ──────────────────────────────────────────────────────────────
/**
 * 화면이 바뀌면 스크롤을 맨 위로 되돌린다.
 *
 * 이 앱은 라우터 없이 한 페이지 안에서 조건부 렌더로 화면을 갈아끼운다. 그래서
 * 브라우저의 스크롤 복원·초기화가 전혀 일어나지 않는다 — 목록을 내려 보다가
 * 다른 화면을 열면 그 화면도 같은 높이에서 시작해 내용 중간이 보였다.
 *
 * 문서와 앱 셸을 모두 올린다. 셸(.app-shell)은 overflow-x:hidden 때문에
 * overflow-y 가 auto 로 계산돼(CSS 표준) 상황에 따라 스크롤 주체가 될 수 있다.
 *
 * @param key 화면을 식별하는 값. 이 값이 바뀔 때만 올린다.
 */
export function useScrollToTop(key: string) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);
    document.querySelector(".app-shell")?.scrollTo(0, 0);
  }, [key]);
}

// ── 백엔드 가용성 ──────────────────────────────────────────────────────────
export function useBackendHealth() {
  const fetcher = useCallback(() => api.health(), []);
  const res = useLoadable<{ status: string; llm: boolean; provider: string; db: boolean }>(fetcher, []);
  return {
    ...res,
    online: Boolean(res.data),
    dbReady: Boolean(res.data?.db),
    llmReady: Boolean(res.data?.llm),
  };
}
