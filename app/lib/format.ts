"use client";

import { SCORE_SCALE } from "@jaesoo/api-client";

/**
 * 화면 표시 헬퍼.
 *
 * ★ 성적 단위는 **백분위 0~100 이고 높을수록 우수**하다. 차트 좌표 변환을
 *   여기 한 곳에 모아 두어, 화면마다 축 방향이 어긋나지 않게 한다.
 */

export const 만원 = (won: number | null | undefined) =>
  typeof won === "number" && Number.isFinite(won)
    ? `${Math.round(won / 10_000).toLocaleString("ko-KR")}만원`
    : "—";

export const 원 = (won: number | null | undefined) =>
  typeof won === "number" && Number.isFinite(won)
    ? `${Math.round(won).toLocaleString("ko-KR")}원`
    : "—";

export const 백분위 = (p: number | null | undefined) =>
  typeof p === "number" && Number.isFinite(p) ? `${p.toFixed(1)}` : "—";

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
 * 백분위 → 차트 Y 좌표(0=위, height=아래).
 * 백분위가 높을수록 위에 오도록 뒤집는다 (100 → 위, 0 → 아래).
 */
export function percentileToY(percentile: number, height: number, pad = 6): number {
  const { min, max } = SCORE_SCALE;
  const clamped = Math.min(Math.max(percentile, min), max);
  const ratio = (max - clamped) / (max - min); // 100 → 0(위), 0 → 1(아래)
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
