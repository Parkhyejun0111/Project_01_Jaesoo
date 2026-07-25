"use client";

import { GRADE_SCALE } from "@jaesoo/api-client";

/**
 * 화면 표시 헬퍼.
 *
 * ★ 성적은 **등급 1~9 이고 낮을수록 우수**하다 (약관 별표3). 백분위 시절 코드를
 *   그대로 두면 차트가 위아래로 뒤집혀 보이므로, 좌표 변환을 여기 한 곳에 둔다.
 */

export const 만원 = (won: number | null | undefined) =>
  typeof won === "number" && Number.isFinite(won)
    ? `${Math.round(won / 10_000).toLocaleString("ko-KR")}만원`
    : "—";

export const 원 = (won: number | null | undefined) =>
  typeof won === "number" && Number.isFinite(won)
    ? `${Math.round(won).toLocaleString("ko-KR")}원`
    : "—";

export const 등급 = (g: number | null | undefined) =>
  typeof g === "number" && Number.isFinite(g) ? `${g.toFixed(2)}등급` : "—";

export const 퍼센트 = (ratio: number | null | undefined, digits = 1) =>
  typeof ratio === "number" && Number.isFinite(ratio)
    ? `${(ratio * 100).toFixed(digits)}%`
    : "—";

/** 과목 고유색 (DESIGN.md — 국어 red · 수학 teal · 영어 blue · 탐구 yellow) */
export const SUBJECT_COLOR: Record<string, string> = {
  국어: "#F5604E",
  수학: "#13BCAD",
  영어: "#3B5998",
  탐구: "#FFC83B",
};

/**
 * 등급 → 차트 Y 좌표(0=위, height=아래).
 * 1등급이 맨 위에 오도록 반전한다.
 */
export function gradeToY(grade: number, height: number, pad = 6): number {
  const { min, max } = GRADE_SCALE;
  const clamped = Math.min(Math.max(grade, min), max);
  const ratio = (clamped - min) / (max - min); // 1등급 → 0, 9등급 → 1
  return pad + ratio * (height - pad * 2);
}

/** 회차 인덱스 → 차트 X 좌표 */
export function indexToX(i: number, count: number, width: number, pad = 14): number {
  if (count <= 1) return pad;
  return pad + (i * (width - pad * 2)) / (count - 1);
}

/** '고3_9월모평' → '9월모평' (차트 라벨용 축약) */
export function shortRoundLabel(label: string): string {
  const [, rest] = label.split("_");
  return rest ?? label;
}

/** '고3_9월모평' → '고3 9월모평' */
export function roundLabel(label: string): string {
  return label.replace("_", " ");
}

export const SEVERITY_TEXT: Record<string, { label: string; tone: "none" | "mild" | "severe" }> = {
  none: { label: "비대상", tone: "none" },
  mild: { label: "경증", tone: "mild" },
  severe: { label: "중증", tone: "severe" },
};

/** 약관 원문 링크 — 조항 앵커로 바로 스크롤된다 (public/policy 는 sync-policy.mjs 가 복사) */
export const POLICY_DOC = "/policy/재수없수_교육보험_보통약관_수정본.html";
export const policyLink = (anchor?: string) =>
  anchor ? `${POLICY_DOC}#${anchor}` : POLICY_DOC;
