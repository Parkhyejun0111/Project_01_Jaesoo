import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  Calculator,
  ChartNoAxesCombined,
  Check,
  Home,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react";
import styles from "./design-system.module.css";

const colors = [
  ["Canvas cream", "#FFFBF2", "Default canvas"],
  ["Canvas gray", "#F3F3F3", "Alternate canvas"],
  ["Canvas gray + white", "#F3F3F3 / #FFFFFF", "Gray canvas with white grades and converter tabs"],
  ["Canvas white", "#F3F3F3 / #FFFFFF", "Gray canvas with white home, grades, and converter tabs"],
  ["Canvas cream + white", "#FFFBF2 / #FFFFFF", "Cream canvas with white grades, converter, and mypage tabs"],
  ["Primary", "#0CB474", "핵심 행동과 활성 상태"],
  ["Strong", "#087D53", "강조와 브랜드 면"],
  ["Deep", "#075B3F", "고대비 텍스트"],
  ["Soft", "#C4F9FF", "보조 정보"],
  ["Highlight", "#DFFF87", "작은 포인트"],
  ["Canvas", "#F3F3F3", "앱 기본 배경"],
  ["Surface", "#FFFFFF", "분리된 표면"],
  ["Ink", "#12372B", "본문과 제목"],
] as const;

const subjects = [
  ["국어", "#F5604E"],
  ["수학", "#13BCAD"],
  ["영어", "#3B5998"],
  ["탐구", "#FFC83B"],
] as const;

export default function DesignSystemPage() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <nav className={styles.topline} aria-label="디자인 시스템 이동">
          <a href="/" className={styles.back}>
            <ArrowLeft size={18} aria-hidden="true" />
            앱으로 돌아가기
          </a>
          <span className={styles.version}>DESIGN SYSTEM 1.0</span>
        </nav>
        <div className={styles.heroCopy}>
          <span className={styles.kicker}>재수없수 Care</span>
          <h1>보험보다 보호자에 가까운<br />하나의 디자인 언어</h1>
          <p>
            따뜻한 색, 명료한 숫자, 둥근 형태와 평면적 계층으로
            모든 화면에서 같은 안심 경험을 만듭니다.
          </p>
        </div>
        <div className={styles.architecture} aria-label="디자인 시스템 구조">
          <span>DESIGN.md</span><ArrowRight aria-hidden="true" />
          <span>CSS tokens</span><ArrowRight aria-hidden="true" />
          <span>Components</span><ArrowRight aria-hidden="true" />
          <span>Product UI</span>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <strong>Contents</strong>
          <a href="#principles">Principles</a>
          <a href="#colors">Colors</a>
          <a href="#type">Typography</a>
          <a href="#shape">Shape & spacing</a>
          <a href="#components">Components</a>
          <a href="#data">Data display</a>
          <a href="#governance">Governance</a>
        </aside>

        <div className={styles.content}>
          <section id="principles" className={styles.section}>
            <div className={styles.sectionIntro}>
              <span>01 / Principles</span>
              <h2>안심이 먼저 보이고,<br />다음 행동은 쉽게</h2>
            </div>
            <div className={styles.principleGrid}>
              {[
                ["Warm", "차가운 금융 앱보다 곁에서 설명하는 보호자의 인상을 만듭니다."],
                ["Clear", "보험료, D-day, 백분위처럼 중요한 숫자를 가장 먼저 읽게 합니다."],
                ["Flat", "그림자 없이 톤, 테두리, 구분선과 여백으로 계층을 만듭니다."],
                ["Focused", "한 화면의 메인 그린은 가장 중요한 행동에 집중합니다."],
              ].map(([title, copy], index) => (
                <article className={styles.principle} key={title}>
                  <span>0{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="colors" className={styles.section}>
            <div className={styles.sectionIntro}>
              <span>02 / Colors</span>
              <h2>따뜻한 그린을 중심으로</h2>
              <p>그린은 행동과 활성 상태에 집중하고, 민트와 라임은 보조 역할로 제한합니다.</p>
            </div>
            <div className={styles.swatches}>
              {colors.map(([name, value, use]) => (
                <article className={styles.swatch} key={name}>
                  <div style={{ background: value }} />
                  <strong>{name}</strong>
                  <code>{value}</code>
                  <p>{use}</p>
                </article>
              ))}
            </div>
            <div className={styles.subjectRow}>
              {subjects.map(([name, value]) => (
                <span key={name}><i style={{ background: value }} />{name}<code>{value}</code></span>
              ))}
            </div>
          </section>

          <section id="type" className={styles.section}>
            <div className={styles.sectionIntro}>
              <span>03 / Typography</span>
              <h2>Pretendard, 단정하고 친근하게</h2>
            </div>
            <div className={styles.typeSpecimens}>
              <div className={styles.displayType}><small>Display · 32 / 1.25 · 900</small>보험보다 보호자에 가까운 안심 케어</div>
              <div className={styles.headingType}><small>Heading · 25 / 1.30 · 850</small>수능 예상 점수</div>
              <div className={styles.titleType}><small>Title · 16 / 1.45 · 800</small>과목별 성적 추이</div>
              <div className={styles.bodyType}><small>Body · 13 / 1.60 · 500</small>모의고사 9회 평균 백분위 63, 전국 상위 37%입니다.</div>
              <div className={styles.metricType}><small>Metric · 32 / 1.10 · 900</small>63 <em>백분위</em></div>
            </div>
          </section>

          <section id="shape" className={styles.section}>
            <div className={styles.sectionIntro}>
              <span>04 / Shape & spacing</span>
              <h2>4px 리듬과 둥근 모서리</h2>
            </div>
            <div className={styles.shapeGrid}>
              {[["Small", "8px"], ["Medium", "12px"], ["Control", "16px"], ["Section", "18px"], ["Card", "24px"], ["Pill", "9999px"]].map(([name, radius]) => (
                <div key={name}><i style={{ borderRadius: radius }} /><strong>{name}</strong><code>{radius}</code></div>
              ))}
            </div>
            <div className={styles.spacingScale}>
              {[4, 8, 12, 16, 20, 24, 32, 40, 48, 64].map((value) => (
                <span key={value}><i style={{ width: value }} />{value}</span>
              ))}
            </div>
          </section>

          <section id="components" className={styles.section}>
            <div className={styles.sectionIntro}>
              <span>05 / Components</span>
              <h2>같은 상태는 같은 모양으로</h2>
            </div>
            <div className={styles.componentGrid}>
              <article className={styles.specimen}>
                <header><strong>Canvas toggle</strong><code>44px · 5 canvas tones</code></header>
                <div className={styles.canvasToggleSpecimen}>
                  <span>기본 캔버스</span>
                  <button type="button" aria-pressed="false"><Sun size={17} />크림</button>
                </div>
                <p className={styles.specimenNote}>기본은 크림 캔버스이며, 사용자는 동일한 제어로 회색 캔버스로 전환할 수 있습니다.</p>
              </article>

              <article className={styles.specimen}>
                <header><strong>Buttons</strong><code>height 54 · radius 16</code></header>
                <button className={styles.primaryButton}>보험료 계산하기</button>
                <button className={styles.secondaryButton}>성적 자세히 보기</button>
                <button className={styles.textButton}>이전 화면으로 <ArrowRight size={17} /></button>
              </article>

              <article className={styles.specimen}>
                <header><strong>Input & icon action</strong><code>44px touch target</code></header>
                <label className={styles.input}>
                  <input placeholder="궁금한 점을 입력하세요" aria-label="질문 입력 예시" />
                  <button aria-label="질문 보내기"><ArrowRight size={20} /></button>
                </label>
                <div className={styles.iconActions}>
                  <button aria-label="알림"><Bell size={20} /></button>
                  <button aria-label="보험료 계산"><Calculator size={20} /></button>
                  <button aria-label="약관 설명"><ShieldCheck size={20} /></button>
                </div>
              </article>

              <article className={styles.specimen}>
                <header><strong>Segments & chips</strong><code>active = brand</code></header>
                <div className={styles.segment}><button className={styles.segmentActive}>성적 추이</button><button>집중 보완 과목</button></div>
                <div className={styles.chips}><button className={styles.chipActive}>전체</button><button>국어</button><button>수학</button><button>영어</button></div>
              </article>

              <article className={styles.specimen}>
                <header><strong>Choice tiles</strong><code>border + tint + check</code></header>
                <div className={styles.choiceTiles}>
                  <button className={styles.choiceTileNone}><span>선택안함</span></button>
                  <button className={styles.choiceTileActive}><span>150~250만원</span></button>
                  <button><span>250만원 이상</span></button>
                </div>
              </article>

              <article className={styles.specimen}>
                <header><strong>Navigation</strong><code>78px · no shadow</code></header>
                <nav className={styles.bottomNav} aria-label="하단 탭 예시">
                  <button className={styles.navActive}><Home size={20} /><span>홈</span></button>
                  <button><ChartNoAxesCombined size={20} /><span>성적분석</span></button>
                  <button><BarChart3 size={20} /><span>돈워리</span></button>
                  <button><UserRound size={20} /><span>마이</span></button>
                </nav>
              </article>
            </div>

            <div className={styles.insights}>
              <article className={styles.positive}>
                <Check size={20} />
                <div><strong>안심 인사이트</strong><p>현재 성적 흐름은 안정적이에요. 다음 모의고사까지 수학을 집중 점검해보세요.</p></div>
              </article>
              <article className={styles.danger}>
                <span>!</span>
                <div><strong>보장 기준 안내</strong><p>빨간 선은 평소보다 15점 이상 떨어진 불운을 판단하는 기준선입니다.</p></div>
              </article>
            </div>
          </section>

          <section id="data" className={styles.section}>
            <div className={styles.sectionIntro}>
              <span>06 / Data display</span>
              <h2>그래프보다 해석이 먼저</h2>
            </div>
            <div className={styles.dataGrid}>
              <article className={styles.chartCard}>
                <div className={styles.chartTitle}><div><small>수능 예상 점수</small><strong>백분위 63</strong></div><span>전국 상위 37%</span></div>
                <div className={styles.chart} aria-label="백분위 추이 예시">
                  <i className={styles.gridOne} /><i className={styles.gridTwo} /><i className={styles.gridThree} />
                  <div className={styles.line}><b /><b /><b /><b /><b /><b /></div>
                  <span className={styles.threshold}>보장 기준선 48점</span>
                </div>
              </article>
              <article className={styles.progressCard}>
                <small>과목별 안정성</small>
                {subjects.map(([name, color], index) => (
                  <div className={styles.progressRow} key={name}>
                    <span>{name}</span><i><b style={{ width: `${72 - index * 7}%`, background: color }} /></i><strong>{72 - index * 7}</strong>
                  </div>
                ))}
              </article>
            </div>
          </section>

          <section id="governance" className={styles.section}>
            <div className={styles.sectionIntro}>
              <span>07 / Governance</span>
              <h2>새 패턴은 세 곳을 함께 바꿉니다</h2>
            </div>
            <ol className={styles.governance}>
              <li><span>1</span><div><strong>Rule</strong><p>DESIGN.md에 목적과 사용 규칙을 기록합니다.</p></div></li>
              <li><span>2</span><div><strong>Token</strong><p>globals.css에 실행 가능한 의미 기반 토큰을 연결합니다.</p></div></li>
              <li><span>3</span><div><strong>Specimen</strong><p>이 카탈로그에 실제 상태와 조합을 추가합니다.</p></div></li>
              <li><span>4</span><div><strong>Product</strong><p>제품 화면에서 재사용하고 모바일 환경을 검증합니다.</p></div></li>
            </ol>
          </section>
        </div>
      </div>
    </main>
  );
}
