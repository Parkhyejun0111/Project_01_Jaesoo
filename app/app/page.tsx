"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { api } from "@jaesoo/api-client";
import type { ChatSource } from "@jaesoo/api-client";
import { SessionProvider, useSession } from "@/lib/session-context";
import { toVariant, useClaim, type ClaimOCRResult } from "@/lib/claim";
import { useCostEstimate, useCostForms, useStudents, type CostCatalog } from "@/lib/hooks";
import { POLICY_DOC, SUBJECT_COLOR, shortRoundLabel } from "@/lib/format";
import {
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BadgeCheck,
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
  FileChartColumn,
  FileText,
  Flag,
  GraduationCap,
  Home,
  Info,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MapPin,
  MessageCircle,
  Plus,
  RefreshCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Dumbbell,
  Siren,
  TriangleAlert,
  TrendingUp,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

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

// 아래 studentProfile/policyInfo/paymentMethod 는 백엔드가 꺼져 있을 때만 쓰는 폴백(데모) 값이다.
// 실데이터는 SessionProvider(useSession) 가 /api/student/{id} 로 불러온다.
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

// 청구 1단계(등록 카드 확인)에서 불러오는, 보험료 납입에 실제로 쓰인 카드들.
// TODO: 결제수단 DB 연동 시 학생별 납입 카드 목록 조회 결과로 교체.
const premiumPaymentCards = [
  { provider: "신한카드", last4: "4821", owner: "김○○ (학부모)", status: "활성 · 사용 가능" },
  { provider: "국민카드", last4: "9910", owner: "김○○ (학부모)", status: "활성 · 사용 가능" },
];

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

// 1차 청구 = 1개월치 학원비 실비 시나리오 — 지급 이력 DB가 없는 동안의 데모 비율
const FIRST_CLAIM_DEMO_RATIO = 0.26;

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
    bannerText: "수능 이후 1차 청구가 열려요. 그때 알림으로 알려드릴게요.",
    paidAmount: "0원",
    remainingAmount: 만원표기(cap),
    progress: 0,
    ctaLabel: "청구 준비 중",
    ctaEnabled: false,
    historySub: "청구 기간이 아직 열리지 않았어요",
    introHeading: "1차 청구, 아직 준비 중이에요",
    introTimeline: [
      { title: "수능", text: "성적 확정 · 보장 자격이 정해져요", state: "" },
      { title: "1차 청구", text: "수능 이후 접수 시작", state: "" },
      { title: "2차 청구", text: "1차로부터 6개월 후 접수", state: "" },
    ],
  },
  postExam: {
    toggleLabel: "수능 후",
    homeHeadline: "수능 종료 · 보장 자격을 확인하세요",
    bannerTitle: "1차 청구 준비 중이에요",
    bannerText: "수능이 끝났어요. 1차 청구는 7월 1일부터 열려요.",
    paidAmount: "0원",
    remainingAmount: 만원표기(cap),
    progress: 0,
    ctaLabel: "아직 접수 기간이 아니에요",
    ctaEnabled: false,
    historySub: "1차 청구 접수를 기다리고 있어요",
    introHeading: "1차 청구, 곧 열려요",
    introTimeline: [
      { title: "수능 · 종료", text: "성적 확정 · 보장 자격 확인 완료", state: "active" },
      { title: "1차 청구 · 접수 예정", text: "2026.07.01 ~ 07.31 · 1개월치 학원비 영수증 필요", state: "" },
      { title: "2차 청구", text: "1차로부터 6개월 후 접수", state: "" },
    ],
  },
  period1: {
    toggleLabel: "1차 청구 기간",
    homeHeadline: "1차 청구가 열렸어요, 지금 시작해보세요",
    bannerTitle: "1차 청구가 열렸어요",
    bannerText: "7월 31일까지 접수할 수 있어요. 영수증만 올리면 자동으로 검증돼요.",
    paidAmount: "0원",
    remainingAmount: 만원표기(cap),
    progress: 0,
    ctaLabel: "청구 시작하기",
    ctaEnabled: true,
    historySub: "아직 접수한 청구가 없어요",
    introHeading: "1차 청구, 두 단계면 끝나요",
    introTimeline: [
      { title: "1차 청구 · 접수 가능", text: "2026.07.01 ~ 07.31 · 1개월치 학원비 영수증 필요", state: "current" },
      { title: "2차 청구", text: "1차로부터 6개월 후 접수", state: "" },
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
      { title: "1차 청구 · 지급완료", text: `2026.06.30 접수 · ${만원표기(first)} · 영수증 대조 결과 정상`, state: "active" },
      { title: "2차 청구 · 접수 예정", text: "2026.12.01 ~ 12.31 · 6개월치 학원비 영수증 필요", state: "" },
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
      { title: "1차 청구 · 지급완료", text: `2026.06.30 접수 · ${만원표기(first)} · 영수증 대조 결과 정상`, state: "active" },
      { title: "2차 청구 · 접수 가능", text: "2026.12.01 ~ 12.31 · 6개월치 학원비 영수증 필요", state: "current" },
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

// 판정 수치(등급·σ)는 수능 성적 입력 후 /api/student/{id}/eligibility 로 교체 예정.
// 보장 한도만 가입정보(티어별 보장금)를 먼저 반영한다.
function buildEligibilityInfo(account: ClaimAccount): Record<EligibilityResult, EligibilityCopy> {
  return {
  none: {
    determinedAt: "2026.12.04",
    isEligible: false,
    tierLabel: "비대상",
    title: "이번엔 보장 대상이 아니에요",
    desc: "예상 성적 대비 하락폭이 경증 기준에 닿지 않았어요. 성적이 크게 떨어지지 않았다는 뜻이에요.",
    expectedGrade: "2.41등급",
    actualGrade: "3.19등급",
    dropSigma: "-1.12σ",
    mildThreshold: "-1.75σ 이하",
    severeThreshold: "-2.25σ 이하",
    coverageLimit: "0원",
    claimWindow: "7월 1일 ~ 7월 31일",
  },
  mild: {
    determinedAt: "2026.12.04",
    isEligible: true,
    tierLabel: "경증",
    title: "경증 보장 대상이에요",
    desc: "예상 성적 대비 하락폭이 경증 기준을 넘었어요. 1차 청구를 접수할 수 있어요.",
    expectedGrade: "2.41등급",
    actualGrade: "3.54등급",
    dropSigma: "-1.92σ",
    mildThreshold: "-1.75σ 이하",
    severeThreshold: "-2.25σ 이하",
    coverageLimit: 만원표기(account.mildCapManwon),
    claimWindow: "7월 1일 ~ 7월 31일",
  },
  severe: {
    determinedAt: "2026.12.04",
    isEligible: true,
    tierLabel: "중증",
    title: "중증 보장 대상이에요",
    desc: "예상 성적 대비 하락폭이 중증 기준을 넘었어요. 1차 청구를 접수할 수 있어요.",
    expectedGrade: "2.41등급",
    actualGrade: "3.98등급",
    dropSigma: "-2.41σ",
    mildThreshold: "-1.75σ 이하",
    severeThreshold: "-2.25σ 이하",
    coverageLimit: 만원표기(account.capManwon),
    claimWindow: "7월 1일 ~ 7월 31일",
  },
  };
}

/** 청구 화면 공용 데이터 — 가입정보(세션) 반영 한도·지급액 + 단계별 카피 */
function useClaimInfo() {
  const account = useClaimAccount();
  return useMemo(
    () => ({
      account,
      phaseInfo: buildClaimPhaseInfo(account),
      eligibility: buildEligibilityInfo(account),
    }),
    [account],
  );
}

// TODO: 모의고사 성적(subjects/percentileTrend/gradeHistory/gradeSubjectHistory)은 학생별 DB 조회 결과로 교체될 임시 목데이터입니다.
const subjects = {
  국어: { color: "#F5604E", values: [55, 58, 61, 60, 64, 66, 70, 73] },
  수학: { color: "#13BCAD", values: [52, 57, 63, 60, 65, 69, 75, 68] },
  영어: { color: "#3B5998", values: [61, 59, 63, 66, 62, 65, 69, 74] },
  탐구: { color: "#FFC83B", values: [57, 60, 66, 62, 64, 67, 72, 65] },
};

type Subject = keyof typeof subjects;
const examLabels = ["9월", "11월", "2월", "6월", "9월", "11월", "3월", "수능"];

const percentileTrend = {
  values: [52, 54, 60, 61, 58, 62, 63, 68, 65, 63],
  labels: ["11월", "11월", "2월", "6월", "9월", "12월", "3월", "6월", "9월", "수능"],
};
const latestPercentile = percentileTrend.values[percentileTrend.values.length - 1];
const percentileRangeLow = latestPercentile - 7;
const percentileRangeHigh = latestPercentile + 7;
const percentileDropThreshold = latestPercentile - 15;

const gradeCutoffs = [96, 89, 77, 60, 40, 23, 11, 4];
const percentileToGrade = (percentile: number) => {
  for (let grade = 0; grade < gradeCutoffs.length; grade++) {
    if (percentile >= gradeCutoffs[grade]) return grade + 1;
  }
  return 9;
};
const averageGrade =
  (Object.keys(subjects) as Subject[]).reduce((sum, name) => {
    const values = subjects[name].values;
    return sum + percentileToGrade(values[values.length - 1]);
  }, 0) / (Object.keys(subjects) as Subject[]).length;

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

const premiumPlan = {
  monthlyAmount: 42000,
  nextDueDate: new Date(2026, 6, 12),
  // TODO: 약관 연동 시 실제 재산정일로 교체
  renewalDate: new Date(2026, 7, 1),
};

const formatMonthDay = (date: Date) => `${date.getMonth() + 1}월 ${date.getDate()}일`;
const formatISODate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const formatDotDate = (date: Date) =>
  `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
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

function Login({ onLogin }: { onLogin: (studentId: string | null) => void }) {
  const { students, loading } = useStudents();
  const { studentId: savedId } = useSession();
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked ?? savedId ?? students[0]?.student_id ?? null;

  return (
    <main className="login-screen">
      <div className="login-brand">
        <Mascot size="md" />
        <h1>재수없수</h1>
        <p>재수없는 우리 아이! 부담없는 우리집!</p>
      </div>
      <form
        className="login-form"
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault();
          onLogin(selected);
        }}
      >
        {/* 실제 인증이 없는 데모 로그인이라 브라우저·확장 프로그램의 비밀번호 제안/자동입력
            팝업이 뜨면 오히려 화면을 깨뜨린다 — 자동완성과 비밀번호 관리자 제안을 모두 끈다 */}
        <label>
          <span>아이디</span>
          <input
            defaultValue="jaesoo2026"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore="true"
          />
        </label>
        <label>
          <span>비밀번호</span>
          <input
            type="password"
            defaultValue="12345678"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore="true"
          />
        </label>
        {students.length > 0 && (
          <fieldset className="choice-field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend>
              <span className="choice-field-title">가입 학생 선택 (데모 계정)</span>
            </legend>
            <div className="choice-grid columns-2">
              {students.slice(0, 6).map((s) => (
                <button
                  type="button"
                  key={s.student_id}
                  className={selected === s.student_id ? "active" : ""}
                  aria-pressed={selected === s.student_id}
                  onClick={() => setPicked(s.student_id)}
                >
                  <span>
                    {s.name}
                    {s.school ? ` · ${s.school}` : ""}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {!loading && students.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--text-weak, #8a8f8c)" }}>
            서버에 연결되지 않아 데모 데이터로 시작해요.
          </p>
        )}
        <button className="primary-button" type="submit">
          로그인
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

function BrandTabHeader({ onNotification, hasUnread = false }: { onNotification: () => void; hasUnread?: boolean }) {
  return (
    <header className="brand-tab-header">
      <img src="/logo-final-dark.png" alt="재수없수" />
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
  const [question, setQuestion] = useState("");
  const { profile } = useSession();
  const { phaseInfo } = useClaimInfo();
  const studentName = profile.data?.student?.name ?? studentProfile.name;
  const monthlyPremium = profile.data?.pricing?.monthly_premium ?? premiumPlan.monthlyAmount;

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
          <p className="home-greeting">
            <span>안녕하세요,</span>
            <strong>{studentName} 학생 학부모님!</strong>
          </p>
          <button className="icon-button" onClick={onNotification} aria-label="알림 열기">
            <Bell size={20} />
            {hasUnread && <span className="notification-dot" />}
          </button>
        </div>
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
          <button className="home-feature-card claim-feature claim-top" onClick={onOpenClaim}>
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
              <strong>{monthlyPremium.toLocaleString("ko-KR")}원</strong>
              <small>{formatMonthDay(premiumPlan.nextDueDate)} 납입 예정</small>
            </article>
            <article className="metric-card dday-card">
              <span className="metric-icon lime">
                <CalendarDays size={20} />
              </span>
              <span>보험료 재산정까지</span>
              <strong>D-{daysUntil(premiumPlan.renewalDate)}</strong>
              <small>{formatISODate(premiumPlan.renewalDate)}</small>
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
    </div>
  );
}

function PremiumDetail({ screen, back, go }: { screen: HomeScreen; back: () => void; go: () => void }) {
  const isHistory = screen === "history";
  const { profile, breakdown } = useSession();
  const pricing = profile.data?.pricing ?? null;
  const bd = breakdown.data ?? null;
  const monthly = pricing?.monthly_premium ?? premiumPlan.monthlyAmount;
  const components = bd?.monthly_components ?? null;
  const tierName = pricing?.tier ?? policyInfo.tier;
  const coverManwon = pricing ? Math.round(pricing.cover_severe / 10_000) : policyInfo.coverageCapManwon;
  const enrollment = (profile.data?.student?.enrollment ?? null) as { created_at?: string } | null;
  const joinedText = enrollment?.created_at
    ? formatDotDate(new Date(enrollment.created_at))
    : formatDotDate(policyInfo.joinedDate);
  return (
    <div className="screen page-with-nav">
      <TopBar back={back} backLabel="홈" />
      <main className="sub-page">
        <span className="eyebrow">우리 아이 보험</span>
        <h1>{isHistory ? "가입 내역" : "월 보험료 상세"}</h1>
        {!isHistory ? (
          <>
            <section className="hero-number-card">
              <span>이번 달 월 보험료</span>
              <strong>{monthly.toLocaleString("ko-KR")}원</strong>
              <p>{tierName} 티어 · 약관 별표4 기준 산정</p>
            </section>
            <section className="white-card">
              <h2>보험료 구성</h2>
              {components ? (
                <>
                  <div className="fee-row">
                    <span>위험보험료 (보장 원가)</span>
                    <strong>{components.risk_premium.toLocaleString("ko-KR")}원</strong>
                  </div>
                  <div className="fee-row">
                    <span>사업비 (모집·심사·수금)</span>
                    <strong>{components.expense.toLocaleString("ko-KR")}원</strong>
                  </div>
                  <div className="fee-row">
                    <span>위험마진 (안전할증)</span>
                    <strong>{components.risk_margin.toLocaleString("ko-KR")}원</strong>
                  </div>
                </>
              ) : (
                <>
                  <div className="fee-row">
                    <span>기본 보장 보험료</span>
                    <strong>36,000원</strong>
                  </div>
                  <div className="fee-row">
                    <span>생활 안심 특약</span>
                    <strong>8,000원</strong>
                  </div>
                  <div className="fee-row discount">
                    <span>성적 연동 할인</span>
                    <strong>-2,000원</strong>
                  </div>
                </>
              )}
              <div className="fee-total">
                <span>최종 월 보험료</span>
                <strong>{monthly.toLocaleString("ko-KR")}원</strong>
              </div>
            </section>
            <button className="primary-button" onClick={go}>
              가입 내역 보기
            </button>
          </>
        ) : (
          <>
            <section className="white-card policy-card">
              <span className="status-badge">보장 중</span>
              <h2>{policyInfo.productName}</h2>
              <p>가입일 {joinedText} · {tierName}</p>
              <div className="policy-values">
                <span>
                  <small>보장 한도</small>
                  <strong>{coverManwon.toLocaleString("ko-KR")}만원</strong>
                </span>
                <span>
                  <small>납입일</small>
                  <strong>매월 {policyInfo.paymentDueDay}일</strong>
                </span>
              </div>
            </section>
            <section className="white-card">
              <h2>주요 보장</h2>
              {["성적 하락 위로금", "재수 비용 보장", "수능 후 청구 지원"].map((item) => (
                <div className="check-row" key={item}>
                  <CircleCheck size={18} /> <span>{item}</span>
                </div>
              ))}
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
  type ChatMessage = {
    who: "ai" | "me";
    text: string;
    target?: string;
    sources?: ChatSource[];
    status?: "loading" | "typing" | "complete";
  };
  const welcomeMessageTail = "재수예요.\n\n약관과 보험료 산정 근거를 실제 약관 문서에 근거해 설명해드릴게요. 아래 추천 질문을 누르거나, 궁금한 점을 직접 입력해 물어보세요.";
  const { studentId } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<Array<{ role: string; content: string }>>([]);
  const recommendedQuestions = [
    "보험금은 언제, 어떻게 받나요?",
    "보험료는 어떤 기준으로 산정되나요?",
    "청약철회는 어떻게 하나요?",
    "보장에서 제외되는 경우는 뭔가요?",
  ];

  useEffect(() => {
    const messageArea = document.querySelector<HTMLElement>(".messages");
    messageArea?.scrollTo({ top: messageArea.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const typingIndex = messages.findIndex((message) => message.who === "ai" && message.status === "typing" && message.target && message.text.length < message.target.length);
    if (typingIndex === -1) return;

    const timer = window.setTimeout(() => {
      setMessages((current) => current.map((message, index) => {
        if (index !== typingIndex || !message.target) return message;
        // 답변이 길면 여러 글자씩 흘려 체감 대기를 줄인다
        const step = message.target.length > 400 ? 6 : message.target.length > 160 ? 3 : 1;
        const nextText = message.target.slice(0, message.text.length + step);
        return { ...message, text: nextText, status: nextText.length === message.target.length ? "complete" : "typing" };
      }));
    }, 24);
    return () => window.clearTimeout(timer);
  }, [messages]);

  const fallbackAnswerFor = (question: string) => {
    if (question.includes("보험금")) return "보험금은 보장 요건을 충족한 뒤 청구가 열리면 신청할 수 있어요. 제출 서류와 심사 결과를 확인한 후 등록한 계좌로 지급됩니다.";
    if (question.includes("청약철회")) return "청약철회는 가입 후 정해진 기간 안에 신청할 수 있어요. 마이 탭의 약관 및 정책에서 기준과 절차를 확인할 수 있습니다.";
    if (question.includes("제외")) return "성적표 위조·변조, 허위 제출처럼 약관에서 정한 면책 사유에 해당하면 보장에서 제외될 수 있어요.";
    return "지금은 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.";
  };

  const sendQuestion = async (question: string) => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;
    setMessages((current) => [
      ...current,
      { who: "me", text: trimmedQuestion },
      { who: "ai", text: "", status: "loading" },
    ]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "56px";

    const res = await api.chat({ message: trimmedQuestion, history: historyRef.current, studentId });
    setMessages((current) => {
      const index = current.findIndex((message) => message.who === "ai" && message.status === "loading");
      if (index === -1) return current;
      if (!res.ok && res.kind === "stale") {
        // 더 최신 질문이 이미 나갔다 — 이 응답 자리는 조용히 지운다
        return current.slice(0, index).concat(current.slice(index + 1));
      }
      const answer = res.ok ? res.data.answer : fallbackAnswerFor(trimmedQuestion);
      const sources = res.ok ? res.data.sources ?? [] : [];
      return current.map((message, i) =>
        i === index ? { ...message, target: answer, sources, status: "typing" as const } : message,
      );
    });
    if (res.ok) {
      historyRef.current = [
        ...historyRef.current,
        { role: "user", content: trimmedQuestion },
        { role: "assistant", content: res.data.answer },
      ].slice(-8); // 최근 4턴만 유지
    }
  };

  // 홈 화면에서 질문을 들고 들어온 경우 — 첫 렌더에 한 번만 전송한다
  const initialSentRef = useRef(false);
  useEffect(() => {
    if (initialSentRef.current || !initialQuestion) return;
    initialSentRef.current = true;
    void sendQuestion(initialQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  const send = () => {
    sendQuestion(input);
  };

  return (
    <div className="screen chat-screen">
      <div className="chat-heading chat-agentbar">
        <button className="chat-back" onClick={back} aria-label="홈으로 돌아가기"><ChevronLeft size={17} /><span>홈으로</span></button>
        <div>
          <h1>AI 도우미 노재수</h1>
          <p>
            <i /> 지금 상담 가능해요
          </p>
        </div>
      </div>
      <div className="messages">
        <div className="message-row ai">
          <Mascot size="sm" />
          <div className="message ai chat-welcome">
            안녕하세요! 저는 재수없수 AI 도우미 <span className="chat-welcome-no">NO</span>
            {welcomeMessageTail}
          </div>
        </div>
        <section className="chat-recommendations" aria-label="추천 질문">
          <span>추천 질문</span>
          <div className="quick-prompts">
            {recommendedQuestions.map((label) => (
              <button key={label} onClick={() => sendQuestion(label)}>{label}</button>
            ))}
          </div>
        </section>
        {messages.map((message, index) => (
          message.who === "ai" && message.status === "loading" ? (
            <div className="chat-loading-runner" key={`${message.who}-${index}`} aria-label="노재수가 답변을 준비하고 있어요">
              <div className="runner-track" aria-hidden="true">
                <span className="paw-print paw-one"><img src="/paw-loader.png" alt="" /></span>
                <span className="paw-print paw-two"><img src="/paw-loader.png" alt="" /></span>
                <span className="paw-print paw-three"><img src="/paw-loader.png" alt="" /></span>
                <span className="paw-print paw-four"><img src="/paw-loader.png" alt="" /></span>
                <div className="runner-mascot"><Mascot size="sm" /></div>
              </div>
            </div>
          ) : (
            <div className={`message-row ${message.who}`} key={`${message.who}-${index}`}>
              {message.who === "ai" && <Mascot size="sm" />}
              <div
                className={`message ${message.who} ${message.status === "typing" ? "typing" : ""} ${message.who === "ai" ? "answer-enter" : ""}`}
                style={{ whiteSpace: "pre-wrap" }}
              >
                {message.text || " "}
                {message.who === "ai" && message.status === "complete" && (message.sources?.length ?? 0) > 0 && (
                  <span style={{ display: "block", marginTop: 8, fontSize: 12, opacity: 0.72 }}>
                    근거: {message.sources!.map((source) => source.title).join(" · ")}
                  </span>
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
          placeholder="노재수에게 물어보세요"
          aria-label="AI 질문"
        />
        <button type="submit" aria-label="질문 보내기">
          <ArrowUp size={19} strokeWidth={2.2} />
        </button>
      </form>
    </div>
  );
}

function PercentileChart({
  values = percentileTrend.values,
  labels = percentileTrend.labels,
  threshold = percentileDropThreshold,
}: {
  values?: number[];
  labels?: string[];
  threshold?: number;
}) {
  const width = 360;
  const height = 218;
  const left = 30;
  const right = 15;
  const top = 18;
  const bottom = 30;
  const dataMin = Math.min(...values, threshold);
  const dataMax = Math.max(...values);
  const yMin = Math.min(30, Math.floor((dataMin - 5) / 10) * 10);
  const yMax = Math.max(80, Math.ceil((dataMax + 5) / 10) * 10);
  const gridValues: number[] = [];
  for (let v = yMin; v <= yMax; v += 10) gridValues.push(v);
  const latest = values[values.length - 1];

  const point = (value: number, index: number) => {
    const x = left + (index / (values.length - 1)) * (width - left - right);
    const y = top + ((yMax - value) / (yMax - yMin)) * (height - top - bottom);
    return [x, y];
  };
  const observedValues = values.slice(0, -1);
  const observedPath = observedValues
    .map((value, index) => {
      const [x, y] = point(value, index);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  const [predictionStartX, predictionStartY] = point(values[values.length - 2], values.length - 2);
  const [predictionEndX, predictionEndY] = point(values[values.length - 1], values.length - 1);
  const observedArea = `${observedPath} L ${predictionStartX} ${height - bottom} L ${left} ${height - bottom} Z`;
  const predictionBand = `${predictionStartX},${predictionStartY - 3} ${predictionEndX},${predictionEndY - 12} ${predictionEndX},${predictionEndY + 12} ${predictionStartX},${predictionStartY + 3}`;
  const [, thresholdY] = point(threshold, 0);
  const thresholdStartX = width - right - 88;

  return (
    <div className="percentile-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="수능 예상 백분위 추이 그래프">
        <defs>
          <linearGradient id="percentileArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0CB474" stopOpacity=".25" />
            <stop offset="100%" stopColor="#0CB474" stopOpacity=".02" />
          </linearGradient>
        </defs>
        {gridValues.map((value) => {
          const [, y] = point(value, 0);
          return (
            <g key={value}>
              <line x1={left} x2={width - right} y1={y} y2={y} className="grid-line" />
              <text x={4} y={y + 4} className="axis-label">
                {value}
              </text>
            </g>
          );
        })}
        <path d={observedArea} fill="url(#percentileArea)" />
        <polygon points={predictionBand} fill="#9CE6C9" opacity=".38" />
        <path d={observedPath} fill="none" stroke="#0CB474" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
        <line
          x1={predictionStartX}
          y1={predictionStartY}
          x2={predictionEndX}
          y2={predictionEndY}
          className="prediction-line"
        />
        {values.map((value, index) => {
          const [x, y] = point(value, index);
          return (
            <g key={`${value}-${index}`}>
              <circle cx={x} cy={y} r="6.2" fill="#9CE6C9" opacity=".55" />
              <circle cx={x} cy={y} r="3.2" fill="#fff" stroke="#0CB474" strokeWidth="2.2" />
            </g>
          );
        })}
        <line x1={thresholdStartX} x2={width - right} y1={thresholdY} y2={thresholdY} className="threshold-line" />
        <text x={width - right} y={thresholdY - 6} textAnchor="end" className="threshold-label">
          보장 기준선 {threshold}점
        </text>
        <text x={width - right} y={point(values[values.length - 1], values.length - 1)[1] - 11} textAnchor="end" className="score-end-label">
          {latest}
        </text>
        {labels.map((label, index) => {
          const [x] = point(values[index], index);
          return (
            <text key={`${label}-${index}`} x={x} y={height - 9} textAnchor="middle" className="x-label">
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

type SubjectSeries = Record<string, { color: string; values: number[] }>;

function Chart({
  selected,
  data = subjects,
  labels = examLabels,
}: {
  selected: string;
  data?: SubjectSeries;
  labels?: string[];
}) {
  const width = 360;
  const height = 224;
  const left = 30;
  const right = 10;
  const top = 16;
  const bottom = 28;
  const subjectNames = Object.keys(data);
  const visible = selected === "전체" ? subjectNames : subjectNames.filter((name) => name === selected);
  const visibleValues = visible.flatMap((name) => data[name].values);
  const yMin = Math.min(45, Math.floor((Math.min(...visibleValues, 60) - 5) / 5) * 5);
  const yMax = Math.max(80, Math.ceil((Math.max(...visibleValues, 60) + 5) / 5) * 5);
  const gridValues: number[] = [];
  for (let v = Math.ceil(yMin / 10) * 10; v <= yMax; v += 10) gridValues.push(v);
  const xCount = Math.max(labels.length, 2);
  const accent = selected === "전체" ? "#0CB474" : data[selected]?.color ?? "#0CB474";

  const point = (value: number, index: number) => {
    const x = left + (index / (xCount - 1)) * (width - left - right);
    const y = top + ((yMax - value) / (yMax - yMin)) * (height - top - bottom);
    return [x, y];
  };

  const pathFor = (values: number[]) =>
    values
      .map((value, index) => {
        const [x, y] = point(value, index);
        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");

  const areaPath =
    selected === "전체" || !data[selected]
      ? ""
      : `${pathFor(data[selected].values)} L ${width - right} ${height - bottom} L ${left} ${height - bottom} Z`;
  const markerRadius = selected === "전체" ? 2.1 : 3.4;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${selected} 성적 추이 그래프`}>
        <defs>
          <linearGradient id="scoreArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity=".25" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridValues.map((value) => {
          const [, y] = point(value, 0);
          return (
            <g key={value}>
              <line x1={left} x2={width - right} y1={y} y2={y} className="grid-line" />
              <text x={2} y={y + 4} className="axis-label">
                {value}
              </text>
            </g>
          );
        })}
        {areaPath && <path d={areaPath} fill="url(#scoreArea)" />}
        {visible.map((subject) => (
          <g key={subject}>
            <path d={pathFor(data[subject].values)} fill="none" stroke={data[subject].color} strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
            {data[subject].values.map((value, index) => {
              const [x, y] = point(value, index);
              return (
                <circle key={`${subject}-${index}`} cx={x} cy={y} r={markerRadius} fill="#fff" stroke={data[subject].color} strokeWidth={selected === "전체" ? "1.7" : "2.3"} />
              );
            })}
          </g>
        ))}
        {labels.map((label, index) => {
          const [x] = point(0, index);
          return (
            <text key={`${label}-${index}`} x={x} y={height - 8} textAnchor="middle" className="x-label subject-x-label">
              {label}
            </text>
          );
        })}
      </svg>
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

  return <Grades onNotification={onNotification} hasUnread={hasUnread} />;
}

function Grades({ onNotification, hasUnread }: { onNotification: () => void; hasUnread: boolean }) {
  const [segment, setSegment] = useState<"trend" | "weak">("trend");
  const [selected, setSelected] = useState<string>("전체");
  const [expandedTrend, setExpandedTrend] = useState(false);
  const trendMoreRef = useRef<HTMLDivElement>(null);
  const { profile } = useSession();
  const analysis = profile.data?.analysis ?? null;

  // 회차 종합 백분위 + 예측치(수능) — 백엔드가 없으면 목데이터로 그린다
  const liveTrend = useMemo(() => {
    if (!analysis) return null;
    const points: Array<{ label: string; value: number }> = [];
    for (const round of analysis.round_order) {
      const value = analysis.rounds[round];
      if (typeof value === "number") points.push({ label: shortRoundLabel(round), value: Math.round(value) });
    }
    const predicted = analysis.band.predicted_percentile;
    if (points.length < 2 || predicted === null) return null;
    points.push({ label: "수능", value: Math.round(predicted) });
    return {
      values: points.map((p) => p.value),
      labels: points.map((p) => p.label),
      threshold:
        analysis.band.mild_threshold_percentile !== null
          ? Math.round(analysis.band.mild_threshold_percentile)
          : Math.round(predicted) - 15,
    };
  }, [analysis]);

  const trend = liveTrend ?? {
    values: percentileTrend.values,
    labels: percentileTrend.labels,
    threshold: percentileDropThreshold,
  };
  const latest = trend.values[trend.values.length - 1];
  const rangeLow = latest - 7;
  const rangeHigh = latest + 7;

  // 과목별 시리즈 — 실데이터가 있으면 과목 색만 붙여 그대로 쓴다
  const liveSubjects = useMemo(() => {
    if (!analysis) return null;
    const out: SubjectSeries = {};
    for (const [name, stat] of Object.entries(analysis.subjects)) {
      if (stat.series.length >= 2) out[name] = { color: SUBJECT_COLOR[name] ?? "#0CB474", values: stat.series.map((v) => Math.round(v)) };
    }
    return Object.keys(out).length >= 2 ? out : null;
  }, [analysis]);

  const chartData: SubjectSeries = liveSubjects ?? subjects;
  const chartLabels = liveSubjects && analysis ? analysis.round_order.map(shortRoundLabel) : examLabels;
  const liveAverageGrade =
    Object.keys(chartData).reduce((sum, name) => {
      const values = chartData[name].values;
      return sum + percentileToGrade(values[values.length - 1]);
    }, 0) / Math.max(Object.keys(chartData).length, 1);

  useEffect(() => {
    if (!expandedTrend) return;
    const timer = window.setTimeout(() => {
      trendMoreRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 170);
    return () => window.clearTimeout(timer);
  }, [expandedTrend]);

  return (
    <div className="screen page-with-nav grades-screen">
      <section className="grades-brand-header">
        <img src="/logo-final-white.png" alt="재수없수" />
        <button className="icon-button" onClick={onNotification} aria-label="알림 열기">
          <Bell size={20} />
          {hasUnread && <span className="notification-dot" />}
        </button>
      </section>
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
                      백분위 <b>{latest}</b>
                      <small>예상 범위 {rangeLow}~{rangeHigh}</small>
                    </h2>
                  </div>
                  <p>
                    그동안의 모의고사 성적 추이를 바탕으로 예상한 백분위 입니다.
                  </p>
                </div>
                <PercentileChart values={trend.values} labels={trend.labels} threshold={trend.threshold} />
              </section>
              <section className="score-explainer">
                <b>빨간 선({trend.threshold}점)은</b> 평소 예상보다 크게 떨어진 &apos;불운&apos;을 판단하는 기준선입니다.
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
                      <strong>평균 {liveAverageGrade.toFixed(2)}등급</strong>
                    </div>
                    <p className="subject-trend-note">
                      백분위는 높을수록 좋아요 · 판정 대상 국어·수학·영어·탐구
                    </p>
                    <div className="subject-filters" aria-label="그래프 과목 필터">
                      {["전체", ...Object.keys(chartData)].map((subject) => (
                        <button
                          key={subject}
                          className={selected === subject ? "active" : ""}
                          onClick={() => setSelected(subject)}
                        >
                          {subject !== "전체" && (
                            <i className="subject-filter-dot" style={{ background: chartData[subject].color }} />
                          )}
                          {subject}
                        </button>
                      ))}
                    </div>
                    <Chart selected={selected} data={chartData} labels={chartLabels} />
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
  const { profile } = useSession();
  const analysis = profile.data?.analysis ?? null;

  // 변동성(백분위 σ)을 100점 기준 안정성 점수로 환산 — σ 0 → 100점, σ 10 → 20점
  const stabilityFromVolatility = (volatility: number) =>
    Math.max(5, Math.min(98, Math.round(100 - volatility * 8)));

  const liveRows = useMemo<[string, number, string][] | null>(() => {
    if (!analysis) return null;
    const rows = Object.entries(analysis.subjects).map(
      ([name, stat]) =>
        [name, stabilityFromVolatility(stat.volatility), SUBJECT_COLOR[name] ?? "#0CB474"] as [string, number, string],
    );
    return rows.length >= 2 ? rows : null;
  }, [analysis]);

  const rows: [string, number, string][] = liveRows ?? [
    ["국어", 56, "#F5604E"],
    ["수학", 52, "#13BCAD"],
    ["영어", 48, "#3B5998"],
    ["탐구", 65, "#FFC83B"],
  ];
  const stabilityScore = liveRows
    ? Math.round(liveRows.reduce((sum, [, score]) => sum + score, 0) / liveRows.length)
    : 55;
  const overallTier = stabilityTier(stabilityScore);
  const priorityCopy: Record<string, string> = {
    국어: "꾸준한 흐름을 유지하면서 취약 유형을 보완해보아요.",
    수학: "아직 점수 향상 여지가 있어요. 기본기를 차근차근 쌓아가요.",
    영어: "수능 당일 변수를 줄이기 위해 점수 향상보다 성적 기복을 잡는 데 집중해보아요.",
    탐구: "안정적인 흐름이니 지금 페이스를 유지하며 심화 학습을 더해보아요.",
  };
  const priorityIcons = [BookOpenCheck, TrendingUp];
  const sortedByStability = [...rows].sort((a, b) => a[1] - b[1]);
  const weakestSubject = sortedByStability[0][0];
  const priorityPair = sortedByStability.slice(0, 2);
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
            aria-label={`안정성 점수 ${stabilityScore}`}
            style={{
              background: `conic-gradient(${stabilityRingColor[overallTier.tone]} 0% ${stabilityScore}%, #e3e8e5 ${stabilityScore}% 100%)`,
            }}
          >
            <span>
              <strong>{stabilityScore}</strong>
            </span>
          </div>
          <p>
            <b>{weakestSubject} 과목</b>의 등락이 가장 커요. 기준선보다 안정도가 낮아 집중 보완을 추천해요.
          </p>
        </div>
      </section>
      <section className="white-card subject-stability">
        <div className="card-heading">
          <span className="eyebrow">과목별 안정성</span>
          <h2>흔들림이 적을수록 좋아요</h2>
        </div>
        {rows.map(([name, score, color]) => {
          const tier = stabilityTier(score);
          return (
            <div className="stability-row" key={name}>
              <strong>{name}</strong>
              <div className="report-bar">
                <span style={{ width: `${score}%`, background: color }} />
              </div>
              <b style={{ color }}>{score}</b>
              <em>{tier.label}</em>
            </div>
          );
        })}
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
              <div
                className="focus-priority-track"
                aria-live="polite"
              >
                {priorityPair.map(([name, , color], index) => {
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
                        <p>{priorityCopy[name] ?? "성적 기복이 커요. 흔들림을 줄이는 데 먼저 집중해보아요."}</p>
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

const academyCostTable: Record<string, number> = {
  "독학재수(독서실·인강)": 35833,
  "단과 통학": 585833,
  "재수종합학원": 1910000,
  "기숙학원": 3600000,
};

const academyDescription: Record<string, string> = {
  "독학재수(독서실·인강)": "메가스터디·대성마이맥 등 인강 패스 비용 기준 (독서실+인강)",
  "단과 통학": "유명 강사 현강 + 동네 보습학원 수강료·교재비 평균",
  "재수종합학원": "메이저 재종합반 5개사 평균 (시대인재·강남대성 등)",
  "기숙학원": "메가스터디·시대인재·강남대성 등 기숙학원 5개사 평균",
};

const regionMultiplier: Record<string, number> = {
  "서울 학군지": 1.15,
  "서울 비학군지": 1.05,
  "수도권": 1,
  "지방": 0.9,
};

const savingsFallbackAmount = 180;
const incomeFallbackAmount = 660;

// 선택지 라벨 → /api/cost-estimate 파라미터 값 (백엔드 costs.py 의 *_OPTIONS 와 동일)
const savingValueByLabel: Record<string, number | null> = {
  "선택안함": null, "50만원 미만": 25, "50~100만원": 75,
  "100~150만원": 125, "150~250만원": 200, "250만원 이상": 300,
};
const childrenValueByLabel: Record<string, number | null> = {
  "선택안함": null, "1명": 1, "2명": 2, "3명 이상": 3,
};
const retireValueByLabel: Record<string, number | null> = {
  "선택안함": null, "1억 미만": 7500, "1~3억원": 20000,
  "3~5억원": 40000, "5~7억원": 60000, "7억 이상": 80000,
};
const incomeValueByLabel: Record<string, number | null> = {
  "선택안함": null, "300만원 미만": 250, "300~450만원": 375,
  "450~600만원": 525, "600~800만원": 700, "800만원 이상": 900,
};

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
  const [converterChoices, setConverterChoices] = useState({
    savings: "150~250만원",
    children: "2명",
    retirement: "3~5억원",
    income: "600~800만원",
    academy: "재수종합학원",
    region: "수도권",
  });
  const savingsIsFallback = converterChoices.savings === "선택안함";
  const incomeIsFallback = converterChoices.income === "선택안함";
  const retirementUnset = converterChoices.retirement === "선택안함";
  const childrenIsFallback = converterChoices.children === "선택안함";
  const childrenHidesTuition = childrenIsFallback || converterChoices.children === "1명";

  // 재수 형태·지역 시세 정의는 백엔드 카탈로그를 우선 쓰고, 없으면 목데이터로 그린다
  const { data: catalog } = useCostForms();
  const catalogForm = catalog?.forms.find((f) => f.name === converterChoices.academy) ?? null;
  const regionPct =
    catalog?.regions.find((r) => r.name === converterChoices.region)?.pct ??
    (regionMultiplier[converterChoices.region] ?? 1) * 100;
  const monthlyManwonBase = catalogForm
    ? catalogForm.monthly
    : academyCostTable[converterChoices.academy] / 10000;

  // 결과·로딩 화면에서만 서버 환산을 호출한다
  const estimateParams = useMemo(() => {
    if (screen !== "result" && screen !== "loading") return null;
    return {
      form: converterChoices.academy,
      region: converterChoices.region,
      monthly_saving: savingValueByLabel[converterChoices.savings] ?? undefined,
      monthly_income: incomeValueByLabel[converterChoices.income] ?? undefined,
      sibling_count: childrenValueByLabel[converterChoices.children] ?? undefined,
      retire_goal: retireValueByLabel[converterChoices.retirement] ?? undefined,
    };
  }, [screen, converterChoices]);
  const { data: estimate } = useCostEstimate(estimateParams);

  const localComparison = Math.round((monthlyManwonBase * regionPct) / 100 * 10);
  const comparisonAmount = estimate?.total ?? localComparison;
  const monthlyCostManwon = estimate
    ? Math.round(estimate.monthly)
    : Math.round((monthlyManwonBase * regionPct) / 100);

  const coveredAmount = estimate?.covered ?? Math.min(policyInfo.coverageCapManwon, comparisonAmount);
  const finalAmount = estimate?.self_pay ?? Math.max(comparisonAmount - coveredAmount, 0);
  const coveragePercent = comparisonAmount > 0 ? Math.round((coveredAmount / comparisonAmount) * 100) : 0;
  const formattedComparison = comparisonAmount.toLocaleString("ko-KR");

  // 환산 분모 — 선택값이 있으면 그 값, 없으면 통계 평균 (카탈로그 → 목데이터 순)
  const savingBase = savingValueByLabel[converterChoices.savings] ?? catalog?.averages?.monthly_saving ?? savingsFallbackAmount;
  const incomeBase = incomeValueByLabel[converterChoices.income] ?? catalog?.averages?.monthly_income ?? incomeFallbackAmount;
  const semesterBase = catalog?.averages?.semester_tuition ?? 355.3;
  const retireBase = retireValueByLabel[converterChoices.retirement] ?? 38200;
  const savingsMonths = String(estimate?.conversions.saving_months ?? (comparisonAmount / savingBase).toFixed(1));
  const tuitionTerms = String(estimate?.conversions.tuition_semesters ?? (comparisonAmount / semesterBase).toFixed(1));
  const retirementPercent = String(estimate?.conversions.retirement_pct ?? ((comparisonAmount / retireBase) * 100).toFixed(1));
  const incomeMonths = String(estimate?.conversions.income_months ?? (comparisonAmount / incomeBase).toFixed(1));

  const updateConverterChoice = (key: keyof typeof converterChoices, value: string) => {
    setConverterChoices((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    if (screen !== "loading") return;
    const timer = window.setTimeout(() => setScreen("result"), 1700);
    return () => window.clearTimeout(timer);
  }, [screen, setScreen]);

  if (screen === "intro") {
    return (
      <div className="screen page-with-nav converter-intro">
        <BrandTabHeader onNotification={onNotification} hasUnread={hasUnread} />
        <main>
          <span className="eyebrow">돈(Money) 걱정은 뚝! Don't Worry</span>
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
        <TopBar onNotification={onNotification} hasUnread={hasUnread} />
        <main className="converter-detail converter-result-page">
          <section className="converter-result-total">
            <span>1년 동안 발생하는 재수 비용은 얼마일까요?</span>
            <strong>{formattedComparison}만원</strong>
            <small>{converterChoices.academy} · {converterChoices.region} 시세 반영</small>
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
                <code>{formattedComparison}만원 ÷ 월 {Math.round(savingBase).toLocaleString("ko-KR")}만원</code>
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
                  <code>{formattedComparison}만원 ÷ 학기당 {Math.round(semesterBase).toLocaleString("ko-KR")}만원</code>
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
                  <code>{formattedComparison}만원 ÷ 목표 {Math.round(retireBase).toLocaleString("ko-KR")}만원</code>
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
                <code>{formattedComparison}만원 ÷ 월 {Math.round(incomeBase).toLocaleString("ko-KR")}만원</code>
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

          <button
            type="button"
            className="converter-restart"
            onClick={() => {
              setConverterChoices({
                savings: "150~250만원",
                children: "2명",
                retirement: "3~5억원",
                income: "600~800만원",
                academy: "재수종합학원",
                region: "수도권",
              });
              setScreen("input");
            }}
          >
            <RefreshCcw size={17} /> 처음부터 다시 계산하기
          </button>
        </main>
      </div>
    );
  }

  const isInput = screen === "input";

  return (
    <div className="screen page-with-nav converter-flow-screen">
      <TopBar
        back={isInput ? undefined : () => setScreen("input")}
        backLabel="이전 화면"
        onNotification={onNotification}
        hasUnread={hasUnread}
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
              options={["선택안함", "50만원 미만", "50~100만원", "100~150만원", "150~250만원", "250만원 이상"]}
              selected={converterChoices.savings}
              onChange={(value) => updateConverterChoice("savings", value)}
              columns={3}
              note={`${savingsFallbackAmount}만 원 기준값 적용 · '평균 가구 기준' 라벨 표시`}
            />
            <FormChoice
              title="자녀 수"
              icon={<UserRound size={18} />}
              options={["선택안함", "1명", "2명", "3명 이상"]}
              selected={converterChoices.children}
              onChange={(value) => updateConverterChoice("children", value)}
              columns={4}
              note="1명으로 간주, '동생 대학 등록금' 카드 미표시"
            />
            <FormChoice
              title="노후 자금 목표액"
              icon={<Flag size={18} />}
              options={["선택안함", "1억 미만", "1~3억원", "3~5억원", "5~7억원", "7억 이상"]}
              selected={converterChoices.retirement}
              onChange={(value) => updateConverterChoice("retirement", value)}
              columns={3}
              note="'노후 자금 목표 대비' 카드가 표시되지 않아요"
            />
            <FormChoice
              title="월 가처분 소득"
              icon={<Home size={18} />}
              options={["선택안함", "300만원 미만", "300~450만원", "450~600만원", "600~800만원", "800만원 이상"]}
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
              options={catalog?.forms.map((f) => f.name) ?? ["독학재수(독서실·인강)", "단과 통학", "재수종합학원", "기숙학원"]}
              selected={converterChoices.academy}
              onChange={(value) => updateConverterChoice("academy", value)}
              columns={2}
            />
            <RegionChoice
              selected={converterChoices.region}
              onChange={(value) => updateConverterChoice("region", value)}
              options={catalog?.regions}
            />
            <section className="converter-cost-summary">
              <div>
                <span>월 평균 비용</span>
                <strong>{monthlyCostManwon.toLocaleString("ko-KR")}만원</strong>
              </div>
              <p>{catalogForm?.note ?? academyDescription[converterChoices.academy]}</p>
              <hr />
              <div className="total">
                <span>10개월 누적 총액</span>
                <strong>{formattedComparison}만원</strong>
              </div>
            </section>
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

function RegionChoice({
  selected,
  onChange,
  options,
}: {
  selected: string;
  onChange: (value: string) => void;
  options?: CostCatalog["regions"];
}) {
  const regions = options?.map((r) => [r.name, r.desc] as [string, string]) ?? [
    ["서울 학군지", "강남·목동·중계"],
    ["서울 비학군지", "서울 그 외 지역"],
    ["수도권", "경기·인천 (기준)"],
    ["지방", "광역시·지방권"],
  ];

  return (
    <fieldset className="choice-field region-choice">
      <legend>
        <span className="choice-field-title">
          <span aria-hidden="true"><MapPin size={18} /></span>
          우리 동네 시세에 맞게 조정
        </span>
      </legend>
      <p>지역마다 학원 시세가 달라요. 우리 동네를 골라주세요.</p>
      <div className="region-grid">
        {regions.map(([name, detail]) => (
          <button
            type="button"
            className={selected === name ? "active" : ""}
            key={name}
            onClick={() => onChange(name)}
            aria-pressed={selected === name}
          >
            <span><strong>{name}</strong><small>{detail}</small></span>
          </button>
        ))}
      </div>
    </fieldset>
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
      { label: "성적 연동 상태", detail: "업데이트 완료", static: true },
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

// 과목별 등급 숫자만 담는다 — 색상(등급 상승/하락/유지)은 직전 회차와 비교해
// historyEntries 생성 시 계산한다 (subjectGradeTone 참고).
type SubjectGradeCell = { name: string; scoreText: string; gradeNum: number | null };
const gradeSubjectHistory: SubjectGradeCell[][] = [
  [{ name: "국어", scoreText: "59점", gradeNum: 5 }, { name: "수학", scoreText: "76점", gradeNum: 4 }, { name: "영어", scoreText: "68점", gradeNum: 4 }, { name: "탐구", scoreText: "59점", gradeNum: 5 }],
  [{ name: "국어", scoreText: "60점", gradeNum: 4 }, { name: "수학", scoreText: "66점", gradeNum: 4 }, { name: "영어", scoreText: "64점", gradeNum: 4 }, { name: "탐구", scoreText: "53점", gradeNum: 5 }],
  [{ name: "국어", scoreText: "63점", gradeNum: 4 }, { name: "수학", scoreText: "69점", gradeNum: 4 }, { name: "영어", scoreText: "67점", gradeNum: 4 }, { name: "탐구", scoreText: "66점", gradeNum: 4 }],
  [{ name: "국어", scoreText: "61점", gradeNum: 4 }, { name: "수학", scoreText: "65점", gradeNum: 4 }, { name: "영어", scoreText: "66점", gradeNum: 4 }, { name: "탐구", scoreText: "63점", gradeNum: 4 }],
  [{ name: "국어", scoreText: "58점", gradeNum: 5 }, { name: "수학", scoreText: "63점", gradeNum: 4 }, { name: "영어", scoreText: "61점", gradeNum: 4 }, { name: "탐구", scoreText: "60점", gradeNum: 4 }],
  [{ name: "국어", scoreText: "60점", gradeNum: 4 }, { name: "수학", scoreText: "62점", gradeNum: 4 }, { name: "영어", scoreText: "63점", gradeNum: 4 }, { name: "탐구", scoreText: "62점", gradeNum: 4 }],
  [{ name: "국어", scoreText: "57점", gradeNum: 5 }, { name: "수학", scoreText: "61점", gradeNum: 4 }, { name: "영어", scoreText: "62점", gradeNum: 4 }, { name: "탐구", scoreText: "59점", gradeNum: 5 }],
  [{ name: "국어", scoreText: "54점", gradeNum: 5 }, { name: "수학", scoreText: "58점", gradeNum: 5 }, { name: "영어", scoreText: "56점", gradeNum: 5 }, { name: "탐구", scoreText: "55점", gradeNum: 5 }],
  [{ name: "국어", scoreText: "53점", gradeNum: 5 }, { name: "수학", scoreText: "56점", gradeNum: 5 }, { name: "영어", scoreText: "55점", gradeNum: 5 }, { name: "탐구", scoreText: "54점", gradeNum: 5 }],
];

/** 등급은 숫자가 작을수록 우수하다 — 직전 회차 대비 낮아지면(상승) 초록, 높아지면(하락) 빨강, 동일하면 회색. */
function subjectGradeTone(current: number | null, previous: number | null): string {
  if (current === null || previous === null || current === previous) return "";
  return current < previous ? "positive" : "danger";
}

// TODO: 보험료 결제 내역은 학생별 DB 조회 결과로 교체될 임시 목데이터입니다.
// (현재 백엔드에 납입 이력을 저장하는 테이블 자체가 없다 — docs/app-backend-integration.md 참고)
const paymentHistory = [
  ["2026년 7월", "45,000원"],
  ["2026년 6월", "45,000원"],
  ["2026년 5월", "48,000원"],
  ["2026년 4월", "48,000원"],
  ["2026년 3월", "46,500원"],
  ["2026년 2월", "44,000원"],
  ["2025년 12월", "44,000원"],
  ["2025년 11월", "44,000원"],
  ["2025년 10월", "42,500원"],
  ["2025년 9월", "42,500원"],
  ["2025년 8월", "40,000원"],
];
const paymentYearOf = (label: string) => parseInt(label.slice(0, 4), 10);

type CardForm = {
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
  onNavigate,
  onNotification,
  hasUnread,
  canvasTone,
  onChangeCanvasTone,
}: {
  detail: string;
  close: () => void;
  onNavigate: (detail: string) => void;
  onNotification: () => void;
  hasUnread: boolean;
  canvasTone: CanvasTone;
  onChangeCanvasTone: (tone: CanvasTone) => void;
}) {
  const [notificationSettings, setNotificationSettings] = useState([true, true, true, false]);
  const [gradeSort, setGradeSort] = useState<"recent" | "past">("recent");
  const [expandedGrades, setExpandedGrades] = useState<string[]>([]);
  const [visiblePaymentCount, setVisiblePaymentCount] = useState(6);
  const paymentYears = useMemo(
    () => Array.from(new Set(paymentHistory.map(([month]) => paymentYearOf(month)))).sort((a, b) => b - a),
    [],
  );
  const [selectedPaymentYear, setSelectedPaymentYear] = useState(paymentYears[0]);
  const paymentHistoryForYear = useMemo(
    () => paymentHistory.filter(([month]) => paymentYearOf(month) === selectedPaymentYear),
    [selectedPaymentYear],
  );
  const [paymentMethodView, setPaymentMethodView] = useState<"list" | "add">("list");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("checkout");
  const [approvedAt, setApprovedAt] = useState<Date | null>(null);
  const [paymentScenario, setPaymentScenario] = useState<PaymentScenario>("success");
  const [methodSaveStatus, setMethodSaveStatus] = useState<MethodSaveStatus>("idle");
  const [methodRegistrationScenario, setMethodRegistrationScenario] = useState<"success" | "error">("success");
  const [pendingCard, setPendingCard] = useState<CardForm | null>(null);
  const [paymentMethods, setPaymentMethods] = useState([
    { id: paymentMethod.last4, name: `${paymentMethod.provider} (${paymentMethod.ownerType})`, lastFour: paymentMethod.last4, default: true },
  ]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(paymentMethod.last4);
  const [cardForm, setCardForm] = useState({ number: "", expiry: "", cvc: "", owner: "" });
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
      if (paymentScenario === "success") {
        setApprovedAt(new Date());
        setPaymentStatus("success");
      } else if (paymentScenario === "pending") setPaymentStatus("pending");
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
      const newMethod = { id: `${lastFour}-${paymentMethods.length}`, name: `${pendingCard.owner} 카드`, lastFour, default: false };
      setPaymentMethods((current) => [...current, newMethod]);
      setSelectedPaymentMethod(newMethod.id);
      setCardForm({ number: "", expiry: "", cvc: "", owner: "" });
      setPendingCard(null);
      setMethodSaveStatus("idle");
      setPaymentMethodView("list");
    }, 900);
    return () => window.clearTimeout(timer);
  }, [methodRegistrationScenario, methodSaveStatus, paymentMethods.length, pendingCard]);

  const { profile, scores } = useSession();
  const detailMonthly = profile.data?.pricing?.monthly_premium ?? 45000;
  const detailMonthlyText = `${detailMonthly.toLocaleString("ko-KR")}원`;

  // 모의고사 히스토리 — DB 성적(회차 종합 + 과목별)이 있으면 그걸 쓰고, 없으면 목데이터.
  // 과목별 등급 색상은 같은 과목의 직전 회차 등급과 비교해 계산한다(상승 초록·하락 빨강·유지 회색).
  const historyEntries = useMemo(() => {
    const scoreMap = scores.data?.scores;
    const analysis = profile.data?.analysis;

    let ascending: Array<{ row: string[]; subjects: SubjectGradeCell[] }> | null = null;
    if (scoreMap && analysis) {
      const entries: Array<{ row: string[]; subjects: SubjectGradeCell[] }> = [];
      let prev: number | null = null;
      for (const round of analysis.round_order) {
        const composite = analysis.rounds[round];
        if (typeof composite !== "number") continue;
        const percentile = Math.round(composite);
        const change =
          prev === null ? "–" : percentile > prev ? `▲${percentile - prev}` : percentile < prev ? `▼${prev - percentile}` : "–";
        prev = percentile;
        const subjects: SubjectGradeCell[] = Object.entries(scoreMap).map(([name, rows]) => {
          const row = rows.find((x) => x.label === round);
          if (!row || row.percentile === null) return { name, scoreText: "—", gradeNum: null };
          return {
            name,
            scoreText: `${Math.round(row.percentile)}점`,
            gradeNum: row.grade !== null ? Math.round(row.grade) : null,
          };
        });
        entries.push({ row: [round.replace("_", " "), round, String(percentile), change], subjects });
      }
      if (entries.length) ascending = entries; // 과거 → 최근 순
    }
    if (!ascending) {
      // 목데이터는 최근 → 과거 순으로 적혀 있으므로 과거 → 최근으로 뒤집는다
      ascending = gradeHistory.map((row, index) => ({ row, subjects: gradeSubjectHistory[index] })).reverse();
    }

    const prevGrade: Record<string, number | null> = {};
    return ascending.map(({ row, subjects }) => ({
      row,
      subjects: subjects.map(({ name, scoreText, gradeNum }) => {
        const tone = subjectGradeTone(gradeNum, prevGrade[name] ?? null);
        prevGrade[name] = gradeNum;
        return [name, scoreText, gradeNum !== null ? `${gradeNum}등급` : "", tone];
      }),
    }));
  }, [scores.data, profile.data]);

  const orderedGradeHistory = gradeSort === "recent" ? [...historyEntries].reverse() : historyEntries;
  const allGradesExpanded = expandedGrades.length === historyEntries.length;

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

        {detail === "성적 연동 상태" && (
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
              <div className="grade-sort-actions">
                <button
                  className="active"
                  onClick={() => setGradeSort((current) => current === "recent" ? "past" : "recent")}
                >
                  {gradeSort === "recent" ? "최근순" : "과거순"}
                </button>
                <button onClick={() => setExpandedGrades(allGradesExpanded ? [] : historyEntries.map((entry) => entry.row[1]))}>
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
                      <span><strong>{exam}</strong>{date.includes(".") && <small>{date}</small>}</span>
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
              <strong>{detailMonthlyText}</strong>
              <em>약관 별표4 기준 산정</em>
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
              <div className="year-filter">
                {paymentYears.map((year) => (
                  <button
                    key={year}
                    className={selectedPaymentYear === year ? "active" : ""}
                    onClick={() => {
                      setSelectedPaymentYear(year);
                      setVisiblePaymentCount(6);
                    }}
                  >
                    {year}년
                  </button>
                ))}
              </div>
              <div className="payment-table">
                <div className="table-head"><span>납입 연월</span><span>결제 금액</span><span>처리 상태</span></div>
                {paymentHistoryForYear.slice(0, visiblePaymentCount).map(([month, amount]) => (
                  <div key={month}><span>{month}</span><strong>{amount}</strong><em>완료</em></div>
                ))}
              </div>
              {paymentHistoryForYear.length > visiblePaymentCount && (
                <button
                  className="payment-more"
                  onClick={() => setVisiblePaymentCount((current) => Math.min(current + 6, paymentHistoryForYear.length))}
                >
                  더보기 ({paymentHistoryForYear.length - visiblePaymentCount}건)
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
              <strong>{detailMonthlyText}</strong>
            </section>
            <section className="my-checkout-methods">
              <div className="my-section-heading">
                <h2>결제 수단</h2>
                <button
                  onClick={() => {
                    setPaymentMethodView("add");
                    onNavigate("결제 수단 관리");
                  }}
                >
                  결제수단 추가
                </button>
              </div>
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
              disabled={!selectedPaymentMethod}
              onClick={() => setPaymentStatus("processing")}
            >
              {detailMonthlyText} 결제하기
            </button>
          </>
        )}

        {detail === "보험료 결제" && !paymentDataLoading && paymentStatus === "processing" && (
          <section className="payment-processing-view" role="status" aria-live="polite">
            <span><LoaderCircle className="spinner dark" size={43} /></span>
            <h1>보험료를 결제하고 있어요</h1>
            <p>카드사 승인 중이니 화면을 닫지 마세요.</p>
            <div><LockKeyhole size={14} /> 안전하게 암호화해 처리 중이에요</div>
          </section>
        )}

        {detail === "보험료 결제" && !paymentDataLoading && paymentStatus === "success" && (
          <section className="payment-complete-view">
            <span className="payment-complete-icon"><CircleCheck size={38} /></span>
            <h1>보험료 결제가 완료됐어요</h1>
            <p>2026년 8월 보험료 {detailMonthlyText}이 정상적으로 납부됐습니다.</p>
            <div>
              <span>결제 수단<strong>{paymentMethods.find((method) => method.id === selectedPaymentMethod)?.name}</strong></span>
              <span>
                승인 일시
                <strong>
                  {approvedAt
                    ? `${formatDotDate(approvedAt)} ${String(approvedAt.getHours()).padStart(2, "0")}:${String(approvedAt.getMinutes()).padStart(2, "0")}`
                    : "-"}
                </strong>
              </span>
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
            <p className="my-detail-desc">회사가 실제로 발행한 교육보험 보통약관 전문이에요. 스크롤해서 확인하거나 새 창에서 크게 볼 수 있어요.</p>
            <div className="policy-frame-wrap">
              <iframe
                className="policy-frame"
                src={POLICY_DOC}
                title="재수없수 교육보험 보통약관"
                loading="lazy"
              />
            </div>
            <a className="white-button policy-frame-open" href={POLICY_DOC} target="_blank" rel="noreferrer">
              새 창에서 전체 보기
            </a>
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
  const { profile, scores, studentId } = useSession();
  const student = profile.data?.student ?? null;
  const pricing = profile.data?.pricing ?? null;
  const myName = student?.name ?? studentProfile.name;
  const myGrade = (student?.grade_year as string | undefined) ?? studentProfile.grade;
  const myTier = pricing?.tier ?? policyInfo.tier;
  const myCoverManwon = pricing ? Math.round(pricing.cover_severe / 10_000) : policyInfo.coverageCapManwon;
  const enrollment = (student?.enrollment ?? null) as { created_at?: string } | null;
  const myJoined = enrollment?.created_at
    ? formatDotDate(new Date(enrollment.created_at))
    : formatDotDate(policyInfo.joinedDate);

  // 학생별 성적 연동 결과 — 실제 DB 성적 조회(scores) 상태를 그대로 반영한다
  const scoreSyncStatus: "업데이트 완료" | "연동 중" | "연동 실패" = !studentId
    ? "업데이트 완료"
    : scores.loading
      ? "연동 중"
      : scores.error
        ? "연동 실패"
        : "업데이트 완료";
  const scoreSyncTone =
    scoreSyncStatus === "연동 실패" ? "status-fail" : scoreSyncStatus === "연동 중" ? "status-progress" : "";

  if (detail) {
    return (
      <MyDetailPage
        detail={detail}
        close={() => setDetail(null)}
        onNavigate={setDetail}
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
          <h1>{myName} 학생 <em>{myGrade}</em></h1>
        </div>
        <section className="membership-card" aria-label="가입 정보">
          <div><small>가입 상품</small><strong>{myTier}</strong></div>
          <div><small>보장 상한</small><strong>{myCoverManwon.toLocaleString("ko-KR")}만원</strong></div>
          <div><small>가입일</small><strong>{myJoined}</strong></div>
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
                    <em className={item.label === "성적 연동 상태" ? scoreSyncTone : ""}>
                      {item.label === "성적 연동 상태" ? scoreSyncStatus : item.detail}
                    </em>
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
  const [cardLast4, setCardLast4] = useState(paymentMethod.last4);
  const [resultPreview, setResultPreview] = useState<ClaimResultVariant>("matched");
  const [eligibilityResult, setEligibilityResult] = useState<EligibilityResult>("none");
  const [appealFiled, setAppealFiled] = useState(false);
  const [captureContext, setCaptureContext] = useState<CaptureContext>("receipt");
  const [proofCaptured, setProofCaptured] = useState(false);
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
  const firstClaimed = phase === "between" || phase === "period2" || (phase === "period1" && submittedFirst);
  const secondClaimed = phase === "period2" && submittedSecond;

  useEffect(() => {
    if (screen !== "scanning") return;
    const timer = window.setTimeout(() => {
      if (captureContext !== "receipt") {
        setScreen("scanResult"); // 이의신청 증빙자료는 기존 단일 확인 흐름 그대로
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
    const rawUserId = student?.user_id;
    const userId =
      typeof rawUserId === "number" && Number.isInteger(rawUserId)
        ? rawUserId
        : Array.from(studentId).reduce((hash, character) => ((hash * 31 + character.charCodeAt(0)) >>> 0), 17) || 1;
    const selectedCard = premiumPaymentCards.find((card) => card.last4 === cardLast4);
    const cardId = await claimApi.ensureCard(
      {
        company: selectedCard?.provider ?? paymentMethod.provider,
        last4: cardLast4,
        holderName: String(student?.name ?? studentProfile.name),
        relationship: "학부모",
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

    setResultPreview(toVariant(lastResult?.status, lastResult?.verification?.final_result) ?? "review");
    setScreen("result");
  }

  useEffect(() => {
    if (screen !== "submitting") return;
    const timer = window.setTimeout(() => {
      const isFirstRound = phase === "preExam" || phase === "postExam" || phase === "period1";
      if (isFirstRound) setSubmittedFirst(true);
      else setSubmittedSecond(true);
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
    result: "영수증 업로드",
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
            <span className="v">{isFirstRound ? "CLM-2026-0006213" : "CLM-2026-0012487"}</span>
          </div>
          <div className="claim-kv-row">
            <span className="k">접수일</span>
            <span className="v">{isFirstRound ? "2026.07.14" : "2026.12.04"}</span>
          </div>
          <div className="claim-kv-row">
            <span className="k">지급 예정액</span>
            <span className="v positive">{isFirstRound ? 만원표기(account.firstPaidManwon) : 만원표기(account.secondPaidManwon)}</span>
          </div>
          <div className="claim-kv-row">
            <span className="k">예상 지급일</span>
            <span className="v">{isFirstRound ? "2026.07.21" : "2026.12.11"}</span>
          </div>
        </section>
        <div className="claim-note claim-done-note">
          {isFirstRound ? "2차 청구는 1차로부터 6개월 뒤에 열려요." : "2차 지급이 끝나면 보장이 종료돼요. 더 청구할 건은 없습니다."}
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
          eligibilityResult={eligibilityResult}
          onChangeEligibilityResult={setEligibilityResult}
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
          count={receipts.length}
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
          onRetake={() => setScreen("capture")}
          onConfirm={() => {
            // 이 화면은 이의신청 증빙자료 확인에서만 쓰인다 — 확인완료는 접수가 아니라
            // STEP 3(확인 및 접수) 재작성 화면으로 돌아간다
            setProofCaptured(true);
            setScreen("appeal");
          }}
        />
      )}
      {screen === "result" && (
        <ClaimResult
          variant={resultPreview}
          cardLast4={cardLast4}
          ocrResult={claimApi.ocrResult}
          reasons={claimApi.reasons}
          onSubmit={() => setScreen("submitting")}
          onRetryUpload={() => setScreen("step2")}
          onChangeCard={() => setScreen("cardChange")}
          onViewStatus={() => setScreen("status")}
        />
      )}
      {screen === "status" && (
        <ClaimStatus
          phase={phase}
          firstClaimed={firstClaimed}
          secondClaimed={secondClaimed}
          submittedReceipts={receipts}
          onStartClaim={() => setScreen("intro")}
        />
      )}
      {screen === "eligibilityDetail" && (
        <ClaimEligibilityDetail result={eligibilityResult} onAppeal={() => setScreen("appeal")} />
      )}
      {screen === "appeal" && (
        <ClaimAppeal
          onSubmit={() => {
            setAppealFiled(true);
            setScreen("appealDone");
          }}
          captured={proofCaptured}
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
      {screen === "appealStatus" && <ClaimAppealStatus />}
    </div>
  );
}

function ClaimHome({
  setScreen,
  phase,
  eligibilityResult,
  onChangeEligibilityResult,
  appealFiled,
  firstClaimed,
  secondClaimed,
}: {
  setScreen: (screen: ClaimScreen) => void;
  phase: ClaimPhase;
  eligibilityResult: EligibilityResult;
  onChangeEligibilityResult: (result: EligibilityResult) => void;
  appealFiled: boolean;
  firstClaimed: boolean;
  secondClaimed: boolean;
}) {
  const { account, phaseInfo, eligibility: eligibilityCopy } = useClaimInfo();
  const info = phaseInfo[phase];
  const eligibility = eligibilityCopy[eligibilityResult];
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
          <span className="eyebrow light">보장 판정 완료 · {eligibility.determinedAt}</span>
          <h2>{eligibility.title}</h2>
          <p>
            {eligibility.isEligible
              ? `1차 청구 기간은 ${eligibility.claimWindow}이에요. 보장 한도 ${eligibility.coverageLimit} 안에서 지급돼요.`
              : eligibility.desc}
          </p>
          {!eligibility.isEligible && (
            <div className="claim-eligibility-stats">
              <div>
                <span className="claim-eligibility-stats-label">하락폭</span>
                <strong>{eligibility.dropSigma}</strong>
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
      {showEligibilityCard && (
        <div className="claim-field">
          <label>판정 결과 미리보기 (테스트용)</label>
          <div className="claim-seg">
            {(["none", "mild", "severe"] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={eligibilityResult === option ? "on" : ""}
                onClick={() => onChangeEligibilityResult(option)}
              >
                {eligibilityCopy[option].tierLabel}
              </button>
            ))}
          </div>
        </div>
      )}
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

function ClaimEligibilityDetail({
  result,
  onAppeal,
}: {
  result: EligibilityResult;
  onAppeal: () => void;
}) {
  const { eligibility } = useClaimInfo();
  const info = eligibility[result];
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
  onCapture,
  reason,
  onChangeReason,
  detail,
  onChangeDetail,
}: {
  onSubmit: () => void;
  captured: boolean;
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
        {captured ? "STEP 3 / 3 · 확인 및 접수" : "STEP 1 / 3 · 이의 신청 작성"}
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
      {captured ? (
        <>
          <div className="claim-drop claim-drop-done">
            <CircleCheck size={24} />
            <strong>증빙자료 첨부 완료</strong>
            <small>성적표 · 성적증명서</small>
          </div>
          <button type="button" className="claim-drop-add" onClick={onCapture}>
            추가하기
          </button>
        </>
      ) : (
        <button type="button" className="claim-drop" onClick={onCapture}>
          <FileText size={24} />
          <strong>증빙 자료 올리기</strong>
          <small>성적표 · 성적증명서</small>
        </button>
      )}
      {captured && (
        <button
          className="primary-button button-flat-primary claim-appeal-submit"
          onClick={onSubmit}
          disabled={!detail.trim()}
        >
          이의 신청 접수하기
        </button>
      )}
    </main>
  );
}

function ClaimAppealStatus() {
  return (
    <main className="sub-page">
      <span className="eyebrow">이의 신청 진행 상황</span>
      <h1>검토가 진행 중이에요</h1>
      <section className="white-card status-timeline">
        {[
          { title: "접수 완료", text: "2026.12.05 오전 10:12", state: "active" as const },
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
  count,
  onAddMore,
  onDone,
}: {
  count: number;
  onAddMore: () => void;
  onDone: () => void;
}) {
  return (
    <main className="sub-page claim-quality-fail">
      <span className="claim-quality-fail-icon claim-quality-ok-icon">
        <CircleCheck size={26} />
      </span>
      <h1>영수증 {count}장 촬영됨</h1>
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
}: {
  context: CaptureContext;
  onRetake: () => void;
  onConfirm: () => void;
}) {
  return (
    <main className={`sub-page${context === "proof" ? " claim-step" : ""}`}>
      {context === "proof" ? (
        <div className="claim-steps">
          <i className="on" />
          <i className="on" />
          <i />
        </div>
      ) : (
        <span className="eyebrow">스캔 결과 확인</span>
      )}
      {context === "proof" && <span className="step-label">STEP 2 / 3 · 증빙 자료 확인</span>}
      <h1>이 사진으로 사용할까요?</h1>
      <div className="claim-scan-preview">
        <FileText size={32} />
        <span>서류 이미지 미리보기</span>
      </div>
      <div className="claim-btn-stack">
        <button className="primary-button button-flat-primary" onClick={onConfirm}>
          {context === "proof" ? "확인완료" : "이 사진 사용하기"}
        </button>
        <button className="secondary-button button-outline-secondary" onClick={onRetake}>
          다시 찍기
        </button>
      </div>
    </main>
  );
}

function ClaimIntro({ onStart, phase }: { onStart: () => void; phase: ClaimPhase }) {
  const { phaseInfo } = useClaimInfo();
  const info = phaseInfo[phase];
  return (
    <main className="sub-page">
      <span className="eyebrow">청구 안내</span>
      <h1>{info.introHeading}</h1>
      <p className="claim-intro-lead">가입 1개월 뒤 1차, 6개월 뒤 2차로 총 두 번 청구해요.</p>
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
          <span className="v">신한 ●●●● 4821</span>
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

function ClaimCardStep({
  cardLast4,
  onConfirm,
  onChangeCard,
}: {
  cardLast4: string;
  onConfirm: (last4: string) => void;
  onChangeCard: () => void;
}) {
  // 새로 등록해서 목록에 없는 카드라면(ClaimCardChange 직후) 맨 위에 얹어 보여준다
  const cards = useMemo(() => {
    if (premiumPaymentCards.some((c) => c.last4 === cardLast4)) return premiumPaymentCards;
    return [{ provider: "새로 등록한 카드", last4: cardLast4, owner: "김○○ (학부모)", status: "활성 · 사용 가능" }, ...premiumPaymentCards];
  }, [cardLast4]);
  const [selected, setSelected] = useState(cardLast4);

  return (
    <main className="sub-page claim-step">
      <div className="claim-steps">
        <i className="on" />
        <i />
        <i />
      </div>
      <span className="step-label">STEP 1 / 3 · 등록 카드 확인</span>
      <h1>이 카드로 결제한 게 맞나요?</h1>
      <p>보험료 납입에 사용한 카드를 먼저 불러왔어요.</p>
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
              onChange={() => setSelected(card.last4)}
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
      <div className="claim-btn-stack claim-btn-stack-cardstep">
        <button className="primary-button button-flat-primary" onClick={() => onConfirm(selected)}>
          선택한 카드로 계속하기
        </button>
        <button className="secondary-button button-outline-secondary" onClick={onChangeCard}>
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
  const [owner, setOwner] = useState("");
  const digits = number.replace(/\D/g, "");
  const complete = digits.length === 16 && owner.trim().length > 1;

  return (
    <main className="sub-page claim-step">
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
      <p className="claim-upload-hint">
        JPG · PNG · PDF / 장당 10MB 이하 · 글씨가 잘리지 않게 전체가 나오도록 찍어주세요
      </p>

      {receipts.length > 0 && (
        <section className="claim-receipt-list" aria-label="첨부한 영수증 목록">
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

function ClaimResult({
  variant,
  cardLast4,
  ocrResult,
  reasons,
  onSubmit,
  onRetryUpload,
  onChangeCard,
  onViewStatus,
}: {
  variant: ClaimResultVariant;
  cardLast4: string;
  ocrResult: ClaimOCRResult | null;
  reasons: string[];
  onSubmit: () => void;
  onRetryUpload: () => void;
  onChangeCard: () => void;
  onViewStatus: () => void;
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
        <button type="button" className="claim-drop">
          <FileText size={24} />
          <strong>카드사 이용내역 올리기</strong>
          <small>
            {paymentMethod.provider} 앱 › 이용내역 › 기간 조회 후 PDF 저장
            <br />
            12월 24일까지 제출해 주세요
          </small>
        </button>
        <div className="claim-btn-stack">
          <button className="primary-button claim-amber" onClick={onSubmit}>
            이용내역 제출하기
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
  submittedReceipts,
  onStartClaim,
}: {
  phase: ClaimPhase;
  firstClaimed: boolean;
  secondClaimed: boolean;
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
              <div className="label">1차 청구 · 2026.06.30</div>
              <div className="value">{만원표기(account.firstPaidManwon)}</div>
              <div className="sub">영수증 2건 · 정상 확인</div>
            </div>
            <span className="claim-tag ok">지급완료</span>
          </div>
        )}
        {secondClaimed && (
          <div className="claim-match-row">
            <div>
              <div className="label">2차 청구 · 2026.12.04</div>
              <div className="value">{만원표기(account.secondPaidManwon)}</div>
              <div className="sub">영수증 3건 · 정상 확인</div>
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
  const { setStudentId } = useSession();
  const [stage, setStage] = useState<Stage>("splash");
  const [tab, setTab] = useState<Tab>("home");
  const [homeScreen, setHomeScreen] = useState<HomeScreen>("main");
  const [chatQuestion, setChatQuestion] = useState("");
  const [canvasTone, setCanvasTone] = useState<CanvasTone>("cream-white");
  const [gradeScreen, setGradeScreen] = useState<GradeScreen>("intro");
  const [converterScreen, setConverterScreen] = useState<ConverterScreen>("intro");
  const [claimScreen, setClaimScreen] = useState<ClaimScreen | null>(null);
  const [notifications, setNotifications] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(true);
  const [claimPhase, setClaimPhase] = useState<ClaimPhase>("period2");

  const shellClass = useMemo(() => `app-shell stage-${stage}`, [stage]);

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
        {stage === "login" && (
          <Login
            onLogin={(studentId) => {
              setStudentId(studentId);
              setStage("loading");
            }}
          />
        )}
        {stage === "loading" && <Loading onDone={() => setStage("app")} />}
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
                  setStudentId(null);
                  setStage("login");
                  setTab("grades");
                  setGradeScreen("intro");
                  setClaimScreen(null);
                }}
                onNotification={openNotifications}
                hasUnread={hasUnreadNotifications}
                canvasTone={canvasTone}
                onChangeCanvasTone={setCanvasTone}
              />
            )}
            {!notifications && homeScreen !== "chat" && visibleClaimScreen !== "submitting" && visibleClaimScreen !== "done" && visibleClaimScreen !== "appealDone" && <BottomNav tab={tab} setTab={changeTab} />}
          </>
        )}
      </div>
    </div>
  );
}
