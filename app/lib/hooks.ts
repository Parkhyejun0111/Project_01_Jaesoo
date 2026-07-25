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
    subjects: Record<string, { series: number[]; mean: number; volatility: number; trend: number; latest: number; judged: boolean }>;
    weak_subjects: Array<{ subject: string; volatility: number; trend: number; risk_score: number }>;
    rounds: Record<string, number | null>;
    round_order: string[];
    observed_rounds: number;
    renewable: boolean;
    band: {
      predicted_grade: number | null;
      sigma: number;
      sigma_provisional: boolean;
      z_mild: number;
      z_severe: number;
      mild_threshold_grade: number | null;
      severe_threshold_grade: number | null;
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
