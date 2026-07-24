"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Bell,
  BookOpenCheck,
  Calculator,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  CreditCard,
  FileChartColumn,
  FileText,
  GraduationCap,
  Home,
  Info,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MapPin,
  MessageCircle,
  RefreshCcw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
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
  | "eligibility"
  | "link"
  | "intro"
  | "step1"
  | "step2"
  | "step3"
  | "submitting"
  | "done"
  | "status";
type ConverterScreen = "intro" | "input" | "cost" | "loading" | "result";

const subjects = {
  국어: { color: "#F5604E", values: [55, 58, 61, 60, 64, 66, 70, 73] },
  수학: { color: "#13BCAD", values: [52, 57, 63, 60, 65, 69, 75, 68] },
  영어: { color: "#3B5998", values: [61, 59, 63, 66, 62, 65, 69, 74] },
  탐구: { color: "#FFC83B", values: [57, 60, 66, 62, 64, 67, 72, 65] },
};

type Subject = keyof typeof subjects;
const examLabels = ["9월", "11월", "2월", "6월", "9월", "11월", "3월", "수능"];

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={`brand-wordmark ${inverse ? "inverse" : ""}`} aria-label="재수없수">
      재수
      <br />
      없수
    </span>
  );
}

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
      <Brand inverse />
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
        <button className="text-button" type="button">
          <ChevronLeft size={15} />
          인강 홈으로
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
  back,
  backLabel,
}: {
  onNotification?: () => void;
  back?: () => void;
  backLabel?: string;
}) {
  return (
    <header className="top-bar">
      {back ? (
        <button className="back-button" onClick={back}>
          <ChevronLeft size={19} />
          {backLabel ?? "이전 화면"}
        </button>
      ) : (
        <Brand />
      )}
      {onNotification && (
        <button className="icon-button" onClick={onNotification} aria-label="알림 열기">
          <Bell size={21} />
          <span className="notification-dot" />
        </button>
      )}
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

function HomeMain({
  onNotification,
  go,
  goTab,
  openClaim,
}: {
  onNotification: () => void;
  go: (screen: HomeScreen) => void;
  goTab: (tab: Tab) => void;
  openClaim: () => void;
}) {
  return (
    <div className="screen page-with-nav">
      <section className="poster-home-hero">
        <img src="/og.png" alt="재수없수, 보험보다 보호자에 가까운 안심 케어" />
        <div className="poster-top-controls">
          <span className="poster-profile">
            <span className="avatar">김</span>
            <span>
              <strong>김지민 학부모님</strong>
              <small>오늘도 든든하게 챙겨드릴게요</small>
            </span>
          </span>
          <button className="icon-button" onClick={onNotification} aria-label="알림 열기">
            <Bell size={20} />
            <span className="notification-dot" />
          </button>
        </div>
      </section>

      <section className="home-command-card">
        <div className="command-heading">
          <span className="command-mascot">
            <Sparkles size={18} />
          </span>
          <span>
            <small>AI 도우미 노재수</small>
            <strong>무엇을 도와드릴까요?</strong>
          </span>
        </div>
        <button className="ask-box" onClick={() => go("chat")}>
          <span>보험료·보장·약관을 편하게 물어보세요</span>
          <Send size={19} />
        </button>
        <div className="poster-actions" aria-label="빠른 메뉴">
          <HeroAction
            icon={<Calculator size={18} />}
            label="비용 계산"
            onClick={() => goTab("converter")}
          />
          <HeroAction
            icon={<ShieldCheck size={18} />}
            label="보장 관리"
            onClick={openClaim}
          />
          <HeroAction
            icon={<BarChart3 size={18} />}
            label="입시 관리"
            onClick={() => goTab("grades")}
          />
        </div>
      </section>

      <section className="home-content">
        <div className="section-heading">
          <div>
            <span className="eyebrow">이번 달 우리 집</span>
            <h2>안심 리포트</h2>
          </div>
          <span className="updated">
            <RefreshCcw size={12} /> 오늘 업데이트
          </span>
        </div>

        <div className="metric-grid">
          <button className="metric-card premium-card" onClick={() => go("premium")}>
            <span className="metric-icon mint">
              <WalletCards size={20} />
            </span>
            <span>현재 월 보험료</span>
            <strong>42,000원</strong>
            <small>
              상세 보기 <ChevronRight size={13} />
            </small>
          </button>
          <button className="metric-card dday-card" onClick={openClaim}>
            <span className="metric-icon lime">
              <CalendarDays size={20} />
            </span>
            <span>1차 청구 마감까지</span>
            <strong>D-17</strong>
            <small>
              일정 보기 <ChevronRight size={13} />
            </small>
          </button>
        </div>

        <button className="insight-card" onClick={() => goTab("grades")}>
          <span className="insight-icon">
            <TrendingUp size={22} />
          </span>
          <span>
            <small>이번 달 성적 분석</small>
            <strong>수학이 6점 올랐어요</strong>
            <em>지금 흐름이면 백분위 70도 가능해요.</em>
          </span>
          <ArrowUpRight size={20} />
        </button>

        <button className="claim-banner" onClick={openClaim}>
          <div>
            <span className="eyebrow light">2026.11.19 평가 · 중증 · 한도 1,404만원</span>
            <h3>1차 청구가 열렸어요</h3>
            <p>6월 30일까지 제출할 수 있어요.</p>
          </div>
          <span className="round-arrow">
            <ArrowRight size={20} />
          </span>
        </button>
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
              <h2>재수종합학원 안심 플랜</h2>
              <p>가입일 2026.03.02 · 스탠다드</p>
              <div className="policy-values">
                <span>
                  <small>보장 한도</small>
                  <strong>1,404만원</strong>
                </span>
                <span>
                  <small>납입일</small>
                  <strong>매월 12일</strong>
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

function Chat({ back }: { back: () => void }) {
  const [messages, setMessages] = useState([
    { who: "ai", text: "안녕하세요! 보험료 계산, 약관, 보장 기준을 쉽게 설명해드릴게요." },
  ]);
  const [input, setInput] = useState("");

  const send = () => {
    if (!input.trim()) return;
    setMessages((current) => [
      ...current,
      { who: "me", text: input.trim() },
      {
        who: "ai",
        text: "좋은 질문이에요. 현재 스탠다드 플랜은 모의고사 성적 흐름과 가입 조건을 함께 반영해 월 보험료를 계산해요.",
      },
    ]);
    setInput("");
  };

  return (
    <div className="screen chat-screen">
      <TopBar back={back} backLabel="홈" />
      <div className="chat-heading">
        <Mascot size="sm" />
        <div>
          <h1>AI 도우미 노재수</h1>
          <p>
            <i /> 지금 상담 가능해요
          </p>
        </div>
      </div>
      <div className="quick-prompts">
        {["보험료는 어떻게 계산해?", "약관을 쉽게 설명해줘", "보장 기준이 궁금해"].map((label) => (
          <button key={label} onClick={() => setInput(label)}>
            {label}
          </button>
        ))}
      </div>
      <div className="messages">
        {messages.map((message, index) => (
          <div className={`message ${message.who}`} key={`${message.who}-${index}`}>
            {message.text}
          </div>
        ))}
      </div>
      <form
        className="chat-input"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="노재수에게 물어보세요"
          aria-label="AI 질문"
        />
        <button type="submit" aria-label="질문 보내기">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}

function Chart({ selected }: { selected: "전체" | Subject }) {
  const width = 360;
  const height = 176;
  const left = 30;
  const right = 10;
  const top = 16;
  const bottom = 30;
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
                <circle key={`${subject}-${index}`} cx={x} cy={y} r="3.4" fill="#fff" stroke={subjects[subject].color} strokeWidth="2.3" />
              );
            })}
          </g>
        ))}
        {examLabels.map((label, index) => {
          const [x] = point(50, index);
          return (
            <text key={label + index} x={x} y={height - 8} textAnchor="middle" className="x-label">
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function Grades() {
  const [segment, setSegment] = useState<"trend" | "weak">("trend");
  const [selected, setSelected] = useState<"전체" | Subject>("전체");

  return (
    <div className="screen page-with-nav">
      <section className="page-header green-header">
        <div>
          <span className="eyebrow light">성적 리포트</span>
          <h1>지민이의 성장 흐름</h1>
        </div>
        <span className="percentile-pill">
          <TrendingUp size={15} /> 상위 37%
        </span>
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
            <section className="score-card white-card">
              <div className="card-heading">
                <div>
                  <span className="eyebrow">수능 예상 점수</span>
                  <h2>
                    백분위 <strong>63</strong>
                  </h2>
                </div>
                <span className="status-badge">
                  <TrendingUp size={13} /> 오르는 중
                </span>
              </div>
              <div className="mini-trend">
                <span>9번의 모의고사 흐름으로 계산했어요</span>
                <strong>+7</strong>
              </div>
            </section>

            <section className="white-card subject-card">
              <div className="card-heading">
                <div>
                  <span className="eyebrow">과목별 성적 추이</span>
                  <h2>평균 2.15등급</h2>
                </div>
                <Info size={18} />
              </div>
              <div className="subject-filters" aria-label="그래프 과목 필터">
                {(["전체", ...Object.keys(subjects)] as ("전체" | Subject)[]).map((subject) => (
                  <button
                    key={subject}
                    className={selected === subject ? "active" : ""}
                    onClick={() => setSelected(subject)}
                    style={subject !== "전체" && selected === subject ? { borderColor: subjects[subject].color, color: subjects[subject].color } : undefined}
                  >
                    {subject !== "전체" && <i style={{ background: subjects[subject].color }} />}
                    {subject}
                  </button>
                ))}
              </div>
              <Chart selected={selected} />
              <p className="chart-note">
                {selected === "전체"
                  ? "전체 선택 시 네 과목의 흐름을 겹쳐 비교해요."
                  : `${selected}만 선택해 라인 아래의 변화 영역을 함께 보여드려요.`}
              </p>
            </section>

            <section className="coach-card">
              <Sparkles size={20} />
              <div>
                <strong>노재수의 한마디</strong>
                <p>수학 상승세가 좋아요. 영어는 주 2회 오답 복습으로 안정성을 챙겨봐요.</p>
              </div>
            </section>
          </>
        ) : (
          <WeakSubjects />
        )}
      </main>
    </div>
  );
}

function WeakSubjects() {
  const rows = [
    ["국어", 56, "#238F67", "보통"],
    ["수학", 52, "#4169D7", "보통"],
    ["영어", 48, "#D14982", "보완"],
    ["탐구", 65, "#C8781F", "높음"],
  ];
  return (
    <>
      <section className="white-card stability-card">
        <div className="card-heading">
          <span className="eyebrow">안정성 점수</span>
          <span className="warning-badge">보통</span>
        </div>
        <h2>
          55 <small>/ 100</small>
        </h2>
        <div className="stability-track">
          <span style={{ width: "55%" }} />
        </div>
        <p>영어 과목의 등락이 가장 커요. 기준선보다 안정도가 낮아 집중 보완을 추천해요.</p>
      </section>
      <section className="white-card subject-stability">
        <div className="card-heading">
          <div>
            <span className="eyebrow">과목별 안정성</span>
            <h2>흔들림이 적을수록 좋아요</h2>
          </div>
        </div>
        {rows.map(([name, score, color, label]) => (
          <div className="stability-row" key={String(name)}>
            <strong>{name}</strong>
            <div className="bar">
              <span style={{ width: `${score}%`, background: color }} />
            </div>
            <b style={{ color }}>{score}</b>
            <em>{label}</em>
          </div>
        ))}
      </section>
      <section className="white-card position-card">
        <span className="eyebrow">과목 포지션 한눈에 보기</span>
        <h2>영어 안정성을 먼저 챙겨요</h2>
        <div className="quadrant">
          <span className="quadrant-label q1">💪 강점</span>
          <span className="quadrant-label q2">🚩 보완</span>
          <i className="q-dot math">수학</i>
          <i className="q-dot korean">국어</i>
          <i className="q-dot english">영어</i>
          <i className="q-dot inquiry">탐구</i>
        </div>
      </section>
    </>
  );
}

function Converter({ screen, setScreen }: { screen: ConverterScreen; setScreen: (screen: ConverterScreen) => void }) {
  useEffect(() => {
    if (screen !== "loading") return;
    const timer = window.setTimeout(() => setScreen("result"), 1500);
    return () => window.clearTimeout(timer);
  }, [screen, setScreen]);

  if (screen === "intro") {
    return (
      <div className="screen page-with-nav converter-intro">
        <TopBar />
        <main>
          <span className="eyebrow">돈워리 계산기</span>
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
        <Mascot size="lg" />
        <LoaderCircle className="spinner dark" size={42} />
        <h1>우리 집 맞춤 재수 비용을 계산 중이에요</h1>
        <p>학원비, 생활비, 보험료를 꼼꼼히 확인하고 있어요.</p>
      </div>
    );
  }

  if (screen === "result") {
    return (
      <div className="screen page-with-nav">
        <TopBar back={() => setScreen("input")} backLabel="입력 수정" />
        <main className="sub-page result-page">
          <span className="eyebrow">우리 집 예상 재수 비용</span>
          <h1>1년 동안 필요한 금액이에요</h1>
          <section className="result-total">
            <span>총 예상 비용</span>
            <strong>2,184만원</strong>
            <p>월평균 182만원</p>
          </section>
          <section className="white-card">
            <h2>비용 구성</h2>
            {[
              ["학원·강의", "1,080만원", "49%"],
              ["교재·모의고사", "264만원", "12%"],
              ["생활비", "720만원", "33%"],
              ["안심 보험료", "50만원", "2%"],
            ].map(([label, value, percent]) => (
              <div className="cost-row" key={label}>
                <span>{label}</span>
                <div className="cost-bar">
                  <i style={{ width: percent }} />
                </div>
                <strong>{value}</strong>
              </div>
            ))}
          </section>
          <button className="primary-button" onClick={() => setScreen("input")}>
            조건 다시 입력하기
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="screen page-with-nav">
      <TopBar back={() => setScreen(screen === "cost" ? "input" : "intro")} backLabel="돈워리" />
      <main className="sub-page converter-form">
        <span className="step-label">STEP {screen === "input" ? "1" : "2"} / 2</span>
        <h1>{screen === "input" ? "우리 집 상황을 알려주세요" : "재수 형태를 선택해주세요"}</h1>
        <div className="step-progress">
          <span style={{ width: screen === "input" ? "50%" : "100%" }} />
        </div>
        {screen === "input" ? (
          <>
            <FormChoice title="월 평균 저축액" options={["50만원 이하", "50~100만원", "100만원 이상"]} />
            <FormChoice title="자녀 수" options={["1명", "2명", "3명 이상"]} />
            <FormChoice title="월 가처분 소득" options={["300만원 이하", "300~500만원", "500만원 이상"]} />
            <button className="primary-button" onClick={() => setScreen("cost")}>
              다음 <ArrowRight size={18} />
            </button>
          </>
        ) : (
          <>
            <FormChoice title="학습 형태" options={["재수종합학원", "독학재수학원", "온라인 강의"]} />
            <FormChoice title="통학 방식" options={["대중교통", "기숙형", "도보·자전거"]} />
            <FormChoice title="교재비 수준" options={["실속형", "표준형", "집중형"]} />
            <button className="primary-button" onClick={() => setScreen("loading")}>
              우리 집 기준으로 계산하기 <Calculator size={18} />
            </button>
          </>
        )}
      </main>
    </div>
  );
}

function FormChoice({ title, options }: { title: string; options: string[] }) {
  const [choice, setChoice] = useState(options[1] ?? options[0]);
  return (
    <fieldset className="choice-field">
      <legend>{title}</legend>
      <div>
        {options.map((option) => (
          <button type="button" className={choice === option ? "active" : ""} key={option} onClick={() => setChoice(option)}>
            {choice === option && <Check size={15} />}
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const myMenu = [
  { label: "성적 등록 상태", icon: BadgeCheck, detail: "등록 완료" },
  { label: "모의고사 성적 히스토리", icon: FileChartColumn },
  { label: "보험료 납입 내역", icon: WalletCards },
  { label: "결제 수단 관리", icon: CreditCard },
  { label: "주소 관리", icon: MapPin },
  { label: "알림 설정", icon: SlidersHorizontal },
  { label: "약관 및 정책", icon: BookOpenCheck },
];

function MyPage({ onLogout }: { onLogout: () => void }) {
  const [detail, setDetail] = useState<string | null>(null);

  if (detail) {
    return (
      <div className="screen page-with-nav">
        <TopBar back={() => setDetail(null)} backLabel="마이페이지" />
        <main className="sub-page">
          <span className="eyebrow">내 정보 관리</span>
          <h1>{detail}</h1>
          <section className="white-card detail-placeholder">
            <CircleCheck size={42} />
            <h2>안전하게 관리되고 있어요</h2>
            <p>{detail} 정보를 확인하고 필요한 항목을 바로 수정할 수 있어요.</p>
          </section>
          <button className="secondary-button" onClick={() => setDetail(null)}>
            마이페이지로 돌아가기
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="screen page-with-nav">
      <TopBar onNotification={() => setDetail("알림 설정")} />
      <main className="mypage-content">
        <div className="profile">
          <span className="profile-avatar">김</span>
          <div>
            <h1>김지민 학생</h1>
            <p>함께한 지 145일째예요</p>
          </div>
        </div>
        <section className="membership-card">
          <div>
            <small>가입 상품</small>
            <strong>스탠다드</strong>
          </div>
          <div>
            <small>보장 상한</small>
            <strong>1,404만원</strong>
          </div>
          <div>
            <small>가입일</small>
            <strong>2026.03.02</strong>
          </div>
        </section>
        <section className="menu-card">
          {myMenu.map(({ label, icon: Icon, detail: itemDetail }) => (
            <button key={label} onClick={() => setDetail(label)}>
              <span className="menu-icon">
                <Icon size={19} />
              </span>
              <span>{label}</span>
              {itemDetail && <em>{itemDetail}</em>}
              <ChevronRight size={17} />
            </button>
          ))}
        </section>
        <button className="logout-button" onClick={onLogout}>
          <LogOut size={17} /> 로그아웃
        </button>
      </main>
    </div>
  );
}

function ClaimFlow({ screen, setScreen, close }: { screen: ClaimScreen; setScreen: (screen: ClaimScreen) => void; close: () => void }) {
  useEffect(() => {
    if (screen !== "submitting") return;
    const timer = window.setTimeout(() => setScreen("done"), 1400);
    return () => window.clearTimeout(timer);
  }, [screen, setScreen]);

  const backMap: Record<ClaimScreen, ClaimScreen | null> = {
    home: null,
    eligibility: "home",
    link: "home",
    intro: "home",
    step1: "intro",
    step2: "step1",
    step3: "step2",
    submitting: "step3",
    done: "home",
    status: "home",
  };

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
    return (
      <div className="screen claim-done">
        <span className="done-icon">
          <Check size={42} />
        </span>
        <span className="eyebrow light">접수번호 JS-260624-017</span>
        <h1>1차 청구 접수가 완료됐어요</h1>
        <p>진행 상황이 바뀌면 알림으로 바로 알려드릴게요.</p>
        <button className="white-button" onClick={() => setScreen("status")}>
          청구 진행 상황 보기
        </button>
        <button className="ghost-button" onClick={close}>
          홈으로
        </button>
      </div>
    );
  }

  const previous = backMap[screen];
  return (
    <div className="screen page-with-nav claim-screen">
      <TopBar back={previous ? () => setScreen(previous) : close} backLabel={screen === "home" ? "홈" : "청구 홈"} />
      {screen === "home" && <ClaimHome setScreen={setScreen} />}
      {screen === "eligibility" && <ClaimEligibility />}
      {screen === "link" && <ClaimLink />}
      {screen === "intro" && <ClaimIntro onStart={() => setScreen("step1")} />}
      {screen === "step1" && <ClaimStep step={1} next={() => setScreen("step2")} />}
      {screen === "step2" && <ClaimStep step={2} next={() => setScreen("step3")} />}
      {screen === "step3" && <ClaimStep step={3} next={() => setScreen("submitting")} />}
      {screen === "status" && <ClaimStatus />}
    </div>
  );
}

function ClaimHome({ setScreen }: { setScreen: (screen: ClaimScreen) => void }) {
  return (
    <main className="sub-page">
      <span className="eyebrow">보험금 청구</span>
      <h1>필요할 때 든든하게 챙겨드려요</h1>
      <section className="white-card claim-membership">
        <div>
          <span>가입 티어</span>
          <strong>스탠다드</strong>
        </div>
        <div>
          <span>가입한 재수 형태</span>
          <strong>재수종합학원</strong>
        </div>
      </section>
      <section className="claim-open-card">
        <span className="eyebrow light">2026.11.19 평가 · 중증 · 한도 1,404만원</span>
        <h2>1차 청구가 열렸어요</h2>
        <p>6월 30일까지 제출할 수 있어요. 연동된 결제 520만원이 준비돼 있어요.</p>
        <div className="claim-progress">
          <span style={{ width: "74%" }} />
        </div>
        <small>잔여 보장 한도 1,404만원</small>
        <button className="white-button" onClick={() => setScreen("intro")}>
          청구 시작하기
        </button>
      </section>
      <div className="claim-menu">
        <button onClick={() => setScreen("eligibility")}>
          <ShieldCheck size={20} />
          <span>
            <strong>보장 자격 상세</strong>
            <small>2026.11.19 판정 · 중증</small>
          </span>
          <ChevronRight size={17} />
        </button>
        <button onClick={() => setScreen("link")}>
          <CreditCard size={20} />
          <span>
            <strong>결제 내역 연동</strong>
            <small>2개 카드 연동됨</small>
          </span>
          <ChevronRight size={17} />
        </button>
        <button onClick={() => setScreen("status")}>
          <FileText size={20} />
          <span>
            <strong>내 청구 내역</strong>
            <small>아직 청구 내역이 없어요</small>
          </span>
          <ChevronRight size={17} />
        </button>
      </div>
    </main>
  );
}

function ClaimEligibility() {
  return (
    <main className="sub-page">
      <span className="eyebrow">보장 자격 상세</span>
      <h1>1차 청구 대상이에요</h1>
      <section className="eligibility-hero">
        <ShieldCheck size={34} />
        <span>보장 가능</span>
        <strong>중증 기준 충족</strong>
      </section>
      <section className="white-card">
        <h2>판정 근거</h2>
        {["2026년 수능 성적 등록 완료", "가입 후 대기기간 충족", "보장 제외 항목 없음"].map((item) => (
          <div className="check-row" key={item}>
            <CircleCheck size={18} /> {item}
          </div>
        ))}
      </section>
    </main>
  );
}

function ClaimLink() {
  const [linked, setLinked] = useState(true);
  return (
    <main className="sub-page">
      <span className="eyebrow">결제 내역 연동</span>
      <h1>학원비 결제를 자동으로 모아요</h1>
      <section className="white-card linked-card">
        <CreditCard size={25} />
        <div>
          <strong>재수카드 · 4821</strong>
          <span>최근 동기화 방금 전</span>
        </div>
        <button className={`toggle ${linked ? "on" : ""}`} onClick={() => setLinked(!linked)} aria-label="카드 연동 전환">
          <i />
        </button>
      </section>
      <section className="white-card linked-card">
        <CreditCard size={25} />
        <div>
          <strong>가족카드 · 1098</strong>
          <span>최근 동기화 오늘 09:20</span>
        </div>
        <span className="status-badge">연동됨</span>
      </section>
      <button className="secondary-button">
        <RefreshCcw size={17} /> 결제 내역 새로고침
      </button>
    </main>
  );
}

function ClaimIntro({ onStart }: { onStart: () => void }) {
  return (
    <main className="claim-intro sub-page">
      <span className="step-orb">
        <FileText size={28} />
      </span>
      <span className="eyebrow">3단계면 끝나요</span>
      <h1>1차 보험금 청구를 시작할게요</h1>
      <p>결제 내역을 확인하고, 받는 방법을 고른 뒤 최종 동의하면 접수돼요.</p>
      <div className="intro-steps">
        {[
          ["01", "비용 증빙", "연동한 결제를 골라요"],
          ["02", "받는 방법", "계좌와 바우처를 정해요"],
          ["03", "지급액 확인", "최종 내용을 확인해요"],
        ].map(([number, title, text]) => (
          <div key={number}>
            <span>{number}</span>
            <p>
              <strong>{title}</strong>
              <small>{text}</small>
            </p>
          </div>
        ))}
      </div>
      <button className="primary-button" onClick={onStart}>
        1차 청구 시작하기 <ArrowRight size={18} />
      </button>
    </main>
  );
}

function ClaimStep({ step, next }: { step: number; next: () => void }) {
  const content = {
    1: {
      title: "청구할 비용을 선택해주세요",
      subtitle: "연동된 학원비와 교재비를 확인했어요.",
      options: ["재수종합학원 4~6월 · 420만원", "온라인 강의 패키지 · 60만원", "교재·모의고사 · 40만원"],
      button: "다음",
    },
    2: {
      title: "보험금을 어떻게 받을까요?",
      subtitle: "계좌 지급과 교육 바우처를 함께 선택할 수 있어요.",
      options: ["계좌로 80% 받기 · 416만원", "교육 바우처 20% 받기 · 104만원"],
      button: "다음",
    },
    3: {
      title: "최종 지급액을 확인해주세요",
      subtitle: "공제 없이 총 520만원을 받을 수 있어요.",
      options: ["계좌 지급 · 416만원", "교육 바우처 · 104만원", "보호자 확인 및 전자 동의"],
      button: "청구 제출하기",
    },
  }[step]!;
  const [checked, setChecked] = useState(content.options);
  return (
    <main className="sub-page claim-step">
      <span className="step-label">STEP {step} / 3</span>
      <h1>{content.title}</h1>
      <p>{content.subtitle}</p>
      <div className="step-progress">
        <span style={{ width: `${(step / 3) * 100}%` }} />
      </div>
      <section className="check-options">
        {content.options.map((option) => {
          const isChecked = checked.includes(option);
          return (
            <button
              className={isChecked ? "active" : ""}
              key={option}
              onClick={() => setChecked((current) => (isChecked ? current.filter((item) => item !== option) : [...current, option]))}
            >
              <span className="fake-check">{isChecked && <Check size={15} />}</span>
              <strong>{option}</strong>
            </button>
          );
        })}
      </section>
      {step === 3 && (
        <section className="payout-card">
          <span>최종 예상 지급액</span>
          <strong>5,200,000원</strong>
        </section>
      )}
      <button className="primary-button" onClick={next} disabled={checked.length === 0}>
        {content.button} {step < 3 ? <ArrowRight size={18} /> : <LockKeyhole size={17} />}
      </button>
    </main>
  );
}

function ClaimStatus() {
  return (
    <main className="sub-page">
      <span className="eyebrow">청구 진행 상황</span>
      <h1>접수 내용을 확인하고 있어요</h1>
      <section className="white-card status-timeline">
        {[
          ["접수 완료", "오늘 오전 10:24", true],
          ["서류 확인", "영업일 기준 1~2일", true],
          ["지급 심사", "확인 예정", false],
          ["지급 완료", "심사 후 알림", false],
        ].map(([title, text, active]) => (
          <div className={active ? "active" : ""} key={String(title)}>
            <i>{active ? <Check size={14} /> : null}</i>
            <p>
              <strong>{title}</strong>
              <span>{text}</span>
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}

function NotificationModal({ close }: { close: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <section className="notification-modal" role="dialog" aria-modal="true" aria-labelledby="notification-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">새 소식</span>
            <h2 id="notification-title">알림</h2>
          </div>
          <button className="icon-button" onClick={close} aria-label="알림 닫기">
            <X size={20} />
          </button>
        </div>
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
    </div>
  );
}

function BottomNav({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) {
  const items = [
    { id: "home" as Tab, label: "홈", icon: Home },
    { id: "grades" as Tab, label: "성적분석", icon: ChartNoAxesCombined },
    { id: "converter" as Tab, label: "돈워리", icon: Calculator },
    { id: "mypage" as Tab, label: "마이페이지", icon: UserRound },
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
  const [converterScreen, setConverterScreen] = useState<ConverterScreen>("intro");
  const [claimScreen, setClaimScreen] = useState<ClaimScreen | null>(null);
  const [notifications, setNotifications] = useState(false);

  const shellClass = useMemo(() => `app-shell stage-${stage}`, [stage]);

  const changeTab = (next: Tab) => {
    setTab(next);
    setClaimScreen(null);
    if (next === "home") setHomeScreen("main");
  };

  return (
    <div className="site-stage">
      <div className={shellClass}>
        {stage === "splash" && <Splash onContinue={() => setStage("login")} />}
        {stage === "login" && <Login onLogin={() => setStage("loading")} />}
        {stage === "loading" && <Loading onDone={() => setStage("app")} />}
        {stage === "app" && (
          <>
            {claimScreen ? (
              <ClaimFlow screen={claimScreen} setScreen={setClaimScreen} close={() => setClaimScreen(null)} />
            ) : tab === "home" ? (
              homeScreen === "main" ? (
                <HomeMain
                  onNotification={() => setNotifications(true)}
                  go={setHomeScreen}
                  goTab={changeTab}
                  openClaim={() => setClaimScreen("home")}
                />
              ) : homeScreen === "chat" ? (
                <Chat back={() => setHomeScreen("main")} />
              ) : (
                <PremiumDetail
                  screen={homeScreen}
                  back={() => setHomeScreen(homeScreen === "history" ? "premium" : "main")}
                  go={() => setHomeScreen("history")}
                />
              )
            ) : tab === "grades" ? (
              <Grades />
            ) : tab === "converter" ? (
              <Converter screen={converterScreen} setScreen={setConverterScreen} />
            ) : (
              <MyPage onLogout={() => setStage("login")} />
            )}
            {!claimScreen && homeScreen !== "chat" && <BottomNav tab={tab} setTab={changeTab} />}
            {notifications && <NotificationModal close={() => setNotifications(false)} />}
          </>
        )}
      </div>
    </div>
  );
}
