"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { readHandoffId, saveStudentId } from "./session";
import {
  useBackendHealth,
  usePremiumBreakdown,
  useScores,
  useStudentProfile,
  type Loadable,
  type StudentProfile,
} from "./hooks";
import type { PremiumBreakdown, ScoresResponse } from "@jaesoo/api-client";

/**
 * 앱 전역 데이터 — 화면이 깊게 중첩돼 있어 props 로 내리면 시그니처가 크게 번진다.
 * 학생 식별자와 그에 딸린 조회 결과만 컨텍스트로 공유하고, 화면별 상태는
 * 각 컴포넌트의 지역 상태로 남긴다.
 */
type SessionValue = {
  studentId: string | null;
  setStudentId: (id: string | null) => void;
  /** 웹에서 넘어온 계약인지 (?student_id= 로 진입) */
  fromWeb: boolean;
  profile: Loadable<StudentProfile>;
  scores: Loadable<ScoresResponse>;
  breakdown: Loadable<PremiumBreakdown>;
  health: ReturnType<typeof useBackendHealth>;
  /** 개인화 데이터를 실제로 쓸 수 있는가 (백엔드 + DB + 학생 선택) */
  personalized: boolean;
};

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [studentId, setStudentIdState] = useState<string | null>(null);
  const [fromWeb, setFromWeb] = useState(false);

  // 최초 진입 — 웹 핸드오프(?student_id=) 또는 이전 세션
  useEffect(() => {
    const id = readHandoffId();
    if (id) {
      setStudentIdState(id);
      setFromWeb(typeof window !== "undefined" && window.location.search.includes("student_id"));
    }
  }, []);

  const setStudentId = useCallback((id: string | null) => {
    setStudentIdState(id);
    saveStudentId(id);
  }, []);

  const health = useBackendHealth();
  const profile = useStudentProfile(studentId);
  const scores = useScores(studentId);
  const breakdown = usePremiumBreakdown(studentId);

  const value = useMemo<SessionValue>(
    () => ({
      studentId,
      setStudentId,
      fromWeb,
      profile,
      scores,
      breakdown,
      health,
      personalized: Boolean(studentId && profile.data),
    }),
    [studentId, setStudentId, fromWeb, profile, scores, breakdown, health],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession 은 SessionProvider 안에서만 쓸 수 있습니다");
  return v;
}
