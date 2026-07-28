"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { SessionProvider, useSession } from "@/lib/session-context";
import { api } from "@jaesoo/api-client";
import type {
  PolicySection,
  RegionCatalog,
  RegionGroup,
  RegionSources,
} from "@jaesoo/api-client";
import {
  deriveUserId,
  useChat,
  useCostEstimate,
  useCostForms,
  useDontworryExplain,
  useEligibility,
  useRegisteredCards,
  useScrollToTop,
  useStudents,
  type StudentSummary,
} from "@/lib/hooks";
import { toVariant, useClaim, type ClaimOCRResult } from "@/lib/claim";
import {
  SUBJECT_COLOR,
  indexToX,
  percentileToY,
  policyLink,
  shortRoundLabel,
  만원,
  원,
  퍼센트,
} from "@/lib/format";
import {
  Archive,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpenCheck,
  Calculator,
  CalendarDays,
  Camera,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  CreditCard,
  FileText,
  ListOrdered,
  Flag,
  GraduationCap,
  Home,
  Info,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MapPin,
  Pin,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Sun,
  Dumbbell,
  Siren,
  TriangleAlert,
  TrendingUp,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Stage = "splash" | "login" | "loading" | "app";
type Tab = "home" | "grades" | "converter" | "mypage";
type HomeScreen = "main" | "premium" | "history" | "chat";
type ClaimScreen =
  | "home"
  | "intro"
  | "step1"
  | "cardChange"
  | "step2"
  | "verifying"
  | "result"
  | "submitting"
  | "done"
  | "status"
  | "eligibilityDetail"
  | "appeal"
  | "appealDone"
  | "appealStatus"
  | "capture"
  | "scanning"
  | "ocrConfirm"
  | "scanResult"
  | "receiptQualityFail"
  | "receiptContinue";
type ClaimResultVariant = "matched" | "review" | "proof" | "rejected";
type EligibilityResult = "none" | "mild" | "severe";
type QualityScenario = "ok" | "blurry" | "dark" | "cropped" | "small_text" | "duplicate";
type ReceiptSource = "capture" | "file";
type ReceiptItem = { id: string; source: ReceiptSource; file: File; documentId?: number };
type CaptureContext = "receipt" | "proof";
type ClaimPhase = "preExam" | "postExam" | "period1" | "between" | "period2";
type ConverterScreen = "intro" | "input" | "cost" | "loading" | "result";
type GradeScreen = "intro" | "loading" | "result";
type CanvasTone = "cream-white" | "gray-white";

// TODO: 아래 studentProfile/policyInfo/paymentMethod는 로그인한 사용자의 DB 조회 결과로 교체될 임시 목데이터입니다.
const studentProfile = {
  name: "김지민",
  grade: "고3",
};

const policyInfo = {
  productName: "재수종합학원 안심 플랜",
  tier: "스탠다드",
  joinedDate: new Date(2026, 2, 2),
  coverageCapManwon: 1400,
  paymentDueDay: 12,
};

const paymentMethod = {
  provider: "신한카드",
  ownerType: "개인",
  last4: "4821",
};

// 청구 1단계(등록 카드 확인)가 보여주는 카드 목록은 DB(jaesoo_registered_cards)에서
// GET /api/cards/users/{user_id} 로 가져온다 — useRegisteredCards 훅 참고.

const qualityIssueCopy: Record<Exclude<QualityScenario, "ok">, string> = {
  blurry: "사진이 흔들렸어요. 다시 촬영해 주세요.",
  dark: "사진이 너무 어두워요. 밝은 곳에서 다시 촬영해 주세요.",
  cropped: "영수증의 결제금액 부분이 잘렸어요. 다시 촬영해 주세요.",
  small_text: "글씨가 너무 작게 나왔어요. 가까이서 다시 촬영해 주세요.",
  duplicate: "이미 등록한 영수증과 같아요. 다른 영수증을 촬영해 주세요.",
};

// ── 청구 계정 (보장 한도·기지급·잔여) ───────────────────────────────────────
// 한도·보장금은 세션 프로필(가입정보 → 계리 엔진 산출값)에서 오고, 지급 이력은
// 아직 청구 DB 조회가 없어 시연 단계(phase)에 따라 한도 비율로 파생한다.
// TODO(청구 연동): 지급 이력이 DB에 쌓이면 useClaimAccount 안의 firstPaidManwon
//   파생만 GET /api/claims/{id} · /api/claims/{id}/verification 결과로 교체하면 된다.
//   화면들은 전부 이 훅만 바라보므로 다른 곳은 손댈 필요가 없다.
type ClaimAccount = {
  /** 총 보장 한도 (중증 보장금, 만원) */
  capManwon: number;
  /** 경증 보장금 (만원) */
  mildCapManwon: number;
  /** 1차 청구 지급액 (만원) */
  firstPaidManwon: number;
  /** 2차 청구 지급(예정)액 (만원) */
  secondPaidManwon: number;
  tier: string;
};

// 1차·2차 모두 6개월치 결제 내역을 청구한다(12~5월 / 6~11월) — 지급 이력 DB가
// 없는 동안 한도를 절반씩 나눠 쓰는 데모 비율
const FIRST_CLAIM_DEMO_RATIO = 0.5;

function useClaimAccount(): ClaimAccount {
  const { profile } = useSession();
  const pricing = profile.data?.pricing ?? null;
  return useMemo(() => {
    const capManwon = pricing ? Math.round(pricing.cover_severe / 10_000) : policyInfo.coverageCapManwon;
    const mildCapManwon = pricing
      ? Math.round(pricing.cover_mild / 10_000)
      : Math.round(policyInfo.coverageCapManwon / 2);
    const firstPaidManwon = Math.round(capManwon * FIRST_CLAIM_DEMO_RATIO);
    return {
      capManwon,
      mildCapManwon,
      firstPaidManwon,
      secondPaidManwon: capManwon - firstPaidManwon,
      tier: pricing?.tier ?? policyInfo.tier,
    };
  }, [pricing]);
}

const 만원표기 = (n: number) => `${n.toLocaleString("ko-KR")}만원`;

type ClaimPhaseCopy = {
  toggleLabel: string;
  homeHeadline: string;
  bannerTitle: string;
  bannerText: string;
  paidAmount: string;
  remainingAmount: string;
  progress: number;
  ctaLabel: string;
  ctaEnabled: boolean;
  historySub: string;
  introHeading: string;
  introTimeline: { title: string; text: string; state: "active" | "current" | "" }[];
};

function buildClaimPhaseInfo(account: ClaimAccount): Record<ClaimPhase, ClaimPhaseCopy> {
  const cap = account.capManwon;
  const first = account.firstPaidManwon;
  return {
  preExam: {
    toggleLabel: "수능 전",
    homeHeadline: "수능 전이에요, 성적 관리에 집중해보세요",
    bannerTitle: "청구는 아직 준비 중이에요",
    bannerText: "수능 다음해 6월에 1차 청구가 열려요. 그때 알림으로 알려드릴게요.",
    paidAmount: "0원",
    remainingAmount: 만원표기(cap),
    progress: 0,
    ctaLabel: "청구 준비 중",
    ctaEnabled: false,
    historySub: "청구 기간이 아직 열리지 않았어요",
    introHeading: "1차 청구, 아직 준비 중이에요",
    introTimeline: [
      { title: "수능", text: "성적 확정 · 보장 자격이 정해져요", state: "" },
      { title: "1차 청구", text: "다음해 6월 접수 · 12월~5월 결제 내역", state: "" },
      { title: "2차 청구", text: "12월 접수 · 6월~11월 결제 내역", state: "" },
    ],
  },
  postExam: {
    toggleLabel: "수능 후",
    homeHeadline: "수능 종료 · 보장 자격을 확인하세요",
    bannerTitle: "1차 청구 준비 중이에요",
    bannerText: "수능이 끝났어요. 1차 청구는 6월 1일부터 열려요.",
    paidAmount: "0원",
    remainingAmount: 만원표기(cap),
    progress: 0,
    ctaLabel: "아직 접수 기간이 아니에요",
    ctaEnabled: false,
    historySub: "1차 청구 접수를 기다리고 있어요",
    introHeading: "1차 청구, 곧 열려요",
    introTimeline: [
      { title: "수능 · 종료", text: "성적 확정 · 보장 자격 확인 완료", state: "active" },
      { title: "1차 청구 · 접수 예정", text: "2026.06.01 ~ 06.30 · 12월~5월 결제 영수증 필요", state: "" },
      { title: "2차 청구", text: "12월 접수 · 6월~11월 결제 내역", state: "" },
    ],
  },
  period1: {
    toggleLabel: "1차 청구 기간",
    homeHeadline: "1차 청구가 열렸어요, 지금 시작해보세요",
    bannerTitle: "1차 청구가 열렸어요",
    bannerText: "6월 30일까지 접수할 수 있어요. 영수증만 올리면 자동으로 검증돼요.",
    paidAmount: "0원",
    remainingAmount: 만원표기(cap),
    progress: 0,
    ctaLabel: "청구 시작하기",
    ctaEnabled: true,
    historySub: "아직 접수한 청구가 없어요",
    introHeading: "1차 청구, 두 단계면 끝나요",
    introTimeline: [
      { title: "1차 청구 · 접수 가능", text: "2026.06.01 ~ 06.30 · 12월~5월 결제 영수증 필요", state: "current" },
      { title: "2차 청구", text: "12월 접수 · 6월~11월 결제 내역", state: "" },
      { title: "보장 종료", text: "2차 지급 후 계약이 끝나요", state: "" },
    ],
  },
  between: {
    toggleLabel: "1차 종료 · 2차 전",
    homeHeadline: "1차 지급 완료 · 2차 청구 준비 중이에요",
    bannerTitle: "2차 청구 준비 중이에요",
    bannerText: "1차 지급이 끝났어요. 2차 청구는 12월 1일부터 열려요.",
    paidAmount: 만원표기(first),
    remainingAmount: 만원표기(cap - first),
    progress: Math.round((first / cap) * 100),
    ctaLabel: "아직 접수 기간이 아니에요",
    ctaEnabled: false,
    historySub: `1차 지급완료 · ${만원표기(first)}`,
    introHeading: "2차 청구, 곧 열려요",
    introTimeline: [
      { title: "1차 청구 · 지급완료", text: `2026.06.14 접수 · ${만원표기(first)} · 영수증 대조 결과 정상`, state: "active" },
      { title: "2차 청구 · 접수 예정", text: "2026.12.01 ~ 12.31 · 6월~11월 결제 영수증 필요", state: "" },
      { title: "보장 종료", text: "2차 지급 후 계약이 끝나요", state: "" },
    ],
  },
  period2: {
    toggleLabel: "2차 청구 기간",
    homeHeadline: "2차 청구가 열렸어요. 지금 시작해보세요.",
    bannerTitle: "2차 청구가 열렸어요",
    bannerText: "12월 31일까지 접수할 수 있어요. 영수증만 올리면 자동으로 검증돼요.",
    paidAmount: 만원표기(first),
    remainingAmount: 만원표기(cap - first),
    progress: Math.round((first / cap) * 100),
    ctaLabel: "청구 시작하기",
    ctaEnabled: true,
    historySub: `1차 지급완료 · ${만원표기(first)}`,
    introHeading: "2차 청구, 두 단계면 끝나요",
    introTimeline: [
      { title: "1차 청구 · 지급완료", text: `2026.06.14 접수 · ${만원표기(first)} · 영수증 대조 결과 정상`, state: "active" },
      { title: "2차 청구 · 접수 가능", text: "2026.12.01 ~ 12.31 · 6월~11월 결제 영수증 필요", state: "current" },
      { title: "보장 종료", text: "2차 지급 후 계약이 끝나요", state: "" },
    ],
  },
  };
}

type EligibilityCopy = {
  determinedAt: string;
  isEligible: boolean;
  tierLabel: string;
  title: string;
  desc: string;
  expectedGrade: string;
  actualGrade: string;
  dropSigma: string;
  mildThreshold: string;
  severeThreshold: string;
  coverageLimit: string;
  claimWindow: string;
};

const 등급표기 = (grade: number | null | undefined) =>
  typeof grade === "number" ? `${grade.toFixed(2)}등급` : "—";
const 시그마표기 = (z: number | null | undefined) =>
  typeof z === "number" ? `${z > 0 ? "+" : ""}${z.toFixed(2)}σ` : "—";

/**
 * 보장 판정 — 학생별 실제 값 (GET /api/student/{id}/eligibility · 약관 별표3).
 *
 * 예전엔 화면에 "판정 결과 미리보기(테스트용)" 토글이 있어 none/mild/severe 를
 * 손으로 바꿔 끼웠고, 등급·σ 숫자는 모든 학생이 똑같은 상수였다. 이제 엔진이
 * 그 학생의 성적으로 계산한 값을 그대로 받아 쓴다.
 *
 * 판정은 수능 성적이 있어야 확정된다(status: determined). 아직 없으면 엔진이
 * pending 을 돌려주고, 화면은 그 학생의 예상 밴드와 기준선만 보여준다.
 */
function useEligibilityView(): EligibilityCopy & { status: string; loading: boolean } {
  const { studentId } = useSession();
  const account = useClaimAccount();
  const { data, loading } = useEligibility(studentId);

  return useMemo(() => {
    const mild = 시그마표기(data?.mild_threshold_z ?? -1.75) + " 이하";
    const severe = 시그마표기(data?.severe_threshold_z ?? -2.25) + " 이하";
    const base = {
      determinedAt: "",
      mildThreshold: mild,
      severeThreshold: severe,
      claimWindow: "6월 1일 ~ 6월 30일",
      expectedGrade: 등급표기(data?.predicted_grade),
      actualGrade: 등급표기(data?.actual_grade),
      dropSigma: 시그마표기(data?.z),
      coverageLimit: "0원",
    };

    if (loading || !data) {
      return { ...base, status: "loading", loading: true, isEligible: false,
        tierLabel: "판정 전", title: "판정 결과를 불러오는 중이에요", desc: "" };
    }

    if (data.status === "insufficient_data") {
      return { ...base, status: data.status, loading: false, isEligible: false,
        tierLabel: "판정 불가",
        title: "아직 판정할 수 없어요",
        desc: data.message
          ?? `밴드 산정에 필요한 최소 관측 회차(9회 중 ${data.required_rounds ?? 5}회)에 미달해요.` };
    }

    if (data.status === "pending") {
      return { ...base, status: data.status, loading: false, isEligible: false,
        tierLabel: "판정 전",
        actualGrade: "수능 성적 등록 전",
        title: "수능 성적이 등록되면 판정해 드려요",
        desc: "지금까지 성적으로 예상 밴드는 잡혀 있어요. 수능 성적이 확정되면 급락 여부를 바로 알려드릴게요." };
    }

    const result = (data.result ?? "none") as EligibilityResult;
    const tierLabel = { none: "비대상", mild: "경증", severe: "중증" }[result];
    const eligible = Boolean(data.eligible);
    return {
      ...base,
      status: data.status,
      loading: false,
      isEligible: eligible,
      tierLabel,
      determinedAt: "",
      coverageLimit: eligible
        ? 만원표기(result === "severe" ? account.capManwon : account.mildCapManwon)
        : "0원",
      title: eligible ? `${tierLabel} 보장 대상이에요` : "이번엔 보장 대상이 아니에요",
      desc: eligible
        ? `예상 성적 대비 하락폭이 ${tierLabel} 기준을 넘었어요. 1차 청구를 접수할 수 있어요.`
        : "예상 성적 대비 하락폭이 경증 기준에 닿지 않았어요. 성적이 크게 떨어지지 않았다는 뜻이에요.",
    };
  }, [data, loading, account]);
}

/** 청구 화면 공용 데이터 — 가입정보(세션) 반영 한도·지급액 + 단계별 카피 */
function useClaimInfo() {
  const account = useClaimAccount();
  return useMemo(
    () => ({
      account,
      phaseInfo: buildClaimPhaseInfo(account),
    }),
    [account],
  );
}

// 판정 대상 과목 (약관 별표6 + engine.subject_weights). 색은 DESIGN.md 고정값이라
// lib/format 의 SUBJECT_COLOR 한 곳에서만 정의한다.
const SUBJECTS = ["국어", "수학", "영어", "탐구"] as const;
type Subject = (typeof SUBJECTS)[number];

// 예상 백분위·예상 범위·급락 기준선·평균 등급은 모두 engine.analyze() 에서 온다
// (Grades 화면 참조). 목데이터 사본을 두면 같은 화면의 그래프와 숫자가 어긋난다.

const gradeCutoffs = [96, 89, 77, 60, 40, 23, 11, 4];
const percentileToGrade = (percentile: number) => {
  for (let grade = 0; grade < gradeCutoffs.length; grade++) {
    if (percentile >= gradeCutoffs[grade]) return grade + 1;
  }
  return 9;
};

type StabilityTone = "positive" | "warning" | "danger";
const stabilityTier = (score: number): { label: string; tone: StabilityTone } => {
  if (score >= 60) return { label: "안정", tone: "positive" };
  if (score >= 45) return { label: "보통", tone: "warning" };
  return { label: "보완", tone: "danger" };
};
const stabilityRingColor: Record<StabilityTone, string> = {
  positive: "var(--brand-green)",
  warning: "#f2a93b",
  danger: "#f0533f",
};

/**
 * 다음 보험료 재산정 시점 — 약관 제17조·별표1.
 *
 * 갱신은 임의의 날짜가 아니라 성적 산출 일정에 맞춘 세 시점뿐이다.
 *   고2 3월 (고1 3·6·9월 반영) · 고3 3월 (+고2 3·6·9월) · 고3 9월 (+고3 5·6·9월모평)
 * 고1 구간은 고정보험료라 갱신하지 않고(별표1), 고3 9월 모평 성적 통지 이후에는
 * 수능까지 보험료를 **동결**한다(제17조 — 예측 가능성·소비자 보호).
 *
 * 그래서 '언제 재산정되나'는 학생이 어느 회차까지 치렀는지로 정해진다.
 * (예전엔 8월 1일이 하드코딩돼 있었는데, 8월은 갱신 시점이 아니다.)
 */
function nextRenewal(rounds: Record<string, number | null> | undefined) {
  if (!rounds) return null;
  const done = (round: string) => typeof rounds[round] === "number";

  if (done("고3_9월모평")) return { label: "동결", month: null, note: "수능까지 고정" };
  if (done("고3_5월") || done("고3_6월")) return { label: "고3 9월", month: 9, note: "고3 5·6·9월 모평 반영" };
  if (done("고2_3월") || done("고2_6월") || done("고2_9월")) return { label: "고3 3월", month: 3, note: "고2 3·6·9월 학평 반영" };
  if (done("고1_3월") || done("고1_6월") || done("고1_9월")) return { label: "고2 3월", month: 3, note: "고1 3·6·9월 학평 반영" };
  return null;
}

/** 오늘 이후 처음 도래하는 해당 월 1일. */
function nextMonthStart(month: number, from = new Date()) {
  const year = from.getFullYear() + (from.getMonth() + 1 >= month ? 1 : 0);
  return new Date(year, month - 1, 1);
}

const formatISODate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const formatDotDate = (date: Date) =>
  `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
/** 접수 시각 표시용 — 날짜 + 24시간제 시:분 */
const formatDotDateTime = (date: Date) =>
  `${formatDotDate(date)} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};
/** 접수번호 — 접수 시각 기반이라 접수할 때마다 새로 발급된다 */
const claimReceiptNo = (at: Date, round: 1 | 2) =>
  `CLM-${at.getFullYear()}-${round}${String(at.getMonth() + 1).padStart(2, "0")}${String(at.getDate()).padStart(2, "0")}${String(at.getHours()).padStart(2, "0")}${String(at.getMinutes()).padStart(2, "0")}`;
const daysUntil = (date: Date) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
};

function Clover({ className = "" }: { className?: string }) {
  return (
    <span className={`clover ${className}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function Mascot({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <div className={`mascot mascot-${size}`}>
      <img src="/jaesoo_character.png" alt="재수없수 AI 도우미 노재수" />
    </div>
  );
}

function Splash({ onContinue }: { onContinue: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onContinue, 1900);
    return () => window.clearTimeout(timer);
  }, [onContinue]);

  return (
    <button className="splash-screen" onClick={onContinue} aria-label="로그인 화면으로 이동">
      <Clover className="splash-clover one" />
      <Clover className="splash-clover two" />
      <img className="splash-logo" src="/logo-final-white.png" alt="재수없수" />
      <span className="splash-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <small>화면을 탭하면 바로 시작해요</small>
    </button>
  );
}

/**
 * 시연 계정 3인 — 판정 결과가 각각 다르다 (api/seed_demo_profiles.py 로 DB 에 심는다).
 * 목록에서 이 순서로 보여야 발표 흐름(중증 → 경증 → 비대상)이 자연스럽다.
 */
const DEMO_ORDER = ["demo_severe", "demo_mild", "demo_none"];
const DEMO_CASE_LABEL: Record<string, string> = {
  demo_severe: "중증 청구 학생",
  demo_mild: "경증 청구 학생",
  demo_none: "비청구 대상 학생",
};

/** 데모 자격증명 — 계약을 고르면 그 계약의 아이디·비밀번호가 자동으로 채워진다. */
const demoCredentials = (studentId: string) => ({
  id: `${studentId.replace(/^(stu|demo)_/, "")}_parent`,
  password: "jaesoo1234",
});

function Login({ onLogin }: { onLogin: () => void }) {
  // 프로토타입 범위 — 실인증 대신 백엔드가 아는 학생 중에서 고른다.
  // (웹 가입 완료 화면에서 ?student_id= 로 넘어온 경우엔 이 화면을 건너뛴다)
  const { setStudentId, health } = useSession();
  const { students: remoteStudents, loading, error } = useStudents();

  // 시연 계정 세 건만, DEMO_ORDER 순서(중증 → 경증 → 비대상)로 보여준다.
  // DB 에는 개발하며 쌓인 계약이 스무 건 넘게 있지만 발표에서 짚을 것은 판정
  // 결과가 서로 다른 이 세 건뿐이다. 데이터는 전부 실제 DB 에 있고, 다른 계약으로
  // 로그인해야 하면 이 필터만 풀면 된다.
  const students = useMemo<StudentSummary[]>(
    () =>
      DEMO_ORDER
        .map((id) => remoteStudents.find((s) => s.student_id === id))
        .filter((s): s is StudentSummary => Boolean(s)),
    [remoteStudents],
  );
  // 계약을 고르면 자격증명 입력 단계로 넘어간다 (한 화면 안의 2단계)
  const [picked, setPicked] = useState<StudentSummary | null>(null);

  const pick = (student: StudentSummary) => {
    setStudentId(student.student_id);
    setPicked(student);
  };

  if (picked) {
    const cred = demoCredentials(picked.student_id);
    return (
      <main className="login-screen">
        <div className="login-brand">
          <Mascot size="md" />
          <h1>재수없수</h1>
          <p>{picked.name} 학생 학부모님 계정</p>
        </div>
        <form
          className="login-form"
          onSubmit={(event) => {
            event.preventDefault();
            onLogin();
          }}
        >
          <label>
            <span>아이디</span>
            <input value={cred.id} readOnly autoComplete="username" />
          </label>
          <label>
            <span>비밀번호</span>
            <input type="password" value={cred.password} readOnly autoComplete="current-password" />
          </label>
          <button className="primary-button" type="submit">
            로그인하기
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="login-screen">
      <div className="login-brand">
        <Mascot size="md" />
        <h1>재수없수</h1>
        <p>재수없는 우리 아이! 부담없는 우리집!</p>
      </div>
      <form
        className="login-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (students.length) pick(students[0]);
          else onLogin();
        }}
      >
        {loading && <p className="login-hint">가입된 계약을 불러오는 중이에요…</p>}

        {!loading && students.length > 0 && (
          <>
            <span className="login-label">계약을 선택하세요</span>
            <ul className="login-accounts">
              {/* 시드 데이터에 student_id 가 겹치는 행이 있어 인덱스를 함께 물린다 */}
              {students.map((s, i) => (
                <li key={`${s.student_id}-${i}`}>
                  <button type="button" onClick={() => pick(s)}>
                    <span className="login-account-name">{s.name}</span>
                    <span className="login-account-meta">
                      {DEMO_CASE_LABEL[s.student_id]
                        ?? ([s.school, s.tier].filter(Boolean).join(" · ") || "가입 정보")}
                    </span>
                    <ChevronRight size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {!loading && students.length === 0 && (
          <p className="login-hint">
            {health.online
              ? "시연 계정을 불러오지 못했어요. 백엔드에서 python -m seed_demo_profiles 를 실행해 주세요."
              : "서버에 연결하지 못했어요. 데모 화면으로 둘러볼 수 있어요."}
            {error ? <span className="login-error">{error}</span> : null}
          </p>
        )}

        <button className="primary-button" type="button" onClick={onLogin}>
          {students.length ? "선택 없이 데모로 보기" : "데모로 둘러보기"}
        </button>
      </form>
    </main>
  );
}

function Loading({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 1500);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <main className="loading-screen">
      <Mascot size="lg" />
      <h1>
        재수없는 우리 아이!
        <br />
        부담없는 우리집!
      </h1>
      <LoaderCircle className="spinner" size={40} aria-hidden="true" />
      <p>성적 데이터를 불러오는 중</p>
    </main>
  );
}

function TopBar({
  onNotification,
  hasUnread = false,
  back,
  backLabel,
}: {
  onNotification?: () => void;
  hasUnread?: boolean;
  back?: () => void;
  backLabel?: string;
}) {
  return (
    <header className="top-bar">
      {back ? (
        <button className="back-button" onClick={back}>
          <ChevronLeft size={17} />
          {backLabel ?? "이전 화면"}
        </button>
      ) : (
        <img className="top-bar-logo" src="/logo-final-dark.png" alt="재수없수" />
      )}
      {onNotification && (
        <button className="icon-button" onClick={onNotification} aria-label="알림 열기">
          <Bell size={21} />
          {hasUnread && <span className="notification-dot" />}
        </button>
      )}
    </header>
  );
}

/**
 * 탭 화면(성적분석·돈워리·마이) 공통 상단바.
 *
 * · tone="green" 이면 성적분석 결과에서 쓰던 그린 바를 쓴다 — 돈워리 계산 화면도 같이 맞춘다.
 * · onBack 을 주면 로고 왼쪽에 도입 화면으로 돌아가는 버튼이 붙는다.
 *   (탭을 옮겼다 와도 상태가 남아 있어 처음 화면으로 되돌아갈 길이 없었다)
 * · 로고는 화면마다 50/40 으로 달랐는데 작은 쪽(40)으로 통일한다.
 */
function BrandTabHeader({
  onNotification,
  hasUnread = false,
  tone = "plain",
  onBack,
  backLabel,
}: {
  onNotification: () => void;
  hasUnread?: boolean;
  tone?: "plain" | "green";
  onBack?: () => void;
  backLabel?: string;
}) {
  const green = tone === "green";
  return (
    <header className={green ? "grades-brand-header" : "brand-tab-header"}>
      <div className="tab-header-left">
        {onBack && (
          <button type="button" className="tab-back" onClick={onBack} aria-label={backLabel ?? "처음 화면으로"}>
            <ChevronLeft size={18} />
            <span>{backLabel ?? "처음 화면"}</span>
          </button>
        )}
        {!onBack && <img src={green ? "/logo-final-white.png" : "/logo-final-dark.png"} alt="재수없수" />}
      </div>
      <button className="icon-button" onClick={onNotification} aria-label="알림 열기">
        <Bell size={20} />
        {hasUnread && <span className="notification-dot" />}
      </button>
    </header>
  );
}

function HeroAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="hero-action" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ClaimPhaseToggle({ phase, onCycle }: { phase: ClaimPhase; onCycle: () => void }) {
  const { phaseInfo } = useClaimInfo();
  return (
    <button className="claim-phase-toggle" type="button" onClick={onCycle} aria-label="청구 진행 단계 미리보기 전환">
      <Clock3 size={17} aria-hidden="true" />
      <span>{phaseInfo[phase].toggleLabel}</span>
    </button>
  );
}

function HomeMain({
  onNotification,
  hasUnread,
  go,
  goTab,
  askAi,
  claimPhase,
  onOpenClaim,
}: {
  onNotification: () => void;
  hasUnread: boolean;
  go: (screen: HomeScreen) => void;
  goTab: (tab: Tab) => void;
  askAi: (question: string) => void;
  claimPhase: ClaimPhase;
  onOpenClaim: () => void;
}) {
  const { phaseInfo } = useClaimInfo();
  const [question, setQuestion] = useState("");
  const [claimGuide, setClaimGuide] = useState(false);
  const { profile } = useSession();
  const pricing = profile.data?.pricing;
  const studentName = (profile.data?.student?.name as string | undefined) ?? "";
  // 재산정 시점은 약관이 정한 세 갱신 시점 중 다음 것 (제17조·별표1)
  const renewal = nextRenewal(profile.data?.analysis?.rounds);

  const submitQuestion = () => {
    if (!question.trim()) return;
    askAi(question.trim());
  };

  return (
    <div className="screen page-with-nav home-screen">
      <section className="home-main-hero">
        <Clover className="home-clover one" />
        <Clover className="home-clover two" />
        <div className="home-hero-top">
          {/* 다른 탭 상단바와 같은 40px 로고 (예전엔 이 자리에 성씨 한 글자 아바타가 있었다) */}
          <img className="home-hero-logo" src="/logo-final-white.png" alt="재수없수" />
          <button className="icon-button" onClick={onNotification} aria-label="알림 열기">
            <Bell size={20} />
            {hasUnread && <span className="notification-dot" />}
          </button>
        </div>
        {/* 아바타를 로고로 바꾸면서 이름은 인사말에만 남는다 — 목데이터가 아니라 실제 계약자 이름으로 */}
        <p className="home-greeting">안녕하세요, {studentName || studentProfile.name} 학생 학부모님!</p>
        <div className="home-ai-copy">
          <Mascot size="lg" />
          <p>
            AI 도우미 <em>노재수</em> 입니다
          </p>
          <h1>보험료 산정과 약관에 관해 AI에게 물어보세요</h1>
        </div>
        <div className="mint-divider home-menu-divider" />
        <div className="hero-actions home-hero-actions" aria-label="AI 추천 메뉴">
          <HeroAction
            icon={<Calculator size={18} />}
            label="보험료 계산"
            onClick={() => askAi("보험료는 어떻게 계산된 거예요?")}
          />
          <HeroAction
            icon={<ShieldCheck size={18} />}
            label="약관 설명"
            onClick={() => askAi("약관에 대해 설명해주세요.")}
          />
          <HeroAction
            icon={<BarChart3 size={18} />}
            label="보장 기준"
            onClick={() => askAi("보장을 받을 수 있는 기준이 뭐예요?")}
          />
        </div>
        <form
          className="home-question"
          onSubmit={(event) => {
            event.preventDefault();
            submitQuestion();
          }}
        >
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="궁금한 점을 입력하세요"
            aria-label="AI에게 질문하기"
          />
          <button type="submit" aria-label="질문 보내기" disabled={!question.trim()}>
            <ArrowRight size={20} />
          </button>
        </form>
      </section>

      <section className="home-content">
        {claimPhase !== "preExam" ? (
          <button className="home-feature-card claim-feature claim-top" onClick={() => setClaimGuide(true)}>
            <span className="feature-arrow">
              <ArrowRight size={17} />
            </span>
            <span className="feature-icon">
              <FileText size={25} />
            </span>
            <span className="claim-feature-text">
              <small>보험금 청구</small>
              <strong>{phaseInfo[claimPhase].homeHeadline}</strong>
            </span>
          </button>
        ) : (
          <div className="metric-grid">
            <article className="metric-card premium-card">
              <span className="metric-icon mint">
                <WalletCards size={20} />
              </span>
              <span>현재 월 보험료</span>
              <strong>{pricing ? 원(pricing.monthly_premium) : "—"}</strong>
              <small>{pricing ? `${pricing.tier} · 잔여 ${pricing.remaining_months}개월` : "불러오는 중"}</small>
            </article>
            <article className="metric-card dday-card">
              <span className="metric-icon lime">
                <CalendarDays size={20} />
              </span>
              <span>{renewal?.month ? "보험료 재산정까지" : "보험료 재산정"}</span>
              <strong>
                {renewal?.month ? `D-${daysUntil(nextMonthStart(renewal.month))}` : renewal?.label ?? "—"}
              </strong>
              <small>
                {renewal?.month
                  ? `${renewal.label} · ${formatISODate(nextMonthStart(renewal.month))}`
                  : renewal?.note ?? "성적을 불러오는 중"}
              </small>
            </article>
          </div>
        )}

        <div className="home-feature-grid">
          <button className="home-feature-card grades-feature" onClick={() => goTab("grades")}>
            <span className="feature-arrow">
              <ArrowRight size={17} />
            </span>
            <span className="feature-icon">
              <ChartNoAxesCombined size={25} />
            </span>
            <small>성적분석</small>
            <strong>
              성적의 추이와
              <br />
              안정성을 점검하세요
            </strong>
          </button>
          <button className="home-feature-card converter-feature" onClick={() => goTab("converter")}>
            <span className="feature-arrow">
              <ArrowRight size={17} />
            </span>
            <span className="feature-icon">
              <Calculator size={25} />
            </span>
            <small>돈워리</small>
            <strong>
              우리 집 재수 비용을
              <br />
              미리 계산해보세요
            </strong>
          </button>
        </div>
      </section>

      {claimGuide && (
        <ClaimGuidePopup
          phase={claimPhase}
          onClose={() => setClaimGuide(false)}
          onStart={() => {
            setClaimGuide(false);
            onOpenClaim();
          }}
        />
      )}
    </div>
  );
}

/** 1차(6월)·2차(12월) 청구 창구 상태 — 데모 단계 토글(ClaimPhase)에 맞춰 갈린다. */
function claimWindowStatus(phase: ClaimPhase, which: "first" | "second"): "open" | "upcoming" | "closed" {
  if (which === "first") {
    if (phase === "period1") return "open";
    if (phase === "between" || phase === "period2") return "closed";
    return "upcoming";
  }
  return phase === "period2" ? "open" : "upcoming";
}

const CLAIM_WINDOW_LABEL = { open: "신청 가능", upcoming: "예정", closed: "마감" } as const;

function ClaimGuidePopup({
  phase,
  onClose,
  onStart,
}: {
  phase: ClaimPhase;
  onClose: () => void;
  onStart: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const firstStatus = claimWindowStatus(phase, "first");
  const secondStatus = claimWindowStatus(phase, "second");

  return (
    <div className="policy-popup-backdrop" role="dialog" aria-modal="true" aria-label="보험금 청구 안내" onClick={onClose}>
      <div className="policy-popup claim-guide-popup" onClick={(e) => e.stopPropagation()}>
        <header className="policy-popup-head claim-guide-head">
          <strong>
            <em>보험금 청구</em>, 이렇게 진행해요
          </strong>
          <button type="button" onClick={onClose} aria-label="청구 안내 닫기">
            <X size={18} />
          </button>
        </header>

        <div className="claim-guide-body">
          <section className="claim-guide-card">
            <div className="claim-guide-card-head">
              <span className="claim-guide-card-icon">
                <CalendarDays size={15} />
              </span>
              <h2>청구 가능 기간</h2>
              <span className="claim-guide-card-meta">연간 총 2회</span>
            </div>

            {/* 달력 한 장처럼 — 월을 크게 얹고 아래에 접수 기간·대상 결제분 */}
            <div className="claim-guide-periods">
              {[
                { key: "first", month: 6, range: "1일 ~ 30일", covers: "전년 12월 ~ 5월 결제분", status: firstStatus },
                { key: "second", month: 12, range: "1일 ~ 31일", covers: "6월 ~ 11월 결제분", status: secondStatus },
              ].map((w) => (
                <div key={w.key} className={`claim-guide-cal ${w.status}`}>
                  <div className="claim-guide-cal-top">
                    <span className="claim-guide-cal-month">{w.month}</span>
                    <span className="claim-guide-cal-unit">월</span>
                  </div>
                  <strong className="claim-guide-cal-range">{w.range}</strong>
                  <span className="claim-guide-cal-covers">{w.covers}</span>
                  <span className={`claim-guide-pill ${w.status}`}>{CLAIM_WINDOW_LABEL[w.status]}</span>
                </div>
              ))}
            </div>

            <p className="claim-guide-caution claim-guide-caution-center">마감일 이후에는 접수가 불가합니다.</p>
          </section>

          <section className="claim-guide-card">
            <div className="claim-guide-card-head">
              <span className="claim-guide-card-icon">
                <ListOrdered size={15} />
              </span>
              <h2>진행 순서 안내</h2>
            </div>
            <ol className="claim-guide-steps">
              <li>
                <div>
                  <strong>결제 카드 확인</strong>
                  <span>보험료 납부 카드 확인 또는 새 결제 카드 등록</span>
                </div>
              </li>
              <li>
                <div>
                  <strong>영수증 첨부</strong>
                  <span>재수비용 결제 영수증 사진 촬영/첨부 (여러 장 가능)</span>
                </div>
              </li>
              <li>
                <div>
                  <strong>내용 확인 및 최종 접수</strong>
                  <span>학원명·결제일·금액 최종 대조 후 접수 완료</span>
                </div>
              </li>
            </ol>
          </section>

          <section className="claim-guide-card">
            <div className="claim-guide-card-head">
              <span className="claim-guide-card-icon">
                <Archive size={15} />
              </span>
              <h2>필수 준비물</h2>
            </div>
            <div className="claim-guide-items">
              <div className="claim-guide-item">
                <CreditCard size={16} />
                <span>재수비용을 결제한 카드</span>
              </div>
              <div className="claim-guide-item">
                <FileText size={16} />
                <span>학원명·결제일·결제금액 명시 영수증</span>
              </div>
            </div>
            <p className="claim-guide-caution">
              영수증이 흐리거나 잘리면 추가 서류를 요청할 수 있어요.
            </p>
          </section>
        </div>

        <footer className="claim-guide-foot">
          <button className="primary-button" type="button" onClick={onStart}>
            청구 시작하기
          </button>
        </footer>
      </div>
    </div>
  );
}

function PremiumDetail({ screen, back, go }: { screen: HomeScreen; back: () => void; go: () => void }) {
  // 월 보험료 상세 = 약관 별표4 의 정식 구성 분해.
  //   위험보험료(보장 원가) + 사업비 + 위험마진(안전할증) = 월 보험료
  // 기존의 '기본 보장 + 생활 안심 특약 − 성적 연동 할인' 3단은 약관에 근거가 없어 폐기했다.
  const isHistory = screen === "history";
  const { breakdown, profile } = useSession();
  const bd = breakdown.data;
  const pricing = profile.data?.pricing;

  const rows = bd
    ? ([
        ["위험보험료", "보장에 실제로 쓰이는 몫", bd.monthly_components.risk_premium, bd.ratios.loss_ratio],
        ["사업비", "모집·심사·수금 비용", bd.monthly_components.expense, bd.ratios.expense_ratio],
        ["위험마진", "예측 오차에 대비한 안전할증", bd.monthly_components.risk_margin, bd.ratios.risk_margin_ratio],
      ] as const)
    : [];

  return (
    <div className="screen page-with-nav">
      <TopBar back={back} backLabel="홈" />
      <main className="sub-page">
        <span className="eyebrow">우리 아이 보험</span>
        <h1>{isHistory ? "가입 내역" : "월 보험료 상세"}</h1>

        {!isHistory ? (
          <>
            {breakdown.loading && <section className="white-card">불러오는 중이에요…</section>}

            {!breakdown.loading && !bd && (
              <section className="white-card empty-card">
                <p>보험료 정보를 불러오지 못했어요.</p>
                <button className="text-button" type="button" onClick={breakdown.reload}>
                  <RefreshCcw size={15} /> 다시 시도
                </button>
              </section>
            )}

            {bd && (
              <>
                <section className="hero-number-card">
                  <span>{bd.tier} · 월 보험료</span>
                  <strong>{원(bd.monthly_premium)}</strong>
                  <p>잔여 {bd.remaining_months}개월 납입 · 연 {원(bd.gross_annual)}</p>
                </section>

                <section className="white-card">
                  <h2>보험료 구성</h2>
                  {rows.map(([label, desc, amount, ratio]) => (
                    <div className="fee-row fee-row-detail" key={label}>
                      <span>
                        {label}
                        <small>{desc}</small>
                      </span>
                      <strong>
                        {원(amount)}
                        <small>{퍼센트(ratio)}</small>
                      </strong>
                    </div>
                  ))}
                  <div className="fee-total">
                    <span>최종 월 보험료</span>
                    <strong>{원(bd.monthly_premium)}</strong>
                  </div>
                  <p className="card-note">세 항목을 더하면 월 보험료가 됩니다.</p>
                </section>

                {bd.late_surcharge > 0 && (
                  <section className="white-card notice-card">
                    <h2>늦은가입 할증</h2>
                    <p>
                      가입 시점이 늦어 연 {원(bd.late_surcharge)}의 할증이 포함돼 있어요.
                      일찍 가입할수록 이 몫이 줄어듭니다.
                    </p>
                    <a className="text-link" href={policyLink("별표2-가입시점-선택-로딩-late-및-납입-구조-제11조-제22조-연계")} target="_blank" rel="noreferrer">
                      약관 별표2 — 가입시점별 납입 구조 <ArrowUpRight size={14} />
                    </a>
                  </section>
                )}

                <section className="white-card">
                  <h2>보장 한도</h2>
                  <div className="fee-row">
                    <span>경증 급락 시</span>
                    <strong>{만원(bd.coverage.mild)}</strong>
                  </div>
                  <div className="fee-row">
                    <span>중증 급락 시</span>
                    <strong>{만원(bd.coverage.severe)}</strong>
                  </div>
                  <a className="text-link" href={policyLink("별표4-위험확률-및-보험료-산출-기준-제22조-제24조-연계")} target="_blank" rel="noreferrer">
                    약관 별표4 — 보험료 산출 기준 <ArrowUpRight size={14} />
                  </a>
                </section>

                <button className="primary-button" onClick={go}>
                  가입 내역 보기
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <section className="white-card policy-card">
              <span className="status-badge">보장 중</span>
              <h2>재수없수 교육보험</h2>
              <p>
                {pricing?.tier ?? "—"} · 잔여 {pricing?.remaining_months ?? "—"}개월 납입
              </p>
              <div className="policy-values">
                <span>
                  <small>중증 보장 한도</small>
                  <strong>{만원(pricing?.cover_severe)}</strong>
                </span>
                <span>
                  <small>월 보험료</small>
                  <strong>{원(pricing?.monthly_premium)}</strong>
                </span>
              </div>
            </section>
            <section className="white-card">
              <h2>주요 보장</h2>
              {["성적 급락 시 재수 비용 보장", "학원비 영수증 기반 청구", "고2·고3 총 3회 갱신 (인상 상한 적용)"].map((item) => (
                <div className="check-row" key={item}>
                  <CircleCheck size={18} /> <span>{item}</span>
                </div>
              ))}
              <a className="text-link" href={policyLink("제13조-보험금의-지급사유-및-심각도별-차등-지급")} target="_blank" rel="noreferrer">
                약관 제13조 — 보험금 지급사유 <ArrowUpRight size={14} />
              </a>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Chat({
  back,
  initialQuestion,
}: {
  back: () => void;
  initialQuestion: string;
}) {
  // 실제 약관 RAG(/api/chat). 개인화 컨텍스트는 studentId 가 있을 때만 붙는다.
  const { studentId, personalized } = useSession();
  const { turns, busy, ask } = useChat(studentId);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const asked = useRef(false);
  // 근거 약관은 새 탭 전체화면 대신 이 화면 위 팝업으로 연다
  const [policyView, setPolicyView] = useState<{ anchor: string; title: string } | null>(null);

  // 'NO' 만 브랜드 그린으로 강조하므로 앞머리는 JSX 로 두고 꼬리만 문자열로 잡는다.
  const welcomeMessageTail =
    "\n\n약관과 보험료 산정 근거를 실제 약관 문서에 근거해 설명해드릴게요. 아래 추천 질문을 누르거나, 궁금한 점을 직접 입력해 물어보세요.";
  const recommendedQuestions = [
    "보험금은 언제, 어떻게 받나요?",
    "보험료는 어떤 기준으로 산정되나요?",
    "청약철회는 어떻게 하나요?",
    "보장에서 제외되는 경우는 뭔가요?",
  ];

  // 홈에서 질문을 안고 들어온 경우 한 번만 자동 전송
  useEffect(() => {
    if (asked.current || !initialQuestion.trim()) return;
    asked.current = true;
    ask(initialQuestion);
  }, [initialQuestion, ask]);

  useEffect(() => {
    const area = document.querySelector<HTMLElement>(".messages");
    area?.scrollTo({ top: area.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const send = () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    ask(q);
  };

  return (
    <div className="screen chat-screen">
      <div className="chat-heading chat-agentbar">
        <button className="chat-back" onClick={back} aria-label="홈으로 돌아가기"><ChevronLeft size={17} /><span>홈으로</span></button>
        <div>
          <h1>AI 도우미 노재수</h1>
          <p>
            <i /> {personalized ? "가입 정보를 반영해 답해요" : "약관 기준으로 답해요"}
          </p>
        </div>
      </div>
      <div className="messages">
        <div className="message-row ai">
          <Mascot size="sm" />
          <div className="message ai chat-welcome">
            {/* '…NO재수예/요.' 로 끊기지 않도록 인사와 소개를 줄로 나누고,
                소개 문장은 통째로 묶어 중간에서 안 끊기게 한다 */}
            안녕하세요!{"\n"}
            <span className="chat-welcome-intro">
              저는 재수없수 AI 도우미 <span className="chat-welcome-no">NO</span>재수예요!
            </span>
            {welcomeMessageTail}
          </div>
        </div>
        {turns.length === 0 && (
          <section className="chat-recommendations" aria-label="추천 질문">
            <span>추천 질문</span>
            <div className="quick-prompts">
              {recommendedQuestions.map((label) => (
                <button key={label} onClick={() => ask(label)} disabled={busy}>{label}</button>
              ))}
            </div>
          </section>
        )}
        {turns.map((turn, index) => (
          turn.who === "ai" && turn.status === "loading" ? (
            <div className="chat-loading-runner" key={`turn-${index}`} aria-label="노재수가 답변을 준비하고 있어요">
              <div className="runner-track" aria-hidden="true">
                <span className="paw-print paw-one"><img src="/paw-loader.png" alt="" /></span>
                <span className="paw-print paw-two"><img src="/paw-loader.png" alt="" /></span>
                <span className="paw-print paw-three"><img src="/paw-loader.png" alt="" /></span>
                <span className="paw-print paw-four"><img src="/paw-loader.png" alt="" /></span>
                <div className="runner-mascot"><Mascot size="sm" /></div>
              </div>
            </div>
          ) : (
            <div className={`message-row ${turn.who}`} key={`turn-${index}`}>
              {turn.who === "ai" && <Mascot size="sm" />}
              {/* 말풍선과 '이어서 물어보기'를 세로로 쌓는다 — 추천 질문은 흰 상자 밖에 둔다 */}
              <div className="message-stack">
                <div className={`message ${turn.who} ${turn.who === "ai" ? "answer-enter" : ""} ${turn.status === "error" ? "message-error" : ""}`}>
                  <RichText text={turn.text || " "} />

                  {/* AI 생성이 아니라 약관 발췌만으로 만든 답변임을 알린다 */}
                  {turn.fallback && (
                    <p className="chat-fallback-note">
                      <TriangleAlert size={12} />
                      AI 응답을 받지 못해 약관 원문에서 관련 조항만 찾아드렸어요.
                    </p>
                  )}

                  {/* 근거 조항 — 서로 독립된 항목이라 한 줄에 하나씩, 같은 표시로 나열한다.
                      누르면 그 조항만 담은 팝업이 열린다 */}
                  {turn.sources && turn.sources.length > 0 && (
                    <div className="chat-sources">
                      <span className="chat-sources-label">
                        근거 약관 {turn.sources.length}건
                      </span>
                      {turn.sources.map((src) => {
                        const { no, text } = splitClauseNo(src.title);
                        return (
                          <button
                            key={src.anchor}
                            type="button"
                            onClick={() => setPolicyView({ anchor: src.anchor, title: src.title })}
                          >
                            <FileText size={12} aria-hidden="true" />
                            {no && <em className="chat-source-no">{no}</em>}
                            <span>{text}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 백엔드가 답변 끝에서 뽑아준 다음 질문 — 마지막 답변에만 노출 */}
                {turn.suggestions && turn.suggestions.length > 0 && index === turns.length - 1 && !busy && (
                  <div className="chat-followups">
                    <span className="chat-followups-label">이어서 물어보기</span>
                    {turn.suggestions.map((q) => (
                      <button key={q} type="button" onClick={() => ask(q)}>
                        {q}
                        <ChevronRight size={14} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        ))}
      </div>
      <form
        className="chat-input"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            event.currentTarget.style.height = "auto";
            event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 120)}px`;
          }}
          onKeyDown={(event) => {
            // 엔터로 바로 보낸다. 줄바꿈이 필요하면 Shift+Enter.
            // (한글 조합 중 엔터는 글자 확정용이라 isComposing 일 때는 흘려보낸다)
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            send();
          }}
          placeholder="노재수에게 물어보세요"
          aria-label="AI 질문"
          disabled={busy}
        />
        <button type="submit" aria-label="질문 보내기" disabled={busy}>
          <ArrowUp size={19} strokeWidth={2.2} />
        </button>
      </form>

      {policyView && (
        <PolicyPopup
          key={policyView.anchor}
          anchor={policyView.anchor}
          title={policyView.title}
          onClose={() => setPolicyView(null)}
        />
      )}
    </div>
  );
}

/**
 * 근거 약관 팝업 — 인용된 그 조항 하나만 보여준다.
 *
 * 예전엔 약관 원문 전체를 iframe 으로 띄우고 해당 조항으로 스크롤했는데,
 * 앞뒤 조항이 함께 보여 무엇이 근거인지 흐릿했다. 이제 백엔드에서 그 조항의
 * 전문만 받아 렌더한다 (GET /api/policy/sections?a=<anchor>).
 * 조항에 딸린 하위 소제목(표·세부 기준)은 subsections 로 함께 온다.
 * 원문 맥락이 필요하면 하단 링크로 전체 문서를 새 탭에서 연다.
 */
/**
 * "13 보험금의 지급사유…" 처럼 앞에 붙어 오는 두 자리 항목번호를 떼어낸다.
 * 번호는 배지로 따로 세우고 제목만 본문에 남긴다.
 */
function splitClauseNo(title: string): { no: string | null; text: string } {
  const matched = /^(\d{2})\s*(\D.*)$/.exec(title.trim());
  return matched ? { no: matched[1], text: matched[2].trim() } : { no: null, text: title };
}

/**
 * 하위 소제목은 "별표3 — 성적 급락 판정 기준 (…) › 검증 방식" 처럼 상위 경로가 앞에 붙어
 * 온다(백엔드 display_title). 한 줄에 다 넣으면 정작 중요한 말단이 잘리므로,
 * 상위는 작은 라벨로 올리고 말단만 제목으로 쓴다.
 */
function splitClausePath(title: string): { parent: string | null; leaf: string } {
  const at = title.lastIndexOf("›");
  if (at < 0) return { parent: null, leaf: title.trim() };
  return { parent: title.slice(0, at).trim(), leaf: title.slice(at + 1).trim() };
}

type ClauseBlock =
  | { kind: "p"; text: string }
  | { kind: "table"; rows: string[][] };

/**
 * 조항 원문을 문단과 표로 나눈다.
 *
 * 조항 원문은 항(li)마다 빈 줄로 구분돼 온다 (백엔드 rag_light._clean).
 * 하나의 <p> 에 통째로 넣으면 pre-wrap 이 빈 줄만 살짝 띄우는 정도라 항이
 * 많은 조항(예: 제18조)은 글자 벽으로 보인다 — 항 단위로 나눠 문단으로 그린다.
 *
 * 여기에 더해 표를 되살린다. 백엔드(rag_light._CellAwareParser)가 약관의
 * <table> 을 "| 셀 | 셀 |" 한 줄로 평문화해 보내고 _clean 이 블록 사이에 빈 줄을
 * 넣기 때문에, 표 한 장이 '빈 줄로 갈린 파이프 문자열' 여러 개로 도착한다.
 * 그대로 문단으로 그리면 화면에 파이프가 그대로 보인다 (별표1·별표5 등 25곳).
 *
 * 빈 줄은 문단만 끊고 표는 끊지 않는다(행 사이 빈 줄이 정상이므로).
 * 표는 파이프가 아닌 줄을 만나야 닫힌다.
 */
function parseClauseBlocks(text: string): ClauseBlock[] {
  const isRow = (line: string) => /^\|.*\|$/.test(line);
  const toCells = (line: string) =>
    line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());

  const blocks: ClauseBlock[] = [];
  let para: string[] = [];
  let rows: string[][] = [];

  const flushPara = () => {
    const text = para.join("\n").trim();
    if (text) blocks.push({ kind: "p", text });
    para = [];
  };
  const flushTable = () => {
    if (rows.length) blocks.push({ kind: "table", rows });
    rows = [];
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      continue;
    }
    if (isRow(line)) {
      flushPara();
      rows.push(toCells(line));
      continue;
    }
    flushTable();
    para.push(line);
  }
  flushPara();
  flushTable();
  return blocks;
}

function ClauseTable({ rows }: { rows: string[][] }) {
  // 원문 파서가 빈 셀을 버려서 행마다 칸 수가 다를 수 있다 — 가장 긴 행에 맞춰 채운다
  const columns = Math.max(...rows.map((row) => row.length));
  const pad = (row: string[]) => [...row, ...Array(columns - row.length).fill("")];
  // 행이 하나뿐이면 머리글로 볼 근거가 없으므로 본문으로만 그린다
  const [head, ...body] = rows.length > 1 ? rows : [];
  const bodyRows = rows.length > 1 ? body : rows;

  return (
    <div className="clause-table-wrap">
      {/* 열 수를 클래스로 넘긴다 — '항목명 + 긴 설명' 2열 표만 설명 칸을 넓게 잡는다 */}
      <table className={`clause-table clause-table-cols-${columns}`}>
        {head && (
          <thead>
            <tr>
              {pad(head).map((cell, i) => (
                <th key={i}>{cell}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {bodyRows.map((row, i) => (
            <tr key={i}>
              {pad(row).map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClauseBody({ text }: { text: string }) {
  const blocks = useMemo(() => parseClauseBlocks(text), [text]);
  return (
    <>
      {blocks.map((block, i) =>
        block.kind === "table" ? (
          <ClauseTable key={i} rows={block.rows} />
        ) : (
          <p key={i}>{block.text}</p>
        ),
      )}
    </>
  );
}

function PolicyPopup({
  anchor,
  title,
  onClose,
}: {
  anchor: string;
  title: string;
  onClose: () => void;
}) {
  const [section, setSection] = useState<PolicySection | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // anchor 마다 새로 마운트되므로(호출부 key) 여기서 loading 으로 되돌릴 필요가 없다
  useEffect(() => {
    let alive = true;
    api.policySections([anchor]).then((res) => {
      if (!alive) return;
      const found = res.ok ? res.data.sections?.[0] : null;
      if (found?.found) {
        setSection(found);
        setState("ready");
      } else {
        setSection(null);
        setState("error");
      }
    });
    return () => {
      alive = false;
    };
  }, [anchor]);

  // 헤더 제목 — 상위 경로("별표3 … ›")와 두 자리 항목번호를 떼어 말단만 크게 보인다
  const headFull = section?.title || title;
  const { parent: headParent, leaf } = splitClausePath(headFull);
  const headLeaf = splitClauseNo(leaf).text;

  return (
    <div className="policy-popup-backdrop" role="dialog" aria-modal="true" aria-label={`약관 ${title}`} onClick={onClose}>
      <div className="policy-popup policy-clause-popup" onClick={(e) => e.stopPropagation()}>
        <header className="policy-popup-head">
          <div>
            {/* 상위 경로는 라벨로, 말단 제목만 크게 — 둘 다 한 줄 고정이라 길면 말줄임된다.
                전체 제목은 title 속성으로 남긴다 */}
            <span title={headParent ?? undefined}>{headParent ?? "근거 약관"}</span>
            <strong title={headFull}>{headLeaf}</strong>
          </div>
          <button type="button" onClick={onClose} aria-label="약관 팝업 닫기">
            <X size={18} />
          </button>
        </header>

        <div className="policy-clause-body">
          {state === "loading" && <p className="policy-clause-status">약관 조항을 불러오는 중이에요…</p>}

          {state === "error" && (
            <p className="policy-clause-status">
              조항을 불러오지 못했어요. 아래 링크로 약관 원문에서 확인해 주세요.
            </p>
          )}

          {state === "ready" && section && (
            <article className="policy-clause">
              <ClauseBody text={section.text} />
              {section.subsections.map((sub) => (
                <section key={sub.anchor}>
                  <h3>{sub.title}</h3>
                  <ClauseBody text={sub.text} />
                </section>
              ))}
            </article>
          )}
        </div>

        <footer className="policy-popup-foot">
          <a href={policyLink(anchor)} target="_blank" rel="noreferrer">
            약관 원문에서 보기 ↗
          </a>
        </footer>
      </div>
    </div>
  );
}

/**
 * 답변 본문의 이모지 → 아이콘 라이브러리(lucide) 아이콘.
 *
 * LLM 프롬프트가 ✅ 요약 · 📌 조건 · ⚠️ 주의 · 💡 팁 을 쓰도록 지시하는데,
 * 이모지는 기기·OS 마다 모양과 색이 달라 앱의 다른 아이콘들과 따로 논다.
 * 모델이 뱉는 글자는 그대로 두고, 그리는 단계에서 같은 라이브러리 아이콘으로 바꾼다.
 */
const CHAT_NOTE_ICONS: Record<string, LucideIcon> = {
  "✅": CircleCheck,
  "📌": Pin,
  "⚠️": TriangleAlert,
  "⚠": TriangleAlert,
  "💡": Lightbulb,
};

// 변이 선택자(U+FE0F)가 붙은 형태를 먼저 잡아야 한다 — 짧은 쪽이 먼저 매칭되면 꼬리가 남는다
const CHAT_NOTE_PATTERN = /(✅|📌|⚠️|⚠|💡)/g;

function withNoteIcons(text: string, keyPrefix: string) {
  return text.split(CHAT_NOTE_PATTERN).map((part, i) => {
    const Icon = CHAT_NOTE_ICONS[part];
    if (!Icon) return part;
    return (
      <span className="chat-note-icon" key={`${keyPrefix}-${i}`}>
        <Icon size={14} strokeWidth={2.4} />
      </span>
    );
  });
}

/**
 * 답변 안의 마크다운 표·강조를 최소한으로 렌더한다.
 * (레거시 SPA 의 renderRich 이식 — LLM 이 '| 항목 | 값 |' 표를 쓰도록 지시받는다)
 */
function RichText({ text }: { text: string }) {
  const blocks = useMemo(() => {
    const lines = text.split("\n");
    const out: Array<{ kind: "p" | "table"; lines: string[] }> = [];
    for (const line of lines) {
      const isRow = /^\s*\|.*\|\s*$/.test(line);
      const last = out[out.length - 1];
      if (isRow) {
        if (last && last.kind === "table") last.lines.push(line);
        else out.push({ kind: "table", lines: [line] });
      } else {
        if (last && last.kind === "p") last.lines.push(line);
        else out.push({ kind: "p", lines: [line] });
      }
    }
    return out;
  }, [text]);

  const cells = (row: string) =>
    row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

  return (
    <>
      {blocks.map((block, i) => {
        if (block.kind === "table") {
          const rows = block.lines.filter((l) => !/^\s*\|[\s|:-]+\|\s*$/.test(l));
          if (!rows.length) return null;
          const [head, ...body] = rows;
          return (
            <div className="chat-table-wrap" key={i}>
              <table className="chat-table">
                <thead>
                  <tr>{cells(head).map((c, j) => <th key={j}>{withNoteIcons(c, `h${i}-${j}`)}</th>)}</tr>
                </thead>
                <tbody>
                  {body.map((r, j) => (
                    <tr key={j}>{cells(r).map((c, k) => <td key={k}>{withNoteIcons(c, `c${i}-${j}-${k}`)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        const body = block.lines.join("\n").trim();
        if (!body) return null;
        return <p key={i} className="chat-paragraph">{withNoteIcons(body, `p${i}`)}</p>;
      })}
    </>
  );
}

function PercentileChart() {
  // 회차별 종합등급(국·수·영·탐 가중합) + 밴드 예측등급 μ̂ + 보장 기준선.
  // ★ 등급은 낮을수록 우수하므로 Y축을 반전한다 (gradeToY).
  const { profile } = useSession();
  const analysis = profile.data?.analysis;

  const width = 360;
  const height = 210;
  const left = 30;
  const right = 15;
  const top = 18;
  const bottom = 30;
  const plotH = height - top - bottom;
  const plotW = width - left - right;

  const rounds = analysis?.round_order ?? [];
  const observed = rounds
    .map((r) => ({ label: r, pct: analysis?.rounds?.[r] ?? null }))
    .filter((p): p is { label: string; pct: number } => typeof p.pct === "number");

  const predicted = analysis?.band?.predicted_percentile ?? null;
  const mildLine = analysis?.band?.mild_threshold_percentile ?? null;

  if (profile.loading) {
    return <div className="percentile-chart chart-placeholder">성적을 불러오는 중이에요…</div>;
  }
  if (observed.length < 2) {
    return (
      <div className="percentile-chart chart-placeholder">
        아직 등록된 모의고사 성적이 부족해요.
        <br />
        성적을 등록하면 예상 백분위를 보여드릴게요.
      </div>
    );
  }

  const count = observed.length + (predicted != null ? 1 : 0);
  const x = (i: number) => left + (count > 1 ? (i * plotW) / (count - 1) : 0);
  const y = (p: number) => top + percentileToY(p, plotH, 0);

  const observedPath = observed
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.pct)}`)
    .join(" ");
  const lastIdx = observed.length - 1;
  const observedArea = `${observedPath} L ${x(lastIdx)} ${height - bottom} L ${left} ${height - bottom} Z`;

  return (
    <div className="percentile-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="회차별 종합 백분위 추이와 예상 수능 백분위">
        <defs>
          <linearGradient id="percentileArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0CB474" stopOpacity=".25" />
            <stop offset="100%" stopColor="#0CB474" stopOpacity=".02" />
          </linearGradient>
        </defs>

        {/* 눈금 — 백분위가 높을수록 위 */}
        {[20, 40, 60, 80, 100].map((p) => (
          <g key={p}>
            <line x1={left} x2={width - right} y1={y(p)} y2={y(p)} className="grid-line" />
            <text x={4} y={y(p) + 4} className="axis-label">{p}</text>
          </g>
        ))}

        <path d={observedArea} fill="url(#percentileArea)" />
        <path d={observedPath} fill="none" stroke="#0CB474" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />

        {/* 예측 구간 — 마지막 관측 → 예상 수능 등급 */}
        {predicted != null && (
          <>
            <line
              x1={x(lastIdx)} y1={y(observed[lastIdx].pct)}
              x2={x(count - 1)} y2={y(predicted)}
              className="prediction-line"
            />
            <circle cx={x(count - 1)} cy={y(predicted)} r="4" fill="#fff" stroke="#0CB474" strokeWidth="2.4" strokeDasharray="2 2" />
            <text x={width - right} y={y(predicted) - 11} textAnchor="end" className="score-end-label">
              예상 {predicted.toFixed(1)}
            </text>
          </>
        )}

        {observed.map((p, i) => (
          <g key={`${p.label}-${i}`}>
            <circle cx={x(i)} cy={y(p.pct)} r="6.2" fill="#9CE6C9" opacity=".55" />
            <circle cx={x(i)} cy={y(p.pct)} r="3.2" fill="#fff" stroke="#0CB474" strokeWidth="2.2" />
          </g>
        ))}

        {/* 보장 기준선 — 이보다 아래로 떨어지면 경증 보장 대상 */}
        {mildLine != null && mildLine >= 0 && (
          <>
            <line x1={width - right - 120} x2={width - right} y1={y(mildLine)} y2={y(mildLine)} className="threshold-line" />
            <text x={width - right} y={y(mildLine) - 6} textAnchor="end" className="threshold-label">
              보장 기준선 {mildLine.toFixed(1)}
            </text>
          </>
        )}

        {observed.map((p, i) => (
          <text key={`lb-${i}`} x={x(i)} y={height - 9} textAnchor="middle" className="x-label">
            {shortRoundLabel(p.label)}
          </text>
        ))}
        {predicted != null && (
          <text x={x(count - 1)} y={height - 9} textAnchor="middle" className="x-label">수능</text>
        )}
      </svg>
    </div>
  );
}

function Chart({ selected }: { selected: "전체" | Subject }) {
  // 과목별 등급 추이. 판정 대상 4과목(국·수·영·탐)을 모두 보여준다.
  const { profile } = useSession();
  const analysis = profile.data?.analysis;

  const width = 360;
  const height = 224;
  const left = 30;
  const right = 10;
  const top = 16;
  const bottom = 28;
  const plotH = height - top - bottom;
  const plotW = width - left - right;

  const rounds = analysis?.round_order ?? [];
  const subjectData = analysis?.subjects ?? {};
  const available = Object.keys(subjectData);
  const visible = selected === "전체" ? available : available.filter((s) => s === selected);

  if (profile.loading) return <div className="subject-chart chart-placeholder">불러오는 중이에요…</div>;
  if (!visible.length) return <div className="subject-chart chart-placeholder">등록된 성적이 없어요.</div>;

  const maxLen = Math.max(...visible.map((s) => subjectData[s].series.length), 1);
  const x = (i: number) => indexToX(i, maxLen, width - right + left, left);
  const y = (p: number) => top + percentileToY(p, plotH, 0);

  return (
    <div className="subject-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="과목별 백분위 추이">
        {[20, 40, 60, 80, 100].map((p) => (
          <g key={p}>
            <line x1={left} x2={width - right} y1={y(p)} y2={y(p)} className="grid-line" />
            <text x={4} y={y(p) + 4} className="axis-label">{p}</text>
          </g>
        ))}
        {visible.map((subject) => {
          const series = subjectData[subject].series;
          const d = series.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
          return (
            <g key={subject}>
              <path d={d} fill="none" stroke={SUBJECT_COLOR[subject] ?? "#0CB474"} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              {series.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r="2.8" fill="#fff" stroke={SUBJECT_COLOR[subject] ?? "#0CB474"} strokeWidth="2" />
              ))}
            </g>
          );
        })}
        {rounds.map((label, i) =>
          i % 2 === 0 ? (
            <text key={label} x={x(i)} y={height - 8} textAnchor="middle" className="x-label">
              {shortRoundLabel(label)}
            </text>
          ) : null,
        )}
      </svg>
      {/* 범례·안내 문구는 그래프 위 과목 필터(subject-filters)와 subject-trend-note 가
          같은 정보를 이미 보여주고 있어 중복이라 걷어냈다 */}
    </div>
  );
}

function GradeIntro({
  onNotification,
  hasUnread,
  onStart,
}: {
  onNotification: () => void;
  hasUnread: boolean;
  onStart: () => void;
}) {
  return (
    <div className="screen page-with-nav grades-intro">
      <BrandTabHeader onNotification={onNotification} hasUnread={hasUnread} />
      <main>
        <span className="eyebrow">성적분석</span>
        <h1>
          아이의 성적 흐름을
          <br />
          <strong>한눈에 살펴보세요</strong>
        </h1>
        <div className="grade-analysis-illustration">
          <img src="/grade-analysis.png" alt="성적 그래프와 돋보기를 살펴보는 일러스트" />
        </div>
        <p>
          모의고사 성적을 바탕으로 과목별 추이와
          <br />
          지금 보완하면 좋은 부분을 정리해 드려요.
        </p>
        <button className="primary-button" onClick={onStart}>
          성적분석 시작하기 <ArrowRight size={18} />
        </button>
      </main>
    </div>
  );
}

function GradeLoading({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 1700);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="screen grade-analysis-loading" aria-live="polite">
      <div className="grade-analysis-loading-art" aria-hidden="true">
        <span>
          <LoaderCircle className="spinner dark" size={36} />
        </span>
      </div>
      <h1>
        최근 성적을 분석하고 있어요
        <br />
        잠시만 기다려 주세요
      </h1>
      <p>과목별 추이와 보완 포인트를 꼼꼼히 확인하는 중이에요.</p>
    </div>
  );
}

function GradeFlow({
  screen,
  setScreen,
  onNotification,
  hasUnread,
}: {
  screen: GradeScreen;
  setScreen: (screen: GradeScreen) => void;
  onNotification: () => void;
  hasUnread: boolean;
}) {
  if (screen === "intro") {
    return <GradeIntro onNotification={onNotification} hasUnread={hasUnread} onStart={() => setScreen("loading")} />;
  }

  if (screen === "loading") {
    return <GradeLoading onDone={() => setScreen("result")} />;
  }

  return (
    <Grades
      onNotification={onNotification}
      hasUnread={hasUnread}
      onBackToIntro={() => setScreen("intro")}
    />
  );
}

function Grades({
  onNotification,
  hasUnread,
  onBackToIntro,
}: {
  onNotification: () => void;
  hasUnread: boolean;
  onBackToIntro: () => void;
}) {
  const [segment, setSegment] = useState<"trend" | "weak">("trend");
  const [selected, setSelected] = useState<"전체" | Subject>("전체");
  const [expandedTrend, setExpandedTrend] = useState(false);
  const trendMoreRef = useRef<HTMLDivElement>(null);

  // 예상 백분위·밴드·기준선은 engine.analyze() 의 band 를 그대로 쓴다.
  // (목데이터를 쓰면 같은 화면의 그래프와 숫자가 어긋난다 — 실제로 어긋나 있었다)
  const { profile } = useSession();
  const band = profile.data?.analysis?.band;
  const predicted = band?.predicted_percentile ?? null;
  const mildLine = band?.mild_threshold_percentile ?? null;
  const predictedText = predicted != null ? Math.round(predicted) : "—";
  // 경증 기준선은 예측치 −1.75σ 다. 그 간격을 되돌려 백분위 σ 를 얻고 ±1σ 를 예상 범위로 쓴다.
  const sigmaPct = predicted != null && mildLine != null ? (predicted - mildLine) / 1.75 : null;
  const rangeText =
    predicted != null && sigmaPct != null
      ? `${Math.max(0, Math.round(predicted - sigmaPct))}~${Math.min(100, Math.round(predicted + sigmaPct))}`
      : "—";
  const dropLineText = mildLine != null ? Math.round(mildLine) : "—";

  // '평균 N등급' 도 API 의 과목별 최근 백분위에서 낸다 (없으면 표시하지 않는다).
  const subjectStats = profile.data?.analysis?.subjects ?? {};
  const latestList = Object.values(subjectStats)
    .map((s) => s.latest)
    .filter((v): v is number => typeof v === "number");
  const averageGradeText = latestList.length
    ? (latestList.reduce((sum, v) => sum + percentileToGrade(v), 0) / latestList.length).toFixed(2)
    : null;

  useEffect(() => {
    if (!expandedTrend) return;
    const timer = window.setTimeout(() => {
      trendMoreRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 170);
    return () => window.clearTimeout(timer);
  }, [expandedTrend]);

  return (
    <div className="screen page-with-nav grades-screen">
      <BrandTabHeader
        tone="green"
        onNotification={onNotification}
        hasUnread={hasUnread}
        onBack={onBackToIntro}
        backLabel="성적분석 홈"
      />
      <main className="grades-content">
        <div className="segment-control" role="tablist" aria-label="성적 분석 보기">
          <button className={segment === "trend" ? "active" : ""} onClick={() => setSegment("trend")}>
            성적 추이
          </button>
          <button className={segment === "weak" ? "active" : ""} onClick={() => setSegment("weak")}>
            집중 보완 과목
          </button>
        </div>

        {segment === "trend" ? (
          <>
            <div className="score-card-stack">
              <section className="score-card white-card">
                <div className="score-heading-row">
                  <div className="score-heading-top">
                    <span className="eyebrow">수능 예상 점수</span>
                    <h2>
                      백분위 <b>{predictedText}</b>
                      <small>예상 범위 {rangeText}</small>
                    </h2>
                  </div>
                  <p>
                    그동안의 모의고사 성적 추이를 바탕으로 예상한 백분위 입니다.
                  </p>
                </div>
                <PercentileChart />
              </section>
              <section className="score-explainer">
                <b>빨간 선({dropLineText}점)은</b> 평소 실력대로라면 나왔을 성적보다 크게 떨어진 &apos;불운&apos;을 판단하는 기준선입니다.
                점수가 이 선 아래로 내려가 재수하게 되면 <b>보험에서 비용을 보장</b>합니다.
              </section>
            </div>

            <button
              type="button"
              className="stability-expand-toggle trend-expand-toggle"
              aria-expanded={expandedTrend}
              onClick={() => setExpandedTrend((current) => !current)}
            >
              {expandedTrend ? "접기" : "전체보기"}
              <ChevronDown size={14} className={expandedTrend ? "flip" : ""} />
            </button>

            <div className={`trend-more${expandedTrend ? " expanded" : ""}`} ref={trendMoreRef}>
              <div>
                <div className="subject-card-stack">
                  <section className="white-card subject-card">
                    <div className="subject-title-row">
                      <span className="eyebrow">과목별 성적 추이</span>
                      {averageGradeText && <strong>평균 {averageGradeText}등급</strong>}
                    </div>
                    <p className="subject-trend-note">
                      백분위는 높을수록 좋아요 · 판정 대상 국어·수학·영어·탐구
                    </p>
                    <div className="subject-filters" aria-label="그래프 과목 필터">
                      {(["전체", ...SUBJECTS] as ("전체" | Subject)[]).map((subject) => (
                        <button
                          key={subject}
                          className={selected === subject ? "active" : ""}
                          onClick={() => setSelected(subject)}
                        >
                          {subject !== "전체" && (
                            <i className="subject-filter-dot" style={{ background: SUBJECT_COLOR[subject] }} />
                          )}
                          {subject}
                        </button>
                      ))}
                    </div>
                    <Chart selected={selected} />
                  </section>
                  <section className="grade-effect-card">
                    <strong>고3 성적이 내려간 것처럼 보여도 걱정마세요.</strong>
                    <p>
                      고3 성적하락은 실력 저하가 아닌 재수생 유입 때문이며, 위 예상 점수는 이를 감안하여
                      계산되었습니다.
                    </p>
                  </section>
                </div>
              </div>
            </div>
          </>
        ) : (
          <WeakSubjects />
        )}
      </main>
    </div>
  );
}

function WeakSubjects() {
  // 안정성 = 등급 변동성의 역수. engine.analyze() 가 과목별 volatility·trend 를 준다.
  const { profile } = useSession();
  const analysis = profile.data?.analysis;
  const subjectStats = analysis?.subjects ?? {};
  const weak = analysis?.weak_subjects ?? [];

  const [prioritySlide, setPrioritySlide] = useState(0);
  const [expandedStability, setExpandedStability] = useState(false);
  const prioritySliderRef = useRef<HTMLDivElement>(null);
  const stabilityMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expandedStability) return;
    const timer = window.setTimeout(() => {
      stabilityMoreRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 170);
    return () => window.clearTimeout(timer);
  }, [expandedStability]);

  // 변동성(백분위 σ)을 0~100 안정성 점수로 — 15%p 이상 흔들리면 0점
  const VOL_CEILING = 15;
  const stability = (vol: number) =>
    Math.max(0, Math.min(100, Math.round((1 - Math.min(vol / VOL_CEILING, 1)) * 100)));

  const rows = Object.entries(subjectStats).map(([name, v]) => {
    const score = stability(v.volatility);
    return { name, score, color: SUBJECT_COLOR[name] ?? "#0CB474", tier: stabilityTier(score) };
  });

  if (profile.loading) {
    return <section className="white-card stability-card chart-placeholder">불러오는 중이에요…</section>;
  }
  if (!rows.length) {
    return (
      <section className="white-card stability-card chart-placeholder">
        등록된 성적이 없어 안정성을 계산할 수 없어요.
      </section>
    );
  }

  const overall = Math.round(rows.reduce((sum, r) => sum + r.score, 0) / rows.length);
  const overallTier = stabilityTier(overall);

  // 추천 순서는 백엔드 weak_subjects(risk_score) 를 그대로 따른다. 안내 문구와 카드가
  // 서로 다른 기준으로 정렬되면 "수학이 가장 흔들린다"면서 1순위는 탐구로 뜬다.
  const byRisk = weak
    .map((w) => rows.find((r) => r.name === w.subject))
    .filter((r): r is (typeof rows)[number] => Boolean(r));
  const ranked = byRisk.length ? byRisk : rows.slice().sort((x, y) => x.score - y.score);
  const worst = ranked[0]?.name;
  const priorityPair = ranked.slice(0, 2);
  // 문구는 과목이 아니라 '순위'에 달려 있다 — 순서가 학생마다 달라지므로.
  const priorityCopy = [
    "성적의 기복이 가장 큰 과목이에요. 점수를 올리기보다 흔들림을 줄이는 데 먼저 집중해보아요.",
    "편차가 있는 편이에요. 기본기를 다지면서 안정도를 함께 올려보아요.",
  ];
  const priorityIcons = [BookOpenCheck, TrendingUp];

  return (
    <>
      <section className="white-card stability-card">
        <div className="card-heading">
          <span className="eyebrow">안정성 점수</span>
          <span className={`warning-badge tone-${overallTier.tone}`}>{overallTier.label}</span>
        </div>
        <div className="stability-summary">
          <div
            className="stability-donut"
            role="img"
            aria-label={`안정성 점수 ${overall}`}
            style={{
              background: `conic-gradient(${stabilityRingColor[overallTier.tone]} 0% ${overall}%, #e3e8e5 ${overall}% 100%)`,
            }}
          >
            <span>
              <strong>{overall}</strong>
            </span>
          </div>
          <p>
            {worst ? (
              <>
                <b>{worst} 과목</b>의 등락이 가장 커요. 기준선보다 안정도가 낮아 집중 보완을 추천해요.
              </>
            ) : (
              "과목별 등락이 고른 편이에요."
            )}
          </p>
        </div>
      </section>
      <section className="white-card subject-stability">
        <div className="card-heading">
          <span className="eyebrow">과목별 안정성</span>
          <h2>흔들림이 적을수록 좋아요</h2>
        </div>
        {rows.map(({ name, score, color, tier }) => (
          <div className="stability-row" key={name}>
            <strong>{name}</strong>
            <div className="report-bar">
              <span style={{ width: `${score}%`, background: color }} />
            </div>
            <b style={{ color }}>{score}</b>
            <em>{tier.label}</em>
          </div>
        ))}
        <p className="stability-footnote">
          백분위 변동폭(σ)을 100점 기준 환산한 참고 지표로, 급락 판정과는 무관해요.
        </p>
      </section>
      <button
        type="button"
        className="stability-expand-toggle"
        aria-expanded={expandedStability}
        onClick={() => setExpandedStability((current) => !current)}
      >
        {expandedStability ? "접기" : "전체보기"}
        <ChevronDown size={14} className={expandedStability ? "flip" : ""} />
      </button>
      <div className={`stability-more${expandedStability ? " expanded" : ""}`} ref={stabilityMoreRef}>
        <div>
          <section className="white-card position-card">
            <span className="eyebrow">과목 포지션 한눈에 보기</span>
            <div className="position-matrix">
              <span className="matrix-label steady">
                <Flag size={14} /> 차근차근
              </span>
              <span className="matrix-label strong">
                <Dumbbell size={14} /> 강점
              </span>
              <span className="matrix-label first">
                <Siren size={14} /> 먼저 챙김
              </span>
              <span className="matrix-label variable">
                <TriangleAlert size={14} /> 당일 변수
              </span>
              <i className="q-dot math">수학</i>
              <i className="q-dot korean">국어</i>
              <i className="q-dot english">영어</i>
              <i className="q-dot inquiry">탐구</i>
              <span className="matrix-axis axis-y">안정성 높음</span>
              <span className="matrix-axis axis-x">점수 높음</span>
            </div>
          </section>
          <section className="focus-priority-section" aria-labelledby="focus-priority-title">
            <div className="card-heading">
              <span className="eyebrow">추천 학습 방향</span>
              <h2 id="focus-priority-title">집중 보완 우선순위</h2>
            </div>
            <div
              className="focus-priority-slider"
              ref={prioritySliderRef}
              onScroll={(event) => {
                const { scrollLeft, clientWidth } = event.currentTarget;
                setPrioritySlide(scrollLeft > Math.max(24, (clientWidth - 22) / 2) ? 1 : 0);
              }}
              aria-label="집중 보완 우선순위 카드. 옆으로 밀어 다음 카드를 확인하세요."
            >
              <div className="focus-priority-track" aria-live="polite">
                {priorityPair.map(({ name, color }, index) => {
                  const Icon = priorityIcons[index];
                  return (
                    <article
                      className="focus-priority-card"
                      key={name}
                      aria-hidden={prioritySlide !== index}
                      style={{ "--priority-accent": color } as CSSProperties}
                    >
                      <div className="focus-priority-copy">
                        <strong>{index + 1}순위 <span>{name}</span></strong>
                        <p>{priorityCopy[index] ?? priorityCopy[priorityCopy.length - 1]}</p>
                      </div>
                      <span className="focus-priority-icon" aria-hidden="true">
                        <Icon size={29} />
                      </span>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

// 학원 형태별 비용·지역 시세 배수·설명 문구는 백엔드(costs.py)가 단일 진실로 들고 있다.
// 여기 있던 사본은 선택을 바꿔도 값이 안 변하는 원인이었으므로 두지 않는다.

const savingsFallbackAmount = 180;
const incomeFallbackAmount = 660;

const SEOUL = "서울";

type ConverterChoices = {
  savings: string;
  children: string;
  retirement: string;
  income: string;
  academy: string;
  /** 거주 시도 — 지역계수의 거시 축 (KOSIS 사교육비). 미선택이면 null. */
  sido: string | null;
  /** 거주 자치구 — 서울일 때만 쓰는 미시 축 (서울 학원 단가) */
  gu: string | null;
};

// 거주지는 처음에 아무것도 고르지 않은 상태로 둔다. 기본값(경기)을 미리 박아 두면
// 사용자가 고르지도 않은 지역의 숫자를 "내 지역 기준"으로 읽게 된다.
// 미선택이면 백엔드가 전국 평균(지역계수 1.0)으로 계산한다.
const CONVERTER_DEFAULTS: ConverterChoices = {
  savings: "150~250",
  children: "2명",
  retirement: "3~5억",
  income: "600~800",
  academy: "재수종합학원",
  sido: null,
  gu: null,
};

/** "2026-07-27T…" → "2026년 7월" — 각주의 갱신 시점 표기. */
function formatUpdateMonth(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}년 ${parsed.getMonth() + 1}월`;
}

function Converter({
  screen,
  setScreen,
  onNotification,
  hasUnread,
}: {
  screen: ConverterScreen;
  setScreen: (screen: ConverterScreen) => void;
  onNotification: () => void;
  hasUnread: boolean;
}) {
  const [converterChoices, setConverterChoices] = useState<ConverterChoices>(
    CONVERTER_DEFAULTS,
  );
  // "왜 이 금액인가요?" 설명 시트
  const [explainOpen, setExplainOpen] = useState(false);
  // 설명 캐시 키의 사용자 축. 로그인 전이면 게스트로 묶는다.
  const { studentId } = useSession();
  const explainUserId = studentId ?? "guest";

  // 계산은 백엔드(costs.py)가 한다 — 웹과 앱이 같은 상수·환산식을 쓰도록.
  // 기존의 comparisonAmount = 2292 하드코딩은 '재수종합학원 + 서울 학군지' 한 조합의
  // 결과였을 뿐이라 선택을 바꿔도 값이 변하지 않았다.
  const catalog = useCostForms();
  const pickValue = (group: string, label: string) =>
    catalog.data?.options?.[group]?.find((o) => o.label.startsWith(label))?.value ?? null;

  const regionCatalog = catalog.data?.region_coefficients;
  // 서울일 때만 구를 넘긴다. 백엔드도 같은 규칙이지만 요청을 깔끔하게 유지한다.
  const isSeoul = converterChoices.sido === SEOUL;

  const estimate = useCostEstimate({
    form: converterChoices.academy,
    sido: converterChoices.sido,
    gu: isSeoul ? converterChoices.gu : null,
    monthly_saving: pickValue("saving", converterChoices.savings),
    monthly_income: pickValue("income", converterChoices.income),
    sibling_count: Number(converterChoices.children.replace(/\D/g, "")) || null,
    retire_goal: pickValue("retirement", converterChoices.retirement),
  });

  const est = estimate.data;
  const comparisonAmount = est?.total ?? 0;
  const coveredAmount = est?.covered ?? 0;
  const finalAmount = est?.self_pay ?? 0;
  const coveragePercent = comparisonAmount > 0 ? Math.round((coveredAmount / comparisonAmount) * 100) : 0;
  // 선택하지 않은 문항은 환산 카드에서 감춘다. 계산 자체는 백엔드(costs.py)가 한다.
  const savingsIsFallback = converterChoices.savings === "선택안함";
  const incomeIsFallback = converterChoices.income === "선택안함";
  const retirementUnset = converterChoices.retirement === "선택안함";
  const childrenIsFallback = converterChoices.children === "선택안함";
  const childrenHidesTuition = childrenIsFallback || converterChoices.children === "1명";

  const formattedComparison = comparisonAmount.toLocaleString("ko-KR");
  // 백엔드가 만든 라벨("서울 강남구")을 쓰고, 응답 전에는 선택값으로 채운다.
  // 거주지를 고르지 않았으면 est.region 이 레거시 기본값("수도권")으로 내려오는데,
  // 고르지도 않은 지역을 "내 지역 기준"으로 적으면 안 되므로 전국 평균이라고 밝힌다.
  const regionLabel = !converterChoices.sido
    ? "전국 평균"
    : est?.region ??
      [converterChoices.sido, isSeoul ? converterChoices.gu : null].filter(Boolean).join(" ");
  const avg = catalog.data?.averages;
  const savingsMonths = est ? String(est.conversions.saving_months) : "—";
  const tuitionTerms = est?.conversions.tuition_semesters != null
    ? String(est.conversions.tuition_semesters) : "—";
  const retirementPercent = est?.conversions.retirement_pct != null
    ? String(est.conversions.retirement_pct) : "—";
  const incomeMonths = est ? String(est.conversions.income_months) : "—";

  const updateConverterChoice = (key: keyof ConverterChoices, value: string) => {
    setConverterChoices((current) => ({ ...current, [key]: value }));
  };

  // 시도를 바꾸면 구 선택은 버린다 — 서울에서 고른 구가 경기도에 남아 있으면 안 된다.
  // null 을 넘기면 거주지 선택 자체를 해제한다 → 백엔드가 전국 평균으로 계산한다.
  const updateSido = (value: string | null) => {
    setConverterChoices((current) => ({
      ...current,
      sido: value,
      gu: value === SEOUL ? current.gu : null,
    }));
  };
  const updateGu = (value: string | null) => {
    setConverterChoices((current) => ({
      ...current,
      gu: value != null && current.gu === value ? null : value,  // 같은 구를 다시 누르면 해제
    }));
  };

  useEffect(() => {
    if (screen !== "loading") return;
    const timer = window.setTimeout(() => setScreen("result"), 1700);
    return () => window.clearTimeout(timer);
  }, [screen, setScreen]);

  // 결과 화면을 벗어나면 설명 시트도 닫는다 — 안 그러면 결과로 되돌아올 때
  // 사용자가 열지도 않은 시트가 떠 있다.
  useEffect(() => {
    if (screen !== "result") setExplainOpen(false);
  }, [screen]);

  if (screen === "intro") {
    return (
      <div className="screen page-with-nav converter-intro">
        <BrandTabHeader onNotification={onNotification} hasUnread={hasUnread} />
        <main>
          <span className="eyebrow">돈(Money) 걱정은 뚝! Don&apos;t Worry</span>
          <h1>
            재수 비용,
            <br />
            <strong>우리 집 기준으로 얼마</strong>일까요?
          </h1>
          <div className="calculator-illustration">
            <div className="notebook">
              <span>₩</span>
            </div>
            <div className="mini-calc">
              <i>123,456</i>
              <b>7</b>
              <b>8</b>
              <b>9</b>
              <b>4</b>
              <b>5</b>
              <b>6</b>
            </div>
          </div>
          <p>입력하신 정보는 보험료와 무관하며 기기에만 저장돼요.</p>
          <button className="primary-button" onClick={() => setScreen("input")}>
            1분 만에 계산하기 <ArrowRight size={18} />
          </button>
        </main>
      </div>
    );
  }

  if (screen === "loading") {
    return (
      <div className="screen converter-loading">
        <div className="converter-loading-mark" aria-hidden="true">
          <LoaderCircle className="spinner dark" size={48} />
        </div>
        <h1>
          우리 집 기준으로
          <br />
          환산하고 있어요…
        </h1>
        <p>저축·등록금·노후 계획 단위로 바꾸는 중</p>
      </div>
    );
  }

  if (screen === "result") {
    return (
      <div className="screen page-with-nav converter-flow-screen">
        <BrandTabHeader
          tone="green"
          onNotification={onNotification}
          hasUnread={hasUnread}
          onBack={() => setScreen("intro")}
          backLabel="돈워리 홈"
        />
        <main className="converter-detail converter-result-page">
          <section className="converter-result-total">
            <span>1년 동안 발생하는 재수 비용은 얼마일까요?</span>
            <strong className="converter-result-amount">
              {formattedComparison}만원
            </strong>
            {/* 전국 평균 대비 배율은 별도 박스로 두지 않는다 — 같은 내용을 우하단
                노재수가 한 문장으로 설명해 준다. 재수유형별 비교표도 뺐다.
                유형은 STEP2 에서 이미 골랐으므로 결과 화면에서 다시 늘어놓을 이유가 없다. */}
            <small>{converterChoices.academy} · {regionLabel} 기준</small>
          </section>

          <div className="converter-result-heading">
            <div>
              <h2><mark>{formattedComparison}만원</mark>, 우리 집엔 얼마나 클까요?</h2>
              <p>연간 재수 비용을 우리 집 가계 단위로 바꿨어요.</p>
            </div>
          </div>

          <div className="converter-equivalents" role="list" aria-label="비교 환산 카드">
            <article className="saving">
              <div className="equivalent-summary">
                <span><WalletCards size={22} /></span>
                <div>
                  <strong>우리 집 월 저축액</strong>
                  {savingsIsFallback && <em className="equivalent-fallback-tag">평균 가구 기준</em>}
                </div>
                <b>{savingsMonths}<small>개월분</small></b>
              </div>
              <div className="equivalent-detail">
                <p>이만큼 저축해야 모을 수 있는 금액이에요.</p>
              </div>
              <div className="equivalent-formula">
                <code>{formattedComparison}만원 ÷ 월 {avg?.monthly_saving ?? "—"}만원</code>
              </div>
            </article>
            {!childrenHidesTuition && (
              <article className="tuition">
                <div className="equivalent-summary">
                  <span><GraduationCap size={23} /></span>
                  <div><strong>동생 대학 등록금</strong></div>
                  <b>{tuitionTerms}<small>학기분</small></b>
                </div>
                <div className="equivalent-detail">
                  <p>이만큼 대학교를 다닐 수 있는 학기예요.</p>
                </div>
                <div className="equivalent-formula">
                  <code>{formattedComparison}만원 ÷ 학기당 {avg?.semester_tuition ?? "—"}만원</code>
                </div>
              </article>
            )}
            {!retirementUnset && (
              <article className="retirement">
                <div className="equivalent-summary">
                  <span><Flag size={22} /></span>
                  <div><strong>노후 자금 목표 대비</strong></div>
                  <b>{retirementPercent}<small>%</small></b>
                </div>
                <div className="equivalent-detail">
                  <p>노후 목표액에서 차지하는 비중이에요.</p>
                </div>
                <div className="equivalent-formula">
                  <code>{formattedComparison}만원 ÷ 목표 {(pickValue("retirement", converterChoices.retirement) ?? 0).toLocaleString("ko-KR")}만원</code>
                </div>
              </article>
            )}
            <article className="income">
              <div className="equivalent-summary">
                <span><CreditCard size={22} /></span>
                <div>
                  <strong>우리 집 월 소득</strong>
                  {incomeIsFallback && <em className="equivalent-fallback-tag">평균 가구 기준</em>}
                </div>
                <b>{incomeMonths}<small>개월치</small></b>
              </div>
              <div className="equivalent-detail">
                <p>몇 달치 소득에 해당하는 금액이에요.</p>
              </div>
              <div className="equivalent-formula">
                <code>{formattedComparison}만원 ÷ 월 {avg?.monthly_income ?? "—"}만원</code>
              </div>
            </article>
          </div>

          <div className="converter-coverage-note">
            <h2><mark>{formattedComparison}만원</mark>, 어떻게 줄어들까요?</h2>
            <p>예상 비용부터 최종 준비 금액까지 단계별로 확인하세요.</p>
            <div className="converter-coverage-steps">
              <div className="coverage-step">
                <strong>{formattedComparison}만원</strong>
                <span>예상 비용</span>
              </div>
              <span className="coverage-operator" aria-hidden="true">–</span>
              <div className="coverage-step">
                <strong>{coveredAmount.toLocaleString("ko-KR")}만원</strong>
                <span>최대 보장</span>
              </div>
              <span className="coverage-operator" aria-hidden="true">=</span>
              <div className="coverage-step final">
                <strong>{finalAmount.toLocaleString("ko-KR")}만원</strong>
                <span>최종 준비</span>
              </div>
            </div>
            <p className="converter-coverage-callout">
              <Lightbulb size={15} className="converter-coverage-callout-icon" aria-hidden="true" />
              보장을 적용하면 전체 예상 비용의 약 {coveragePercent}%를 덜 준비해도 됩니다.
            </p>
          </div>

          {/* 지역을 고르지 않았어도 띄운다 — 그때는 "전국 평균으로 계산했다"는 것 자체가
              설명해야 할 근거다. region_coefficient 유무로 막으면 미선택 상태에서
              노재수가 통째로 사라진다. */}
          {est && (
            <ExplainPanel
              userId={explainUserId}
              재수유형={converterChoices.academy}
              sido={converterChoices.sido}
              gu={isSeoul ? converterChoices.gu : null}
              open={explainOpen}
              onToggle={() => setExplainOpen((v) => !v)}
            />
          )}

          <button
            type="button"
            className="converter-restart"
            onClick={() => {
              setConverterChoices(CONVERTER_DEFAULTS);
              setScreen("input");
            }}
          >
            <RefreshCcw size={17} /> 처음부터 다시 계산하기
          </button>

          <RegionSourceNote sources={regionCatalog?.sources} />
        </main>
      </div>
    );
  }

  const isInput = screen === "input";

  return (
    <div className="screen page-with-nav converter-flow-screen">
      <BrandTabHeader
        tone="green"
        onNotification={onNotification}
        hasUnread={hasUnread}
        onBack={isInput ? () => setScreen("intro") : () => setScreen("input")}
        backLabel={isInput ? "돈워리 홈" : "이전 화면"}
      />
      <main className={`converter-detail converter-form ${isInput ? "input-step" : "cost-step"}`}>
        {isInput ? (
          <>
            <header className="converter-step-heading">
              <span>STEP 1 / 2</span>
              <h1>우리 집 상황을 알려주세요</h1>
              <div className="converter-step-progress"><i style={{ width: "50%" }} /></div>
            </header>
            <FormChoice
              title="월 평균 저축액"
              icon={<WalletCards size={18} />}
              options={catalog.data?.options.saving.map((o) => o.label) ?? ["선택안함"]}
              selected={converterChoices.savings}
              onChange={(value) => updateConverterChoice("savings", value)}
              columns={3}
              note={`${savingsFallbackAmount}만 원 기준값 적용 · '평균 가구 기준' 라벨 표시`}
            />
            <FormChoice
              title="자녀 수"
              icon={<UserRound size={18} />}
              options={catalog.data?.options.sibling.map((o) => o.label) ?? ["선택안함"]}
              selected={converterChoices.children}
              onChange={(value) => updateConverterChoice("children", value)}
              columns={4}
              note="1명으로 간주, '동생 대학 등록금' 카드 미표시"
            />
            <FormChoice
              title="노후 자금 목표액"
              icon={<Flag size={18} />}
              options={catalog.data?.options.retirement.map((o) => o.label) ?? ["선택안함"]}
              selected={converterChoices.retirement}
              onChange={(value) => updateConverterChoice("retirement", value)}
              columns={3}
              note="'노후 자금 목표 대비' 카드가 표시되지 않아요"
            />
            <FormChoice
              title="월 가처분 소득"
              icon={<Home size={18} />}
              options={catalog.data?.options.income.map((o) => o.label) ?? ["선택안함"]}
              selected={converterChoices.income}
              onChange={(value) => updateConverterChoice("income", value)}
              columns={3}
              note={`${incomeFallbackAmount}만 원 기준값 적용 · '평균 가구 기준' 라벨 표시`}
            />
            <button className="primary-button" onClick={() => setScreen("cost")}>
              다음
            </button>
          </>
        ) : (
          <>
            <header className="converter-cost-title">
              <span>STEP 2 / 2</span>
              <h1>재수에 드는 비용부터 정해요</h1>
              <p>평균 통계로 시작하고, 우리 동네 시세에 맞게 조정하세요.</p>
              <div className="converter-step-progress"><i style={{ width: "100%" }} /></div>
            </header>
            <FormChoice
              title="재수 유형 선택"
              icon={<GraduationCap size={18} />}
              options={catalog.data?.forms.map((f) => f.name) ?? ["재수종합학원"]}
              selected={converterChoices.academy}
              onChange={(value) => updateConverterChoice("academy", value)}
              columns={2}
            />
            <RegionChoice
              catalog={regionCatalog}
              sido={converterChoices.sido}
              gu={converterChoices.gu}
              onSidoChange={updateSido}
              onGuChange={updateGu}
            />
            <section className="converter-cost-summary">
              <div>
                <span>월 평균 비용</span>
                <strong>{est ? `${est.monthly.toLocaleString("ko-KR")}만원` : "—"}</strong>
              </div>
              <p>
                {est?.note ?? "업계 평균 기준"}
                {est?.region_coefficient
                  ? ` · ${est.region} 지역계수 ${est.region_coefficient.coefficient.toFixed(2)}배`
                  : ""}
              </p>
              <hr />
              <div className="total">
                <span>10개월 누적 총액</span>
                <strong>{est ? `${formattedComparison}만원` : "계산 중…"}</strong>
              </div>
            </section>
            <RegionSourceNote sources={regionCatalog?.sources} />
            <button className="primary-button" onClick={() => setScreen("loading")}>
              우리 집 기준으로 환산하기
            </button>
          </>
        )}
      </main>
    </div>
  );
}

function FormChoice({
  title,
  icon,
  options,
  selected,
  onChange,
  columns = 3,
  note,
}: {
  title: string;
  icon: React.ReactNode;
  options: string[];
  selected: string;
  onChange: (value: string) => void;
  columns?: 2 | 3 | 4;
  note?: string;
}) {
  const isSkipOption = (option: string) => option === "선택안함";
  return (
    <fieldset className="choice-field">
      <legend>
        <span className="choice-field-title">
          <span aria-hidden="true">{icon}</span>
          {title}
        </span>
      </legend>
      <div className={`choice-grid columns-${columns}`}>
        {options.map((option) => (
          <button
            type="button"
            className={`${selected === option ? "active" : ""} ${isSkipOption(option) ? "no-selection" : ""}`.trim()}
            key={option}
            onClick={() => onChange(option)}
            aria-pressed={selected === option}
          >
            <span>{option}</span>
          </button>
        ))}
      </div>
      {note && isSkipOption(selected) && <p className="choice-field-note">{note}</p>}
    </fieldset>
  );
}

/**
 * 거주지 선택 — 4개 탭(서울 학군지 / 서울 비학군지 / 수도권 / 지방)으로 묶고,
 * 탭 안에서 실제 지역을 고른다.
 *
 * 이전에는 시도 17개를 한 번에 깔고 서울일 때만 자치구 25개를 덧붙였다. 최대 42개
 * 버튼이 한 화면에 쏟아져 "우리 동네가 비싼 편인가"를 읽기 어려웠다. 탭으로 묶으면
 * 한 번에 보이는 버튼이 2~22개로 줄고, 학군지/비학군지 구분도 화면에 드러난다.
 *
 * 묶음 정의(어느 구가 학군지인지 포함)는 서버가 준다 — costs.region_groups().
 * 프론트에서 따로 판정하면 설명 문구("학군지라 학원비가 높은 편이에요")와
 * 화면 분류가 어긋날 수 있다.
 *
 * 고른 결과는 결국 (시도, 구) 한 쌍이라 데이터 기반 지역계수와 "왜 이 금액인가요?"
 * 설명이 그대로 동작한다. 요율의 학원밀집도지수(engine.REGION_CHOICES)와는 무관하다.
 */
function RegionChoice({
  catalog,
  sido,
  gu,
  onSidoChange,
  onGuChange,
}: {
  catalog: RegionCatalog | undefined;
  sido: string | null;
  gu: string | null;
  /** null 이면 선택 해제 — 백엔드가 전국 평균으로 계산한다. */
  onSidoChange: (value: string | null) => void;
  onGuChange: (value: string | null) => void;
}) {
  const groups = catalog?.groups ?? [];

  // 현재 선택이 어느 탭에 속하는지 — 되돌아왔을 때 그 탭이 열려 있어야 한다.
  const activeKeyFromSelection = groups.find((g) =>
    g.sido
      ? sido === g.sido && gu != null && g.items.some((i) => i.name === gu)
      : g.items.some((i) => i.name === sido),
  )?.key;

  const [openKey, setOpenKey] = useState<string | null>(null);
  // 아무것도 고르지 않은 상태가 기본이다 — 첫 탭을 미리 펴 두지 않는다.
  const currentKey = openKey ?? activeKeyFromSelection ?? null;
  const current = groups.find((g) => g.key === currentKey);

  // 탭은 "펼치기"만 한다. 여기서 첫 항목을 자동 선택하면 사용자가 고르지도 않은
  // 지역의 숫자가 "내 지역 기준"으로 찍힌다. 실제 선택은 아래 목록에서 한다.
  // 열려 있는 탭을 다시 누르면 접고 지역 선택도 함께 해제한다 → 다시 깨끗한 4칸.
  const toggleGroup = (group: RegionGroup) => {
    if (group.key === currentKey) {
      setOpenKey(null);
      onSidoChange(null);
      onGuChange(null);
      return;
    }
    setOpenKey(group.key);
  };

  const isPicked = (name: string) =>
    current?.sido ? gu === name : sido === name;

  const pick = (name: string) => {
    if (current?.sido) {
      onSidoChange(current.sido);
      onGuChange(name);
    } else {
      // 같은 시도를 다시 누르면 해제 — 자치구 타일과 동작을 맞춘다.
      onSidoChange(sido === name ? null : name);
    }
  };

  return (
    <fieldset className="choice-field region-choice">
      <legend>
        <span className="choice-field-title">
          <span aria-hidden="true"><MapPin size={18} /></span>
          우리 동네 시세에 맞게 조정
        </span>
      </legend>
      <p>지역마다 학원 시세가 달라요. 사는 곳을 골라주세요.</p>

      <div className="region-tabs" role="tablist" aria-label="지역 분류">
        {groups.map((group) => (
          <button
            type="button"
            key={group.key}
            role="tab"
            id={`region-tab-${group.key}`}
            aria-selected={group.key === currentKey}
            aria-controls={`region-panel-${group.key}`}
            className={group.key === currentKey ? "active" : ""}
            onClick={() => toggleGroup(group)}
          >
            <strong>{group.label}</strong>
            <small>{group.desc}</small>
          </button>
        ))}
      </div>

      {/* 2차 옵션 — 회색 패널로 감싸 상위 4탭과 층위를 구분한다. 같은 흰 타일로
          이어 두면 22개 자치구가 탭과 한 덩어리로 보인다. */}
      {current && (
        <div
          className="region-detail"
          role="tabpanel"
          id={`region-panel-${current.key}`}
          aria-labelledby={`region-tab-${current.key}`}
        >
          <p className="region-detail-title">
            {current.label}에서 사는 곳을 골라주세요 <small>(선택)</small>
          </p>
          <div className="region-grid compact">
            {current.items.map(({ name, coefficient }) => (
              <button
                type="button"
                key={name}
                className={isPicked(name) ? "active" : ""}
                onClick={() => pick(name)}
                aria-pressed={isPicked(name)}
              >
                <span>
                  <strong>{name}</strong>
                  <small>{coefficient.toFixed(2)}배</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </fieldset>
  );
}

/**
 * 결과 화면의 노재수 설명 버튼 — 재계산 버튼 바로 위에 고정으로 놓인다.
 *
 * 예전에는 화면 우하단에 떠 있는 독(fixed)이었고 끌어서 옮길 수 있었는데,
 * 지역계수 각주 위에 겹쳐 앉아 글을 가렸다. 이제 문서 흐름 안에 들어가
 * 아무것도 가리지 않고 위치도 움직이지 않는다.
 *
 * 접힌 상태에서는 마스코트 + 권유 문구가 한 줄짜리 알약 버튼이고, 누르면
 * 같은 상자가 아래로 늘어나며 그 안에 설명이 채워진다.
 *
 * 답 본문은 열렸을 때만 마운트한다 — useDontworryExplain 이 마운트 시점에
 * 요청하므로, 이렇게 해야 화면에 들어오자마자 LLM 을 부르지 않는다. 한 번
 * 받아온 답은 훅 안의 메모에 남아 다시 열 때 즉시 뜬다.
 */
function ExplainPanel({
  userId,
  재수유형,
  sido,
  gu,
  open,
  onToggle,
}: {
  userId: string;
  재수유형: string;
  sido: string | null;
  gu: string | null;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <section className={`explain-panel${open ? " open" : ""}`}>
      <button
        type="button"
        className="explain-panel-trigger"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="explain-panel-mascot" aria-hidden="true">
          <img src="/jaesoo_character.png" alt="" draggable={false} />
        </span>
        <span className="explain-panel-label">
          계산 된 재수 비용 계산 근거를 설명해드려요!
        </span>
        <ChevronDown size={16} className="explain-panel-caret" aria-hidden="true" />
      </button>

      {open && (
        <div className="explain-panel-body">
          <ExplainAnswerBubble userId={userId} 재수유형={재수유형} sido={sido} gu={gu} />
        </div>
      )}
    </section>
  );
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * 설명 문장에서 근거가 되는 세 대목을 노란 하이라이트로 짚는다.
 *   1) 자치구 이름 (송파구·양천구 …)
 *   2) 전국 평균 대비 배율 — "전국 평균의 약 2.07배" / "전국 평균보다 107% 높은"
 *   3) 최종 예상비용 금액 — "3,954만원"
 *
 * 문장 형태는 모델이 매번 조금씩 다르게 쓰므로 문구를 통째로 찾지 않는다.
 * 자치구명과 금액은 breakdown 의 실제 값으로 정확히 맞히고, 배율만 문형을
 * 정규식으로 잡는다. 값이 없으면(지역 미선택 등) 그 항목은 그냥 넘어간다.
 */
function highlightExplain(
  text: string,
  { gu, total }: { gu: string | null; total: number | null; coefficient: number | null },
): React.ReactNode[] {
  const patterns: string[] = [];

  // 배율/증감률 — "전국 평균의 약 1.4배", "전국 평균보다 약 107% 높은"
  patterns.push("전국\\s*평균(?:의|보다)?\\s*(?:약\\s*)?[\\d.,]+\\s*(?:배|%)");
  // 금액은 서버가 준 값으로 정확히 — 천단위 구분이 있든 없든 받는다
  if (typeof total === "number") {
    const withComma = total.toLocaleString("ko-KR");
    patterns.push(`(?:${escapeRegExp(withComma)}|${escapeRegExp(String(total))})\\s*만원`);
  }
  if (gu) patterns.push(escapeRegExp(gu));

  if (!patterns.length) return [text];

  const re = new RegExp(`(${patterns.join("|")})`, "g");
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    out.push(<mark key={`${at}-${m[0]}`}>{m[0]}</mark>);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * 설명 본문 — 패널이 열렸을 때 그 안에 채워진다.
 *
 * 문구는 백엔드가 만든다 — 지역계수는 배치가 계산해 둔 값이고, LLM 은 그 숫자를
 * 문장으로 옮기는 역할만 한다. 실패하면 백엔드가 템플릿 문구를 주므로 여기에
 * 오류 상태가 오는 경우는 네트워크가 아예 끊긴 때뿐이다.
 */
function ExplainAnswerBubble({
  userId,
  재수유형,
  sido,
  gu,
}: {
  userId: string;
  재수유형: string;
  sido: string | null;
  gu: string | null;
}) {
  const { answer, reference, highlight, loading, error } = useDontworryExplain({
    userId,
    재수유형,
    sido,
    gu,
  });

  return (
    <div className="explain-answer" role="status" aria-live="polite">
      {loading ? (
        // 챗봇 대화창과 같은 발자국 러너를 쓴다 — 노재수가 답을 준비하는 표시가
        // 앱 안에서 하나로 읽혀야 한다. 캐시 히트면 거의 보이지 않는다.
        <div
          className="chat-loading-runner explain-runner"
          aria-label="노재수가 답변을 준비하고 있어요"
        >
          <div className="runner-track" aria-hidden="true">
            <span className="paw-print paw-one"><img src="/paw-loader.png" alt="" /></span>
            <span className="paw-print paw-two"><img src="/paw-loader.png" alt="" /></span>
            <span className="paw-print paw-three"><img src="/paw-loader.png" alt="" /></span>
            <span className="paw-print paw-four"><img src="/paw-loader.png" alt="" /></span>
            <div className="runner-mascot"><Mascot size="sm" /></div>
          </div>
        </div>
      ) : error ? (
        <p className="explain-answer-error">{error}</p>
      ) : (
        <>
          <p className="explain-answer-text">
            {answer ? highlightExplain(answer, highlight) : null}
          </p>
          <span className="explain-answer-foot">
            {reference
              ? `${reference.replace("-", "년 ")}월 기준 공공데이터`
              : "공공데이터 기준"}
          </span>
        </>
      )}
    </div>
  );
}

/**
 * 지역계수 출처·갱신시점 각주.
 *
 * 계수가 어디서 왔고 언제 것인지 밝혀야 숫자가 신뢰를 얻는다. 계수 캐시가 없어
 * 전국 평균(1.0)으로 떨어진 상태도 숨기지 않고 알린다.
 */
function RegionSourceNote({ sources }: { sources: RegionSources | undefined }) {
  if (!sources) return null;

  if (!sources.available) {
    return (
      <p className="converter-source-note">
        <Info size={14} aria-hidden="true" />
        지역별 시세를 불러오지 못해 전국 평균 기준으로 계산했어요.
      </p>
    );
  }

  const updated = formatUpdateMonth(sources.generated_at);
  const sidoDataset = sources.sido.dataset ?? "초중고 사교육비조사";
  const year = sources.sido.period ? `${sources.sido.period}년 조사` : null;

  return (
    <p className="converter-source-note">
      <Info size={14} aria-hidden="true" />
      <span>
        시도 배율: {sources.sido.provider} {sidoDataset}
        {year ? ` (${year})` : ""} / 서울 내 구간 보정: {sources.gu.provider} 학원 정보
        {updated ? `, ${updated} 기준` : ""}
      </span>
    </p>
  );
}

type MyMenuItem = {
  label: string;
  detail?: string;
  static?: boolean;
};

const myMenuGroups: { title: string; items: MyMenuItem[] }[] = [
  {
    title: "성적 관리",
    items: [
      { label: "성적 등록 상태", detail: "확인 필요", static: true },
      { label: "모의고사 성적 히스토리" },
    ],
  },
  {
    title: "결제 관리",
    items: [{ label: "보험료 결제" }, { label: "보험료 납입 내역" }, { label: "결제 수단 관리" }],
  },
  {
    title: "기타",
    items: [{ label: "알림 설정" }, { label: "테마 설정" }, { label: "약관 및 정책" }],
  },
];

const gradeHistory = [
  ["고3 9월", "2025.09.03", "67", "▼3"],
  ["고3 6월", "2025.06.04", "70", "▲6"],
  ["고3 3월", "2025.03.27", "64", "–"],
  ["고2 12월", "2024.11.14", "64", "▲4"],
  ["고2 9월", "2024.09.04", "60", "▼2"],
  ["고2 6월", "2024.06.04", "62", "–"],
  ["고2 3월", "2024.03.28", "62", "▲7"],
  ["고1 12월", "2023.11.16", "55", "▲1"],
  ["고1 9월", "2023.09.06", "54", "–"],
];

const gradeSubjectHistory = [
  [["국어", "59점", "5등급 ▼", "danger"], ["수학", "76점", "4등급", ""], ["영어", "68점", "4등급", ""], ["탐구", "59점", "5등급", ""]],
  [["국어", "60점", "4등급", ""], ["수학", "66점", "4등급", ""], ["영어", "64점", "4등급", ""], ["탐구", "53점", "5등급 ▼", "danger"]],
  [["국어", "63점", "4등급 ▲", "positive"], ["수학", "69점", "4등급 ▲", "positive"], ["영어", "67점", "4등급 ▲", "positive"], ["탐구", "66점", "4등급 ▲", "positive"]],
  [["국어", "61점", "4등급", ""], ["수학", "65점", "4등급", ""], ["영어", "66점", "4등급 ▲", "positive"], ["탐구", "63점", "4등급", ""]],
  [["국어", "58점", "5등급 ▼", "danger"], ["수학", "63점", "4등급", ""], ["영어", "61점", "4등급", ""], ["탐구", "60점", "4등급", ""]],
  [["국어", "60점", "4등급", ""], ["수학", "62점", "4등급", ""], ["영어", "63점", "4등급", ""], ["탐구", "62점", "4등급", ""]],
  [["국어", "57점", "5등급", ""], ["수학", "61점", "4등급 ▲", "positive"], ["영어", "62점", "4등급 ▲", "positive"], ["탐구", "59점", "5등급", ""]],
  [["국어", "54점", "5등급", ""], ["수학", "58점", "5등급", ""], ["영어", "56점", "5등급", ""], ["탐구", "55점", "5등급 ▲", "positive"]],
  [["국어", "53점", "5등급", ""], ["수학", "56점", "5등급", ""], ["영어", "55점", "5등급", ""], ["탐구", "54점", "5등급", ""]],
];

// TODO: 보험료 결제 내역은 학생별 DB 조회 결과로 교체될 임시 목데이터입니다.
const paymentHistory = [
  ["2026년 7월", "45,000원"],
  ["2026년 6월", "45,000원"],
  ["2026년 5월", "48,000원"],
  ["2026년 4월", "48,000원"],
  ["2026년 3월", "46,500원"],
  ["2026년 2월", "44,000원"],
];

type CardForm = {
  provider: string;
  number: string;
  expiry: string;
  cvc: string;
  owner: string;
};

type PaymentScenario = "success" | "declined" | "limit" | "invalid" | "network" | "timeout" | "pending";
type PaymentStatus = "checkout" | "processing" | "success" | "failed" | "pending";
type MethodSaveStatus = "idle" | "saving" | "verifying" | "error";

const paymentFailureCopy: Record<Exclude<PaymentScenario, "success" | "pending">, { title: string; description: string; action: string }> = {
  declined: {
    title: "카드 승인이 거절됐어요",
    description: "카드사에서 결제를 승인하지 않았어요. 다른 결제수단을 선택하거나 카드사에 확인해 주세요.",
    action: "다른 결제수단 선택",
  },
  limit: {
    title: "카드 한도를 확인해 주세요",
    description: "이용 한도 또는 잔액이 부족해 결제를 완료하지 못했어요.",
    action: "다른 결제수단 선택",
  },
  invalid: {
    title: "카드 정보를 확인해 주세요",
    description: "등록된 카드 정보가 유효하지 않아요. 결제수단을 다시 등록해 주세요.",
    action: "결제수단 확인",
  },
  network: {
    title: "네트워크 연결이 불안정해요",
    description: "결제 요청을 전송하지 못했어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.",
    action: "다시 시도",
  },
  timeout: {
    title: "결제 처리 시간이 초과됐어요",
    description: "승인 결과를 받지 못했어요. 중복 결제를 막기 위해 결제 내역을 먼저 확인해 주세요.",
    action: "결제 상태 다시 확인",
  },
};

function PaymentPageSkeleton() {
  return (
    <div className="payment-page-skeleton" role="status" aria-label="결제 정보를 불러오는 중">
      <span className="skeleton-line short" />
      <span className="skeleton-line title" />
      <section><span /><strong /></section>
      <section className="method"><span /><span /></section>
      <p>결제 정보를 불러오고 있어요</p>
    </div>
  );
}

function PaymentMethodStatusPanel({
  status,
  onRetry,
  onEdit,
}: {
  status: Exclude<MethodSaveStatus, "idle">;
  onRetry: () => void;
  onEdit: () => void;
}) {
  const isError = status === "error";
  return (
    <section className={`payment-method-status ${isError ? "error" : ""}`} role="status" aria-live="polite">
      <span>{isError ? <TriangleAlert size={30} /> : <LoaderCircle className="spinner dark" size={34} />}</span>
      <h2>{isError ? "카드를 등록하지 못했어요" : status === "saving" ? "카드 정보를 안전하게 저장하고 있어요" : "카드사 인증을 진행하고 있어요"}</h2>
      <p>{isError ? "카드 정보 또는 네트워크 상태를 확인한 뒤 다시 시도해 주세요." : "잠시만 기다려 주세요. 화면을 닫지 않아도 돼요."}</p>
      {isError && (
        <div>
          <button type="button" onClick={onEdit}>정보 수정</button>
          <button type="button" onClick={onRetry}>다시 시도</button>
        </div>
      )}
    </section>
  );
}

function PaymentMethodFields({
  cardForm,
  setCardForm,
}: {
  cardForm: CardForm;
  setCardForm: (value: CardForm) => void;
}) {
  return (
    <div className="payment-field-grid">
      <label className="payment-field full">
        <span>카드사</span>
        <select
          value={cardForm.provider}
          onChange={(event) => setCardForm({ ...cardForm, provider: event.target.value })}
        >
          {cardProviders.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="payment-field full">
        <span>카드 번호</span>
        <input
          inputMode="numeric"
          autoComplete="cc-number"
          value={cardForm.number}
          placeholder="0000 0000 0000 0000"
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 16);
            setCardForm({ ...cardForm, number: digits.replace(/(\d{4})(?=\d)/g, "$1 ") });
          }}
        />
      </label>
      <label className="payment-field">
        <span>유효기간</span>
        <input
          inputMode="numeric"
          autoComplete="cc-exp"
          value={cardForm.expiry}
          placeholder="MM/YY"
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
            setCardForm({ ...cardForm, expiry: digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits });
          }}
        />
      </label>
      <label className="payment-field">
        <span>CVC</span>
        <input
          inputMode="numeric"
          autoComplete="cc-csc"
          type="password"
          value={cardForm.cvc}
          placeholder="3자리"
          onChange={(event) => setCardForm({ ...cardForm, cvc: event.target.value.replace(/\D/g, "").slice(0, 3) })}
        />
      </label>
      <label className="payment-field full">
        <span>카드 명의자</span>
        <input
          autoComplete="cc-name"
          value={cardForm.owner}
          placeholder="이름을 입력해 주세요"
          onChange={(event) => setCardForm({ ...cardForm, owner: event.target.value.slice(0, 20) })}
        />
      </label>
    </div>
  );
}

function MyDetailPage({
  detail,
  close,
  onNotification,
  hasUnread,
  canvasTone,
  onChangeCanvasTone,
}: {
  detail: string;
  close: () => void;
  onNotification: () => void;
  hasUnread: boolean;
  canvasTone: CanvasTone;
  onChangeCanvasTone: (tone: CanvasTone) => void;
}) {
  const [notificationSettings, setNotificationSettings] = useState([true, true, true, false]);
  const [gradeSort, setGradeSort] = useState<"recent" | "past">("recent");
  const [expandedGrades, setExpandedGrades] = useState<string[]>([]);
  const [visiblePaymentCount, setVisiblePaymentCount] = useState(6);
  const [paymentMethodView, setPaymentMethodView] = useState<"list" | "add">("list");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("checkout");
  const [paymentScenario, setPaymentScenario] = useState<PaymentScenario>("success");
  const [methodSaveStatus, setMethodSaveStatus] = useState<MethodSaveStatus>("idle");
  const [methodRegistrationScenario, setMethodRegistrationScenario] = useState<"success" | "error">("success");
  const [pendingCard, setPendingCard] = useState<CardForm | null>(null);
  const [paymentMethods, setPaymentMethods] = useState([
    { id: paymentMethod.last4, name: `${paymentMethod.provider} (${paymentMethod.ownerType})`, lastFour: paymentMethod.last4, default: true },
  ]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(paymentMethod.last4);
  const [cardForm, setCardForm] = useState<CardForm>({ provider: cardProviders[0], number: "", expiry: "", cvc: "", owner: "" });
  const isPaymentDetail = detail === "보험료 결제";
  const [paymentDataLoading, setPaymentDataLoading] = useState(isPaymentDetail);

  useEffect(() => {
    if (!isPaymentDetail) return;
    setPaymentDataLoading(true);
    const timer = window.setTimeout(() => setPaymentDataLoading(false), 850);
    return () => window.clearTimeout(timer);
  }, [detail, isPaymentDetail]);

  useEffect(() => {
    if (paymentStatus !== "processing") return;
    const timer = window.setTimeout(() => {
      if (paymentScenario === "success") setPaymentStatus("success");
      else if (paymentScenario === "pending") setPaymentStatus("pending");
      else setPaymentStatus("failed");
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [paymentScenario, paymentStatus]);

  useEffect(() => {
    if (methodSaveStatus === "saving") {
      const timer = window.setTimeout(() => setMethodSaveStatus("verifying"), 700);
      return () => window.clearTimeout(timer);
    }
    if (methodSaveStatus !== "verifying") return;
    const timer = window.setTimeout(() => {
      if (methodRegistrationScenario === "error" || !pendingCard) {
        setMethodSaveStatus("error");
        return;
      }
      const lastFour = pendingCard.number.replace(/\D/g, "").slice(-4);
      const newMethod = { id: `${lastFour}-${paymentMethods.length}`, name: `${pendingCard.provider} (${pendingCard.owner})`, lastFour, default: false };
      setPaymentMethods((current) => [...current, newMethod]);
      setSelectedPaymentMethod(newMethod.id);
      setCardForm({ provider: cardProviders[0], number: "", expiry: "", cvc: "", owner: "" });
      setPendingCard(null);
      setMethodSaveStatus("idle");
      setPaymentMethodView("list");
    }, 900);
    return () => window.clearTimeout(timer);
  }, [methodRegistrationScenario, methodSaveStatus, paymentMethods.length, pendingCard]);

  const orderedGradeHistory = gradeHistory
    .map((row, index) => ({ row, subjects: gradeSubjectHistory[index] }))
    .sort((a, b) => gradeSort === "recent" ? b.row[1].localeCompare(a.row[1]) : a.row[1].localeCompare(b.row[1]));
  const allGradesExpanded = expandedGrades.length === gradeHistory.length;

  const toggleGrade = (date: string) => {
    setExpandedGrades((current) => current.includes(date) ? current.filter((item) => item !== date) : [...current, date]);
  };
  const cardFormComplete =
    cardForm.number.replace(/\D/g, "").length === 16 &&
    cardForm.expiry.length === 5 &&
    cardForm.cvc.length === 3 &&
    cardForm.owner.trim().length > 1;
  const startPaymentMethodSave = () => {
    if (!cardFormComplete) return;
    setPendingCard({ ...cardForm });
    setMethodSaveStatus("saving");
  };
  const handleMyDetailBack = () => {
    if (paymentStatus === "processing" || methodSaveStatus === "saving" || methodSaveStatus === "verifying") return;
    if (detail === "결제 수단 관리" && paymentMethodView === "add") {
      setMethodSaveStatus("idle");
      setPaymentMethodView("list");
      return;
    }
    if (detail === "보험료 결제" && paymentStatus !== "checkout") {
      setPaymentStatus("checkout");
      return;
    }
    close();
  };

  return (
    <div className="screen page-with-nav mypage-screen my-detail-screen">
      <BrandTabHeader onNotification={onNotification} hasUnread={hasUnread} />
      <main className="my-detail-content">
        <button
          className="my-detail-back"
          onClick={handleMyDetailBack}
          disabled={paymentStatus === "processing" || methodSaveStatus === "saving" || methodSaveStatus === "verifying"}
        >
          <ChevronLeft size={17} /> 뒤로
        </button>

        {isPaymentDetail && paymentDataLoading && <PaymentPageSkeleton />}

        {detail === "성적 등록 상태" && (
          <>
            <section className="my-status-summary">
              <div><strong>현재 상태</strong><em>확인 필요</em></div>
              <p>OCR로 인식한 성적 중 확인이 필요한 항목이 있어요. 결과를 확인해 주세요.</p>
            </section>
            <h1 className="my-detail-title">상태 히스토리</h1>
            <div className="my-history-list">
              {[
                ["이의신청중", "국어 성적 이의신청이 접수되어 운영팀이 검수하고 있어요.", "2026.07.18"],
                ["확인필요", "OCR 인식 신뢰도가 낮은 항목이 있어 확인이 필요했어요.", "2026.07.15"],
                ["확정", "고3 3월 모의고사 성적이 확정되어 보험료 산정에 반영됐어요.", "2026.03.12"],
                ["확정", "고2 9월 모의고사 성적이 확정됐어요.", "2025.09.05"],
              ].map(([status, description, date]) => (
                <article key={date}>
                  <div><strong>{status}</strong><time>{date}</time></div>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </>
        )}

        {detail === "모의고사 성적 히스토리" && (
          <>
            <section className="my-grade-status">
              <strong>최근 모의고사 성적</strong>
              <span>확인 대기 중</span>
            </section>
            <div className="my-detail-heading-row">
              <h1>모의고사 히스토리</h1>
              <div>
                <button
                  className="active"
                  onClick={() => setGradeSort((current) => current === "recent" ? "past" : "recent")}
                >
                  {gradeSort === "recent" ? "최근순" : "과거순"}
                </button>
                <button onClick={() => setExpandedGrades(allGradesExpanded ? [] : gradeHistory.map((row) => row[1]))}>
                  {allGradesExpanded ? "전체 접기" : "전체 펼치기"}
                </button>
              </div>
            </div>
            <div className="my-grade-history">
              {orderedGradeHistory.map(({ row: [exam, date, percentile, change], subjects }) => {
                const expanded = expandedGrades.includes(date);
                return (
                  <article className={expanded ? "expanded" : ""} key={date}>
                    <div className="grade-history-summary">
                      <span><strong>{exam}</strong><small>{date}</small></span>
                      <b>백분위 {percentile} <em className={change.includes("▼") ? "down" : "up"}>{change}</em></b>
                      <button
                        className="grade-expand-button"
                        onClick={() => toggleGrade(date)}
                        aria-label={`${exam} ${expanded ? "접기" : "펼치기"}`}
                        aria-expanded={expanded}
                      >
                        <ChevronDown size={15} />
                      </button>
                    </div>
                    {expanded && (
                      <div className="grade-subject-grid">
                        {subjects.map(([subject, score, grade, tone]) => (
                          <div className={tone} key={subject}>
                            <span>{subject}</span><strong>{score}</strong><b>{grade}</b>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}

        {detail === "보험료 납입 내역" && !paymentDataLoading && (
          <>
            <section className="my-premium-summary">
              <span>이번 달 보험료</span>
              <strong>45,000원</strong>
              <em>전월 대비 -3,000원</em>
            </section>
            <section className="my-payment-card">
              <div className="payment-receipt">
                <CircleCheck size={30} />
                <strong>월별 납입 영수증</strong>
                <small>No. RCPT-20260302-017</small>
              </div>
              <div className="payment-total">
                <span>총 납입 합계<strong>320,500원</strong></span>
                <em>전액 정상 납입</em>
              </div>
              <div className="year-filter"><button className="active">2026년</button><button>2025년</button></div>
              <div className="payment-table">
                <div className="table-head"><span>납입 연월</span><span>결제 금액</span><span>처리 상태</span></div>
                {paymentHistory.slice(0, visiblePaymentCount).map(([month, amount]) => (
                  <div key={month}><span>{month}</span><strong>{amount}</strong><em>완료</em></div>
                ))}
              </div>
              {paymentHistory.length > visiblePaymentCount && (
                <button
                  className="payment-more"
                  onClick={() => setVisiblePaymentCount((current) => Math.min(current + 6, paymentHistory.length))}
                >
                  더보기 ({paymentHistory.length - visiblePaymentCount}건)
                </button>
              )}
            </section>
          </>
        )}

        {detail === "보험료 결제" && !paymentDataLoading && paymentStatus === "checkout" && (
          <>
            <div className="my-payment-heading">
              <span>보험료 결제</span>
              <h1>다음 보험료를 납부할게요</h1>
              <p>결제 금액과 수단을 확인한 뒤 결제해 주세요.</p>
            </div>
            <section className="my-checkout-summary">
              <div><span>2026년 8월 보험료</span><em>납부 예정일 8월 12일</em></div>
              <strong>45,000원</strong>
            </section>
            <section className="my-checkout-methods">
              <div className="my-section-heading">
                <h2>결제 수단</h2>
                <button onClick={() => setPaymentMethodView("add")}>결제수단 추가</button>
              </div>
              {paymentMethodView === "add" ? (
                methodSaveStatus === "idle" ? (
                  <form
                    className="payment-method-form inline"
                    onSubmit={(event) => {
                      event.preventDefault();
                      startPaymentMethodSave();
                    }}
                  >
                    <PaymentMethodFields cardForm={cardForm} setCardForm={setCardForm} />
                    <details className="payment-simulator compact">
                      <summary>카드 등록 상태 테스트</summary>
                      <select value={methodRegistrationScenario} onChange={(event) => setMethodRegistrationScenario(event.target.value as "success" | "error")}>
                        <option value="success">정상 등록</option>
                        <option value="error">등록 실패</option>
                      </select>
                    </details>
                    <div className="payment-form-actions">
                      <button type="button" className="payment-cancel-button" onClick={() => setPaymentMethodView("list")}>취소</button>
                      <button type="submit" className="payment-save-button" disabled={!cardFormComplete}>저장</button>
                    </div>
                  </form>
                ) : (
                  <PaymentMethodStatusPanel
                    status={methodSaveStatus}
                    onEdit={() => setMethodSaveStatus("idle")}
                    onRetry={() => setMethodSaveStatus("saving")}
                  />
                )
              ) : (
                <div className="payment-method-options">
                  {paymentMethods.map((method) => (
                    <button
                      type="button"
                      className={selectedPaymentMethod === method.id ? "active" : ""}
                      key={method.id}
                      onClick={() => setSelectedPaymentMethod(method.id)}
                      aria-pressed={selectedPaymentMethod === method.id}
                    >
                      <span className="payment-method-icon"><CreditCard size={19} /></span>
                      <span><strong>{method.name}</strong><small>•••• {method.lastFour}</small></span>
                      {method.default && <em>기본</em>}
                      <i><Check size={14} /></i>
                    </button>
                  ))}
                </div>
              )}
            </section>
            <div className="payment-security-note"><LockKeyhole size={15} /> 결제 정보는 암호화되어 안전하게 처리돼요.</div>
            <details className="payment-simulator">
              <summary>프로토타입 결제 상태 테스트</summary>
              <label>
                <span>결제 결과</span>
                <select value={paymentScenario} onChange={(event) => setPaymentScenario(event.target.value as PaymentScenario)}>
                  <option value="success">정상 승인</option>
                  <option value="declined">카드 승인 거절</option>
                  <option value="limit">한도·잔액 부족</option>
                  <option value="invalid">카드 정보 오류</option>
                  <option value="network">네트워크 오류</option>
                  <option value="timeout">처리 시간 초과</option>
                  <option value="pending">결제 결과 확인 지연</option>
                </select>
              </label>
            </details>
            <button
              className="primary-button my-pay-button"
              disabled={!selectedPaymentMethod || paymentMethodView === "add"}
              onClick={() => setPaymentStatus("processing")}
            >
              45,000원 결제하기
            </button>
          </>
        )}

        {detail === "보험료 결제" && !paymentDataLoading && paymentStatus === "processing" && (
          <section className="payment-processing-view" role="status" aria-live="polite">
            <span><LoaderCircle className="spinner dark" size={43} /></span>
            <h1>보험료를 결제하고 있어요</h1>
            <p>중복 결제 방지를 위해 화면을 닫지 말아 주세요.</p>
            <div><LockKeyhole size={14} /> 안전하게 암호화해 처리 중이에요</div>
          </section>
        )}

        {detail === "보험료 결제" && !paymentDataLoading && paymentStatus === "success" && (
          <section className="payment-complete-view">
            <span className="payment-complete-icon"><CircleCheck size={38} /></span>
            <h1>보험료 결제가 완료됐어요</h1>
            <p>2026년 8월 보험료 45,000원이 정상적으로 납부됐습니다.</p>
            <div>
              <span>결제 수단<strong>{paymentMethods.find((method) => method.id === selectedPaymentMethod)?.name}</strong></span>
              <span>승인 일시<strong>2026.07.25 14:32</strong></span>
              <span>처리 상태<strong className="positive">결제 완료</strong></span>
            </div>
            <button className="primary-button" onClick={close}>마이로 돌아가기</button>
          </section>
        )}

        {detail === "보험료 결제" && !paymentDataLoading && paymentStatus === "failed" && paymentScenario !== "success" && paymentScenario !== "pending" && (
          <section className="payment-result-view error" role="alert">
            <span><TriangleAlert size={36} /></span>
            <h1>{paymentFailureCopy[paymentScenario].title}</h1>
            <p>{paymentFailureCopy[paymentScenario].description}</p>
            <div className="payment-result-actions">
              <button
                className="primary-button"
                onClick={() => {
                  if (paymentScenario === "network" || paymentScenario === "timeout") {
                    setPaymentScenario("success");
                    setPaymentStatus("processing");
                  } else {
                    setPaymentStatus("checkout");
                  }
                }}
              >
                {paymentFailureCopy[paymentScenario].action}
              </button>
              <button className="secondary-button" onClick={close}>마이로 돌아가기</button>
            </div>
          </section>
        )}

        {detail === "보험료 결제" && !paymentDataLoading && paymentStatus === "pending" && (
          <section className="payment-result-view pending" role="status" aria-live="polite">
            <span><Clock3 size={36} /></span>
            <h1>결제 결과를 확인하고 있어요</h1>
            <p>카드사 승인은 요청됐지만 최종 결과가 늦어지고 있어요. 중복 결제 없이 확인되는 대로 알려드릴게요.</p>
            <div className="payment-pending-reference">
              <span>결제 요청 번호<strong>PAY-20260725-0812</strong></span>
              <span>현재 상태<strong>승인 확인 중</strong></span>
            </div>
            <div className="payment-result-actions">
              <button
                className="primary-button"
                onClick={() => {
                  setPaymentScenario("success");
                  setPaymentStatus("processing");
                }}
              >
                결제 상태 다시 확인
              </button>
              <button className="secondary-button" onClick={close}>나중에 확인하기</button>
            </div>
          </section>
        )}

        {detail === "결제 수단 관리" && !paymentDataLoading && paymentMethodView === "list" && (
          <>
            <h1 className="my-detail-title">결제 수단 관리</h1>
            <div className="my-payment-method-list">
              {paymentMethods.map((method) => (
                <section className="my-management-item" key={method.id}>
                  <span className="payment-method-icon"><CreditCard size={19} /></span>
                  <div>
                    <strong>{method.name}</strong>
                    <p>•••• {method.lastFour} · 매월 자동이체</p>
                  </div>
                  {method.default && <em>기본</em>}
                </section>
              ))}
            </div>
            <button className="my-add-item" onClick={() => setPaymentMethodView("add")}>+ 새 결제수단 추가</button>
          </>
        )}

        {detail === "결제 수단 관리" && !paymentDataLoading && paymentMethodView === "add" && (
          <>
            {methodSaveStatus === "idle" ? (
              <>
                <div className="my-payment-heading">
                  <span>결제 수단 추가</span>
                  <h1>새 카드를 등록해 주세요</h1>
                  <p>본인 명의의 신용·체크카드를 등록할 수 있어요.</p>
                </div>
                <form
                  className="payment-method-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    startPaymentMethodSave();
                  }}
                >
                  <PaymentMethodFields cardForm={cardForm} setCardForm={setCardForm} />
                  <label className="payment-consent">
                    <input type="checkbox" defaultChecked />
                    <span>결제수단 등록 및 정기결제 이용에 동의합니다.</span>
                  </label>
                  <details className="payment-simulator compact">
                    <summary>카드 등록 상태 테스트</summary>
                    <select value={methodRegistrationScenario} onChange={(event) => setMethodRegistrationScenario(event.target.value as "success" | "error")}>
                      <option value="success">정상 등록</option>
                      <option value="error">등록 실패</option>
                    </select>
                  </details>
                  <button className="primary-button" type="submit" disabled={!cardFormComplete}>결제수단 저장</button>
                </form>
              </>
            ) : (
              <PaymentMethodStatusPanel
                status={methodSaveStatus}
                onEdit={() => setMethodSaveStatus("idle")}
                onRetry={() => setMethodSaveStatus("saving")}
              />
            )}
          </>
        )}

        {detail === "알림 설정" && (
          <>
            <h1 className="my-detail-title">알림 설정</h1>
            <section className="my-toggle-list">
              {["성적표 등록 알림", "보험료 산정 알림", "이의신청 처리 알림", "혜택 및 이벤트 알림"].map((label, index) => (
                <button
                  key={label}
                  role="switch"
                  aria-checked={notificationSettings[index]}
                  onClick={() => setNotificationSettings((current) => current.map((value, i) => i === index ? !value : value))}
                >
                  <span>{label}</span><i className={notificationSettings[index] ? "on" : ""} />
                </button>
              ))}
            </section>
          </>
        )}

        {detail === "테마 설정" && (
          <>
            <h1 className="my-detail-title">테마 설정</h1>
            <p className="my-detail-desc">앱 전체에 적용할 배경 테마를 선택하세요.</p>
            <section className="theme-option-list">
              {[
                { tone: "cream-white" as const, label: "크림 & 화이트", desc: "따뜻한 크림 배경 + 화이트 콘텐츠 영역", swatch: "#FFFBF2" },
                { tone: "gray-white" as const, label: "회색 & 화이트", desc: "차분한 회색 배경 + 화이트 콘텐츠 영역", swatch: "#F3F3F3" },
              ].map((option) => (
                <button
                  key={option.tone}
                  type="button"
                  className={`theme-option ${canvasTone === option.tone ? "active" : ""}`}
                  onClick={() => onChangeCanvasTone(option.tone)}
                  aria-pressed={canvasTone === option.tone}
                >
                  <span className="theme-swatch" style={{ background: option.swatch }}>
                    <Sun size={16} />
                  </span>
                  <span className="theme-option-text">
                    <strong>{option.label}</strong>
                    <small>{option.desc}</small>
                  </span>
                  {canvasTone === option.tone && <Check size={18} />}
                </button>
              ))}
            </section>
          </>
        )}

        {detail === "약관 및 정책" && (
          <>
            <h1 className="my-detail-title">보험상품 약관</h1>
            <article className="my-terms">
              <p className="my-terms-intro">재수없수 교육보험 보통약관의 핵심 내용을 이해하기 쉽게 요약했어요.</p>

              <h2>계약과 청약철회</h2>
              <p>계약은 가입자의 청약과 회사의 승낙으로 성립합니다. 관계 법령이 정한 기간 안에는 청약을 철회할 수 있고, 약관 전달·중요내용 설명·자필서명 등 품질보증 요건이 지켜지지 않았다면 계약 성립일부터 3개월 이내에 취소를 요구할 수 있습니다.</p>

              <h2>보장받는 경우</h2>
              <p>수능 성적이 학생별 예측 밴드의 하단보다 낮아지고 실제로 재수 또는 반수를 실행한 경우 보험금을 지급합니다. 하락 정도는 단순 점수 차가 아니라 개인별 성적 변동성을 반영한 표준편차 기준으로 경증과 중증을 구분하며, 가입한 티어의 보장액과 한도는 갱신으로 바뀌지 않습니다.</p>

              <h2>보험료 산정과 갱신</h2>
              <p>보험료는 누적 모의고사 성적과 사전에 공개된 산식으로 산정합니다. 갱신은 매월이 아니라 고2 3월, 고3 3월과 9월에 총 3회 실시하고, 고3 9월 이후에는 동결합니다. 한 번의 시험만으로 결정하지 않으며 1회 변동폭과 최초 보험료 대비 누적 인상 상한을 적용합니다.</p>

              <h2>보험료 납입</h2>
              <p>최초 보험료와 이후 보험료는 약정한 납입일에 납부해야 합니다. 갱신 보험료는 사전 통지 후 다음 납입일부터 적용됩니다. 미납 시 납입최고 기간을 거쳐 계약이 해지될 수 있으며, 정해진 요건을 충족하면 부활을 청구할 수 있습니다.</p>

              <h2>보험금 청구</h2>
              <p>수능 성적표와 함께 다음 학년도 수능 응시원서, 재수 교육과정 등록 또는 반수 응시 등 실제 재수·반수 실행을 확인할 수 있는 자료를 제출해야 합니다. 회사는 서류 접수 후 정해진 기한 안에 지급하며, 추가 조사가 필요하면 사유와 지급예정일을 안내합니다. 보험금 청구권은 사고 발생일부터 통상 3년 안에 행사해야 합니다.</p>

              <h2>지급 제한과 계약 해지</h2>
              <p>수능 성적이 밴드 하단 이상인 경우, 성적표나 재수 증빙의 위·변조, 보험사기, 중대한 고지의무 위반 또는 미보장 가입 구간은 보험금 부지급이나 계약 해지 사유가 될 수 있습니다. 계약자는 언제든지 해지할 수 있으나 순수보장성 상품이므로 해약환급금은 미경과보험료에서 해지공제를 뺀 금액으로 산정됩니다.</p>

              <a className="my-terms-link" href={policyLink()} target="_blank" rel="noreferrer">
                전체 약관 원문 보기 <ArrowUpRight size={14} />
              </a>
              <small>이 화면은 핵심 요약이며, 세부 조건과 법적 효력은 전체 약관 및 개별 계약 내용을 따릅니다.</small>
            </article>
          </>
        )}
      </main>
    </div>
  );
}

function MyPage({
  onLogout,
  onNotification,
  hasUnread,
  canvasTone,
  onChangeCanvasTone,
}: {
  onLogout: () => void;
  onNotification: () => void;
  hasUnread: boolean;
  canvasTone: CanvasTone;
  onChangeCanvasTone: (tone: CanvasTone) => void;
}) {
  const [detail, setDetail] = useState<string | null>(null);

  // 마이 상세는 AppShell 이 모르는 자체 상태라 여기서 따로 올린다
  useScrollToTop(detail ?? "-");

  if (detail) {
    return (
      <MyDetailPage
        detail={detail}
        close={() => setDetail(null)}
        onNotification={onNotification}
        hasUnread={hasUnread}
        canvasTone={canvasTone}
        onChangeCanvasTone={onChangeCanvasTone}
      />
    );
  }

  return (
    <div className="screen page-with-nav mypage-screen">
      <BrandTabHeader onNotification={onNotification} hasUnread={hasUnread} />
      <main className="mypage-content">
        <div className="profile">
          <h1>{studentProfile.name} 학생 <em>{studentProfile.grade}</em></h1>
        </div>
        <section className="membership-card" aria-label="가입 정보">
          <div><small>가입 상품</small><strong>{policyInfo.tier}</strong></div>
          <div><small>보장 상한</small><strong>{policyInfo.coverageCapManwon.toLocaleString("ko-KR")}만원</strong></div>
          <div><small>가입일</small><strong>{formatDotDate(policyInfo.joinedDate)}</strong></div>
        </section>
        <div className="grouped-menu">
          <section className="menu-card">
            {myMenuGroups.map((group) => (
              <div className="menu-group" key={group.title}>
              <h2>{group.title}</h2>
              {group.items.map((item) =>
                item.static ? (
                  <div className="menu-static-row" key={item.label}>
                    <span>{item.label}</span>
                    <em>{item.detail}</em>
                  </div>
                ) : (
                  <button className="menu-row" key={item.label} onClick={() => setDetail(item.label)}>
                    <span>{item.label}</span>
                    <ChevronRight size={17} />
                  </button>
                ),
              )}
              </div>
            ))}
          </section>
        </div>
        <button className="logout-button" onClick={onLogout}>
          <LogOut size={17} /> 로그아웃
        </button>
      </main>
    </div>
  );
}

function ClaimFlow({
  screen,
  setScreen,
  close,
  phase,
}: {
  screen: ClaimScreen;
  setScreen: (screen: ClaimScreen) => void;
  close: () => void;
  phase: ClaimPhase;
}) {
  const { account } = useClaimInfo();
  const { studentId, profile } = useSession();
  const claimApi = useClaim(studentId);
  // 빈 값으로 시작한다 — 1단계가 DB에서 불러온 카드 중 첫 장을 기본 선택한다
  const [cardLast4, setCardLast4] = useState("");
  const [resultPreview, setResultPreview] = useState<ClaimResultVariant>("matched");
  // 카드사 이용내역(추가 증빙) — 고른 파일을 제출 버튼까지 들고 있는다.
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [appealFiled, setAppealFiled] = useState(false);
  const [appealSubmittedAt, setAppealSubmittedAt] = useState<Date | null>(null);
  const [captureContext, setCaptureContext] = useState<CaptureContext>("receipt");
  const [proofCaptured, setProofCaptured] = useState(false);
  // 이의신청 증빙 첨부 장수 (파일은 아직 서버로 보내지 않는다 — 아래 TODO 참고)
  const [proofCount, setProofCount] = useState(0);
  // 영수증은 여러 장을 촬영/등록할 수 있어 목록으로 관리한다. 사진 품질은 실제
  // 분석기가 없으니, 다음 촬영 결과를 무엇으로 볼지 사람이 미리 골라 시뮬레이션한다.
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [qualityScenario] = useState<QualityScenario>("ok");
  const [pendingReceiptSource, setPendingReceiptSource] = useState<ReceiptSource>("capture");
  const [pendingReceiptFile, setPendingReceiptFile] = useState<File | null>(null);
  const [claimUploadError, setClaimUploadError] = useState<string | null>(null);
  // 증빙 자료 확인(capture/scanResult)을 거쳐 돌아와도 이미 적어둔 내용이 남아있도록
  // ClaimAppeal 이 아니라 여기(ClaimFlow)에서 들고 있는다 — ClaimAppeal 은 화면 전환마다
  // 조건부로 마운트/언마운트되므로 로컬 state 로 두면 돌아올 때마다 비워진다.
  const [appealReason, setAppealReason] = useState<"성적 반영 오류" | "기타">("성적 반영 오류");
  const [appealDetail, setAppealDetail] = useState("");
  // 실제 청구 이력 DB가 없으므로, 이번 세션에서 실제로 제출을 마쳤는지를 추적한다.
  // between·period2 단계는 "1차는 이미 지급됐다"는 시나리오 전제이므로 항상 청구됨으로 본다.
  const [submittedFirst, setSubmittedFirst] = useState(false);
  const [submittedSecond, setSubmittedSecond] = useState(false);
  // 실제로 접수를 마친 시각. 화면에 박아둔 날짜 대신 이 값을 보여준다.
  const [firstSubmittedAt, setFirstSubmittedAt] = useState<Date | null>(null);
  const [secondSubmittedAt, setSecondSubmittedAt] = useState<Date | null>(null);
  const firstClaimed = phase === "between" || phase === "period2" || (phase === "period1" && submittedFirst);
  const secondClaimed = phase === "period2" && submittedSecond;

  useEffect(() => {
    if (screen !== "scanning") return;
    const timer = window.setTimeout(() => {
      if (captureContext !== "receipt") {
        // ★ 이의신청 증빙자료는 OCR·업로드를 거치지 않는다. 촬영한 파일
        //   (pendingReceiptFile)은 여기서 그냥 버려지고 화면만 넘어간다.
        //   영수증(receipt)만 POST /api/claims/{id}/receipt 로 올라가 OCR·대조를 받는다.
        // TODO(이의신청 연동): 증빙 파일도 서버에 보관해야 한다. 다만 백엔드의
        //   추가증빙 경로(/additional-proof)는 설계상 OCR 없이 MANUAL_REVIEW 로만
        //   보내므로, 성적표 OCR 이 필요하면 전용 엔드포인트를 새로 열어야 한다.
        setScreen("scanResult");
        return;
      }
      if (!pendingReceiptFile) {
        setClaimUploadError("선택한 영수증 파일을 불러오지 못했어요. 다시 선택해 주세요.");
        setScreen("step2");
        return;
      }
      setReceipts((current) => [
        ...current,
        {
          id: `${Date.now()}-${current.length}`,
          source: pendingReceiptSource,
          file: pendingReceiptFile,
        },
      ]);
      setPendingReceiptFile(null);
      setScreen("receiptContinue");
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [screen, setScreen, captureContext, pendingReceiptFile, pendingReceiptSource]);

  async function verifyReceipts() {
    if (!studentId) {
      setClaimUploadError("학생 정보가 없어 영수증을 전송할 수 없어요. 다시 로그인해 주세요.");
      return;
    }
    if (receipts.length === 0) {
      setClaimUploadError("먼저 영수증 사진 또는 파일을 추가해 주세요.");
      return;
    }

    setClaimUploadError(null);
    setScreen("verifying");

    const student = profile.data?.student as Record<string, unknown> | undefined;
    const userId = deriveUserId(studentId, student);
    if (userId === null) {
      setClaimUploadError("가입자 정보를 확인하지 못했어요. 다시 로그인해 주세요.");
      setScreen("step2");
      return;
    }
    // 1단계에서 고른 카드의 카드사명 — 목록은 DB(jaesoo_registered_cards)에서 왔다
    const cardsRes = await api.userCards(userId);
    const selectedCard = cardsRes.ok
      ? cardsRes.data.cards.find((card) => card.card_last4 === cardLast4)
      : undefined;
    const cardId = await claimApi.ensureCard(
      {
        company: selectedCard?.card_company ?? paymentMethod.provider,
        last4: cardLast4,
        holderName: String(student?.name ?? studentProfile.name),
        relationship: selectedCard?.relationship_to_student ?? "학부모",
      },
      userId,
    );
    if (!cardId) {
      setClaimUploadError("등록 카드를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setScreen("step2");
      return;
    }

    const claimId = await claimApi.createClaim(cardId, userId);
    if (!claimId) {
      setClaimUploadError("청구 정보를 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
      setScreen("step2");
      return;
    }

    let lastResult: Awaited<ReturnType<typeof claimApi.uploadReceipt>> = null;
    for (const receipt of receipts) {
      lastResult = await claimApi.uploadReceipt(claimId, receipt.file);
      if (!lastResult) {
        setClaimUploadError(`‘${receipt.file.name}’ 파일을 확인하지 못했어요. 파일 형식과 용량을 확인해 주세요.`);
        setScreen("step2");
        return;
      }
      if (lastResult.document?.id) {
        setReceipts((current) =>
          current.map((item) => (item.id === receipt.id ? { ...item, documentId: lastResult?.document?.id } : item)),
        );
      }
    }

    // 인식 결과를 사용자에게 먼저 보여주고 확인을 받는다. 확인 화면에서
    // '이대로 등록'을 눌러야 판정 결과로 넘어간다 — 잘못 읽힌 영수증을 그대로
    // 접수해 버리는 일을 막는다.
    setResultPreview(toVariant(lastResult?.status, lastResult?.verification?.final_result) ?? "review");
    setScreen("ocrConfirm");
  }

  useEffect(() => {
    if (screen !== "submitting") return;
    const timer = window.setTimeout(() => {
      const isFirstRound = phase === "preExam" || phase === "postExam" || phase === "period1";
      const now = new Date();
      if (isFirstRound) {
        setSubmittedFirst(true);
        setFirstSubmittedAt(now);
      } else {
        setSubmittedSecond(true);
        setSecondSubmittedAt(now);
      }
      setScreen("done");
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [screen, setScreen, phase]);

  const backMap: Record<ClaimScreen, ClaimScreen | null> = {
    home: null,
    intro: "home",
    step1: "intro",
    cardChange: "step1",
    step2: "step1",
    verifying: null,
    // 확인 화면에서 뒤로 가면 다시 찍는 자리(업로드)로 돌아간다.
    ocrConfirm: "step2",
    result: "step2",
    submitting: null,
    done: null,
    status: "home",
    eligibilityDetail: "home",
    appeal: "eligibilityDetail",
    appealDone: null,
    appealStatus: "home",
    capture: null,
    scanning: null,
    scanResult: null,
    receiptQualityFail: "step2",
    receiptContinue: "step2",
  };

  // 청구 진입 후 첫 화면(home)에서만 "홈"(앱 홈 탭으로 나가기)이고, 그 밖의 화면은
  // 실제로 돌아가는 이전 화면의 이름을 그대로 쓴다 — "홈"은 앱 홈 탭 전용 라벨이다.
  const backLabel: Partial<Record<ClaimScreen, string>> = {
    home: "홈",
    intro: "보험금 청구",
    step1: "청구 안내",
    cardChange: "카드 확인",
    step2: "카드 확인",
    ocrConfirm: "영수증 업로드",
    result: "인식 결과 확인",
    status: "보험금 청구",
    eligibilityDetail: "보험금 청구",
    appeal: "보장 자격 상세",
    appealStatus: "보험금 청구",
    receiptQualityFail: "영수증 업로드",
    receiptContinue: "영수증 업로드",
  };

  const captureOrigin: ClaimScreen = captureContext === "proof" ? "appeal" : "step2";

  if (screen === "verifying") {
    return <ClaimVerifying />;
  }

  if (screen === "scanning") {
    return (
      <div className="screen page-with-nav claim-screen">
        <TopBar />
        <div className="claim-verifying claim-scanning-center">
          <div className="claim-spinner" />
          <h1>서류를 스캔하고 있어요</h1>
          <p>
            글씨가 잘 보이는지 확인하고 있어요.
            <br />
            잠시만 기다려주세요.
          </p>
        </div>
      </div>
    );
  }

  if (screen === "submitting") {
    return (
      <div className="screen claim-loading">
        <div className="claim-spinner" aria-hidden="true" />
        <h1>청구 내용을 안전하게 제출하고 있어요</h1>
        <p>잠시만 기다려주세요. 창을 닫지 않아도 괜찮아요.</p>
      </div>
    );
  }

  if (screen === "done") {
    const isFirstRound = phase === "preExam" || phase === "postExam" || phase === "period1";
    // 방금 실제로 접수한 시각. (직접 들어온 경우를 대비해 now 로 대비책을 둔다)
    const submittedAt = (isFirstRound ? firstSubmittedAt : secondSubmittedAt) ?? new Date();
    return (
      <div className="screen claim-done claim-done-plain">
        <span className="done-icon">
          <Check size={42} />
        </span>
        <h1>{isFirstRound ? "1차 청구가 접수됐어요" : "2차 청구가 접수됐어요"}</h1>
        <p>심사가 끝나면 등록하신 계좌로 입금돼요.</p>
        <section className="white-card claim-kv-card claim-done-card">
          <div className="claim-kv-row">
            <span className="k">접수번호</span>
            <span className="v">{claimReceiptNo(submittedAt, isFirstRound ? 1 : 2)}</span>
          </div>
          <div className="claim-kv-row">
            <span className="k">접수일시</span>
            <span className="v">{formatDotDateTime(submittedAt)}</span>
          </div>
          <div className="claim-kv-row">
            <span className="k">지급 예정액</span>
            <span className="v positive">{isFirstRound ? 만원표기(account.firstPaidManwon) : 만원표기(account.secondPaidManwon)}</span>
          </div>
          <div className="claim-kv-row">
            <span className="k">예상 지급일</span>
            <span className="v">{formatDotDate(addDays(submittedAt, 7))}</span>
          </div>
        </section>
        <div className="claim-note claim-done-note">
          {isFirstRound ? "2차 청구는 12월에 열려요. 6월~11월 결제 내역을 청구할 수 있어요." : "2차 지급이 끝나면 보장이 종료돼요. 더 청구할 건은 없습니다."}
        </div>
        <button className="primary-button button-flat-primary" onClick={() => setScreen("status")}>
          진행 상황 보기
        </button>
        <button className="secondary-button button-outline-secondary" onClick={close}>
          홈으로
        </button>
      </div>
    );
  }

  if (screen === "appealDone") {
    return (
      <div className="screen claim-done claim-done-plain">
        <span className="done-icon">
          <Check size={42} />
        </span>
        <h1>이의 신청이 완료됐어요</h1>
        <p>접수 후 5영업일 안에 결과를 알려드려요.</p>
        <button className="primary-button button-flat-primary" onClick={() => setScreen("appealStatus")}>
          이의신청 내역 보기
        </button>
        <button className="secondary-button button-outline-secondary" onClick={close}>
          홈으로
        </button>
      </div>
    );
  }

  // 이의신청 STEP 3(증빙 확인 후 재작성 화면)에서는 뒤로가기를 누르면 STEP 2(증빙 촬영)로 돌아간다
  const previous =
    screen === "capture"
      ? captureOrigin
      : screen === "scanResult"
        ? "capture"
        : screen === "appeal" && proofCaptured
          ? "capture"
          : backMap[screen];
  const label =
    screen === "capture"
      ? captureContext === "proof"
        ? "이의 신청"
        : "영수증 업로드"
      : screen === "scanResult"
        ? "사진 촬영"
        : screen === "appeal" && proofCaptured
          ? "사진 촬영"
          : (backLabel[screen] ?? "이전 화면");

  return (
    <div className="screen page-with-nav claim-screen">
      <TopBar back={previous ? () => setScreen(previous) : close} backLabel={label} />
      {screen === "home" && (
        <ClaimHome
          setScreen={setScreen}
          phase={phase}
          appealFiled={appealFiled}
          firstClaimed={firstClaimed}
          secondClaimed={secondClaimed}
        />
      )}
      {screen === "intro" && <ClaimIntro onStart={() => setScreen("step1")} phase={phase} />}
      {screen === "step1" && (
        <ClaimCardStep
          cardLast4={cardLast4}
          onConfirm={(last4) => {
            setCardLast4(last4);
            setScreen("step2");
          }}
          onChangeCard={() => setScreen("cardChange")}
        />
      )}
      {screen === "cardChange" && (
        <ClaimCardChange
          onSave={(last4) => {
            setCardLast4(last4);
            setScreen("step1");
          }}
        />
      )}
      {screen === "step2" && (
        <ClaimUpload
          onUpload={verifyReceipts}
          receipts={receipts}
          error={claimUploadError}
          onCapture={() => {
            setCaptureContext("receipt");
            setPendingReceiptSource("capture");
            setScreen("capture");
          }}
          onFileSelected={(file) => {
            setCaptureContext("receipt");
            setPendingReceiptSource("file");
            setPendingReceiptFile(file);
            setScreen("scanning");
          }}
          onRetakeReceipt={(id) => {
            setReceipts((current) => current.filter((r) => r.id !== id));
            setCaptureContext("receipt");
            setPendingReceiptSource("capture");
            setScreen("capture");
          }}
          onDeleteReceipt={(id) => setReceipts((current) => current.filter((r) => r.id !== id))}
        />
      )}
      {screen === "capture" && (
        <ClaimCapture
          onCapture={(file) => {
            setPendingReceiptSource("capture");
            setPendingReceiptFile(file);
            setScreen("scanning");
          }}
          receiptCount={receipts.length}
        />
      )}
      {screen === "receiptQualityFail" && (
        <ClaimReceiptQualityFail
          scenario={qualityScenario}
          onRetake={() => {
            setPendingReceiptSource("capture");
            setScreen("capture");
          }}
        />
      )}
      {screen === "receiptContinue" && (
        <ClaimReceiptContinue
          onAddMore={() => {
            setPendingReceiptSource("capture");
            setScreen("capture");
          }}
          onDone={() => setScreen("step2")}
        />
      )}
      {screen === "scanResult" && (
        <ClaimScanResult
          context={captureContext}
          proofCount={proofCount}
          onRetake={() => setScreen("capture")}
          onConfirm={() => {
            // 이 화면은 이의신청 증빙자료 확인에서만 쓰인다 — 확인완료는 접수가 아니라
            // STEP 3(이의 신청) 작성 화면으로 돌아간다
            setProofCount((n) => n + 1);
            setProofCaptured(true);
            setScreen("appeal");
          }}
          onAddMore={() => {
            // 이 장은 첨부로 확정하고 카메라로 되돌아간다
            setProofCount((n) => n + 1);
            setProofCaptured(true);
            setScreen("capture");
          }}
        />
      )}
      {screen === "ocrConfirm" && (
        <ClaimOCRConfirm
          ocrResult={claimApi.ocrResult}
          cardLast4={cardLast4}
          onConfirm={() => setScreen("result")}
          onRetake={() => {
            setReceipts([]);
            setClaimUploadError(null);
            setScreen("step2");
          }}
        />
      )}
      {screen === "result" && (
        <ClaimResult
          variant={resultPreview}
          cardLast4={cardLast4}
          ocrResult={claimApi.ocrResult}
          reasons={claimApi.reasons}
          onSubmit={async () => {
            // 카드사 이용내역을 고른 상태면 먼저 올린다. 백엔드는 이 파일을
            // CARD_STATEMENT 로 저장하고 청구를 수동 심사로 넘긴다.
            if (proofFile && claimApi.claimId) {
              const res = await claimApi.uploadReceipt(claimApi.claimId, proofFile, "proof");
              if (!res) {
                setClaimUploadError("이용내역을 제출하지 못했어요. 파일 형식과 용량을 확인해 주세요.");
                return;
              }
              setProofFile(null);
            }
            setScreen("submitting");
          }}
          onRetryUpload={() => setScreen("step2")}
          onChangeCard={() => setScreen("cardChange")}
          onViewStatus={() => setScreen("status")}
          onProofSelected={(file) => {
            setClaimUploadError(null);
            setProofFile(file);
          }}
          proofFileName={proofFile?.name ?? null}
        />
      )}
      {screen === "status" && (
        <ClaimStatus
          phase={phase}
          firstClaimed={firstClaimed}
          secondClaimed={secondClaimed}
          firstSubmittedAt={firstSubmittedAt}
          secondSubmittedAt={secondSubmittedAt}
          submittedReceipts={receipts}
          onStartClaim={() => setScreen("intro")}
        />
      )}
      {screen === "eligibilityDetail" && (
        <ClaimEligibilityDetail onAppeal={() => setScreen("appeal")} />
      )}
      {screen === "appeal" && (
        <ClaimAppeal
          onSubmit={() => {
            setAppealFiled(true);
            setAppealSubmittedAt(new Date());
            setScreen("appealDone");
          }}
          captured={proofCaptured}
          proofCount={proofCount}
          reason={appealReason}
          onChangeReason={setAppealReason}
          detail={appealDetail}
          onChangeDetail={setAppealDetail}
          onCapture={() => {
            setCaptureContext("proof");
            setScreen("capture");
          }}
        />
      )}
      {screen === "appealStatus" && <ClaimAppealStatus submittedAt={appealSubmittedAt} />}
    </div>
  );
}

function ClaimHome({
  setScreen,
  phase,
  appealFiled,
  firstClaimed,
  secondClaimed,
}: {
  setScreen: (screen: ClaimScreen) => void;
  phase: ClaimPhase;
  appealFiled: boolean;
  firstClaimed: boolean;
  secondClaimed: boolean;
}) {
  const { account, phaseInfo } = useClaimInfo();
  const info = phaseInfo[phase];
  const eligibility = useEligibilityView();
  const showEligibilityCard = phase === "postExam";
  // 세션에서 실제로 접수를 마쳤으면(백엔드 청구 이력이 아직 없어 로컬로만 추적) 문구를 갱신한다
  const historySub =
    phase === "period1" && firstClaimed
      ? "1차 청구 심사중"
      : phase === "period2" && secondClaimed
        ? "2차 청구 심사중"
        : info.historySub;
  return (
    <main className="sub-page">
      <span className="eyebrow">보험금 청구</span>
      <h1>필요할 때 든든하게 챙겨드려요</h1>
      {showEligibilityCard ? (
        <section className={`claim-open-card ${eligibility.isEligible ? "" : "not-eligible"}`}>
          <span className="eyebrow light">
            {eligibility.status === "determined" ? "보장 판정 완료" : `보장 판정 · ${eligibility.tierLabel}`}
          </span>
          <h2>{eligibility.title}</h2>
          <p>
            {eligibility.isEligible
              ? `1차 청구 기간은 ${eligibility.claimWindow}이에요. 보장 한도 ${eligibility.coverageLimit} 안에서 지급돼요.`
              : eligibility.desc}
          </p>
          {!eligibility.isEligible && !eligibility.loading && (
            <div className="claim-eligibility-stats">
              <div>
                <span className="claim-eligibility-stats-label">
                  {eligibility.status === "determined" ? "하락폭" : "예상 성적"}
                </span>
                <strong>
                  {eligibility.status === "determined" ? eligibility.dropSigma : eligibility.expectedGrade}
                </strong>
              </div>
              <div>
                <span>경증 기준</span>
                <strong>{eligibility.mildThreshold}</strong>
              </div>
              <div>
                <span>중증 기준</span>
                <strong>{eligibility.severeThreshold}</strong>
              </div>
            </div>
          )}
          <button className="white-button" onClick={() => setScreen("eligibilityDetail")}>
            판정 근거 자세히 보기
          </button>
        </section>
      ) : null}
      {!showEligibilityCard && (
        <section className="claim-open-card">
          <span className="eyebrow light">보장 자격 확정 · 중증 · 한도 {만원표기(account.capManwon)}</span>
          <h2>{info.bannerTitle}</h2>
          <p>{info.bannerText}</p>
          <div className="claim-progress">
            <span style={{ width: `${info.progress}%` }} />
          </div>
          <div className="claim-progress-legend">
            <span>
              <i className="claim-legend-dot" />
              기지급 <b>{info.paidAmount}</b>
            </span>
            <span>
              <i className="claim-legend-dot off" />
              잔여 <b>{info.remainingAmount}</b>
            </span>
          </div>
          <button className="white-button" onClick={() => setScreen("intro")} disabled={!info.ctaEnabled}>
            {info.ctaLabel}
          </button>
        </section>
      )}
      {showEligibilityCard && !eligibility.isEligible && appealFiled && (
        <button type="button" className="claim-lrow" onClick={() => setScreen("appealStatus")}>
          <span>
            <strong>이의 신청 진행 상황</strong>
            <small>검토 중 · 5영업일 이내 안내</small>
          </span>
          <ChevronRight size={17} />
        </button>
      )}
      <button type="button" className="claim-lrow" onClick={() => setScreen("status")}>
        <span>
          <strong>내 청구 내역</strong>
          <small>{historySub}</small>
        </span>
        <ChevronRight size={17} />
      </button>
    </main>
  );
}

function ClaimEligibilityDetail({ onAppeal }: { onAppeal: () => void }) {
  const info = useEligibilityView();
  return (
    <main className="sub-page">
      <span> </span>
      <h1>보장 자격 상세</h1>
      <p className="claim-eligibility-lead">
        예상 성적과 실제 성적의 차이를 표준편차로 계산해요.
      </p>
      <section className="white-card claim-kv-card claim-result-card">
        <div className="claim-kv-row">
          <span className="k">예상 성적(밴드 중심)</span>
          <span className="v">{info.expectedGrade}</span>
        </div>
        <div className="claim-kv-row">
          <span className="k">실제 수능 성적</span>
          <span className="v">{info.actualGrade}</span>
        </div>
        <div className="claim-kv-row">
          <span className="k">하락폭</span>
          <span className="v">{info.dropSigma}</span>
        </div>
        <div className="claim-kv-row">
          <span className="k">판정</span>
          <span className="v brand-green-text">{info.tierLabel}</span>
        </div>
      </section>
      <div className="claim-threshold-list claim-threshold-list-muted">
        <div className="claim-threshold-row">
          <TriangleAlert size={11} aria-hidden="true" />
          <span>경증 기준선</span>
          <strong>{info.mildThreshold}</strong>
        </div>
        <div className="claim-threshold-row">
          <Siren size={11} aria-hidden="true" />
          <span>중증 기준선</span>
          <strong>{info.severeThreshold}</strong>
        </div>
      </div>
      {!info.isEligible && (
        <button className="primary-button button-flat-primary claim-appeal-cta" onClick={onAppeal}>
          이의 신청하기
        </button>
      )}
    </main>
  );
}

function ClaimAppeal({
  onSubmit,
  captured,
  proofCount,
  onCapture,
  reason,
  onChangeReason,
  detail,
  onChangeDetail,
}: {
  onSubmit: () => void;
  captured: boolean;
  proofCount: number;
  onCapture: () => void;
  reason: "성적 반영 오류" | "기타";
  onChangeReason: (reason: "성적 반영 오류" | "기타") => void;
  detail: string;
  onChangeDetail: (detail: string) => void;
}) {
  // 증빙 자료를 한 번 확인하고 돌아오면(STEP 3) 그제서야 접수 버튼이 열린다.
  // reason/detail 은 부모(ClaimFlow)가 들고 있다 — 이 화면은 capture/scanResult 를
  // 거칠 때마다 마운트가 풀렸다 다시 걸리므로, 로컬 state 로 두면 돌아올 때 비워진다.
  return (
    <main className="sub-page claim-step">
      <div className="claim-steps">
        <i className="on" />
        <i className={captured ? "on" : ""} />
        <i className={captured ? "on" : ""} />
      </div>
      <span className="step-label">
        {captured ? "STEP 3 / 3 · 이의 신청" : "STEP 1 / 3 · 증빙 자료 업로드"}
      </span>
      <h1>이의 신청</h1>
      <p>성적 반영이 잘못됐다면 신청해 주세요 · 5영업일 내 안내</p>
      <div className="claim-field">
        <label>이의 사유</label>
        <div className="claim-seg">
          {(["성적 반영 오류", "기타"] as const).map((option) => (
            <button key={option} type="button" className={reason === option ? "on" : ""} onClick={() => onChangeReason(option)}>
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* STEP 1 은 증빙 업로드까지만, 상세 내용은 증빙을 확인하고 온 STEP 3 에서 받는다 */}
      {captured ? (
        <>
          <div className="claim-drop claim-drop-done">
            <CircleCheck size={24} />
            <strong>증빙자료 첨부 완료{proofCount > 1 ? ` · ${proofCount}장` : ""}</strong>
            <small>성적표 · 성적증명서</small>
          </div>
          <div className="claim-field">
            <label>상세 내용</label>
            <textarea
              className="claim-input claim-textarea"
              value={detail}
              onChange={(event) => onChangeDetail(event.target.value)}
              placeholder="어떤 부분이 잘못됐는지 적어주세요"
              rows={4}
            />
          </div>
          <button
            className="primary-button button-flat-primary claim-appeal-submit"
            onClick={onSubmit}
            disabled={!detail.trim()}
          >
            이의 신청 접수하기
          </button>
        </>
      ) : (
        <button type="button" className="claim-drop" onClick={onCapture}>
          <FileText size={24} />
          <strong>증빙 자료 올리기</strong>
          <small>성적표 · 성적증명서</small>
        </button>
      )}
    </main>
  );
}

function ClaimAppealStatus({ submittedAt }: { submittedAt: Date | null }) {
  return (
    <main className="sub-page">
      <span className="eyebrow">이의 신청 진행 상황</span>
      <h1>검토가 진행 중이에요</h1>
      <section className="white-card status-timeline">
        {[
          {
            title: "접수 완료",
            text: submittedAt ? formatDotDateTime(submittedAt) : "접수 시각 확인 중",
            state: "active" as const,
          },
          { title: "서류 검토 중", text: "영업일 기준 5일 이내", state: "current" as const },
          { title: "결과 안내", text: "검토 완료 후 알림", state: "" as const },
        ].map((item) => (
          <div className={item.state} key={item.title}>
            <i>{item.state === "active" ? <Check size={14} /> : null}</i>
            <p>
              <strong>{item.title}</strong>
              <span>{item.text}</span>
            </p>
          </div>
        ))}
      </section>
      <div className="claim-note">결과가 나오면 알림으로 바로 알려드릴게요.</div>
    </main>
  );
}

function ClaimCapture({ onCapture, receiptCount = 0 }: { onCapture: (file: File) => void; receiptCount?: number }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<"starting" | "ready" | "error">("starting");
  const [cameraError, setCameraError] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraState("starting");
      setCameraError("");

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState("error");
        setCameraError("이 브라우저에서는 실시간 카메라를 지원하지 않아요.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1440 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraState("ready");
      } catch (error) {
        if (cancelled) return;
        const denied = error instanceof DOMException && error.name === "NotAllowedError";
        setCameraState("error");
        setCameraError(
          denied
            ? "카메라 권한이 허용되지 않았어요. 브라우저 설정에서 권한을 허용해 주세요."
            : "카메라를 시작하지 못했어요. 다른 촬영 방법을 이용해 주세요.",
        );
      }
    }

    void startCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [facingMode]);

  function captureFrame() {
    const video = videoRef.current;
    if (!video || cameraState !== "ready" || video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraState("error");
      setCameraError("촬영 이미지를 만들지 못했어요. 다시 시도해 주세요.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraState("error");
          setCameraError("촬영 이미지를 저장하지 못했어요. 다시 시도해 주세요.");
          return;
        }
        onCapture(new File([blob], `receipt-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <main className="claim-capture">
      {receiptCount > 0 && <span className="claim-capture-count">영수증 {receiptCount}장 촬영됨</span>}
      <div className="claim-camera-frame">
        <div className="claim-camera-guide">
          <video ref={videoRef} className="claim-camera-video" autoPlay muted playsInline aria-label="실시간 카메라 화면" />
          {cameraState === "starting" && (
            <div className="claim-camera-overlay">
              <LoaderCircle className="spinner" size={30} />
              <span>카메라를 준비하고 있어요</span>
            </div>
          )}
          {cameraState === "error" && (
            <div className="claim-camera-overlay claim-camera-error" role="alert">
              <TriangleAlert size={28} />
              <span>{cameraError}</span>
              <label className="claim-camera-fallback">
                사진 촬영 또는 선택
                <input
                  className="claim-file-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onCapture(file);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          )}
        </div>
        <p>서류 전체가 프레임 안에 들어오게 맞춰주세요</p>
      </div>
      <div className="claim-camera-controls">
        <button
          type="button"
          className="claim-camera-switch"
          onClick={() => setFacingMode((current) => (current === "environment" ? "user" : "environment"))}
          aria-label="전면 또는 후면 카메라 전환"
        >
          <RefreshCcw size={20} />
        </button>
        <button
          type="button"
          className="claim-shutter"
          onClick={captureFrame}
          disabled={cameraState !== "ready"}
          aria-label="촬영하기"
        >
          <Camera size={26} />
        </button>
        <span className="claim-camera-control-spacer" aria-hidden="true" />
      </div>
    </main>
  );
}

function ClaimReceiptQualityFail({
  scenario,
  onRetake,
}: {
  scenario: QualityScenario;
  onRetake: () => void;
}) {
  const message = scenario === "ok" ? "" : qualityIssueCopy[scenario];
  return (
    <main className="sub-page claim-quality-fail">
      <span className="claim-quality-fail-icon">
        <TriangleAlert size={26} />
      </span>
      <h1>사진을 다시 확인해 주세요</h1>
      <p>{message}</p>
      <button className="primary-button button-flat-primary" onClick={onRetake}>
        다시 촬영하기
      </button>
    </main>
  );
}

function ClaimReceiptContinue({
  onAddMore,
  onDone,
}: {
  onAddMore: () => void;
  onDone: () => void;
}) {
  return (
    <main className="sub-page claim-quality-fail">
      <span className="claim-quality-fail-icon claim-quality-ok-icon">
        <CircleCheck size={26} />
      </span>
      <h1>사진 촬영 완료</h1>
      <p>더 촬영할 영수증이 있으면 이어서 찍어주세요.</p>
      <div className="claim-btn-stack">
        <button className="primary-button button-flat-primary" onClick={onAddMore}>
          한 장 더 촬영하기
        </button>
        <button className="secondary-button button-outline-secondary" onClick={onDone}>
          촬영 완료
        </button>
      </div>
    </main>
  );
}

function ClaimScanResult({
  context,
  onRetake,
  onConfirm,
  onAddMore,
  proofCount,
}: {
  context: CaptureContext;
  onRetake: () => void;
  onConfirm: () => void;
  onAddMore: () => void;
  proofCount: number;
}) {
  const isProof = context === "proof";
  return (
    <main className={`sub-page${isProof ? " claim-step" : ""}`}>
      {isProof ? (
        <div className="claim-steps">
          <i className="on" />
          <i className="on" />
          <i />
        </div>
      ) : (
        <span className="eyebrow">스캔 결과 확인</span>
      )}
      {isProof && <span className="step-label">STEP 2 / 3 · 증빙 자료 확인</span>}
      <h1>이 사진으로 사용할까요?</h1>
      <div className="claim-scan-preview">
        <FileText size={32} />
        <span>서류 이미지 미리보기</span>
      </div>
      {isProof && proofCount > 0 && (
        <p className="claim-scan-count">지금까지 {proofCount}장 첨부했어요</p>
      )}
      {/* 버튼이 셋이면 세로로 쌓았을 때 무거워 보인다 — 주 동작만 크게 두고
          '다시 찍기 · 한 장 더'는 아래 한 줄에 나란히 놓는다 */}
      <div className="claim-btn-stack">
        <button className="primary-button button-flat-primary" onClick={onConfirm}>
          {isProof ? "확인완료" : "이 사진 사용하기"}
        </button>
        {isProof ? (
          <div className="claim-btn-row">
            <button className="secondary-button button-outline-secondary" onClick={onRetake}>
              다시 찍기
            </button>
            <button className="secondary-button button-outline-secondary" onClick={onAddMore}>
              <Plus size={15} /> 한 장 더
            </button>
          </div>
        ) : (
          <button className="secondary-button button-outline-secondary" onClick={onRetake}>
            다시 찍기
          </button>
        )}
      </div>
    </main>
  );
}

function ClaimIntro({ onStart, phase }: { onStart: () => void; phase: ClaimPhase }) {
  const { phaseInfo } = useClaimInfo();
  const info = phaseInfo[phase];
  // 준비물 안내에 실제 등록 카드를 보여준다 (DB: jaesoo_registered_cards)
  const { studentId, profile } = useSession();
  const { cards } = useRegisteredCards(deriveUserId(studentId, profile.data?.student));
  const primaryCard = cards.find((card) => card.is_active) ?? cards[0];
  return (
    <main className="sub-page">
      <span className="eyebrow">청구 안내</span>
      <h1>{info.introHeading}</h1>
      <p className="claim-intro-lead">수능 후 다음해 6월에 1차, 12월에 2차로 두 번에 나눠 청구해요.</p>
      <section className="white-card claim-schedule-card">
        <h2>내 청구 일정</h2>
        <div className="status-timeline">
          {info.introTimeline.map((item) => (
            <div className={item.state} key={item.title}>
              <i>{item.state === "active" ? <Check size={14} /> : null}</i>
              <p>
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </p>
            </div>
          ))}
        </div>
      </section>
      <section className="white-card claim-kv-card">
        <h2>미리 준비할 것</h2>
        <div className="claim-kv-row">
          <span className="k">등록한 학부모 카드</span>
          <span className="v">
            {primaryCard ? `${primaryCard.card_company} ●●●● ${primaryCard.card_last4}` : "등록된 카드가 없습니다"}
          </span>
        </div>
        <div className="claim-kv-row">
          <span className="k">학원 결제 영수증</span>
          <span className="v">사진 또는 PDF</span>
        </div>
      </section>
      <button className="primary-button" onClick={onStart}>
        청구 시작하기
      </button>
    </main>
  );
}

/** 화면에 뿌릴 카드 한 장 — DB 행(RegisteredCard)을 표시용으로 좁힌 것. */
type ClaimCardOption = {
  provider: string;
  last4: string;
  owner: string;
  status: string;
};

function ClaimCardStep({
  cardLast4,
  onConfirm,
  onChangeCard,
}: {
  cardLast4: string;
  onConfirm: (last4: string) => void;
  onChangeCard: () => void;
}) {
  const { studentId, profile } = useSession();
  const userId = deriveUserId(studentId, profile.data?.student);
  const { cards: rows, loading, error, reload } = useRegisteredCards(userId);

  const cards = useMemo<ClaimCardOption[]>(() => {
    const fromDb = rows.map((row) => ({
      provider: row.card_company,
      last4: row.card_last4,
      owner: `${row.card_holder_name} (${row.relationship_to_student})`,
      status: row.is_active ? "활성 · 사용 가능" : "비활성 · 과거 등록",
    }));
    // 방금 등록해 아직 목록에 안 잡힌 카드(ClaimCardChange 직후)는 맨 위에 얹는다
    if (cardLast4 && !fromDb.some((card) => card.last4 === cardLast4)) {
      return [
        { provider: "새로 등록한 카드", last4: cardLast4, owner: "본인 확인 필요", status: "등록 대기" },
        ...fromDb,
      ];
    }
    return fromDb;
  }, [rows, cardLast4]);

  // 고른 값이 없으면 첫 카드를 기본으로 본다 — 목록이 늦게 도착해도 effect 없이
  // 화면과 상태가 어긋나지 않는다
  const [picked, setPicked] = useState(cardLast4);
  const selected = picked || cards[0]?.last4 || "";
  // 조회가 끝났고 오류도 아닌데 카드가 한 장도 없는 상태 (불러오기 실패와 구분한다)
  const isEmpty = !loading && !error && cards.length === 0;

  return (
    <main className="sub-page claim-step">
      <div className="claim-steps">
        <i className="on" />
        <i />
        <i />
      </div>
      <span className="step-label">STEP 1 / 3 · 등록 카드 확인</span>
      <h1>{isEmpty ? "등록된 카드가 없습니다" : "이 카드로 결제한 게 맞나요?"}</h1>
      <p>
        {isEmpty
          ? "재수비용을 결제한 카드를 먼저 등록해 주세요."
          : "보험료 납입에 사용한 카드를 먼저 불러왔어요."}
      </p>

      {loading && <section className="white-card">등록 카드를 불러오는 중이에요…</section>}

      {!loading && error && (
        <section className="white-card empty-card">
          <p>등록 카드를 불러오지 못했어요.</p>
          <button className="text-button" type="button" onClick={reload}>
            <RefreshCcw size={15} /> 다시 시도
          </button>
        </section>
      )}

      {isEmpty && (
        <section className="white-card empty-card claim-card-empty">
          <span className="claim-card-empty-icon">
            <CreditCard size={26} />
          </span>
          <p>등록된 카드가 없습니다</p>
          <small>아래 &lsquo;결제 카드 등록하기&rsquo;로 카드를 추가하면 청구를 이어갈 수 있어요.</small>
        </section>
      )}

      {cards.length > 0 && (
        <div className="claim-card-list" role="radiogroup" aria-label="결제 카드 선택">
          {cards.map((card) => (
            <label
              className={`claim-card-option white-card claim-kv-card${selected === card.last4 ? " active" : ""}`}
              key={card.last4}
            >
              <input
                type="radio"
                name="claim-card"
                checked={selected === card.last4}
                onChange={() => setPicked(card.last4)}
              />
              <div className="claim-kv-row">
                <span className="k">카드사</span>
                <span className="v">{card.provider}</span>
              </div>
              <div className="claim-kv-row">
                <span className="k">카드번호 뒤 4자리</span>
                <span className="v">●●●● {card.last4}</span>
              </div>
              <div className="claim-kv-row">
                <span className="k">카드 명의자</span>
                <span className="v">{card.owner}</span>
              </div>
              <div className="claim-kv-row">
                <span className="k">상태</span>
                <span className="v positive">{card.status}</span>
              </div>
            </label>
          ))}
        </div>
      )}

      {/* 카드가 없으면 등록만이 유일한 다음 행동이라 그것만 주 버튼으로 남긴다 */}
      <div className="claim-btn-stack claim-btn-stack-cardstep">
        {!isEmpty && (
          <button
            className="primary-button button-flat-primary"
            disabled={!selected}
            onClick={() => onConfirm(selected)}
          >
            선택한 카드로 계속하기
          </button>
        )}
        <button
          className={isEmpty ? "primary-button button-flat-primary" : "secondary-button button-outline-secondary"}
          onClick={onChangeCard}
        >
          결제 카드 등록하기
        </button>
      </div>
    </main>
  );
}

const cardProviders = ["신한카드", "국민카드", "삼성카드", "현대카드", "우리카드", "하나카드", "카카오뱅크"];

function ClaimCardChange({ onSave }: { onSave: (last4: string) => void }) {
  const [provider, setProvider] = useState(cardProviders[0]);
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [owner, setOwner] = useState("");
  const digits = number.replace(/\D/g, "");
  const complete = digits.length === 16 && expiry.length === 5 && cvc.length === 3 && owner.trim().length > 1;

  return (
    <main className="sub-page claim-step">
      <span className="step-label">결제 카드 등록</span>
      <h1 className="claim-cardchange-title">재수비용을 결제한 카드를 등록해 주세요</h1>
      <div className="claim-note">변경한 카드는 이번 청구부터 바로 대조 기준이 됩니다.</div>
      <div className="claim-field">
        <label>카드사</label>
        <select className="claim-input" value={provider} onChange={(event) => setProvider(event.target.value)}>
          {cardProviders.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="claim-field">
        <label>카드번호</label>
        <input
          className="claim-input"
          value={number}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, "").slice(0, 16);
            setNumber(next.replace(/(\d{4})(?=\d)/g, "$1 "));
          }}
          placeholder="0000 0000 0000 0000"
          inputMode="numeric"
        />
      </div>
      <div className="claim-field-row">
        <div className="claim-field">
          <label>유효기간</label>
          <input
            className="claim-input"
            value={expiry}
            onChange={(event) => {
              const next = event.target.value.replace(/\D/g, "").slice(0, 4);
              setExpiry(next.length > 2 ? `${next.slice(0, 2)}/${next.slice(2)}` : next);
            }}
            placeholder="MM/YY"
            inputMode="numeric"
            autoComplete="cc-exp"
          />
        </div>
        <div className="claim-field">
          <label>CVC</label>
          <input
            className="claim-input"
            type="password"
            value={cvc}
            onChange={(event) => setCvc(event.target.value.replace(/\D/g, "").slice(0, 3))}
            placeholder="3자리"
            inputMode="numeric"
            autoComplete="cc-csc"
          />
        </div>
      </div>
      <div className="claim-field">
        <label>카드 명의자</label>
        <input
          className="claim-input"
          value={owner}
          onChange={(event) => setOwner(event.target.value.slice(0, 20))}
          placeholder="이름을 입력해 주세요"
        />
      </div>
      <button
        className="primary-button button-flat-primary"
        onClick={() => onSave(digits.slice(-4))}
        disabled={!complete}
      >
        카드 등록하기
      </button>
    </main>
  );
}

function ClaimUpload({
  onUpload,
  receipts,
  error,
  onCapture,
  onFileSelected,
  onRetakeReceipt,
  onDeleteReceipt,
}: {
  onUpload: () => void | Promise<void>;
  receipts: ReceiptItem[];
  error: string | null;
  onCapture: () => void;
  onFileSelected: (file: File) => void;
  onRetakeReceipt: (id: string) => void;
  onDeleteReceipt: (id: string) => void;
}) {
  return (
    <main className="sub-page claim-step claim-upload-step">
      <div className="claim-steps">
        <i className="on" />
        <i className="on" />
        <i />
      </div>
      <span className="step-label">STEP 2 / 3 · 영수증 업로드</span>
      <h1>재수비용 영수증을 첨부해 주세요</h1>
      <p>7~12월 결제분이 필요해요. 여러 장이면 모두 올려도 됩니다.</p>
      <div className="claim-upload-options">
        <button type="button" className="claim-drop claim-drop-half" onClick={onCapture}>
          <Camera size={24} />
          <strong>사진 찍기</strong>
        </button>
        <label className="claim-drop claim-drop-half">
          <FileText size={24} />
          <strong>파일 선택</strong>
          <input
            type="file"
            accept="image/*,.pdf"
            className="claim-file-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFileSelected(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="claim-upload-hint">JPG·PNG·PDF · 장당 10MB 이하 · 잘리지 않게 촬영해주세요</p>
      <div className="claim-receipt-divider" />
      <h2 className="claim-receipt-subtitle">첨부한 영수증 목록</h2>

      {receipts.length > 0 && (
        <section className="claim-receipt-list">
          {receipts.map((receipt, index) => (
            <div className="claim-receipt-item" key={receipt.id}>
              <span className="claim-receipt-thumb">
                <FileText size={18} />
              </span>
              <div className="claim-receipt-info">
                <strong>영수증 {index + 1}</strong>
                <small>
                  {receipt.file.name} · {receipt.source === "capture" ? "촬영됨" : "선택됨"}
                </small>
              </div>
              <div className="claim-receipt-actions">
                <button type="button" onClick={() => onRetakeReceipt(receipt.id)}>
                  다시 촬영
                </button>
                <button type="button" onClick={() => onDeleteReceipt(receipt.id)}>
                  삭제
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {error && <p className="claim-upload-error" role="alert">{error}</p>}
      <button className="primary-button claim-upload-submit" onClick={onUpload} disabled={receipts.length === 0}>
        영수증 확인하기
      </button>
    </main>
  );
}

function ClaimVerifying() {
  const steps = [
    { label: "영수증 파일 저장", sub: "3장 업로드 완료", done: true },
    { label: "OCR 실행", sub: "결제 정보 추출 완료", done: true },
    { label: "등록 카드와 대조", sub: "뒤 4자리·카드사 확인 중", done: false },
    { label: "학원 정보와 대조", sub: "학원명·사업자등록번호 대기", done: false },
  ];
  return (
    <div className="screen page-with-nav claim-screen">
      <TopBar />
      <main className="claim-verifying">
        <div className="claim-spinner" />
        <h1>영수증을 확인하고 있어요</h1>
        <p>
          보통 30초, 길어도 1분이면 끝나요.
          <br />
          앱을 닫아도 결과는 알림으로 보내드려요.
        </p>
        <section className="white-card claim-verify-list">
          {steps.map((step, index) => (
            <div className="claim-verify-item" key={step.label}>
              <span className={`claim-verify-marker ${step.done ? "" : "wait"}`}>{step.done ? <Check size={12} /> : index + 1}</span>
              <span>
                <strong>{step.label}</strong>
                <small>{step.sub}</small>
              </span>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

/**
 * 영수증 인식 결과 확인 — 등록 전에 사용자가 눈으로 대조하는 단계.
 *
 * OCR 이 붙기 전에는 업로드하면 곧장 판정 결과로 넘어갔다. 이제 실제로 글자를
 * 읽어 오므로, 잘못 읽힌 값이 그대로 접수되지 않도록 한 번 확인을 받는다.
 * 못 읽은 항목은 '인식 실패'로 드러내서 다시 찍을지 사용자가 판단하게 한다.
 */
function ClaimOCRConfirm({
  ocrResult,
  cardLast4,
  onConfirm,
  onRetake,
}: {
  ocrResult: ClaimOCRResult | null;
  cardLast4: string;
  onConfirm: () => void;
  onRetake: () => void;
}) {
  const amount =
    typeof ocrResult?.payment_amount === "number"
      ? `${ocrResult.payment_amount.toLocaleString("ko-KR")}원`
      : null;
  const rows: Array<{ label: string; value: string | null; note?: string }> = [
    {
      label: "학원",
      value: ocrResult?.merchant_name ?? null,
      note: ocrResult?.business_number ? `사업자 ${ocrResult.business_number}` : undefined,
    },
    { label: "결제금액", value: amount },
    { label: "결제일", value: ocrResult?.payment_date ?? null },
    { label: "승인번호", value: ocrResult?.approval_number ?? null },
    {
      label: "카드 뒤 4자리",
      value: ocrResult?.card_last4 ?? null,
      note: `등록 카드 ${cardLast4}`,
    },
  ];
  const missing = rows.filter((row) => !row.value).length;

  return (
    <main className="sub-page claim-step">
      <section className="claim-result-head">
        <span className="icon">
          <FileText size={20} />
        </span>
        <h2>이 내용이 맞나요?</h2>
        <p>
          영수증에서 읽어낸 값이에요.
          <br />
          맞으면 그대로 등록하고, 다르면 다시 찍어주세요.
        </p>
      </section>

      <section className="white-card">
        {rows.map((row) => (
          <div className="claim-match-row" key={row.label}>
            <div>
              <div className="label">{row.label}</div>
              <div className={`value${row.value ? "" : " claim-ocr-missing"}`}>
                {row.value ?? "인식하지 못했어요"}
              </div>
              {row.note && <div className="sub">{row.note}</div>}
            </div>
            <span className={`claim-tag ${row.value ? "ok" : "warn"}`}>
              {row.value ? "인식" : "실패"}
            </span>
          </div>
        ))}
      </section>

      {missing > 0 && (
        <p className="claim-upload-hint">
          {missing}개 항목을 읽지 못했어요. 글자가 잘리거나 흐리지 않게 다시 찍으면
          더 정확해집니다. 이대로 등록해도 심사는 진행되지만 확인이 길어질 수 있어요.
        </p>
      )}

      <div className="claim-btn-stack">
        <button className="primary-button button-flat-primary" onClick={onConfirm}>
          이대로 등록하기
        </button>
        <button className="secondary-button" onClick={onRetake}>
          다시 촬영하기
        </button>
      </div>
    </main>
  );
}

function ClaimResult({
  variant,
  cardLast4,
  ocrResult,
  reasons,
  onSubmit,
  onRetryUpload,
  onChangeCard,
  onViewStatus,
  onProofSelected,
  proofFileName,
}: {
  variant: ClaimResultVariant;
  cardLast4: string;
  ocrResult: ClaimOCRResult | null;
  reasons: string[];
  onSubmit: () => void;
  onRetryUpload: () => void;
  onChangeCard: () => void;
  onViewStatus: () => void;
  /** 카드사 이용내역 파일을 고른 순간 — 제출은 아래 버튼에서 한다. */
  onProofSelected: (file: File) => void;
  /** 고른 파일 이름. 없으면 아직 안 골랐다는 뜻이라 제출 버튼을 잠근다. */
  proofFileName: string | null;
}) {
  const receiptLast4 = ocrResult?.card_last4 ?? "확인되지 않음";
  const merchantName = ocrResult?.merchant_name ?? "학원명 확인 필요";
  const businessNumber = ocrResult?.business_number ?? "사업자번호 확인 필요";
  const paymentAmount =
    typeof ocrResult?.payment_amount === "number"
      ? `${ocrResult.payment_amount.toLocaleString("ko-KR")}원`
      : "결제금액 확인 필요";
  const approvalNumber = ocrResult?.approval_number ?? "승인번호 확인 필요";
  const reasonText = reasons.length > 0 ? reasons.join(" · ") : "백엔드 자동 검증 결과";

  if (variant === "matched") {
    return (
      <main className="sub-page claim-step">
        <div className="claim-steps">
          <i className="on" />
          <i className="on" />
          <i className="on" />
        </div>
        <section className="claim-result-head">
          <span className="icon">
            <Check size={20} />
          </span>
          <h2>정상 확인됐어요</h2>
          <p>
            등록 카드와 학원 정보가 모두 일치해요.
            <br />
            바로 청구를 접수할 수 있어요.
          </p>
        </section>
        <section className="white-card">
          <div className="claim-match-row">
            <div>
              <div className="label">카드 뒤 4자리</div>
              <div className="value">{cardLast4}</div>
              <div className="sub">
                등록 {cardLast4} · 영수증 {receiptLast4}
              </div>
            </div>
            <span className="claim-tag ok">일치</span>
          </div>
          <div className="claim-match-row">
            <div>
              <div className="label">학원</div>
              <div className="value">{merchantName}</div>
              <div className="sub">사업자 {businessNumber}</div>
            </div>
            <span className="claim-tag ok">일치</span>
          </div>
          <div className="claim-match-row">
            <div>
              <div className="label">결제금액 · 승인번호</div>
              <div className="value">{paymentAmount}</div>
              <div className="sub">승인 {approvalNumber} · 형식 정상</div>
            </div>
            <span className="claim-tag ok">정상</span>
          </div>
        </section>
        <div className="claim-btn-stack">
          <button className="primary-button button-flat-primary" onClick={onSubmit}>
            청구 접수하기
          </button>
          <button className="secondary-button button-outline-secondary" onClick={onRetryUpload}>
            영수증 다시 올리기
          </button>
        </div>
      </main>
    );
  }

  if (variant === "review") {
    return (
      <main className="sub-page claim-step">
        <div className="claim-steps">
          <i className="on" />
          <i className="on" />
          <i className="on" />
        </div>
        <section className="claim-result-head warn">
          <span className="icon">
            <TriangleAlert size={20} />
          </span>
          <h2>추가 확인이 필요해요</h2>
          <p>
            대부분 맞지만 한 항목을 사람이 다시 봐야 해요.
            <br />
            1영업일 안에 결과를 알려드려요.
          </p>
        </section>
        <section className="white-card">
          <div className="claim-match-row">
            <div>
              <div className="label">카드 뒤 4자리</div>
              <div className="value">{cardLast4}</div>
              <div className="sub">
                등록 {cardLast4} · 영수증 {receiptLast4}
              </div>
            </div>
            <span className="claim-tag ok">일치</span>
          </div>
          <div className="claim-match-row">
            <div>
              <div className="label">학원</div>
              <div className="value">{merchantName}</div>
              <div className="sub">사업자 {businessNumber}</div>
            </div>
            <span className="claim-tag ok">일치</span>
          </div>
          <div className="claim-match-row">
            <div>
              <div className="label">결제일</div>
              <div className="value">{ocrResult?.payment_date ?? "결제일 확인 필요"}</div>
              <div className="sub">{reasonText}</div>
            </div>
            <span className="claim-tag warn">확인</span>
          </div>
        </section>
        <div className="claim-note warn">검토가 끝나면 알림으로 알려드려요. 추가로 하실 일은 없어요.</div>
        <button className="primary-button claim-amber" onClick={onViewStatus}>
          진행 상황 보기
        </button>
      </main>
    );
  }

  if (variant === "proof") {
    return (
      <main className="sub-page claim-step">
        <section className="claim-result-head warn">
          <span className="icon">
            <Plus size={20} />
          </span>
          <h2>카드사 이용내역이 필요해요</h2>
          <p>
            영수증만으로는 실제 결제를 확인하기 어려워요.
            <br />
            공식 이용내역을 올려주시면 바로 처리됩니다.
          </p>
        </section>
        <section className="white-card">
          <h2>이상으로 잡힌 항목</h2>
          <div className="claim-match-row">
            <div>
              <div className="label">결제금액</div>
              <div className="value">{paymentAmount}</div>
              <div className="sub">{reasonText}</div>
            </div>
            <span className="claim-tag warn">중복</span>
          </div>
        </section>
        {/* button 이었을 때는 onClick 이 없어 눌러도 아무 일이 없었다.
            label + file input 으로 바꿔 파일 선택창이 뜨게 한다. */}
        <label className="claim-drop">
          <FileText size={24} />
          <strong>{proofFileName ?? "카드사 이용내역 올리기"}</strong>
          <small>
            {proofFileName
              ? "다시 누르면 다른 파일로 바꿀 수 있어요"
              : `${paymentMethod.provider} 앱 › 이용내역 › 기간 조회 후 PDF 저장`}
            <br />
            12월 24일까지 제출해 주세요
          </small>
          <input
            type="file"
            accept="image/*,.pdf"
            className="claim-file-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onProofSelected(file);
              event.target.value = "";
            }}
          />
        </label>
        <div className="claim-btn-stack">
          <button
            className="primary-button claim-amber"
            onClick={onSubmit}
            disabled={!proofFileName}
          >
            {proofFileName ? "이용내역 제출하기" : "파일을 먼저 골라주세요"}
          </button>
          <button className="secondary-button" onClick={onViewStatus}>
            나중에 하기
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="sub-page claim-step">
      <div className="claim-steps">
        <i className="on" />
        <i className="on" />
        <i className="on" />
      </div>
      <section className="claim-result-head bad">
        <span className="icon">
          <X size={20} />
        </span>
        <h2>등록 카드와 달라요</h2>
        <p>
          영수증의 카드가 가입 시 등록한 카드가 아니에요.
          <br />
          아래 방법 중 하나로 다시 시도해 주세요.
        </p>
      </section>
      <section className="white-card">
        <div className="claim-match-row">
          <div>
            <div className="label">카드 뒤 4자리</div>
            <div className="value">{receiptLast4}</div>
            <div className="sub">등록 {cardLast4} · 영수증 {receiptLast4}</div>
          </div>
          <span className="claim-tag bad">불일치</span>
        </div>
        <div className="claim-match-row">
          <div>
            <div className="label">학원</div>
            <div className="value">{merchantName}</div>
            <div className="sub">사업자 {businessNumber}</div>
          </div>
          <span className="claim-tag ok">일치</span>
        </div>
      </section>
      <div className="claim-note bad">
        <b>검증 사유</b> {reasonText}
        <br />
        실제로 다른 카드로 결제했다면 등록 카드를 변경하거나 영수증을 다시 올려주세요.
      </div>
      <div className="claim-btn-stack">
        <button className="primary-button claim-red" onClick={onRetryUpload}>
          영수증 다시 올리기
        </button>
        <button className="secondary-button" onClick={onChangeCard}>
          등록 카드 변경하기
        </button>
      </div>
    </main>
  );
}

function ClaimStatus({
  phase,
  firstClaimed,
  secondClaimed,
  firstSubmittedAt,
  secondSubmittedAt,
  submittedReceipts,
  onStartClaim,
}: {
  phase: ClaimPhase;
  firstClaimed: boolean;
  secondClaimed: boolean;
  /** 이번 세션에서 실제로 접수한 시각. 없으면(이전 회차 시나리오) 예시 날짜를 쓴다. */
  firstSubmittedAt: Date | null;
  secondSubmittedAt: Date | null;
  submittedReceipts: ReceiptItem[];
  onStartClaim: () => void;
}) {
  const { account, phaseInfo } = useClaimInfo();
  const [receiptsOpen, setReceiptsOpen] = useState(false);

  // TODO(claim-receipts-api): 청구 상세 API에 영수증 목록이 추가되면 서버 응답을
  // submittedReceipts 로 전달한다. 그 전까지는 이번 세션에서 실제 제출한 목록만 표시한다.
  if (!firstClaimed && !secondClaimed) {
    const info = phaseInfo[phase];
    return (
      <main className="sub-page">
        <span className="eyebrow">청구 진행 상황</span>
        <h1>내 청구 내역</h1>
        <section className="claim-empty-state">
          <span className="claim-empty-icon">
            <FileText size={26} />
          </span>
          <h2>{phase === "period1" ? "아직 접수한 청구가 없어요" : info.bannerTitle}</h2>
          <p>{phase === "period1" ? "청구를 시작하면 진행 상황을 여기서 확인할 수 있어요." : info.bannerText}</p>
          {phase === "period1" && (
            <button className="primary-button button-flat-primary" onClick={onStartClaim}>
              청구 시작하기
            </button>
          )}
        </section>
      </main>
    );
  }

  const usedManwon = (firstClaimed ? account.firstPaidManwon : 0) + (secondClaimed ? account.secondPaidManwon : 0);
  const usedPercent = Math.round((usedManwon / account.capManwon) * 100);

  return (
    <main className="sub-page">
      <span className="eyebrow">청구 진행 상황</span>
      <h1>내 청구 내역</h1>
      <section className="white-card">
        <h2>보장 한도 사용</h2>
        <div className="claim-limit-track">
          <span style={{ width: `${usedPercent}%` }} />
        </div>
        <div className="claim-limit-caption">
          <span>사용 {만원표기(usedManwon)}</span>
          <span>한도 {만원표기(account.capManwon)}</span>
        </div>
      </section>
      <section className="white-card">
        {firstClaimed && (
          <div className="claim-match-row">
            <div>
              <div className="label">
                1차 청구 · {firstSubmittedAt ? formatDotDateTime(firstSubmittedAt) : "2026.06.14"}
              </div>
              <div className="value">{만원표기(account.firstPaidManwon)}</div>
              <div className="sub">
                {firstSubmittedAt
                  ? `영수증 ${submittedReceipts.length}건 · 정상 확인`
                  : "영수증 2건 · 정상 확인"}
              </div>
            </div>
            <span className={`claim-tag ${firstSubmittedAt ? "warn" : "ok"}`}>
              {firstSubmittedAt ? "심사중" : "지급완료"}
            </span>
          </div>
        )}
        {secondClaimed && (
          <div className="claim-match-row">
            <div>
              <div className="label">
                2차 청구 · {secondSubmittedAt ? formatDotDateTime(secondSubmittedAt) : "2026.12.04"}
              </div>
              <div className="value">{만원표기(account.secondPaidManwon)}</div>
              <div className="sub">
                {secondSubmittedAt
                  ? `영수증 ${submittedReceipts.length}건 · 정상 확인`
                  : "영수증 3건 · 정상 확인"}
              </div>
            </div>
            <span className="claim-tag warn">심사중</span>
          </div>
        )}
      </section>
      <button
        type="button"
        className="claim-lrow"
        aria-expanded={receiptsOpen}
        aria-controls="submitted-receipts"
        onClick={() => setReceiptsOpen((open) => !open)}
      >
        <span>
          <strong>제출한 영수증 보기</strong>
          <small>{submittedReceipts.length > 0 ? `총 ${submittedReceipts.length}건` : "내역 확인"}</small>
        </span>
        <ChevronDown className={receiptsOpen ? "flip" : ""} size={17} />
      </button>
      {receiptsOpen && (
        <section id="submitted-receipts" className="claim-submitted-receipts" aria-label="제출한 영수증 내역">
          {submittedReceipts.length > 0 ? (
            submittedReceipts.map((receipt, index) => (
              <div className="claim-submitted-receipt" key={receipt.id}>
                <span className="claim-receipt-thumb">
                  <FileText size={17} />
                </span>
                <span>
                  <strong>영수증 {index + 1}</strong>
                  <small>{receipt.source === "capture" ? "카메라 촬영" : "파일 업로드"} · 제출 완료</small>
                </span>
              </div>
            ))
          ) : (
            <p className="claim-submitted-empty">
              저장된 영수증 내역은 청구 영수증 DB가 연결되면 이곳에 표시돼요.
            </p>
          )}
        </section>
      )}
      <div className="claim-note">
        {secondClaimed ? "2차까지 지급되면 청구 절차가 모두 끝나요." : "2차 청구가 열리면 알려드릴게요."}
      </div>
    </main>
  );
}

function NotificationPage({ close }: { close: () => void }) {
  return (
    <div className="screen notification-page">
      <TopBar back={close} backLabel="이전 화면" />
      <main>
        <div className="notification-page-heading">
          <span className="eyebrow">새 소식</span>
          <h1>알림</h1>
          <p>중요한 일정과 재수없수의 새로운 소식을 확인하세요.</p>
        </div>
        <section className="notification-list" aria-label="알림 목록">
        <div className="notice unread">
          <span>
            <TrendingUp size={19} />
          </span>
          <div>
            <strong>수학 성적이 6점 올랐어요</strong>
            <p>새 성적 분석 리포트를 확인해보세요.</p>
            <small>10분 전</small>
          </div>
        </div>
        <div className="notice">
          <span>
            <CalendarDays size={19} />
          </span>
          <div>
            <strong>1차 청구 마감 D-17</strong>
            <p>지금 결제 내역을 미리 확인할 수 있어요.</p>
            <small>어제</small>
          </div>
        </div>
        </section>
      </main>
    </div>
  );
}

function BottomNav({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) {
  const items = [
    { id: "home" as Tab, label: "홈", icon: Home },
    { id: "grades" as Tab, label: "성적분석", icon: ChartNoAxesCombined },
    { id: "converter" as Tab, label: "돈워리", icon: Calculator },
    { id: "mypage" as Tab, label: "마이", icon: UserRound },
  ];
  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      {items.map(({ id, label, icon: Icon }) => (
        <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
          <span>
            <Icon size={21} />
          </span>
          <em>{label}</em>
        </button>
      ))}
    </nav>
  );
}

export default function AppPage() {
  return (
    <SessionProvider>
      <AppShell />
    </SessionProvider>
  );
}

function AppShell() {
  const { studentId, fromWeb } = useSession();
  const [stage, setStage] = useState<Stage>("splash");

  const [tab, setTab] = useState<Tab>("home");
  const [homeScreen, setHomeScreen] = useState<HomeScreen>("main");
  const [chatQuestion, setChatQuestion] = useState("");
  // 기본 테마는 회색 & 화이트. 크림은 마이 → 테마 설정에서 고를 수 있다.
  const [canvasTone, setCanvasTone] = useState<CanvasTone>("gray-white");
  const [gradeScreen, setGradeScreen] = useState<GradeScreen>("intro");
  const [converterScreen, setConverterScreen] = useState<ConverterScreen>("intro");
  const [claimScreen, setClaimScreen] = useState<ClaimScreen | null>(null);
  const [notifications, setNotifications] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(true);
  const [claimPhase, setClaimPhase] = useState<ClaimPhase>("period2");

  /**
   * 앱으로 들어갈 때는 언제나 홈 탭에서 시작한다.
   *
   * 탭·화면 상태는 로그아웃해도 남아 있어서, 그냥 stage 만 "app" 으로 돌리면
   * 직전에 보던 탭(로그아웃 처리가 성적분석으로 돌려놓기까지 했다)이 그대로
   * 열렸다. 진입 경로가 둘(로딩 완료 · 웹 핸드오프)이라 한 곳에 모아 둔다.
   */
  const enterApp = useCallback(() => {
    setTab("home");
    setHomeScreen("main");
    setGradeScreen("intro");
    setConverterScreen("intro");
    setClaimScreen(null);
    setNotifications(false);
    setStage("app");
  }, []);

  // 웹 가입 완료 화면에서 ?student_id= 로 넘어왔으면 로그인을 건너뛴다
  useEffect(() => {
    if (fromWeb && studentId) enterApp();
  }, [fromWeb, studentId, enterApp]);

  const shellClass = useMemo(() => `app-shell stage-${stage}`, [stage]);

  // 화면이 바뀌면 항상 맨 위에서 시작한다 (탭·단계·상세·알림 전환 모두 포함)
  useScrollToTop(
    [stage, tab, homeScreen, gradeScreen, converterScreen, claimScreen ?? "-", notifications ? "noti" : "-"].join("|"),
  );

  const cycleClaimPhase = () => {
    const order: ClaimPhase[] = ["preExam", "postExam", "period1", "between", "period2"];
    setClaimPhase((current) => order[(order.indexOf(current) + 1) % order.length]);
  };

  useEffect(() => {
    document.documentElement.dataset.canvas = canvasTone;
    return () => {
      delete document.documentElement.dataset.canvas;
    };
  }, [canvasTone]);

  const visibleClaimScreen = claimScreen;

  const changeTab = (next: Tab) => {
    setTab(next);
    setClaimScreen(null);
    if (next === "home") setHomeScreen("main");
  };

  const openNotifications = () => {
    setHasUnreadNotifications(false);
    setNotifications(true);
  };

  const openChat = (question: string) => {
    setChatQuestion(question);
    setHomeScreen("chat");
  };

  return (
    <div className="site-stage">
      <div className={shellClass}>
        {stage === "splash" && <Splash onContinue={() => setStage("login")} />}
        {stage === "login" && <Login onLogin={() => setStage("loading")} />}
        {stage === "loading" && <Loading onDone={enterApp} />}
        {stage === "app" && (
          <>
            <ClaimPhaseToggle phase={claimPhase} onCycle={cycleClaimPhase} />
            {notifications ? (
              <NotificationPage close={() => setNotifications(false)} />
            ) : visibleClaimScreen ? (
              <ClaimFlow screen={visibleClaimScreen} setScreen={setClaimScreen} close={() => setClaimScreen(null)} phase={claimPhase} />
            ) : tab === "home" ? (
              homeScreen === "main" ? (
                <HomeMain
                  onNotification={openNotifications}
                  hasUnread={hasUnreadNotifications}
                  go={setHomeScreen}
                  goTab={changeTab}
                  askAi={openChat}
                  claimPhase={claimPhase}
                  onOpenClaim={() => setClaimScreen("home")}
                />
              ) : homeScreen === "chat" ? (
                <Chat
                  back={() => setHomeScreen("main")}
                  initialQuestion={chatQuestion}
                />
              ) : (
                <PremiumDetail
                  screen={homeScreen}
                  back={() => setHomeScreen(homeScreen === "history" ? "premium" : "main")}
                  go={() => setHomeScreen("history")}
                />
              )
            ) : tab === "grades" ? (
              <GradeFlow
                screen={gradeScreen}
                setScreen={setGradeScreen}
                onNotification={openNotifications}
                hasUnread={hasUnreadNotifications}
              />
            ) : tab === "converter" ? (
              <Converter
                screen={converterScreen}
                setScreen={setConverterScreen}
                onNotification={openNotifications}
                hasUnread={hasUnreadNotifications}
              />
            ) : (
              <MyPage
                onLogout={() => {
                  setStage("login");
                  setTab("home");
                  setGradeScreen("intro");
                  setClaimScreen(null);
                }}
                onNotification={openNotifications}
                hasUnread={hasUnreadNotifications}
                canvasTone={canvasTone}
                onChangeCanvasTone={setCanvasTone}
              />
            )}
            {!notifications && homeScreen !== "chat" && visibleClaimScreen !== "submitting" && visibleClaimScreen !== "done" && <BottomNav tab={tab} setTab={changeTab} />}
          </>
        )}
      </div>
    </div>
  );
}
