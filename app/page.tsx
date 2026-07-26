"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
  | "appealStatus"
  | "capture"
  | "scanning"
  | "scanResult";
type ClaimResultVariant = "matched" | "review" | "proof" | "rejected";
type EligibilityResult = "none" | "mild" | "severe";
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

const claimPhaseInfo: Record<
  ClaimPhase,
  {
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
  }
> = {
  preExam: {
    toggleLabel: "수능 전",
    homeHeadline: "수능 전이에요, 성적 관리에 집중해보세요",
    bannerTitle: "청구는 아직 준비 중이에요",
    bannerText: "수능 이후 1차 청구가 열려요. 그때 알림으로 알려드릴게요.",
    paidAmount: "0원",
    remainingAmount: `${policyInfo.coverageCapManwon.toLocaleString("ko-KR")}만원`,
    progress: 0,
    ctaLabel: "청구 준비 중",
    ctaEnabled: false,
    historySub: "청구 내역 없음",
    introHeading: "1차 청구, 아직 준비 중이에요",
    introTimeline: [
      { title: "수능", text: "성적 확정 · 보장 자격이 정해져요", state: "" },
      { title: "1차 청구", text: "수능 이후 접수 시작", state: "" },
      { title: "2차 청구", text: "1차로부터 6개월 후 접수", state: "" },
    ],
  },
  postExam: {
    toggleLabel: "수능 후",
    homeHeadline: "수능 종료 · 1차 청구 준비 중이에요",
    bannerTitle: "1차 청구 준비 중이에요",
    bannerText: "수능이 끝났어요. 1차 청구는 7월 1일부터 열려요.",
    paidAmount: "0원",
    remainingAmount: `${policyInfo.coverageCapManwon.toLocaleString("ko-KR")}만원`,
    progress: 0,
    ctaLabel: "아직 접수 기간이 아니에요",
    ctaEnabled: false,
    historySub: "청구 내역 없음",
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
    remainingAmount: `${policyInfo.coverageCapManwon.toLocaleString("ko-KR")}만원`,
    progress: 0,
    ctaLabel: "청구 시작하기",
    ctaEnabled: true,
    historySub: "청구 내역 없음",
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
    paidAmount: "364만원",
    remainingAmount: `${(policyInfo.coverageCapManwon - 364).toLocaleString("ko-KR")}만원`,
    progress: 26,
    ctaLabel: "아직 접수 기간이 아니에요",
    ctaEnabled: false,
    historySub: "1차 지급완료 · 364만원",
    introHeading: "2차 청구, 곧 열려요",
    introTimeline: [
      { title: "1차 청구 · 지급완료", text: "2026.06.30 접수 · 364만원 · 영수증 대조 결과 정상", state: "active" },
      { title: "2차 청구 · 접수 예정", text: "2026.12.01 ~ 12.31 · 6개월치 학원비 영수증 필요", state: "" },
      { title: "보장 종료", text: "2차 지급 후 계약이 끝나요", state: "" },
    ],
  },
  period2: {
    toggleLabel: "2차 청구 기간",
    homeHeadline: "수능이 끝났어요, 지금 청구를 시작해보세요",
    bannerTitle: "2차 청구가 열렸어요",
    bannerText: "12월 31일까지 접수할 수 있어요. 영수증만 올리면 자동으로 검증돼요.",
    paidAmount: "364만원",
    remainingAmount: `${(policyInfo.coverageCapManwon - 364).toLocaleString("ko-KR")}만원`,
    progress: 26,
    ctaLabel: "청구 시작하기",
    ctaEnabled: true,
    historySub: "1차 지급완료 · 364만원",
    introHeading: "2차 청구, 두 단계면 끝나요",
    introTimeline: [
      { title: "1차 청구 · 지급완료", text: "2026.06.30 접수 · 364만원 · 영수증 대조 결과 정상", state: "active" },
      { title: "2차 청구 · 접수 가능", text: "2026.12.01 ~ 12.31 · 6개월치 학원비 영수증 필요", state: "current" },
      { title: "보장 종료", text: "2차 지급 후 계약이 끝나요", state: "" },
    ],
  },
};

const eligibilityInfo: Record<
  EligibilityResult,
  {
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
  }
> = {
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
    coverageLimit: `${Math.round(policyInfo.coverageCapManwon / 2).toLocaleString("ko-KR")}만원`,
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
    coverageLimit: `${policyInfo.coverageCapManwon.toLocaleString("ko-KR")}만원`,
    claimWindow: "7월 1일 ~ 7월 31일",
  },
};

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

function Login({ onLogin }: { onLogin: () => void }) {
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
          onLogin();
        }}
      >
        <label>
          <span>아이디</span>
          <input defaultValue="jaesoo2026" autoComplete="username" />
        </label>
        <label>
          <span>비밀번호</span>
          <input type="password" defaultValue="12345678" autoComplete="current-password" />
        </label>
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
  return (
    <button className="claim-phase-toggle" type="button" onClick={onCycle} aria-label="청구 진행 단계 미리보기 전환">
      <Clock3 size={17} aria-hidden="true" />
      <span>{claimPhaseInfo[phase].toggleLabel}</span>
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
          <span className="avatar" aria-hidden="true">
            {studentProfile.name.charAt(0)}
          </span>
          <button className="icon-button" onClick={onNotification} aria-label="알림 열기">
            <Bell size={20} />
            {hasUnread && <span className="notification-dot" />}
          </button>
        </div>
        <p className="home-greeting">안녕하세요, {studentProfile.name} 학생 학부모님!</p>
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
              <strong>{claimPhaseInfo[claimPhase].homeHeadline}</strong>
            </span>
          </button>
        ) : (
          <div className="metric-grid">
            <article className="metric-card premium-card">
              <span className="metric-icon mint">
                <WalletCards size={20} />
              </span>
              <span>현재 월 보험료</span>
              <strong>{premiumPlan.monthlyAmount.toLocaleString("ko-KR")}원</strong>
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
  return (
    <div className="screen page-with-nav">
      <TopBar back={back} backLabel="홈" />
      <main className="sub-page">
        <span className="eyebrow">우리 아이 보험</span>
        <h1>{isHistory ? "가입 내역" : "월 보험료 상세"}</h1>
        {!isHistory ? (
          <>
            <section className="hero-number-card">
              <span>2026년 7월 예상 보험료</span>
              <strong>42,000원</strong>
              <p>지난달보다 1,800원 줄었어요</p>
            </section>
            <section className="white-card">
              <h2>보험료 구성</h2>
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
              <div className="fee-total">
                <span>최종 월 보험료</span>
                <strong>42,000원</strong>
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
              <p>가입일 {formatDotDate(policyInfo.joinedDate)} · {policyInfo.tier}</p>
              <div className="policy-values">
                <span>
                  <small>보장 한도</small>
                  <strong>{policyInfo.coverageCapManwon.toLocaleString("ko-KR")}만원</strong>
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
  type ChatMessage = { who: "ai" | "me"; text: string; target?: string; status?: "loading" | "typing" | "complete" };
  const welcomeMessageTail = "재수예요.\n\n약관과 보험료 산정 근거를 실제 약관 문서에 근거해 설명해드릴게요. 아래 추천 질문을 누르거나, 궁금한 점을 직접 입력해 물어보세요.";
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialQuestion
      ? [
          { who: "me", text: initialQuestion },
          { who: "ai", text: "", target: "좋은 질문이에요. 현재 가입 정보와 성적 흐름을 바탕으로 이해하기 쉽게 설명해드릴게요.", status: "loading" },
        ]
      : [],
  );
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recommendedQuestions = [
    "보험금은 언제, 어떻게 받나요?",
    "보험료는 어떤 기준으로 산정되나요?",
    "청약철회는 어떻게 하나요?",
    "보장에서 제외되는 경우는 뭔가요?",
  ];

  useEffect(() => {
    const loadingIndex = messages.findIndex((message) => message.who === "ai" && message.status === "loading");
    if (loadingIndex === -1) return;

    const timer = window.setTimeout(() => {
      setMessages((current) => current.map((message, index) => index === loadingIndex ? { ...message, status: "typing" } : message));
    }, 1450);
    return () => window.clearTimeout(timer);
  }, [messages]);

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
        const nextText = message.target.slice(0, message.text.length + 1);
        return { ...message, text: nextText, status: nextText.length === message.target.length ? "complete" : "typing" };
      }));
    }, 34);
    return () => window.clearTimeout(timer);
  }, [messages]);

  const answerFor = (question: string) => {
    if (question.includes("보험금")) return "보험금은 보장 요건을 충족한 뒤 청구가 열리면 신청할 수 있어요. 제출 서류와 심사 결과를 확인한 후 등록한 계좌로 지급됩니다.";
    if (question.includes("청약철회")) return "청약철회는 가입 후 정해진 기간 안에 신청할 수 있어요. 마이 탭의 약관 및 정책에서 기준과 절차를 확인할 수 있습니다.";
    if (question.includes("제외")) return "성적표 위조·변조, 허위 제출처럼 약관에서 정한 면책 사유에 해당하면 보장에서 제외될 수 있어요.";
    return "좋은 질문이에요. 현재 가입 정보와 성적 흐름을 바탕으로 이해하기 쉽게 설명해드릴게요.";
  };

  const sendQuestion = (question: string) => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;
    setMessages((current) => [
      ...current,
      { who: "me", text: trimmedQuestion },
      { who: "ai", text: "", target: answerFor(trimmedQuestion), status: "loading" },
    ]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "56px";
  };

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
              <div className={`message ${message.who} ${message.status === "typing" ? "typing" : ""} ${message.who === "ai" ? "answer-enter" : ""}`}>
                {message.text || " "}
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

function PercentileChart() {
  const { values, labels } = percentileTrend;
  const width = 360;
  const height = 218;
  const left = 30;
  const right = 15;
  const top = 18;
  const bottom = 30;
  const yMin = 30;
  const yMax = 80;

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
  const [, thresholdY] = point(percentileDropThreshold, 0);
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
        {[30, 40, 50, 60, 70, 80].map((value) => {
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
          보장 기준선 {percentileDropThreshold}점
        </text>
        <text x={width - right} y={point(values[values.length - 1], values.length - 1)[1] - 11} textAnchor="end" className="score-end-label">
          {latestPercentile}
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

function Chart({ selected }: { selected: "전체" | Subject }) {
  const width = 360;
  const height = 224;
  const left = 30;
  const right = 10;
  const top = 16;
  const bottom = 28;
  const yMin = 45;
  const yMax = 80;
  const visible = selected === "전체" ? (Object.keys(subjects) as Subject[]) : [selected];

  const point = (value: number, index: number) => {
    const x = left + (index / (examLabels.length - 1)) * (width - left - right);
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

  const areaPath = selected === "전체" ? "" : `${pathFor(subjects[selected].values)} L ${width - right} ${height - bottom} L ${left} ${height - bottom} Z`;
  const markerRadius = selected === "전체" ? 2.1 : 3.4;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${selected} 성적 추이 그래프`}>
        <defs>
          <linearGradient id="scoreArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={selected === "전체" ? "#0CB474" : subjects[selected].color} stopOpacity=".25" />
            <stop offset="100%" stopColor={selected === "전체" ? "#0CB474" : subjects[selected].color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[50, 60, 70, 80].map((value) => {
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
            <path d={pathFor(subjects[subject].values)} fill="none" stroke={subjects[subject].color} strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
            {subjects[subject].values.map((value, index) => {
              const [x, y] = point(value, index);
              return (
                <circle key={`${subject}-${index}`} cx={x} cy={y} r={markerRadius} fill="#fff" stroke={subjects[subject].color} strokeWidth={selected === "전체" ? "1.7" : "2.3"} />
              );
            })}
          </g>
        ))}
        {examLabels.map((label, index) => {
          const [x] = point(subjects.국어.values[index], index);
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
  const [selected, setSelected] = useState<"전체" | Subject>("전체");
  const [expandedTrend, setExpandedTrend] = useState(false);
  const trendMoreRef = useRef<HTMLDivElement>(null);

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
                      백분위 <b>{latestPercentile}</b>
                      <small>예상 범위 {percentileRangeLow}~{percentileRangeHigh}</small>
                    </h2>
                  </div>
                  <p>
                    그동안의 모의고사 성적 추이를 바탕으로 예상한 백분위 입니다.
                  </p>
                </div>
                <PercentileChart />
              </section>
              <section className="score-explainer">
                <b>빨간 선({percentileDropThreshold}점)은</b> 평소보다 15점 이상 떨어진 &apos;불운&apos;을 판단하는 기준선입니다.
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
                      <strong>평균 {averageGrade.toFixed(2)}등급</strong>
                    </div>
                    <p className="subject-trend-note">
                      백분위는 높을수록 좋아요 · 판정 대상 국어·수학·영어·탐구
                    </p>
                    <div className="subject-filters" aria-label="그래프 과목 필터">
                      {(["전체", ...Object.keys(subjects)] as ("전체" | Subject)[]).map((subject) => (
                        <button
                          key={subject}
                          className={selected === subject ? "active" : ""}
                          onClick={() => setSelected(subject)}
                        >
                          {subject !== "전체" && (
                            <i className="subject-filter-dot" style={{ background: subjects[subject].color }} />
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
  const rows: [string, number, string][] = [
    ["국어", 56, "#F5604E"],
    ["수학", 52, "#13BCAD"],
    ["영어", 48, "#3B5998"],
    ["탐구", 65, "#FFC83B"],
  ];
  const stabilityScore = 55;
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
                        <p>{priorityCopy[name]}</p>
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

  const monthlyCostWon = academyCostTable[converterChoices.academy] * (regionMultiplier[converterChoices.region] ?? 1);
  const baseTenMonthWon = monthlyCostWon * 10;
  const monthlyCostManwon = Math.round(monthlyCostWon / 10000);
  const comparisonAmount = Math.round(baseTenMonthWon / 10000);

  const coveredAmount = Math.min(policyInfo.coverageCapManwon, comparisonAmount);
  const finalAmount = Math.max(comparisonAmount - coveredAmount, 0);
  const coveragePercent = comparisonAmount > 0 ? Math.round((coveredAmount / comparisonAmount) * 100) : 0;
  const formattedComparison = comparisonAmount.toLocaleString("ko-KR");
  const savingsMonths = (comparisonAmount / 191).toFixed(1);
  const tuitionTerms = (comparisonAmount / 347).toFixed(1);
  const retirementPercent = ((comparisonAmount / 38200) * 100).toFixed(1);
  const incomeMonths = (comparisonAmount / 636).toFixed(1);

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
                <code>{formattedComparison}만원 ÷ 월 191만원</code>
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
                  <code>{formattedComparison}만원 ÷ 학기당 347만원</code>
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
                  <code>{formattedComparison}만원 ÷ 목표 38,200만원</code>
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
                <code>{formattedComparison}만원 ÷ 월 636만원</code>
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
              options={["독학재수(독서실·인강)", "단과 통학", "재수종합학원", "기숙학원"]}
              selected={converterChoices.academy}
              onChange={(value) => updateConverterChoice("academy", value)}
              columns={2}
            />
            <RegionChoice
              selected={converterChoices.region}
              onChange={(value) => updateConverterChoice("region", value)}
            />
            <section className="converter-cost-summary">
              <div>
                <span>월 평균 비용</span>
                <strong>{monthlyCostManwon.toLocaleString("ko-KR")}만원</strong>
              </div>
              <p>{academyDescription[converterChoices.academy]}</p>
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
}: {
  selected: string;
  onChange: (value: string) => void;
}) {
  const regions = [
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
            <p>카드사 승인을 기다리고 있어요. 중복 결제를 막기 위해 화면을 닫지 말아 주세요.</p>
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
              <h2>제1조 (목적)</h2>
              <p>이 약관은 회사가 제공하는 ‘재수없수 스탠다드 보험상품(이하 ‘이 계약’)’의 체결과 이행에 관한 회사와 계약자, 피보험자 간의 권리와 의무를 정함을 목적으로 합니다.</p>
              <h2>제2조 (보장 내용)</h2>
              <p>피보험자가 대학수학능력시험 응시 결과 평소 예상 범위보다 15점 이상 하락하고, 이로 인해 재수를 하게 되는 경우 회사는 연간 재수 비용의 최대 70%, 최대 1,500만원 한도 내에서 보험금을 지급합니다.</p>
              <h2>제3조 (보험료의 산정)</h2>
              <p>월 보험료는 가입 시점의 성적 데이터, 성적 변동성, 재수 가능성 등을 종합적으로 반영하여 산정되며 매월 갱신 시 최근 확정 성적을 기준으로 재산정됩니다.</p>
              <h2>제4조 (면책 사항)</h2>
              <p>성적표의 위조·변조 또는 허위 제출이 확인되는 경우, 회사는 보험금을 지급하지 않으며 이미 지급된 보험금을 회수할 수 있습니다.</p>
              <small>본 내용은 임시 예시이며, 실제 약관은 상품 설명서 및 계약서를 따릅니다.</small>
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
  const [cardLast4, setCardLast4] = useState(paymentMethod.last4);
  const [resultPreview, setResultPreview] = useState<ClaimResultVariant>("matched");
  const [eligibilityResult, setEligibilityResult] = useState<EligibilityResult>("none");
  const [appealFiled, setAppealFiled] = useState(false);
  const [captureContext, setCaptureContext] = useState<CaptureContext>("receipt");
  const [receiptCaptured, setReceiptCaptured] = useState(false);
  const [proofCaptured, setProofCaptured] = useState(false);

  useEffect(() => {
    if (screen !== "verifying") return;
    const timer = window.setTimeout(() => setScreen("result"), 1600);
    return () => window.clearTimeout(timer);
  }, [screen, setScreen]);

  useEffect(() => {
    if (screen !== "scanning") return;
    const timer = window.setTimeout(() => setScreen("scanResult"), 1200);
    return () => window.clearTimeout(timer);
  }, [screen, setScreen]);

  useEffect(() => {
    if (screen !== "submitting") return;
    const timer = window.setTimeout(() => setScreen("done"), 1400);
    return () => window.clearTimeout(timer);
  }, [screen, setScreen]);

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
    appealStatus: "home",
    capture: null,
    scanning: null,
    scanResult: null,
  };

  const backLabel: Partial<Record<ClaimScreen, string>> = {
    home: "홈",
    intro: "홈",
    step1: "청구 안내",
    cardChange: "카드 확인",
    step2: "카드 확인",
    result: "영수증 업로드",
    status: "홈",
    eligibilityDetail: "홈",
    appeal: "보장 자격 상세",
    appealStatus: "홈",
  };

  const captureOrigin: ClaimScreen = captureContext === "proof" ? "appeal" : "step2";

  if (screen === "verifying") {
    return <ClaimVerifying />;
  }

  if (screen === "scanning") {
    return (
      <div className="screen page-with-nav claim-verifying">
        <div className="claim-spinner" />
        <h1>서류를 스캔하고 있어요</h1>
        <p>
          글씨가 잘 보이는지 확인하고 있어요.
          <br />
          잠시만 기다려주세요.
        </p>
      </div>
    );
  }

  if (screen === "submitting") {
    return (
      <div className="screen claim-loading">
        <Mascot size="lg" />
        <LoaderCircle className="spinner" size={42} />
        <h1>청구 내용을 안전하게 제출하고 있어요</h1>
        <p>잠시만 기다려주세요. 창을 닫지 않아도 괜찮아요.</p>
      </div>
    );
  }

  if (screen === "done") {
    const isFirstRound = phase === "preExam" || phase === "postExam" || phase === "period1";
    return (
      <div className="screen claim-done">
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
            <span className="v positive">{isFirstRound ? "364만원" : `${(policyInfo.coverageCapManwon - 364).toLocaleString("ko-KR")}만원`}</span>
          </div>
          <div className="claim-kv-row">
            <span className="k">예상 지급일</span>
            <span className="v">{isFirstRound ? "2026.07.21" : "2026.12.11"}</span>
          </div>
        </section>
        <div className="claim-note claim-done-note">
          {isFirstRound ? "2차 청구는 1차로부터 6개월 뒤에 열려요." : "2차 지급이 끝나면 보장이 종료돼요. 더 청구할 건은 없습니다."}
        </div>
        <button className="white-button" onClick={() => setScreen("status")}>
          진행 상황 보기
        </button>
        <button className="ghost-button" onClick={close}>
          홈으로
        </button>
      </div>
    );
  }

  const previous =
    screen === "capture" ? captureOrigin : screen === "scanResult" ? "capture" : backMap[screen];
  const label =
    screen === "capture"
      ? captureContext === "proof"
        ? "이의 신청"
        : "영수증 업로드"
      : screen === "scanResult"
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
        />
      )}
      {screen === "intro" && <ClaimIntro onStart={() => setScreen("step1")} phase={phase} />}
      {screen === "step1" && (
        <ClaimCardStep cardLast4={cardLast4} onConfirm={() => setScreen("step2")} onChangeCard={() => setScreen("cardChange")} />
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
          onUpload={() => setScreen("verifying")}
          previewResult={resultPreview}
          onChangePreviewResult={setResultPreview}
          captured={receiptCaptured}
          onCapture={() => {
            setCaptureContext("receipt");
            setScreen("capture");
          }}
        />
      )}
      {screen === "capture" && (
        <ClaimCapture
          onCapture={() => setScreen("scanning")}
        />
      )}
      {screen === "scanResult" && (
        <ClaimScanResult
          onRetake={() => setScreen("capture")}
          onConfirm={() => {
            if (captureContext === "proof") {
              setProofCaptured(true);
              setScreen("appeal");
            } else {
              setReceiptCaptured(true);
              setScreen("step2");
            }
          }}
        />
      )}
      {screen === "result" && (
        <ClaimResult
          variant={resultPreview}
          cardLast4={cardLast4}
          onSubmit={() => setScreen("submitting")}
          onRetryUpload={() => setScreen("step2")}
          onChangeCard={() => setScreen("cardChange")}
          onViewStatus={() => setScreen("status")}
        />
      )}
      {screen === "status" && <ClaimStatus />}
      {screen === "eligibilityDetail" && (
        <ClaimEligibilityDetail result={eligibilityResult} onAppeal={() => setScreen("appeal")} />
      )}
      {screen === "appeal" && (
        <ClaimAppeal
          onSubmit={() => {
            setAppealFiled(true);
            setScreen("home");
          }}
          captured={proofCaptured}
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
}: {
  setScreen: (screen: ClaimScreen) => void;
  phase: ClaimPhase;
  eligibilityResult: EligibilityResult;
  onChangeEligibilityResult: (result: EligibilityResult) => void;
  appealFiled: boolean;
}) {
  const info = claimPhaseInfo[phase];
  const eligibility = eligibilityInfo[eligibilityResult];
  const showEligibilityCard = phase === "postExam";
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
                <span>예상 성적 대비 하락폭</span>
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
                {eligibilityInfo[option].tierLabel}
              </button>
            ))}
          </div>
        </div>
      )}
      {!showEligibilityCard && (
        <section className="claim-open-card">
          <span className="eyebrow light">보장 자격 확정 · 중증 · 한도 {policyInfo.coverageCapManwon.toLocaleString("ko-KR")}만원</span>
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
          <small>{info.historySub}</small>
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
  const info = eligibilityInfo[result];
  return (
    <main className="sub-page">
      <span className="eyebrow">보장 자격 상세</span>
      <h1>보장 자격 상세</h1>
      <div className="claim-note">
        판정은 예상 성적(밴드)과 실제 수능 성적의 차이를 표준편차 단위로 계산해 나옵니다.
      </div>
      <section className="white-card claim-kv-card">
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
          <span className={`v ${info.isEligible ? "positive" : ""}`}>{info.tierLabel}</span>
        </div>
      </section>
      <section className="white-card claim-kv-card">
        <h2>기준선</h2>
        <div className="claim-kv-row">
          <span className="k">경증</span>
          <span className="v">{info.mildThreshold}</span>
        </div>
        <div className="claim-kv-row">
          <span className="k">중증</span>
          <span className="v">{info.severeThreshold}</span>
        </div>
      </section>
      {!info.isEligible && (
        <button className="white-button" onClick={onAppeal}>
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
}: {
  onSubmit: () => void;
  captured: boolean;
  onCapture: () => void;
}) {
  const [reason, setReason] = useState<"성적 반영 오류" | "기타">("성적 반영 오류");
  const [detail, setDetail] = useState("");
  return (
    <main className="sub-page claim-step">
      <h1>이의 신청</h1>
      <div className="claim-note warn">
        성적 자료가 잘못 반영됐다고 판단되면 신청해 주세요. 접수 후 5영업일 안에 결과를 알려드려요.
      </div>
      <div className="claim-field">
        <label>이의 사유</label>
        <div className="claim-seg">
          {(["성적 반영 오류", "기타"] as const).map((option) => (
            <button key={option} type="button" className={reason === option ? "on" : ""} onClick={() => setReason(option)}>
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
          onChange={(event) => setDetail(event.target.value)}
          placeholder="어떤 부분이 잘못됐는지 적어주세요"
          rows={4}
        />
      </div>
      <button type="button" className="claim-drop" onClick={onCapture}>
        <FileText size={24} />
        <strong>{captured ? "증빙 자료 첨부됨 · 다시 올리기" : "증빙 자료 올리기"}</strong>
        <small>성적표 · 성적증명서</small>
      </button>
      <button className="primary-button" onClick={onSubmit} disabled={!detail.trim()}>
        이의 신청 접수하기
      </button>
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

function ClaimCapture({ onCapture }: { onCapture: () => void }) {
  return (
    <main className="claim-capture">
      <div className="claim-camera-frame">
        <div className="claim-camera-guide" />
        <p>서류 전체가 프레임 안에 들어오게 맞춰주세요</p>
      </div>
      <button type="button" className="claim-shutter" onClick={onCapture} aria-label="촬영하기">
        <Camera size={26} />
      </button>
    </main>
  );
}

function ClaimScanResult({ onRetake, onConfirm }: { onRetake: () => void; onConfirm: () => void }) {
  return (
    <main className="sub-page">
      <span className="eyebrow">스캔 결과 확인</span>
      <h1>이 사진으로 사용할까요?</h1>
      <div className="claim-scan-preview">
        <FileText size={32} />
        <span>서류 이미지 미리보기</span>
      </div>
      <div className="claim-note">글씨가 잘리지 않고 또렷하게 나왔는지 확인해주세요.</div>
      <div className="claim-btn-stack">
        <button className="primary-button" onClick={onConfirm}>
          이 사진 사용하기
        </button>
        <button className="secondary-button" onClick={onRetake}>
          다시 찍기
        </button>
      </div>
    </main>
  );
}

function ClaimIntro({ onStart, phase }: { onStart: () => void; phase: ClaimPhase }) {
  const info = claimPhaseInfo[phase];
  return (
    <main className="sub-page">
      <span className="eyebrow">청구 안내</span>
      <h1>{info.introHeading}</h1>
      <div className="claim-note">
        <b>청구는 두 번으로 끝나요.</b>
        <br />
        가입 1개월 뒤 1차, 그로부터 6개월 뒤 2차 학원비 영수증을 확인하면 보장이 마무리됩니다.
      </div>
      <section className="white-card">
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
          <span className="k">학원 카드 영수증</span>
          <span className="v">사진 또는 PDF</span>
        </div>
      </section>
      <button className="primary-button" onClick={onStart}>
        카드 확인하고 시작하기 <ArrowRight size={18} />
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
  onConfirm: () => void;
  onChangeCard: () => void;
}) {
  return (
    <main className="sub-page claim-step">
      <div className="claim-steps">
        <i className="on" />
        <i />
        <i />
      </div>
      <span className="step-label">STEP 1 / 3 · 등록 카드 확인</span>
      <h1>이 카드로 결제한 게 맞나요?</h1>
      <p>영수증의 카드 뒤 4자리가 아래 카드와 같아야 자동으로 통과돼요.</p>
      <section className="white-card claim-kv-card">
        <div className="claim-kv-row">
          <span className="k">카드사</span>
          <span className="v">{paymentMethod.provider}</span>
        </div>
        <div className="claim-kv-row">
          <span className="k">카드번호 뒤 4자리</span>
          <span className="v">●●●● {cardLast4}</span>
        </div>
        <div className="claim-kv-row">
          <span className="k">카드 명의자</span>
          <span className="v">김○○ (학부모)</span>
        </div>
        <div className="claim-kv-row">
          <span className="k">상태</span>
          <span className="v positive">활성 · 사용 가능</span>
        </div>
      </section>
      <div className="claim-note warn">카드를 재발급·분실했다면 먼저 변경해 주세요. 변경 전 영수증을 올리면 불일치로 반려됩니다.</div>
      <div className="claim-btn-stack">
        <button className="primary-button" onClick={onConfirm}>
          이 카드로 진행하기 <ArrowRight size={18} />
        </button>
        <button className="secondary-button" onClick={onChangeCard}>
          등록 카드 변경
        </button>
      </div>
    </main>
  );
}

function ClaimCardChange({ onSave }: { onSave: (last4: string) => void }) {
  const [reason, setReason] = useState<"만료" | "분실" | "재발급">("분실");
  const [last4, setLast4] = useState("");
  return (
    <main className="sub-page claim-step">
      <h1>등록 카드 변경</h1>
      <div className="claim-note">변경한 카드는 이번 청구부터 바로 대조 기준이 됩니다.</div>
      <div className="claim-field">
        <label>카드사</label>
        <div className="claim-input">
          {paymentMethod.provider} <ChevronDown size={15} />
        </div>
      </div>
      <div className="claim-field">
        <label>카드번호 뒤 4자리</label>
        <input
          className="claim-input"
          value={last4}
          onChange={(event) => setLast4(event.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="숫자 4자리"
          inputMode="numeric"
        />
      </div>
      <div className="claim-field">
        <label>카드 명의자</label>
        <div className="claim-input">김○○</div>
      </div>
      <div className="claim-field">
        <label>변경 사유</label>
        <div className="claim-seg">
          {(["만료", "분실", "재발급"] as const).map((option) => (
            <button key={option} type="button" className={reason === option ? "on" : ""} onClick={() => setReason(option)}>
              {option}
            </button>
          ))}
        </div>
      </div>
      <section className="white-card claim-kv-card claim-kv-muted">
        <div className="claim-kv-row">
          <span className="k">기존 카드</span>
          <span className="v muted-strike">{paymentMethod.provider} ●●●● {paymentMethod.last4}</span>
        </div>
        <div className="claim-kv-row">
          <span className="k">변경 후</span>
          <span className="v">{paymentMethod.provider} ●●●● {last4 || "○○○○"}</span>
        </div>
      </section>
      <button className="primary-button" onClick={() => onSave(last4 || paymentMethod.last4)} disabled={last4.length !== 4}>
        카드 변경 저장
      </button>
    </main>
  );
}

function ClaimUpload({
  onUpload,
  previewResult,
  onChangePreviewResult,
  captured,
  onCapture,
}: {
  onUpload: () => void;
  previewResult: ClaimResultVariant;
  onChangePreviewResult: (variant: ClaimResultVariant) => void;
  captured: boolean;
  onCapture: () => void;
}) {
  const previewLabels: Record<ClaimResultVariant, string> = {
    matched: "일치",
    review: "확인",
    proof: "서류",
    rejected: "불일치",
  };
  return (
    <main className="sub-page claim-step">
      <div className="claim-steps">
        <i className="on" />
        <i className="on" />
        <i />
      </div>
      <span className="step-label">STEP 2 / 3 · 영수증 업로드</span>
      <h1>학원 카드 영수증을 올려주세요</h1>
      <p>7~12월 결제분이 필요해요. 여러 장이면 모두 올려도 됩니다.</p>
      <button type="button" className="claim-drop" onClick={onCapture}>
        <Camera size={26} />
        <strong>{captured ? "촬영 완료 · 다시 찍기" : "사진 찍기 · 파일 선택"}</strong>
        <small>
          JPG · PNG · PDF / 장당 10MB 이하
          <br />
          글씨가 잘리지 않게 전체가 나오도록 찍어주세요
        </small>
      </button>
      <section className="white-card">
        <h2>영수증에서 읽는 항목</h2>
        <div className="claim-chips">
          {["카드 뒤 4자리", "카드사", "학원명", "사업자등록번호", "결제금액", "결제일", "승인번호", "결제수단"].map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
      </section>
      <div className="claim-field">
        <label>결과 미리보기 (테스트용)</label>
        <div className="claim-seg">
          {(["matched", "review", "proof", "rejected"] as const).map((variant) => (
            <button
              key={variant}
              type="button"
              className={previewResult === variant ? "on" : ""}
              onClick={() => onChangePreviewResult(variant)}
            >
              {previewLabels[variant]}
            </button>
          ))}
        </div>
      </div>
      <button className="primary-button" onClick={onUpload}>
        업로드하고 검증하기 <ArrowRight size={18} />
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
    <div className="screen page-with-nav claim-verifying">
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
    </div>
  );
}

function ClaimResult({
  variant,
  cardLast4,
  onSubmit,
  onRetryUpload,
  onChangeCard,
  onViewStatus,
}: {
  variant: ClaimResultVariant;
  cardLast4: string;
  onSubmit: () => void;
  onRetryUpload: () => void;
  onChangeCard: () => void;
  onViewStatus: () => void;
}) {
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
                등록 {cardLast4} · 영수증 {cardLast4}
              </div>
            </div>
            <span className="claim-tag ok">일치</span>
          </div>
          <div className="claim-match-row">
            <div>
              <div className="label">학원</div>
              <div className="value">○○기숙학원</div>
              <div className="sub">사업자 123-45-67890</div>
            </div>
            <span className="claim-tag ok">일치</span>
          </div>
          <div className="claim-match-row">
            <div>
              <div className="label">결제금액 · 승인번호</div>
              <div className="value">15,000,000원</div>
              <div className="sub">승인 12345678 · 형식 정상</div>
            </div>
            <span className="claim-tag ok">정상</span>
          </div>
        </section>
        <div className="claim-btn-stack">
          <button className="primary-button" onClick={onSubmit}>
            청구 접수하기
          </button>
          <button className="secondary-button" onClick={onRetryUpload}>
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
                등록 {cardLast4} · 영수증 {cardLast4}
              </div>
            </div>
            <span className="claim-tag ok">일치</span>
          </div>
          <div className="claim-match-row">
            <div>
              <div className="label">학원</div>
              <div className="value">○○기숙학원</div>
              <div className="sub">사업자 123-45-67890</div>
            </div>
            <span className="claim-tag ok">일치</span>
          </div>
          <div className="claim-match-row">
            <div>
              <div className="label">결제일</div>
              <div className="value">2026.06.28</div>
              <div className="sub">보장 기간 시작 이틀 전 결제</div>
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
              <div className="value">15,000,000원</div>
              <div className="sub">동일 승인번호가 2건 확인됨</div>
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
            <div className="value">7302</div>
            <div className="sub">등록 {cardLast4} · 영수증 7302</div>
          </div>
          <span className="claim-tag bad">불일치</span>
        </div>
        <div className="claim-match-row">
          <div>
            <div className="label">학원</div>
            <div className="value">○○기숙학원</div>
            <div className="sub">사업자 123-45-67890</div>
          </div>
          <span className="claim-tag ok">일치</span>
        </div>
      </section>
      <div className="claim-note bad">
        <b>1</b> 실제로 다른 카드로 결제했다면 등록 카드를 먼저 변경하세요.
        <br />
        <b>2</b> 다른 영수증을 잘못 올렸다면 해당 영수증만 다시 올리면 돼요.
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

function ClaimStatus() {
  return (
    <main className="sub-page">
      <span className="eyebrow">청구 진행 상황</span>
      <h1>내 청구 내역</h1>
      <section className="white-card">
        <h2>보장 한도 사용</h2>
        <div className="claim-limit-track">
          <span style={{ width: "100%" }} />
        </div>
        <div className="claim-limit-caption">
          <span>사용 {policyInfo.coverageCapManwon.toLocaleString("ko-KR")}만원</span>
          <span>한도 {policyInfo.coverageCapManwon.toLocaleString("ko-KR")}만원</span>
        </div>
      </section>
      <section className="white-card">
        <div className="claim-match-row">
          <div>
            <div className="label">1차 청구 · 2026.06.30</div>
            <div className="value">364만원</div>
            <div className="sub">영수증 2건 · 정상 확인</div>
          </div>
          <span className="claim-tag ok">지급완료</span>
        </div>
        <div className="claim-match-row">
          <div>
            <div className="label">2차 청구 · 2026.12.04</div>
            <div className="value">{(policyInfo.coverageCapManwon - 364).toLocaleString("ko-KR")}만원</div>
            <div className="sub">영수증 3건 · 정상 확인</div>
          </div>
          <span className="claim-tag warn">심사중</span>
        </div>
      </section>
      <button type="button" className="claim-lrow">
        <span>
          <strong>제출한 영수증 보기</strong>
          <small>총 5건</small>
        </span>
        <ChevronRight size={17} />
      </button>
      <button type="button" className="claim-lrow">
        <span>
          <strong>검증 결과 상세</strong>
          <small>차수별 대조 항목 확인</small>
        </span>
        <ChevronRight size={17} />
      </button>
      <div className="claim-note">2차까지 지급되면 청구 절차가 모두 끝나요.</div>
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
  const [stage, setStage] = useState<Stage>("app");
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
        {stage === "login" && <Login onLogin={() => setStage("loading")} />}
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
            {!notifications && homeScreen !== "chat" && visibleClaimScreen !== "submitting" && visibleClaimScreen !== "done" && <BottomNav tab={tab} setTab={changeTab} />}
          </>
        )}
      </div>
    </div>
  );
}
