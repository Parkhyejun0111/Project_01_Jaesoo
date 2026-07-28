import React from "react";
import { api } from "@jaesoo/api-client";

// 백엔드 주소 결정은 @jaesoo/api-client 한 곳에만 있다 (VITE_API_URL / 기본 :8000).
// Vite 환경변수는 빌드 시점에 박히므로 배포 전에 반드시 설정해야 한다.

// 약관 원문 (public/policy/, scripts/sync-policy.mjs 가 api/policy 에서 복사).
// 모든 <h3>/<h4> 에 id 앵커가 있어 조항으로 바로 스크롤된다.
const POLICY_DOC = "policy/재수없수_교육보험_보통약관_수정본.html";
// 웹 → 앱 핸드오프 대상. 배포 시 VITE_APP_URL 로 앱 도메인을 지정한다.
const APP_URL =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_APP_URL) ||
  "http://localhost:3000";
// 화면에서 링크로 여는 주요 조항 앵커
const POLICY_ANCHORS = {
  지급제한: "제15조-보험금을-지급하지-않는-사유",
  급락판정: "별표3-성적-급락-판정-기준-제13조-제26조-연계",
  보험료표: "별표4-위험확률-및-보험료-산출-기준-제22조-제24조-연계",
  // ※ 별표2 는 제목이 "늦은가입 할증"으로 갱신됐지만 id 는 옛 문구가 남아 있다
  가입시점: "별표2-가입시점-선택-로딩-late-및-납입-구조-제11조-제22조-연계",
  해약환급: "별표5-해약환급금-환급률-제9조-연계",
  청약철회: "제5조-청약의-철회",
};

// ── 청약서 요율 3문항 (약관 별표4) ────────────────────────────────────────
// 고객에게는 구간으로 묻고, 백엔드에는 구간의 **대표 금액(만원)** 을 보낸다.
// 스코어카드가 log1p(만원) 을 입력으로 쓰므로 구간 코드가 아니라 금액이어야 한다.
// 대표값은 학습표본의 구간별 중위값(노트북 채점표 §10-2)에 맞췄다.
const INCOME_BANDS = [
  { label: '1분위 (약 300만원 미만)', manwon: 288 },
  { label: '2분위 (약 300~550만원)', manwon: 500 },
  { label: '3분위 (약 550~650만원)', manwon: 600 },
  { label: '4분위 (약 650~800만원)', manwon: 700 },
  { label: '5분위 (약 800만원 이상)', manwon: 1000 },
];
const EDU_COST_BANDS = [
  { label: '1분위 (약 30만원 미만)', manwon: 20 },
  { label: '2분위 (약 30~52만원)', manwon: 45 },
  { label: '3분위 (약 52~75만원)', manwon: 60 },
  { label: '4분위 (약 75~120만원)', manwon: 90 },
  { label: '5분위 (약 120만원 이상)', manwon: 150 },
];
// 거주지역 → 학원밀집도지수. 백엔드 engine.REGION_CHOICES 와 같은 체계를 쓴다
// (지역규모를 재수 인프라 접근성으로 뒤집은 대리지표: 특별시 4 ~ 읍면 1).
const REGION_BANDS = [
  { label: '1단계(읍·면지역)', value: '읍면지역', density: 1, desc: '군 지역' },
  { label: '2단계(중소도시)', value: '중소도시', density: 2, desc: '그 외 시 지역' },
  { label: '3단계(대도시)', value: '대도시', density: 3, desc: '부산·대구·인천·광주·대전·울산' },
  { label: '4단계(특별시급)', value: '특별시', density: 4, desc: '서울·세종' },
];

// 가입 시점(잔여 납입개월) — 별표2. 늦게 들수록 할증 + 분납 단축으로 월납이 오른다.
const ENROLL_WINDOWS = [
  { label: '고1 3월 (최초)', months: 33 },
  { label: '고1 9월', months: 27 },
  { label: '고2 3월', months: 21 },
  { label: '고2 9월', months: 15 },
  { label: '고3 3월', months: 9 },
  { label: '고3 6월 (마감)', months: 6 },
];

// CSS 문자열 -> React style 객체 변환 헬퍼 (원본 dc-runtime cssToObj 대응)
function S(css) {
  if (css == null) return undefined;
  if (typeof css === "object") return css;
  const o = {};
  for (const decl of String(css).split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    if (!prop) continue;
    const val = decl.slice(i + 1).trim();
    const key = prop.startsWith("--") ? prop : prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    o[key] = val;
  }
  return o;
}

// 이미지 자산 (원본 PNG 를 표시 크기로 인라인)
const IMG_F7F53234 = "/jaesoo_character.png";

class Component extends React.Component {
  resetApplyForm = () => ({
    school: '', region: '', target_univ: '',
    c_name: '', c_birth: '', c_phone: '', c_rel: '부',
    p_name: '', p_birth: '', p_phone: '',
    g_name: '', g_phone: '',
    q_grade: '', q_direction: '', q_wait: '', q_data: '', q_evidence: '',
    d2: '', d3: '', d4: '', d5: '',
    gender: '', income: '', edu_cost: '',
    subj_kor: false, subj_math: false, subj_eng: false, subj_soc: false, subj_sci: false,
    school_type: '', target_area: '', study_time: '', sibling: '', sibling_result: '', stat_consent: '',
    pi_req: '', pi_opt: '', pi_counsel: '',
    sign: false, sign_name: '',
  });

  state = {
    // 화면 단계: landing(인강 홈) → insurance(보험 소개) → tiers(상품 선택)
    //           → terms(약관 동의) → apply(청약서) → done(가입 완료·앱 다운로드)
    entry: 'landing',
    payBackEntry: 'landing',       // 모달을 닫았을 때 돌아갈 화면
    tiers: [], expandedTier: null, applyTierTableOpen: false, openFaq: 0,
    // 히어로 배너 자동 전환 (0 = 재수없수 임베디드 보험, 1 = 메가에듀패스 올패스).
    // 앱에서는 인강 사이트가 먼저 보여야 자연스러워 올패스부터 띄운다.
    heroSlide: this.props.appMode ? 1 : 0, heroPaused: false,
    loading: false, loadStage: '',     // 청약 제출 중 오버레이
    enrolledId: null,                  // /api/enroll 이 돌려준 student_id
    enrolledQuote: null,               // 가입완료 화면에 보여줄 확정 월납·보장금
    enrollError: null,                 // 제출 실패 안내 (기존엔 성공처럼 넘어갔다)
    backendDown: false,                // /api/tiers 실패 → 폴백 표 사용 중
    remainingMonths: 33,               // 가입 시점(잔여 납입개월, 별표2)
    quoteMeta: null,                   // { late, theta }
    regionChoices: REGION_BANDS,       // /api/regions 로 갱신
    onbForm: { name: '', school: '', track: '자연', target_univ: '', tier: '스탠다드', region: '수도권',
               gradeYear: '고2', gender: '남', income_band: 3, retake_intent: 3, target_gap: 'near',
               monthly_saving: 100, retire_goal: 20000,
               agree1: false, agree2: false, agree3: false, insChecked: true },
    // 보험 청약서(가입설문) — 지류문서 형식 전체 항목
    apply: this.resetApplyForm(),
  };

  // ── 백엔드 연동 (@jaesoo/api-client) ─────────────────────────────────────
  loadTiers = async () => {
    const res = await api.tiers(this.state.remainingMonths);
    if (!res.ok) {
      // 백엔드가 꺼진 정적 배포에서도 표가 보이도록 폴백 (§tierFallback)
      this.setState({ tiers: [], backendDown: true });
      return;
    }
    this.setState({
      tiers: res.data.tiers || [],
      backendDown: false,
      quoteMeta: { late: res.data.late, theta: res.data.theta },
    });
  };

  loadRegions = async () => {
    const res = await api.regions();
    if (res.ok && res.data.regions?.length) this.setState({ regionChoices: res.data.regions });
  };

  _applyValid = (a) => Boolean(
    a && a.c_name && a.p_name && a.q_grade && a.q_data === '동의' && a.q_evidence === '동의' &&
    a.d2 && a.d3 && a.d4 && a.d5 &&
    a.income && a.region && a.edu_cost && a.pi_req === '동의' && a.sign
  );

  submitEnroll = async () => {
    const f = this.state.onbForm;
    const a = this.state.apply;
    this.setState({ loading: true, loadStage: '청약 정보를 안전하게 등록하는 중…', enrollError: null });
    const res = await api.enroll({
          name: a.p_name || '신규가입자', school: a.school, track: f.track, target_univ: a.target_univ,
          tier: f.tier,
          // ── 요율 3지표 (약관 별표4) — 구간 라벨을 대표 금액(만원)으로 환산해 보낸다 ──
          region: this._regionValue(a.region),
          household_income_manwon: INCOME_BANDS.find(b => b.label === a.income)?.manwon ?? null,
          monthly_edu_cost_manwon: EDU_COST_BANDS.find(b => b.label === a.edu_cost)?.manwon ?? null,
          enrolled_at_remaining_months: this.state.remainingMonths,
          declared_subjects: this._declaredSubjects(a),
          gender: a.gender || null, terms_agreed: true,
          survey: {
            계약관계자: { 계약자겸법정대리인: { 성명: a.c_name, 생년월일: a.c_birth, 연락처: a.c_phone, 관계: a.c_rel }, 피보험자: { 성명: a.p_name, 생년월일: a.p_birth, 연락처: a.p_phone } },
            가입자격: { 학년: a.q_grade, 대입방향: a.q_direction, 대기기간확인: a.q_wait, 성적자료제출: a.q_data, 요율지표증빙서류제출: a.q_evidence },
            고지사항: { 학업중단: a.d2, 질병장애: a.d3, 타사보험: a.d4, 타진로: a.d5 },
            요율문항: { 가구소득: a.income, 거주지역: a.region, 월교육비: a.edu_cost },
            응시과목선언: { 국어: a.subj_kor, 수학: a.subj_math, 영어: a.subj_eng, 사회탐구: a.subj_soc, 과학탐구: a.subj_sci, 재조사시점: '고3 9월 모의고사 직후' },
            통계검증: { 고교유형: a.school_type, 정시지향도: a.q_direction, 목표대학권역: a.target_area, 주당공부시간: a.study_time, 형제재수: a.sibling, 형제결과: a.sibling_result, 동의: a.stat_consent },
            개인정보동의: { 필수: a.pi_req, 선택: a.pi_opt, 심리상담: a.pi_counsel },
            자필서명: a.sign, 거주지역: a.region, 학교: a.school, 목표대학: a.target_univ,
          },
    });
    await new Promise(r => setTimeout(r, 500));   // 등록 연출

    if (!res.ok || res.data?.ok === false) {
      // 실패를 성공처럼 보이게 하던 기존 동작을 고쳤다 — 청약서에 머물며 오류를 안내한다.
      // (백엔드가 꺼진 데모에서는 '데모 모드로 계속' 버튼으로 넘어갈 수 있다)
      this.setState({
        loading: false,
        enrollError: res.ok ? String(res.data.error || '등록에 실패했어요') : res.error,
      });
      return;
    }
    this.setState({
      loading: false, entry: 'done', enrollError: null,
      enrolledId: res.data.student_id,
      enrolledQuote: {
        monthly_premium: res.data.monthly_premium,
        coverage: res.data.coverage,
        remaining_months: res.data.remaining_months,
      },
    });
  };

  /** 오류를 확인한 뒤에도 데모를 이어보고 싶을 때 (DB 저장은 안 된 상태) */
  skipEnrollError = () => this.setState({ loading: false, enrollError: null, entry: 'done', enrolledId: null });

  /** 청약서 거주지 라벨 → 백엔드 지역규모 값 (특별시/대도시/중소도시/읍면지역) */
  _regionValue = (label) => REGION_BANDS.find(r => r.label === label)?.value || '대도시';

  /** 응시과목 선언 — 탐구는 사회/과학 중 하나만 선택해도 '탐구'로 집계 (별표6) */
  _declaredSubjects = (a) => {
    const out = [];
    if (a.subj_kor) out.push('국어');
    if (a.subj_math) out.push('수학');
    if (a.subj_eng) out.push('영어');
    if (a.subj_soc || a.subj_sci) out.push('탐구');
    return out.length ? out : null;
  };

  componentDidMount() {
    this.loadTiers();
    this.loadRegions();
    try { window.sessionStorage && window.sessionStorage.removeItem('jaesoo-web-insurance-flow-v1'); } catch (e) {}

    // 히어로 배너 자동 전환. 마우스를 올리면 멈추고, 모션 최소화 설정이면 아예 돌리지 않는다.
    const reduceMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion) {
      this._heroTimer = setInterval(() => {
        if (this.state.heroPaused) return;
        if (this.state.entry !== 'landing') return;
        this.setState(st => ({ heroSlide: (st.heroSlide + 1) % 2 }));
      }, this.props.appMode ? 5000 : 8000);
    }
  }

  componentWillUnmount() {
    if (this._heroTimer) clearInterval(this._heroTimer);
  }

  // 전화번호 자동 포맷 (010-1234-5678)
  _phoneFmt = (v) => {
    const d = String(v || '').replace(/\D/g, '').slice(0, 11);
    if (d.length < 4) return d;
    if (d.length < 8) return d.slice(0, 3) + '-' + d.slice(3);
    return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
  };

  // 생년월일 드롭다운 (년/월/일 select) — apply[field]에 'YYYY-MM-DD' 저장
  _dob = (field, y0, y1) => {
    const parts = String(this.state.apply[field] || '').split('-');
    const yy = parts[0] || '', mm = parts[1] || '', dd = parts[2] || '';
    const set = (i, val) => {
      const p = [yy, mm, dd]; p[i] = val;
      this.setState(st => ({ apply: { ...st.apply, [field]: (p[0] || '') + '-' + (p[1] || '') + '-' + (p[2] || '') } }));
    };
    const years = []; for (let y = y1; y >= y0; y--) years.push(String(y));
    const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
    const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
    const sel = S("flex:1;min-width:0;box-sizing:border-box;border:1px solid #DDD;border-radius:8px;padding:9px 6px;font-size:11px;font-family:inherit;outline:none;background:#fff;color:#333");
    return (
      <div style={S("display:flex;gap:6px")}>
        <select value={yy} onChange={e => set(0, e.target.value)} style={sel}><option value="">년</option>{years.map(y => <option key={y} value={y}>{y}년</option>)}</select>
        <select value={mm} onChange={e => set(1, e.target.value)} style={sel}><option value="">월</option>{months.map(m => <option key={m} value={m}>{Number(m)}월</option>)}</select>
        <select value={dd} onChange={e => set(2, e.target.value)} style={sel}><option value="">일</option>{days.map(d => <option key={d} value={d}>{Number(d)}일</option>)}</select>
      </div>
    );
  };

  // 과목 심볼 아이콘 (강사 카드 상단). 텍스트·이모지 대신 굵기를 통일한 라인 SVG.
  // 다섯 과목이 실루엣만으로 구분되도록 서로 다른 형태를 골랐다.
  subjectIcon = (kind, size = 54, stroke = 'rgba(255,255,255,0.95)') => {
    const paths = {
      book: (<>
        <path d="M12 7c-1.4-1.2-3.2-1.9-5.2-1.9H4v12.4h2.8c2 0 3.8.7 5.2 1.9" />
        <path d="M12 7c1.4-1.2 3.2-1.9 5.2-1.9H20v12.4h-2.8c-2 0-3.8.7-5.2 1.9" />
        <path d="M12 7v12.4" />
      </>),
      graph: (<>
        <path d="M4.5 3.5v16h16" />
        <path d="M7.2 16.6c2.6 0 3.2-8.2 5.7-8.2 2 0 2.9 3.5 5.3 3.5" />
      </>),
      globe: (<>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 3.5c2.4 2.3 3.7 5.4 3.7 8.5s-1.3 6.2-3.7 8.5c-2.4-2.3-3.7-5.4-3.7-8.5S9.6 5.8 12 3.5Z" />
        <path d="M3.5 12h17" />
      </>),
      temple: (<>
        <path d="M3.4 9.4 12 4.3l8.6 5.1" />
        <path d="M5 9.4h14" />
        <path d="M7 9.4v9.2M12 9.4v9.2M17 9.4v9.2" />
        <path d="M3.6 19.7h16.8" />
      </>),
      flask: (<>
        <path d="M9.2 3.6v5.3L4.6 17a2.2 2.2 0 0 0 1.9 3.3h11a2.2 2.2 0 0 0 1.9-3.3l-4.6-8.1V3.6" />
        <path d="M8 3.6h8" />
        <path d="M6.7 14.6h10.6" />
      </>),
    };
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
           stroke={stroke} strokeWidth="1.5"
           strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {paths[kind]}
      </svg>
    );
  };

  // 보험/랜딩 UI 라인 아이콘. subjectIcon 과 같은 언어(24 그리드·라운드캡)이되 색·굵기를 파라미터로 받는다.
  uiIcon = (kind, size = 22, stroke = 'currentColor', sw = 1.6) => {
    const paths = {
      // 랜딩 혜택 밴드
      play: (<><circle cx="12" cy="12" r="9" /><path d="M10 8.5l5.5 3.5L10 15.5z" /></>),
      book: (<><path d="M4 5.2A2 2 0 0 1 6 4h5v15H6a2 2 0 0 0-2 1.4z" /><path d="M20 5.2A2 2 0 0 0 18 4h-5v15h5a2 2 0 0 1 2 1.4z" /></>),
      chart: (<><path d="M4.5 4v15.5H20" /><rect x="8" y="11" width="2.6" height="5.5" rx="0.6" /><rect x="13.4" y="7.5" width="2.6" height="9" rx="0.6" /></>),
      refund: (<><path d="M4 12a8 8 0 1 1 2.5 5.8" /><path d="M4 12.5V8M4 12.5H8.4" /></>),
      // 프로세스(HOW IT WORKS)
      cart: (<><circle cx="9.5" cy="19" r="1.3" /><circle cx="17" cy="19" r="1.3" /><path d="M3.5 4h2l2.1 10.4a1.4 1.4 0 0 0 1.4 1.1h7.2a1.4 1.4 0 0 0 1.4-1.1L20 7H6.2" /></>),
      docCheck: (<><path d="M13 3.5H7A1.8 1.8 0 0 0 5.2 5.3v13.4A1.8 1.8 0 0 0 7 20.5h10a1.8 1.8 0 0 0 1.8-1.8V9.3z" /><path d="M13 3.5V9h5.5" /><path d="M8.6 14.2l2 2 3.4-3.8" /></>),
      chartUp: (<><path d="M4.5 4v15.5H20" /><path d="M7.5 15.5l3.4-3.8 2.6 2.2 4-5" /><path d="M17.5 8.9h2v2" /></>),
      shieldCheck: (<><path d="M12 3.2l6.5 2.4v5c0 4.2-2.8 7.4-6.5 8.7-3.7-1.3-6.5-4.5-6.5-8.7v-5z" /><path d="M9.2 11.6l2 2 3.6-4" /></>),
      // 핵심요약(KEY POINTS)
      target: (<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4.2" /><circle cx="12" cy="12" r="0.8" fill={stroke} stroke="none" /></>),
      clipboard: (<><rect x="6" y="5" width="12" height="15.5" rx="2" /><path d="M9 5V3.8A1.3 1.3 0 0 1 10.3 2.5h3.4A1.3 1.3 0 0 1 15 3.8V5" /><path d="M9 10.5h6M9 14h6M9 17.5h3.5" /></>),
      calculator: (<><rect x="5.5" y="3" width="13" height="18" rx="2" /><path d="M8 6.5h8" /><circle cx="8.4" cy="11" r="0.9" fill={stroke} stroke="none" /><circle cx="12" cy="11" r="0.9" fill={stroke} stroke="none" /><circle cx="15.6" cy="11" r="0.9" fill={stroke} stroke="none" /><circle cx="8.4" cy="14.4" r="0.9" fill={stroke} stroke="none" /><circle cx="12" cy="14.4" r="0.9" fill={stroke} stroke="none" /><circle cx="15.6" cy="14.4" r="0.9" fill={stroke} stroke="none" /><rect x="7.6" y="17" width="8.8" height="2" rx="1" fill={stroke} stroke="none" /></>),
      ruleCheck: (<><path d="M13 3.5H7A1.8 1.8 0 0 0 5.2 5.3v13.4A1.8 1.8 0 0 0 7 20.5h10a1.8 1.8 0 0 0 1.8-1.8V9.3z" /><path d="M13 3.5V9h5.5" /><path d="M8.2 12.2l1.3 1.3 2.3-2.5" /><path d="M8.4 16.3l2.6 2.6M11 16.3l-2.6 2.6" /></>),
      // 보장 제외 — 모든 행 공통 마커(‘지급 안 됨’)
      xCircle: (<><circle cx="12" cy="12" r="8.5" /><path d="M9 9l6 6M15 9l-6 6" /></>),
      // 문서 바로가기
      fileText: (<><path d="M13 3.5H7A1.8 1.8 0 0 0 5.2 5.3v13.4A1.8 1.8 0 0 0 7 20.5h10a1.8 1.8 0 0 0 1.8-1.8V9.3z" /><path d="M13 3.5V9h5.5" /><path d="M8.5 12.5h7M8.5 15.5h7M8.5 9.5h2.5" /></>),
      search: (<><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l4.5 4.5" /></>),
      // 앱 하단 탭바
      home: (<><path d="M4 10.5L12 4l8 6.5" /><path d="M6 9.7V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.7" /><path d="M10 20v-5.2h4V20" /></>),
      user: (<><circle cx="12" cy="8.4" r="3.6" /><path d="M5 20c.6-3.7 3.5-5.6 7-5.6s6.4 1.9 7 5.6" /></>),
      // 공감 말풍선 옆 — 걱정하는 학부모/학생 얼굴(라인 스타일, 브랜드 톤)
      worry: (<><circle cx="12" cy="12" r="9" /><path d="M8.2 9.1l2 0.9" /><path d="M15.8 9.1l-2 0.9" /><circle cx="9.4" cy="12.1" r="0.7" fill={stroke} stroke="none" /><circle cx="14.6" cy="12.1" r="0.7" fill={stroke} stroke="none" /><path d="M9.5 16.1Q12 14.4 14.5 16.1" /></>),
      // 웹툰식 걱정 얼굴 — 큰 눈 + 처진 눈썹 + 살짝 찡그린 입 + 땀방울
      worry1: (<><circle cx="11.3" cy="12.6" r="8.2" /><path d="M7.5 9.9l2 0.7" /><path d="M15.1 9.9l-2 0.7" /><circle cx="8.9" cy="12.8" r="1.15" fill={stroke} stroke="none" /><circle cx="13.7" cy="12.8" r="1.15" fill={stroke} stroke="none" /><path d="M9.3 16.5Q11.3 15.2 13.3 16.5" /><path d="M18.6 5.4C19.7 7 19.7 8.6 18.6 8.6C17.5 8.6 17.5 7 18.6 5.4Z" fill={stroke} stroke="none" /></>),
      // 웹툰식 당황 얼굴 — 큰 눈 + 올라간 눈썹 + 작게 벌린 입(o) + 땀방울
      worry2: (<><circle cx="11.3" cy="12.6" r="8.2" /><path d="M7.5 9.5l2 -0.5" /><path d="M15.1 9.5l-2 -0.5" /><circle cx="8.9" cy="12.7" r="1.2" fill={stroke} stroke="none" /><circle cx="13.7" cy="12.7" r="1.2" fill={stroke} stroke="none" /><ellipse cx="11.3" cy="16.2" rx="1.05" ry="1.35" /><path d="M18.6 5.4C19.7 7 19.7 8.6 18.6 8.6C17.5 8.6 17.5 7 18.6 5.4Z" fill={stroke} stroke="none" /></>),
      slipFace: (<><circle cx="12" cy="12.3" r="8.8" /><path d="M7.6 9.4l2.9 1.1" /><path d="M16.4 9.4l-2.9 1.1" /><path d="M8.1 12.9h2.7" /><path d="M13.2 12.9h2.7" /><path d="M8.8 16.8q3.2-1.9 6.4 0" /><path d="M18.7 7.2c1.2 1.6 1.1 2.9 0 2.9s-1.2-1.3 0-2.9z" fill={stroke} stroke="none" /></>),
      swingFace: (<><circle cx="12" cy="12.3" r="8.8" /><path d="M7.7 9.6q1.6-1 3.2 0" /><path d="M13.1 9.6q1.6 1 3.2 0" /><circle cx="9.3" cy="12.7" r="1.25" fill={stroke} stroke="none" /><circle cx="14.7" cy="12.7" r="1.25" fill={stroke} stroke="none" /><path d="M9.3 16.5q2.7 1.4 5.4 0" /></>),
      heavyFace: (<><circle cx="12" cy="12.5" r="8.8" /><path d="M7.9 10.2q1.4-1 2.8 0" /><path d="M13.3 10.2q1.4-1 2.8 0" /><path d="M8.4 13.2h2.1" /><path d="M13.5 13.2h2.1" /><path d="M8.8 17q3.2-.6 6.4 0" /></>),
      moneyFace: (<><circle cx="12" cy="12.4" r="8.8" /><path d="M7.2 8.9q1.6-2.4 3.4-1.4" /><path d="M16.8 8.9q-1.6-2.4-3.4-1.4" /><circle cx="9.2" cy="12.9" r="1" fill={stroke} stroke="none" /><circle cx="14.8" cy="12.9" r="1" fill={stroke} stroke="none" /><ellipse cx="12" cy="17.3" rx="2.5" ry="2.7" /></>),
    };
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
           stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {paths[kind]}
      </svg>
    );
  };

  // 공감 말풍선 강조어 — 단어 의미가 보이도록 웹툰풍(과하지 않게) 그린 톤 스타일.
  fxWord = (text, fx, key) => {
    if (fx === 'tilt') {   // 삐끗 — 살짝 기울여 진짜 삐끗한 느낌
      return <span key={key} style={S("display:inline-block;font-weight:800;color:#0B7A4A;font-style:italic;transform:rotate(-7deg);transform-origin:60% 100%")}>{text}</span>;
    }
    if (fx === 'heavy') {  // 부담 — 배경 없이, 글자 자체를 굵고 눌린 느낌 + 아래쪽 짧은 진한 그림자로 무게감
      return <span key={key} style={S("display:inline-block;font-weight:900;color:#00331E;font-size:1.08em;letter-spacing:-0.8px;transform:translateY(1px);text-shadow:0 2px 1px rgba(0,51,30,0.4)")}>{text}</span>;
    }
    if (fx === 'wave') {   // 오르락내리락 — 글자가 위아래로 출렁이는 배열
      return <span key={key} style={S("display:inline-block;white-space:nowrap;font-weight:800;color:#0B7A4A")}>
        {[...text].map((ch, ci) => (
          <span key={ci} style={S(`display:inline-block;transform:translateY(${ci % 2 === 0 ? '-3px' : '3px'}) rotate(${ci % 2 === 0 ? '-5deg' : '5deg'})`)}>{ch}</span>
        ))}
      </span>;
    }
    if (fx === 'grow') {   // 수백만~수천만 — 뒤로 갈수록 금액이 커지는 느낌
      const words = text.split(' '); const n = words.length;
      return <span key={key}>
        {words.map((w, wi) => {
          const t = n > 1 ? wi / (n - 1) : 1;
          const size = (1.0 + t * 0.42).toFixed(3);
          const col = t < 0.5 ? '#12915B' : '#00462A';
          const weight = 700 + Math.round(t * 2) * 100;
          return <React.Fragment key={wi}>
            <span style={S(`display:inline-block;white-space:nowrap;font-size:${size}em;font-weight:${weight};color:${col};letter-spacing:-0.5px`)}>{w}</span>
            {wi < n - 1 ? ' ' : ''}
          </React.Fragment>;
        })}
      </span>;
    }
    return <React.Fragment key={key}>{text}</React.Fragment>;
  };

  // 티어 비교표 폴백 — 백엔드(/api/tiers)가 꺼진 정적 배포에서도 표가 보이도록.
  // 게시용 기준값: 약관 별표4 "단계별 적용 및 티어별 결과" 표(중증 보장금·영업보험료·월납).
  //   경증 보장금 = 중증 × 50%(약관 보장내용: 경증 6개월분 / 중증 12개월분 × 보장률 70%).
  // 게시값 출처: 약관 별표4 "티어별 결과" 표 (고1 3월 최초 가입 · 보장률 70% · 납입 33개월).
  // 백엔드 engine.tier_table() 이 오차 없이 재현하는 값과 동일하다.
  tierFallback = [
    { tier: '라이트',   form: '독학재수',   cover_mild: 2100000,  cover_severe: 4200000,  monthly_premium: 1808 },
    { tier: '스탠다드', form: '단과 통학',  cover_mild: 4200000,  cover_severe: 8400000,  monthly_premium: 3262 },
    { tier: '플러스',   form: '재종합학원', cover_mild: 7014000,  cover_severe: 14028000, monthly_premium: 5209 },
    { tier: '프리미엄', form: '기숙학원',   cover_mild: 10500000, cover_severe: 21000000, monthly_premium: 7622 },
  ];
  // 대표 강사 — 랜딩 라인업 카드와 '전체 강사 보기' 페이지가 같은 배열을 쓴다.
  //   n·s·img : 랜딩 카드가 쓰는 이름·과목·사진   tag : 카드 좌상단 홍보문구
  //   career~quote : 전체 강사 페이지에서만 쓰는 상세 소개
  instructors = [
    { n:'차미래', s:'국어', c:'#5B7CFA', icon:'book',
      tag:'국어의 기준을\n세우는\n미래 CLASS', img:'/instructors/cha-mirae-angled-clean.png', thumb:'/instructors/thumb/cha-mirae-angled-clean.png', cut:'/instructors/cutout/cha-mirae-angled-clean.png', focusX:71,
      years:'강의 12년', field:'문학 · 독서 · 화법과 작문',
      career:['前 대치 국어논술 대표강사', '수능 국어 분석서 「기준」 집필', '누적 수강생 21만 명'],
      style:'지문을 읽는 순서와 선지를 지우는 기준부터 세웁니다. 감으로 고르던 판단을 문장 근거로 바꾸는 데 한 학기를 씁니다.',
      courses:['개념의 기준 — 문학 전 갈래', '독서 지문 구조 훈련', '수능 실전 화작 100제'],
      quote:'국어는 재능이 아니라 기준의 문제예요. 기준이 서면 점수는 흔들리지 않습니다.',
      // 상세 페이지 전용 — 슬로건 · 한 줄 설명 · 요약 경력 3블록 · 짧은 태그 · 짧은 인용
      slogan:'감이 아닌 근거로 답을 찾는 국어',
      blurb:'지문을 읽는 순서부터 선지를 판단하는 기준까지 체계적으로 훈련합니다.',
      careerBlocks:[['경력','12년'],['수강생','21만 명'],['전문 영역','문학·독서']],
      chips:['문학의 기준', '독서 구조 분석', '수능 실전 100제'],
      quoteShort:'불안한 순간에도 끝까지 흔들리지 않는 기준을 만들어 드리겠습니다.',
      students:'218만 명', mainCourse:'[고3·2·N수] 수능 (문제풀이)' },
    { n:'이윤서', s:'수학', c:'#0B8F58', icon:'graph',
      tag:'막힌 수학을\n뚫어내는\n윤서 ROUTE', img:'/instructors/yunseo-math-card-polished.png?v=3', thumb:'/instructors/thumb/yunseo-math-card-polished.png', cut:'/instructors/cutout/yunseo-math-card-polished.png', focusX:48,
      years:'강의 10년', field:'수학Ⅰ · 수학Ⅱ · 미적분',
      career:['前 강남대성 수학과 전임', '「루트」 시리즈 저자', '학습 상담 누적 8천 건'],
      style:'막히는 지점을 유형이 아니라 풀이 순서로 정리합니다. 손이 멈췄을 때 다음에 무엇을 할지 알게 만드는 수업입니다.',
      courses:['수학Ⅰ·Ⅱ 개념 루트', '4점 문항 접근법', '미적분 킬러 해체'],
      quote:'안 풀리는 게 아니라 순서를 모르는 겁니다. 순서만 잡아도 절반은 풀려요.',
      slogan:'막힘이 아니라 순서로 푸는 수학',
      blurb:'풀이가 멈추는 지점마다 다음 단계를 판단하는 순서를 세워 훈련합니다.',
      careerBlocks:[['경력','10년'],['상담 누적','8천 건'],['전문 영역','수학Ⅰ·Ⅱ·미적분']],
      chips:['개념 루트', '4점 공략', '킬러 해체'],
      quoteShort:'막힌 문제 앞에서도 다음 순서가 보이게 만들어 드리겠습니다.',
      students:'203만 명', mainCourse:'약점체크 2027 드릴 ◆ 실전 문제풀이 훈련' },
    { n:'박혜준', s:'영어', c:'#2B4FE8', icon:'globe',
      tag:'영어 고민을\n때려잡는\n혜준 CRUSH', img:'/instructors/park-hyejun.png', thumb:'/instructors/thumb/park-hyejun.png', cut:'/instructors/cutout/park-hyejun.png', focusX:66,
      years:'강의 9년', field:'독해 · 어법 · 듣기',
      career:['前 종로학원 영어과 강사', 'EBS 연계교재 집필 참여', '모의고사 해설 누적 400회'],
      style:'구문을 외우게 하지 않습니다. 문장이 이어지는 흐름을 따라가 지문 끝까지 밀고 가는 힘을 만듭니다.',
      courses:['구문 독해 크러시', '빈칸·순서 집중반', '수능 어법 30제'],
      quote:'해석이 아니라 흐름입니다. 흐름을 잡으면 모르는 단어가 나와도 안 멈춰요.',
      slogan:'해석이 아니라 흐름으로 읽는 영어',
      blurb:'문장이 이어지는 흐름을 따라가 지문 끝까지 밀고 가는 힘을 기릅니다.',
      careerBlocks:[['경력','9년'],['해설 누적','400회'],['전문 영역','독해·어법·듣기']],
      chips:['구문 독해', '빈칸·순서', '어법 30제'],
      quoteShort:'모르는 단어가 나와도 끝까지 흐름을 놓치지 않게 만들어 드리겠습니다.',
      students:'227만 명', mainCourse:'고1, 고2, 고3을 위한 2026년 모의고사 변형 강좌◆' },
    { n:'한희지', s:'한국사', c:'#B7791F', icon:'temple',
      tag:'역사의 흐름을\n한눈에 잡는\n희지 FLOW', img:'/instructors/han-heeji-history-card.png?v=1', thumb:'/instructors/thumb/han-heeji-history-card.png', cut:'/instructors/cutout/han-heeji-history-card.png', focusX:57,
      years:'강의 8년', field:'한국사 · 동아시아사',
      career:['한국사능력검정 대비서 집필', '역사 교양 채널 구독 12만', '고교 특강 300회'],
      style:'연표를 외우는 대신 사건을 원인과 결과로 잇습니다. 한 번 이어두면 문제에서 먼저 떠오릅니다.',
      courses:['흐름으로 잡는 한국사', '사료 독해 특강', '수능 한국사 파이널'],
      quote:'외운 역사는 시험장에서 사라져요. 이어진 역사는 남습니다.',
      slogan:'외우지 않고 이어서 기억하는 한국사',
      blurb:'사건을 원인과 결과로 이어두면 문제에서 먼저 떠오르게 만듭니다.',
      careerBlocks:[['경력','8년'],['채널 구독','12만'],['전문 영역','한국사·동아시아사']],
      chips:['흐름 정리', '사료 독해', '파이널 정리'],
      quoteShort:'시험장에서도 잊히지 않는 역사의 흐름을 만들어 드리겠습니다.',
      students:'201만 명', mainCourse:'[한국사 수능] 평가원과 수험생을 연결하다' },
    { n:'최지현', s:'사회탐구', c:'#B03A5B', icon:'temple',
      tag:'사탐 개념을\n꿰뚫는\n지현 READ', img:'/instructors/choi-jihyun-fixed.png', thumb:'/instructors/thumb/choi-jihyun-fixed.png', cut:'/instructors/cutout/choi-jihyun-fixed.png', focusX:71,
      years:'강의 11년', field:'사회문화 · 생활과 윤리',
      career:['前 메가스터디 사탐 대표강사', '「도표로 읽는 사회문화」 저자', '오답 유형 데이터 6만 건 분석'],
      style:'개념을 사례와 붙여 정리합니다. 헷갈리던 선지가 눈에 걸리기 시작하면 실전에서 시간이 줄어듭니다.',
      courses:['사회문화 개념 리드', '도표 분석 집중반', '실전 선지 훈련'],
      quote:'사탐은 암기 과목이 아니라 구분 과목이에요. 구분이 되면 빨라집니다.',
      slogan:'암기가 아니라 구분으로 푸는 사회탐구',
      blurb:'개념을 사례와 함께 정리해 헷갈리던 선지를 구분하는 눈을 길러줍니다.',
      careerBlocks:[['경력','11년'],['오답 데이터','6만 건'],['전문 영역','사회문화·생활과 윤리']],
      chips:['개념 정리', '도표 분석', '선지 훈련'],
      quoteShort:'헷갈리는 선지도 망설임 없이 구분할 수 있게 만들어 드리겠습니다.',
      students:'212만 명', mainCourse:'[사회문화 개념완성] 시작부터 탄탄하게 최적의 시작!' },
    { n:'노재희', s:'과학탐구', c:'#7A5BFA', icon:'flask',
      tag:'과탐 고민을\n뿌리뽑는\n재희 SOLVE', img:'/instructors/no-jaehee.png', thumb:'/instructors/thumb/no-jaehee.png', cut:'/instructors/cutout/no-jaehee.png', focusX:68,
      years:'강의 9년', field:'생명과학Ⅰ · 지구과학Ⅰ',
      career:['前 시대인재 과탐 전임', '수능 과탐 자료해석 특강 개설', '재수생 대상 강의 6년'],
      style:'공식보다 원리를 먼저 세웁니다. 처음 보는 자료가 나와도 어디부터 읽을지 알게 만드는 게 목표입니다.',
      courses:['생명과학Ⅰ 원리 솔브', '유전 계산 집중반', '지구과학 자료해석'],
      quote:'낯선 자료는 늘 나옵니다. 당황하지 않는 훈련이 곧 점수예요.',
      slogan:'공식이 아니라 원리로 푸는 과학탐구',
      blurb:'처음 보는 자료가 나와도 어디부터 읽어야 할지 판단하는 힘을 기릅니다.',
      careerBlocks:[['경력','9년'],['재수생 강의','6년'],['전문 영역','생명과학Ⅰ·지구과학Ⅰ']],
      chips:['원리 정리', '유전 계산', '자료 해석'],
      quoteShort:'낯선 자료 앞에서도 당황하지 않는 힘을 길러 드리겠습니다.',
      students:'209만 명', mainCourse:'[수능 생명과학I] 점수를 끌어올리는 기출·문제 풀이', cardSubject:'생명과학' },
  ];
  // 티어별 색 — 보장이 커질수록 이화그린이 진해지도록 라이트→프리미엄 순으로 명도를 낮춘다.
  //   ink   : 티어명·금액 등 글자색   line: 테두리   tint: 셀 배경   btn: 버튼 그라디언트
  tierScale = [
    { ink: '#3E9E74', line: '#BEE3CE', tint: 'rgba(62,158,116,0.12)',  btn: 'linear-gradient(135deg,#3E9E74,#57B189)' },
    { ink: '#1F8659', line: '#9FD3B8', tint: 'rgba(31,134,89,0.15)',   btn: 'linear-gradient(135deg,#1F8659,#35A272)' },
    { ink: '#0B7A4A', line: '#84C2A3', tint: 'rgba(11,122,74,0.18)',   btn: 'linear-gradient(135deg,#0B7A4A,#1B8258)' },
    { ink: '#00462A', line: '#6BB08F', tint: 'rgba(0,70,42,0.20)',     btn: 'linear-gradient(135deg,#00462A,#0A5F3C)' },
  ];
  // 티어별 추천 대상 한 줄 (표의 맨 아랫줄)
  tierFor = {
    라이트: '인강·독서실 위주로 스스로 하는 학생',
    스탠다드: '약점 과목만 단과로 보완하는 학생',
    플러스: '재종합반 통학을 염두에 둔 학생',
    프리미엄: '전일제 기숙까지 대비하려는 학생',
  };

  // 랜딩 — 가입부터 보장까지의 흐름 (4단계)
  flowSteps = [
    { icon: 'search', title: '보험 자세히 알아보기', desc: '보험 상세 페이지에서 보장 내용과 약관을 확인하고, 약관 동의 후 청약서를 작성하면 가입이 완료돼요.' },
    { icon: 'docCheck', title: '모의고사 성적 연동', desc: '교육청·평가원 원본 성적을 등록하면 과목별 변동성과 예상 백분위를 분석해요.' },
    { icon: 'chartUp', title: '보험료 산정', desc: '가구소득·거주지역·월교육비 등 비성적 객관 지표를 기준으로 산정해요.' },
    { icon: 'shieldCheck', title: '급락 시 재수비용 지급', desc: '수능 백분위가 예측 밴드를 벗어나고 실제 재수가 확인되면 비용을 보장해요.' },
  ];

  // 약관·상품설명서·청약서 원문 (public/policy/jaesoo-policy.html). 문서 내 앵커로 바로 이동한다.
  // 약관 원문은 백엔드 RAG 가 인덱싱하는 것과 **같은 파일**을 쓴다
  // (scripts/sync-policy.mjs 가 api/policy → public/policy 로 복사).
  // 조항 id 앵커가 있어 #앵커로 해당 조항까지 바로 스크롤된다.
  policyUrl = POLICY_DOC;
  applicationUrl = 'policy/jaesoo-application.html';

  // 보험 상세 — 가입 전 핵심 요약 3카드. 문구는 전부 첨부 약관·상품설명서 원문 근거.
  keyPoints = [
    { icon: 'shieldCheck', title: '보장 대상',
      lead: '재수 가능성과 학습 성취 관련 위험에 대비하는 교육보험입니다.',
      points: [
        '평소 실력대로라면 나왔을 성적(밴드)보다 수능 성적이 크게 급락하고',
        '그 결과 실제로 재수를 하게 되면 보험금을 지급해요',
        '떨어진 정도에 따라 경증·중증으로 나눠 지급하고, 보장은 최초 1회예요',
      ],
      ref: '보통약관 제13조 · 보장내용' },
    { icon: 'calculator', title: '보험료 산정',
      lead: '비성적 객관 지표와 가입 시점 등을 반영해 개인별로 산정합니다.',
      points: [
        '가구소득·거주지역·월교육비 3개 지표를 증빙서류로 확인해요',
        '성적 자료는 급락 사고 판정에 쓰고 보험료 스코어카드에는 다시 넣지 않아요',
        '임계값·점수표·안전할증 등 파라미터는 사전 확정·공시 기준을 따릅니다',
      ],
      ref: '보통약관 제22조 · 상품설명서 03·13' },
    { icon: 'ruleCheck', title: '보장 · 제한',
      lead: '지급 사유, 부지급 사유, 갱신 조건은 약관과 상품설명서를 기준으로 적용합니다.',
      body: '고의에 의한 성적 급락, 재수 미이행, 선언 과목 미응시, 부정행위로 인한 성적 무효, 고지의무 위반, 성적 자료 미제출, 진로 변경 등은 보험금 지급이 제한됩니다.',
      ref: '보통약관 제15조 · 지급제한사항' },
  ];

  // 보험 상세 — 청약서 작성 전 준비할 정보 (청약서 Ⅰ~Ⅷ 구성 그대로)
  applyPrep = [
    { no: '1', title: '계약자 / 피보험자 정보', desc: '성명·생년월일·연락처와 피보험자와의 관계. 피보험자가 미성년자인 경우 법정대리인 정보를 함께 기재합니다.' },
    { no: '2', title: '가입자격 확인', desc: '현재 학년, 대기기간 안내 확인, 성적자료 제출 동의, 요율지표 증빙서류 제출 동의. 성적자료·증빙서류 제출에 동의하지 않으면 가입이 불가합니다.' },
    { no: '3', title: '고지사항', desc: '학업 중단·휴학·유급 이력, 학업에 지장을 주는 질병·장애, 타사 유사보험 가입 여부, 수능 외 진로 계획 등 4개 문항.' },
    { no: '4', title: '요율 산출 문항', desc: '가구소득, 거주지역(학원밀집도지수), 월교육비 3개 항목만 보험료 산출에 사용합니다. 성적은 급락(사고) 판정에만 사용됩니다.' },
    { no: '5', title: '응시과목 선언', desc: '고3 9월 갱신(최종 갱신) 시점에 최소 2과목 이상 선언하며, 선언 이후에는 변경할 수 없습니다.' },
    { no: '6', title: '개인정보 동의', desc: '필수 항목과 선택 항목을 구분해 동의합니다. 통계·검증용 선택 문항은 보험료에 반영되지 않습니다.' },
    { no: '7', title: '전자서명', desc: '계약자(법정대리인) 성명을 다시 입력하면 전자서명을 대신합니다. 피보험자가 미성년자이므로 법정대리인 서명으로 진행됩니다.' },
  ];

  // 랜딩 — 자주 묻는 질문
  faqs = [
    { q: '어떤 경우에 보험금을 받나요?', a: '수능 백분위가 가입 기간 동안 예측한 밴드의 하단을 벗어날 정도로 떨어지고, 실제로 재수를 하는 것이 확인되면 지급됩니다. 하단을 벗어난 정도에 따라 경증·중증으로 나뉘어 보장 금액이 달라져요. 성적이 떨어져도 재수를 하지 않으면 지급 대상이 아닙니다.' },
    { q: '보험료는 어떻게 정해지나요?', a: '보험료 스코어카드는 가구소득·거주지역·월교육비 3개 비성적 객관 지표를 기준으로 산정합니다. 모의고사·수능 성적은 급락 사고 판정에만 사용하고 보험료 산출에는 다시 넣지 않아요. 임계값과 점수표, 안전할증, 상한 기준은 약관과 별표에 따라 사전 확정·공시됩니다.' },
    { q: '언제까지 가입할 수 있나요?', a: '고등학교 1학년부터 가입할 수 있고, 고3 6월 모의평가 이후에는 신규 가입이 제한됩니다. 6월 모의평가는 졸업생(재수생)이 함께 응시해 실제 경쟁 위치가 드러나는 시점이라, 그 이후의 가입은 받지 않습니다. 별도의 면책 대기기간은 없습니다. 사고 자체가 수능 시험 이후에만 성립하기 때문이에요.' },
    { q: '보험금은 어떻게 지급되나요?', a: '보통약관은 경증·중증으로 나누어 보험가입금액을 지급하며, 최초 1회한이고 경증과 중증은 중복 지급하지 않습니다. 스탠다드 기준 경증 420만원, 중증 840만원이 예시입니다. 재수학원비 지원 특약(실손형)은 가입 완료 후 재수없수 앱에서 별도로 신청할 수 있는 선택형 특약으로, 실제 납부한 수강료를 영수증 기준 실비로 연간 한도 내에서 보상받을 수 있어요.' },
    { q: '중간에 해지할 수 있나요?', a: '네. 보험증권을 받은 날부터 15일 이내에는 청약철회로 납입한 보험료 전액을 3영업일 이내에 돌려받을 수 있습니다. 그 이후의 해지도 가능하지만, 해지 시점이 수능에 가까울수록 환급률이 낮아지도록 설계되어 있어요. 수능 직전의 선택적 해지를 막기 위한 장치입니다.' },
    { q: '성적 데이터는 어디에 쓰이나요?', a: '성적 데이터는 급락 사고 판정과 보험금 지급 심사에 사용하며, 보험료 스코어카드에는 재투입하지 않습니다. 급락 판정에는 교육청·평가원 원본 성적을 사용하고, 학원 자체 모의고사는 쓰지 않아요. 선택 참고문항은 포트폴리오 통계 분석 목적으로 분리 관리됩니다.' },
  ];

  // 화면에서 쓰는 값만 모아 넘긴다. (원본의 renderVals 중 웹 화면이 참조하는 항목만)
  renderVals() {
    const s = this.state;
    const fmtWon = n => n.toLocaleString('ko-KR') + '만원';
    // 백엔드(/api/tiers)가 꺼져 있으면 폴백 표로 대체 — 정적 배포에서도 표가 보이도록.
    // 백엔드는 cover_severe, 화면 코드는 cover_sev 를 쓰므로 여기서 한 번만 정규화한다.
    const tierSrc = ((s.tiers && s.tiers.length) ? s.tiers : this.tierFallback)
      .map(t => ({ ...t, cover_sev: t.cover_severe ?? t.cover_sev }));

    return {
      // ── 화면 전환 ──
      entry: s.entry,
      payBackEntry: s.payBackEntry || 'landing',
      entryGo: (screen, payBackEntry = null) => {
        // 기존엔 여기서 'pay' 를 막고 있었고 pay 로 보내는 함수는 아무도 호출하지 않아
        // 인강 결제 화면에 도달할 수 없었다. pickPass() 로 패스를 고르면 진입한다.
        this.setState(st => {
          const shouldResetApply = (st.entry === 'apply' && screen !== 'done') || screen === 'apply';
          return {
            entry: screen,
            payBackEntry: payBackEntry || (st.payBackEntry || 'landing'),
            apply: shouldResetApply ? this.resetApplyForm() : st.apply,
          };
        }, () => {
          // 화면을 바꿔도 스크롤 위치가 남아 있어, 랜딩 중간에서 넘어가면
          // 새 화면도 중간부터 보였다. 새 화면은 항상 맨 위에서 시작한다.
          try { window.scrollTo(0, 0); } catch (e) { /* SSR·구형 브라우저 */ }
        });
      },
      navWeb: () => { try { window.history.pushState({}, '', '/'); } catch (e) {} this.setState({ entry: 'landing' }); },

      // ── 랜딩 히어로 배너 ──
      heroSlide: s.heroSlide,
      goHeroSlide: (i) => this.setState({ heroSlide: i }),
      pauseHero: () => this.setState({ heroPaused: true }),
      resumeHero: () => this.setState({ heroPaused: false }),

      // ── 랜딩·보험 소개 콘텐츠 ──
      flowSteps: this.flowSteps,
      keyPoints: this.keyPoints,
      applyPrep: this.applyPrep,
      policyUrl: this.policyUrl,
      applicationUrl: this.applicationUrl,
      anchors: POLICY_ANCHORS,
      faqs: this.faqs.map((f, i) => ({
        ...f,
        open: s.openFaq === i,
        onClick: () => this.setState(st => ({ openFaq: st.openFaq === i ? null : i })),
      })),

      // ── 티어 비교표 ──
      tiers: s.tiers,
      tierRows: tierSrc.map((t, ti) => {
        // 중증 보장 = 연 재수비용의 70%(engine.COVER_RATE) → 역산해 연 비용을 얻는다.
        const annualWon = Math.round(t.cover_sev / 0.7);
        const c = this.tierScale[Math.min(ti, this.tierScale.length - 1)];
        return {
          tier: t.tier,
          form: t.form,
          ink: c.ink, line: c.line, tint: c.tint, btn: c.btn,
          forWhom: this.tierFor[t.tier] || '',
          // 원값도 노출한다 — 티어 상세 카드가 cover_mild/cover_sev 를 직접 읽는다
          cover_mild: t.cover_mild,
          cover_sev: t.cover_sev,
          monthly_premium: t.monthly_premium,
          sevLabel: fmtWon(t.cover_sev / 10000),
          mildLabel: fmtWon(t.cover_mild / 10000),
          premiumLabel: t.monthly_premium.toLocaleString('ko-KR'),
          annualWon,
          annualLabel: fmtWon(Math.round(annualWon / 10000)),
          selfLabel: fmtWon(Math.round((annualWon - t.cover_sev) / 10000)),
        };
      }),
      costBars: (() => {
        const rows = tierSrc.map(t => {
          const annualWon = Math.round(t.cover_sev / 0.7);
          return { form: t.form, annualWon, annualLabel: fmtWon(Math.round(annualWon / 10000)) };
        }).sort((a, b) => a.annualWon - b.annualWon);
        const max = Math.max(...rows.map(r => r.annualWon)) || 1;
        return {
          rows: rows.map(r => ({ ...r, pct: Math.round(r.annualWon / max * 100) })),
          minLabel: rows[0].annualLabel,
          maxLabel: rows[rows.length - 1].annualLabel,
        };
      })(),
      expandedTier: s.expandedTier,
      toggleTierDetail: (name) => this.setState(st => ({ expandedTier: st.expandedTier === name ? null : name })),
      applyTierTableOpen: s.applyTierTableOpen,
      toggleApplyTierTable: () => this.setState(st => ({ applyTierTableOpen: !st.applyTierTableOpen })),

      // ── 가입 완료 ──
      enrolledId: s.enrolledId,
      enrolledQuote: s.enrolledQuote,
      // 앱으로 넘길 딥링크. student_id 를 실어 앱이 이 계약을 바로 불러오게 한다.
      appUrl: APP_URL + (s.enrolledId ? `?student_id=${encodeURIComponent(s.enrolledId)}` : ''),
      // ── 청약 제출 실패 안내 (기존엔 실패해도 성공처럼 넘어갔다) ──
      enrollError: s.enrollError,
      retryEnroll: () => this.submitEnroll(),
      skipEnrollError: this.skipEnrollError,
      dismissEnrollError: () => this.setState({ enrollError: null }),

      // ── 요율 3문항 선택지 (약관 별표4). 라벨↔대표금액은 상단 상수 한 곳에서만 정의 ──
      incomeOptions: INCOME_BANDS.map(b => b.label),
      eduCostOptions: EDU_COST_BANDS.map(b => b.label),
      // 백엔드 /api/regions 로 갱신되며, 실패 시 REGION_BANDS 기본값을 쓴다
      regionOptions: (s.regionChoices || REGION_BANDS).map(
        r => REGION_BANDS.find(b => b.value === (r.value || r))?.label || r.label || r,
      ),

      // ── 가입 시점 (별표2) — 늦게 들수록 할증 + 분납 단축 ──
      enrollWindows: ENROLL_WINDOWS.map(w => ({
        ...w,
        selected: s.remainingMonths === w.months,
        onClick: () => this.setState({ remainingMonths: w.months }, this.loadTiers),
      })),
      remainingMonths: s.remainingMonths,
      remainingLabel: (ENROLL_WINDOWS.find(w => w.months === s.remainingMonths) || ENROLL_WINDOWS[0]).label,
      lateSurchargePct: s.quoteMeta ? Math.round((s.quoteMeta.theta - 0.24) * 100) : 0,
      backendDown: s.backendDown,

      // ── 청약서 작성·제출 ──
      onbForm: s.onbForm,
      setOnb: (patch) => this.setState(st => ({ onbForm: { ...st.onbForm, ...patch } })),
      apply: s.apply,
      setApply: (patch) => this.setState(st => ({ apply: { ...st.apply, ...patch } })),
      applyValid: this._applyValid(s.apply),
      submitEnroll: this.submitEnroll,

      // ── 제출 중 오버레이 ──
      loading: s.loading, loadStage: s.loadStage,
    };
  }

  render() {
    const vm = this.renderVals();
    // 앱 모드(webapp 빌드) — 같은 화면을 폰 폭에 맞춰 배치한다.
    // 인라인 스타일은 CSS 로 못 덮으므로 레이아웃이 갈리는 곳만 여기서 분기한다.
    const app = Boolean(this.props.appMode);
    const A = (webCss, appCss) => (app ? appCss : webCss);
    return (
      <div className={app ? "app-mode" : undefined} style={S("min-height:100dvh;display:flex;justify-content:center;background:#fff")}>
        <div style={S("width:100%;min-height:100dvh;background:#fff;position:relative;display:flex;flex-direction:column")}>
          {/* ── 인강 데스크톱 웹페이지 (첫 화면 · 웹) ── */}
          {(!['apply','done','insurance','instructors','policy'].includes(vm.entry) && !(vm.payBackEntry === 'insurance' && ['terms'].includes(vm.entry))) && (<>
            <div style={S("background:#fff;display:flex;flex-direction:column;width:100%")}>
              {/* ① 상단 유틸리티 바 — 앱에서는 자리만 먹어 감춘다 */}
              {!app && (
              <div style={S("width:100%;background:#1A1C22;color:#B9BEC9")}>
                <div style={S("max-width:1160px;margin:0 auto;height:34px;padding:0 20px;display:flex;align-items:center;justify-content:flex-end;font-size:11.5px")}>
                  {[['고객센터',null],['학습Q&A',null],['수강권 등록',null],['회원가입',null],['로그인',null]].map((it,i)=>(
                    <React.Fragment key={i}>
                      {i>0 && (<span style={S("color:#3A3D45;margin:0 12px")}>|</span>)}
                      <span className="hov-link" style={S(`cursor:pointer;${it[0]==='로그인'?'color:#fff;font-weight:700':''}`)} onClick={it[1]||undefined}>{it[0]}</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
              )}
              {/* ② 헤더 · 글로벌 내비 (sticky).
                  앱에서는 한 줄에 다 못 들어가므로 로고+검색 / 메뉴 두 줄로 쪼갠다. */}
              <div className={app ? "app-topbar" : undefined} style={S("width:100%;background:#fff;border-bottom:1px solid #ECEEF1;position:sticky;top:0;z-index:8")}>
                <div style={S(A(
                  "max-width:1160px;margin:0 auto;min-height:66px;padding:10px 20px;display:flex;align-items:center;gap:clamp(12px,2vw,26px);flex-wrap:wrap",
                  "margin:0 auto;padding:8px 16px 0;display:flex;align-items:center;gap:10px",
                ))}>
                  <div style={S("display:flex;align-items:center;gap:8px;cursor:pointer;flex:none")} onClick={vm.navWeb}>
                    <span style={S("width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#2B4FE8,#3F6BFF);color:#fff;font-size:14px;font-weight:900;display:flex;align-items:center;justify-content:center;flex:none")}>M</span>
                    <span style={S(A(
                      "font-size:20px;font-weight:900;color:#1A1C22;letter-spacing:-0.6px;white-space:nowrap",
                      "font-size:18px;font-weight:900;color:#1A1C22;letter-spacing:-0.6px;white-space:nowrap",
                    ))}>메가에듀<span style={S("color:#2B4FE8")}>패스</span></span>
                  </div>
                  {/* 웹: 메뉴를 로고 옆에. 앱: 아래 줄로 내린다 */}
                  {!app && (
                  <div style={S("flex:1 1 240px;min-width:0;display:flex;align-items:center;gap:clamp(12px,1.8vw,24px);overflow-x:auto")}>
                    {['인강','교재','모의고사','학습관리','입시정보','합격수기'].map((m,mi)=>(<React.Fragment key={mi}><span className="hov-link" style={S(`font-size:14.5px;font-weight:700;cursor:pointer;white-space:nowrap;flex:none;color:${mi===0?'#2B4FE8':'#3A3E46'}`)}>{m}</span></React.Fragment>))}
                  </div>
                  )}
                  <div style={S(A(
                    "display:flex;align-items:center;gap:6px;height:38px;padding:0 14px;background:#F3F5F8;border-radius:20px;flex:0 1 200px;min-width:44px;overflow:hidden",
                    "display:flex;align-items:center;gap:6px;height:36px;padding:0 14px;background:#F3F5F8;border-radius:20px;flex:1 1 auto;min-width:0;overflow:hidden;margin-left:auto",
                  ))}>
                    <span style={S("flex:none;display:flex")}>{this.uiIcon('search', 15, '#9AA0AB')}</span>
                    <span style={S("font-size:12.5px;color:#9AA0AB;white-space:nowrap")}>강좌·교재 검색</span>
                  </div>
                </div>
                {app && (
                  <div className="app-navchips">
                    {['인강','교재','모의고사','학습관리','입시정보','합격수기'].map((m,mi)=>(
                      <span key={mi} style={S(`font-size:14px;font-weight:700;white-space:nowrap;flex:none;color:${mi===0?'#2B4FE8':'#3A3E46'}`)}>{m}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* ③ 히어로 배너 — 8초마다 자동 전환 (0: 인강 얼리버드 / 1: 임베디드 보험).
                  전체폭 띠가 아니라 라운드 카드로 띄워, 넘어가는 두 화면을 하나의 캐러셀로 읽히게 한다. */}
              <div style={S(A(
                "width:100%;box-sizing:border-box;display:flex;justify-content:center;padding:clamp(14px,2vw,24px) 20px clamp(26px,3.4vw,38px);background:#fff",
                "width:100%;box-sizing:border-box;display:flex;justify-content:center;padding:12px 14px 22px;background:#fff",
              ))}>
              <div
                style={S(`width:100%;max-width:1440px;position:relative;box-sizing:border-box;overflow:hidden;border-radius:clamp(20px,2.6vw,28px);transition:background .9s ease,box-shadow .9s ease,border-color .9s ease;background:${vm.heroSlide === 0
                  ? 'radial-gradient(1100px 460px at 78% 0%,#FFFFFF 0%,#DCF0E5 46%,#BCE0CD 100%)'
                  : 'radial-gradient(1240px 420px at 74% 0%,#16204A 0%,#0A0A0C 62%)'};border:1px solid ${vm.heroSlide === 0 ? '#A9D3BC' : 'rgba(255,255,255,0.10)'};box-shadow:${vm.heroSlide === 0 ? '0 18px 44px rgba(0,70,42,0.16)' : '0 18px 44px rgba(14,20,52,0.26)'}`)}
                onMouseEnter={vm.pauseHero}
                onMouseLeave={vm.resumeHero}
              >
                {/* 슬라이드 1 — 메가에듀패스 */}
                {(vm.heroSlide === 1) && (
                <div key="hero1" style={S("padding:clamp(34px,4.6vw,52px) clamp(24px,6vw,64px) clamp(56px,6vw,64px);display:flex;align-items:center;gap:clamp(24px,4vw,40px);flex-wrap:wrap;animation:heroIn .9s cubic-bezier(.16,.84,.44,1) both")}>
                  <div style={S("flex:1 1 300px;min-width:0")}>
                    <div style={S("display:inline-block;font-size:12px;font-weight:800;color:#9BE23B;border:1px solid rgba(155,226,59,0.5);border-radius:20px;padding:5px 12px")}>2026 대비 · 얼리버드 진행중</div>
                    <div style={S("font-size:clamp(30px,6vw,46px);font-weight:900;color:#fff;letter-spacing:-2px;margin-top:20px;line-height:1.12")}>합격까지<br/>무제한 <span style={S("background:linear-gradient(90deg,#4E7CFF,#8FB4FF);-webkit-background-clip:text;background-clip:text;color:transparent")}>올패스</span></div>
                    <div style={S("font-size:clamp(13.5px,1.4vw,15px);color:#AEB4C0;margin-top:16px;line-height:1.7;word-break:keep-all")}>국·수·영·탐 전 강좌 12개월 무제한 수강.<br/>결제 한 번으로 대표 강사진의 전 커리큘럼을 모두 담았습니다.</div>
                    {/* 인강 결제는 실제 서비스가 아니라 데모용 장식 카피 — 이 웹의 핵심은
                        보험 가입 데모이므로, 이 버튼은 보험 가입 플로우로 연결하지 않는다. */}
                    <div style={S("width:min(300px,100%);height:60px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;margin-top:26px;background:linear-gradient(135deg,#2B4FE8,#4E7CFF);color:#fff;font-size:17px;font-weight:900;border-radius:16px;cursor:default;box-shadow:0 14px 26px rgba(43,79,232,0.28)")}>메가패스 수강신청 →</div>
                  </div>
                  <div style={S("flex:1 1 280px;max-width:380px;display:flex;flex-direction:column;gap:12px")}>
                    {[['누적 수강생','1,240,000+'],['전체 강사진','48명'],['평균 만족도','4.9 / 5.0']].map((r,ri)=>(<React.Fragment key={ri}>
                      <div style={S("background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between")}>
                        <span style={S("font-size:13px;color:#AEB4C0;font-weight:600")}>{r[0]}</span>
                        <span style={S("font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px")}>{r[1]}</span>
                      </div>
                    </React.Fragment>))}
                  </div>
                </div>
                )}

                {/* 슬라이드 0 — 제휴 보험(첫 화면). 인강 히어로가 어두우므로 밝은 초록으로 명암을 뒤집어 구분한다 */}
                {(vm.heroSlide === 0) && (
                <div key="hero0" style={S("padding:clamp(34px,4.6vw,52px) clamp(24px,6vw,64px) clamp(56px,6vw,64px);display:flex;align-items:center;gap:clamp(24px,4vw,40px);flex-wrap:wrap;animation:heroIn .9s cubic-bezier(.16,.84,.44,1) both")}>
                  <div style={S("flex:1 1 300px;min-width:0")}>
                    <div style={S("display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:800;color:#fff;background:#00462A;border:1px solid #00462A;border-radius:20px;padding:5px 12px;box-shadow:0 4px 12px rgba(0,70,42,0.28)")}>
                      <span style={S("font-size:10px;font-weight:900;color:#00462A;background:#fff;border-radius:4px;padding:2px 6px")}>제휴</span>
                      메가에듀패스 × 재수없수
                    </div>
                    <div style={S("font-size:clamp(28px,5.4vw,44px);font-weight:900;color:#00331E;letter-spacing:-1.8px;margin-top:20px;line-height:1.15;word-break:keep-all")}>수능이 흔들려도<br/><span style={S("background:linear-gradient(90deg,#00462A,#00734A);-webkit-background-clip:text;background-clip:text;color:transparent")}>다시 시작할 비용</span>은 남게</div>
                    <div style={S("font-size:clamp(13.5px,1.4vw,15px);color:#204538;margin-top:16px;line-height:1.7;word-break:keep-all")}>성적이 예측 밴드를 크게 벗어나 재수하게 되면 재수학원·인강 수강료를 보장합니다.<br/>수강신청 결제 단계에서 체크 한 번으로 함께 신청할 수 있어요.</div>
                    <div style={S("display:flex;gap:12px;margin-top:28px;flex-wrap:wrap")}>
                      <div className="hov-btn" style={S("width:300px;height:64px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;background:linear-gradient(135deg,#00462A,#00764A);color:#fff;font-size:18px;font-weight:900;border-radius:16px;cursor:pointer;box-shadow:0 14px 26px rgba(0,70,42,0.18)")} onClick={() => vm.entryGo('insurance')}>보험 자세히 알아보기 →</div>
                    </div>
                  </div>
                  <div style={S("flex:1 1 280px;max-width:380px;display:flex;flex-direction:column;gap:12px")}>
                    {[['월 보험료', vm.tierRows[0].premiumLabel + '원~'],['연 최대 보장', vm.tierRows[vm.tierRows.length-1].sevLabel],['보장 비율','재수비용의 70%']].map((r,ri)=>(<React.Fragment key={ri}>
                      <div style={S("background:#fff;border:1px solid #A9D3BC;border-radius:16px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:10px;box-shadow:0 6px 18px rgba(0,70,42,0.10)")}>
                        <span style={S("font-size:13px;color:#41604F;font-weight:600;white-space:nowrap")}>{r[0]}</span>
                        <span style={S("font-size:19px;font-weight:900;color:#00462A;letter-spacing:-0.5px;white-space:nowrap")}>{r[1]}</span>
                      </div>
                    </React.Fragment>))}
                  </div>
                </div>
                )}

                {/* 좌우 화살표 — 카드 안쪽에 띄운다. 배경 밝기가 슬라이드마다 반대라 색을 뒤집는다 */}
                {[['‹',-1,'left'],['›',1,'right']].map((a,ai)=>{
                  const onLight = vm.heroSlide === 0;
                  return (
                    <React.Fragment key={ai}>
                      <div
                        className="hero-arrow"
                        onClick={() => vm.goHeroSlide((vm.heroSlide + 2 + a[1]) % 2)}
                        style={S(`position:absolute;${a[2]}:clamp(8px,1.1vw,16px);top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;user-select:none;font-size:20px;line-height:1;padding-bottom:3px;z-index:2;${onLight
                          ? 'background:rgba(255,255,255,0.92);color:#00462A;border:1px solid #A9D3BC;box-shadow:0 4px 14px rgba(0,70,42,0.18)'
                          : 'background:rgba(255,255,255,0.12);color:#fff;border:1px solid rgba(255,255,255,0.22)'}`)}
                      >{a[0]}</div>
                    </React.Fragment>
                  );
                })}

                {/* 인디케이터 — 슬라이드마다 배경 밝기가 반대라 점 색도 함께 뒤집는다 */}
                <div style={S("position:absolute;left:0;right:0;bottom:20px;display:flex;align-items:center;justify-content:center;gap:9px;z-index:2")}>
                  {['제휴 보험 소개','메가에듀패스 소개'].map((lb,li)=>{
                    const onLight = vm.heroSlide === 0;
                    const active = vm.heroSlide === li;
                    const bg = active
                      ? (onLight ? '#00462A' : '#fff')
                      : (onLight ? 'rgba(0,70,42,0.32)' : 'rgba(255,255,255,0.35)');
                    return (
                      <React.Fragment key={li}>
                        <div
                          title={lb}
                          onClick={() => vm.goHeroSlide(li)}
                          style={S(`height:6px;border-radius:20px;cursor:pointer;transition:width .3s ease,background .3s ease;width:${active?'30px':'10px'};background:${bg}`)}
                        ></div>
                      </React.Fragment>
                    );
                  })}
                  {/* 앱에서는 좌우 화살표가 본문과 겹쳐 숨기므로, 점 옆에 넘김 버튼을 둔다 */}
                  {app && (() => {
                    const onLight = vm.heroSlide === 0;
                    return (
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label="다음 배너 보기"
                        onClick={() => vm.goHeroSlide((vm.heroSlide + 1) % 2)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') vm.goHeroSlide((vm.heroSlide + 1) % 2); }}
                        style={S(`margin-left:6px;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;user-select:none;font-size:17px;line-height:1;padding-bottom:2px;${onLight
                          ? 'background:rgba(255,255,255,0.92);color:#00462A;border:1px solid #A9D3BC;box-shadow:0 3px 10px rgba(0,70,42,0.16)'
                          : 'background:rgba(255,255,255,0.16);color:#fff;border:1px solid rgba(255,255,255,0.28)'}`)}
                      >›</div>
                    );
                  })()}
                </div>
              </div>
              </div>

              {/* ④ 패스 혜택 밴드 — 웹 전용. 앱에서는 히어로 바로 아래에 강사 라인업이 오도록 뺀다 */}
              {!app && (
              <div style={S("width:100%;background:#fff;border-top:1px solid #ECEEF1;border-bottom:1px solid #ECEEF1")}>
                <div style={S("max-width:1160px;margin:0 auto;padding:20px;display:flex;align-items:stretch;justify-content:center;gap:clamp(14px,2.4vw,30px);flex-wrap:wrap")}>
                  {[
                    ['play','전 강좌 무제한','12개월 동안 횟수 제한 없이'],
                    ['book','교재 무료 배송','패스 전용 교재 3권 포함'],
                    ['chart','주간 학습 리포트','진도·취약 단원 자동 정리'],
                    ['refund','7일 내 100% 환불','수강 시작 전이면 조건 없이'],
                  ].map((b,bi)=>(<React.Fragment key={bi}>
                    <div style={S(`display:flex;align-items:center;gap:11px;flex:0 1 auto;min-width:0;padding-left:clamp(14px,2.4vw,30px);border-left:${bi===0?'0':'1px solid #ECEEF1'}`)}>
                      <span style={S("width:34px;height:34px;border-radius:10px;flex:none;background:#EEF3FF;display:flex;align-items:center;justify-content:center")}>{this.uiIcon(b[0], 19, '#2B4FE8')}</span>
                      <div style={S("min-width:0")}>
                        <div style={S("font-size:14px;font-weight:800;color:#16181D;letter-spacing:-0.3px;word-break:keep-all")}>{b[1]}</div>
                        <div style={S("font-size:11.5px;color:#7A808B;margin-top:2px;word-break:keep-all")}>{b[2]}</div>
                      </div>
                    </div>
                  </React.Fragment>))}
                </div>
              </div>
              )}

              {/* ⑤ 대표 강사 라인업 — 앱에서는 6열 그리드 대신 스와이프 캐러셀 */}
              <div style={S(A(
                "width:min(1760px,calc(100vw - 72px));margin:0 auto;padding:clamp(36px,5vw,52px) 0 20px;box-sizing:border-box",
                "width:100%;margin:0 auto;padding:30px 0 16px;box-sizing:border-box",
              ))}>
                <div style={S(A(
                  "display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:8px",
                  "display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:0 16px",
                ))}>
                  <div>
                    <div style={S("font-size:13px;font-weight:800;color:#2B4FE8")}>TOP INSTRUCTORS</div>
                    <div style={S(A(
                      "font-size:clamp(21px,3vw,26px);font-weight:900;color:#16181D;letter-spacing:-1px;margin-top:6px",
                      "font-size:21px;font-weight:900;color:#16181D;letter-spacing:-1px;margin-top:5px",
                    ))}>대표 강사 라인업</div>
                  </div>
                  <span className="hov-link" style={S("font-size:13px;color:#7A808B;cursor:pointer;white-space:nowrap")}
                        onClick={() => vm.entryGo('instructors')}>자세히 보기 ›</span>
                </div>
                <div className={app ? "app-rail app-rail-instructors" : undefined}
                     style={S(A("display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:18px;margin-top:24px", "margin-top:18px"))}>
                  {this.instructors.map((t,ti)=>(<React.Fragment key={ti}>
                    {/* 세로형 프로필 카드 — 좌상단 홍보문구 / 좌하단 과목·강사명 / 우하단 인물(또는 과목 아이콘) */}
                    <div className="hov-lift" style={S("height:300px;position:relative;overflow:hidden;border:1px solid #EAECEF;border-radius:18px;background:#F1F0EE")}>
                      {t.full ? (
                        /* 완성 카드 이미지(문구 포함) 통째로 — 반응형 여백은 카드 배경색과 동일해 자연스럽게 묻힘 */
                        <img src={t.full} alt={`${t.n} 선생님`} style={S("position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center bottom")} />
                      ) : (<>
                      {/* 우하단 인물/아이콘 */}
                      {t.img ? (
                        <img src={t.img} alt={`${t.n} 선생님`} style={S(t.n === '한희지'
                          ? "position:absolute;right:-10px;bottom:-62px;height:101%;width:auto;object-position:bottom right;z-index:1"
                          : `position:absolute;right:${t.n === '차미래' ? '-4px' : t.n === '이윤서' ? '-34px' : t.n === '최지현' ? '-10px' : t.n === '노재희' ? '0' : '-2px'};bottom:${t.n === '차미래' ? '-27px' : t.n === '이윤서' ? '-2px' : t.n === '박혜준' ? '-7px' : t.n === '최지현' ? '-7px' : t.n === '노재희' ? '3px' : '0'};height:${t.n === '최지현' ? '80%' : t.n === '차미래' ? '88%' : t.n === '이윤서' ? '82%' : t.n === '노재희' ? '76%' : '80%'};width:auto;object-position:bottom right;z-index:1`
                        )} />
                      ) : (
                        <div style={S(`position:absolute;right:16px;bottom:64px;width:104px;height:104px;border-radius:50%;background:${t.c}18;display:flex;align-items:center;justify-content:center`)}>{this.subjectIcon(t.icon, 54, t.c)}</div>
                      )}
                      <div style={S("position:absolute;left:0;bottom:0;width:48%;height:48%;background:linear-gradient(90deg,#F1F0EE 0%,#F1F0EE 62%,rgba(241,240,238,0) 100%);z-index:2;pointer-events:none")} />
                      {/* 좌상단 홍보문구 */}
                      <div style={S("position:absolute;left:18px;top:16px;right:32%;font-size:14px;font-weight:800;color:#2A2E34;line-height:1.4;letter-spacing:-0.4px;white-space:pre-line;word-break:keep-all;z-index:2")}>{t.tag}</div>
                      {/* 좌하단 과목·강사명 — '선생님'은 다음 줄로(사진에 안 가리게) */}
                      <div style={S(`position:absolute;left:18px;bottom:28px;z-index:3;${['차미래','이윤서','한희지','최지현','노재희'].includes(t.n) ? 'text-shadow:0 1px 0 #F1F0EE,1px 0 0 #F1F0EE,0 -1px 0 #F1F0EE,-1px 0 0 #F1F0EE,0 2px 8px rgba(241,240,238,0.9);' : ''}`)}>
                        <div style={S("font-size:12px;font-weight:800;color:#5B7CFA")}>{t.s}</div>
                        <div style={S("font-size:18px;font-weight:900;color:#16181D;margin-top:3px;letter-spacing:-0.5px")}>{t.n}</div>
                        <div style={S("font-size:12px;font-weight:600;color:#7A808B;margin-top:1px")}>선생님</div>
                      </div>
                      </>)}
                    </div>
                  </React.Fragment>))}
                </div>
              </div>

              {/* ⑧ 합격 후기 — 앱에서는 3열 그리드 대신 스와이프 캐러셀 */}
              <div style={S(A(
                "max-width:1160px;margin:0 auto;padding:clamp(36px,5vw,52px) 20px 20px;width:100%;box-sizing:border-box",
                "margin:0 auto;padding:30px 0 16px;width:100%;box-sizing:border-box",
              ))}>
                <div style={S("text-align:center")}>
                  <div style={S("font-size:13px;font-weight:800;color:#2B4FE8")}>REVIEWS</div>
                  <div style={S(A(
                    "font-size:clamp(21px,3vw,26px);font-weight:900;color:#16181D;letter-spacing:-1px;margin-top:6px",
                    "font-size:21px;font-weight:900;color:#16181D;letter-spacing:-1px;margin-top:5px",
                  ))}>합격이 증명합니다</div>
                </div>
                <div className={app ? "app-rail app-rail-reviews" : undefined}
                     style={S(A("display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:28px", "margin-top:20px"))}>
                  {[
                    {q:'차미래 선생님이 문학과 독서의 기준을 먼저 잡아주셔서, 지문마다 흔들리던 판단이 훨씬 또렷해졌어요.',
                     who:'심은숙',univ:'고려대 국어국문학과',pass:'국어',from:74,to:95},
                    {q:'이윤서 선생님이 막히는 유형을 풀이 순서로 잡아주셔서, 수학이 흔들릴 때도 어디서부터 손대야 할지 보이기 시작했어요.',
                     who:'이정수',univ:'서울대 경영대학',pass:'수학',from:71,to:96},
                    {q:'박혜준 선생님 강의는 구문을 외우게 하기보다 문장 흐름을 읽게 해줘요. 영어 지문을 끝까지 밀고 가는 힘이 생겼어요.',
                     who:'박준규',univ:'연세대 전기전자공학부',pass:'영어',from:78,to:94},
                    {q:'한희지 선생님이 시대 흐름을 한 번에 이어주셔서, 외우기만 하던 한국사가 문제에서 바로 떠오르기 시작했어요.',
                     who:'최지연',univ:'성균관대 글로벌리더학부',pass:'한국사',from:69,to:92},
                    {q:'최지현 선생님이 사문 개념을 사례랑 같이 정리해 주셔서 헷갈리던 선지가 눈에 걸리기 시작했어요. 실전에서 시간이 줄었어요.',
                     who:'문혜영',univ:'고려대 미디어학부',pass:'사회문화',from:66,to:91},
                    {q:'노재희 선생님이 과탐 개념을 공식보다 원리로 풀어주셔서, 낯선 자료가 나와도 당황하지 않게 됐어요.',
                     who:'김찬영',univ:'한양대 융합전자공학부',pass:'과학탐구',from:70,to:93},
                  ].map((r,ri)=>(<React.Fragment key={ri}>
                    <div className="hov-lift" style={S("min-width:0;min-height:238px;border:1px solid #EDEFF2;border-radius:18px;padding:22px;background:#fff;display:flex;flex-direction:column;box-sizing:border-box")}>
                      <div style={S("display:flex;align-items:center;justify-content:space-between;gap:8px")}>
                        <span style={S("font-size:15px;color:#FFC53D")}>★★★★★</span>
                        <span style={S("font-size:10.5px;font-weight:700;color:#5C626C;background:#F3F5F8;border-radius:20px;padding:4px 10px;white-space:nowrap")}>{r.pass}</span>
                      </div>
                      <div style={S("font-size:14px;color:#2E323A;line-height:1.75;margin-top:14px;font-weight:600;word-break:keep-all;min-height:74px")}>“{r.q}”</div>
                      {/* 백분위 변화 — 후기에 검증 가능한 구체성을 준다 */}
                      <div style={S("display:flex;align-items:center;gap:9px;margin-top:18px;padding:11px 13px;background:#F8FAFC;border-radius:12px")}>
                        <span style={S("font-size:10.5px;color:#9AA0AB;font-weight:600;flex:none")}>백분위</span>
                        <span style={S("font-size:14px;font-weight:800;color:#9AA0AB;font-variant-numeric:tabular-nums")}>{r.from}</span>
                        <span style={S("font-size:12px;color:#C3C8D0;flex:none")}>→</span>
                        <span style={S("font-size:17px;font-weight:900;color:#2B4FE8;font-variant-numeric:tabular-nums")}>{r.to}</span>
                        <span style={S("font-size:11px;font-weight:800;color:#0B8F58;margin-left:auto;white-space:nowrap")}>+{r.to - r.from}</span>
                      </div>
                      <div style={S("font-size:12.5px;color:#9AA0AB;margin-top:auto;padding-top:14px")}>{r.univ} · {r.who}</div>
                    </div>
                  </React.Fragment>))}
                </div>
              </div>

              {/* ⑩ 푸터 */}
              <div style={S(A(
                "width:100%;background:#fff;border-top:1px solid #E8EAEE;margin-top:48px;color:#5C626C",
                "width:100%;background:#fff;border-top:1px solid #E8EAEE;margin-top:30px;color:#5C626C",
              ))}>
                <div style={S("border-bottom:1px solid #ECEFF3")}>
                  <div style={S(A(
                    "max-width:1160px;margin:0 auto;padding:20px;display:flex;align-items:center;justify-content:center;gap:clamp(18px,3vw,34px);flex-wrap:wrap;font-size:13px;color:#4F5662",
                    "margin:0 auto;padding:16px;display:flex;align-items:center;justify-content:center;gap:12px 16px;flex-wrap:wrap;font-size:12px;color:#4F5662",
                  ))}>
                    {['회사소개','언론보도','사회공헌','찾아오는길','제휴·단체문의','강사모집','인재채용','이용약관'].map((l,li)=>(
                      <span key={li} className="hov-link" style={S("cursor:pointer;white-space:nowrap")}>{l}</span>
                    ))}
                    <span className="hov-link" style={S("color:#2B4FE8;font-weight:800;cursor:pointer;white-space:nowrap")}>개인정보처리방침</span>
                    <span className="hov-link" style={S("color:#2B4FE8;font-weight:800;cursor:pointer;white-space:nowrap")}>학습지원센터</span>
                    <span className="hov-link" style={S("color:#2B4FE8;font-weight:800;cursor:pointer;white-space:nowrap")}>메가에듀패스 소개⌃</span>
                  </div>
                </div>
                <div style={S(A(
                  "max-width:1160px;margin:0 auto;padding:24px 20px 44px;display:flex;align-items:flex-start;gap:28px;flex-wrap:wrap",
                  "margin:0 auto;padding:18px 16px 28px;display:flex;flex-direction:column;align-items:flex-start;gap:10px",
                ))}>
                  <div style={S(A(
                    "font-size:22px;font-weight:900;color:#2B2F36;letter-spacing:-1.4px;line-height:1.15;min-width:170px",
                    "font-size:18px;font-weight:900;color:#2B2F36;letter-spacing:-1px;line-height:1.15",
                  ))}>메가에듀교육(주)</div>
                  <div style={S(A(
                    "flex:1;min-width:300px;font-size:12px;color:#4F5662;line-height:1.9;word-break:keep-all",
                    "font-size:11px;color:#7A808B;line-height:1.8;word-break:break-all",
                  ))}>
                    06643 서울 서초구 효령로 321 미래안정형빌딩 메가에듀교육(주) · 대표이사: 박혜준 · 사업자등록번호: 780-87-00034<br/>
                    통신판매번호: 2026-서울서초-0678&nbsp;
                    <span className="hov-link" style={S("color:#2B4FE8;cursor:pointer;text-decoration:underline;text-underline-offset:2px")}>정보조회</span>
                    &nbsp;› 신고기관명: 서울특별시 서초구 호스팅제공자: (주)케이티<br/>
                    학원설립·운영등록번호: 제10176호 메가에듀입시학원&nbsp;
                    <span className="hov-link" style={S("color:#2B4FE8;cursor:pointer;text-decoration:underline;text-underline-offset:2px")}>정보조회</span>
                    &nbsp;› 신고기관명: 서울특별시 강남교육지원청<br/>
                    학습지원센터: 1599-1010 · 개인정보보호책임자: 정보보안실 김영무 (keeper@megaedupass.net)<br/>
                    copyright©2026 megaEduPass.co.,Ltd. All rights reserved.
                  </div>
                </div>
              </div>
              {/* 앱 하단 탭바 — 고정이라 푸터가 가려지지 않도록 같은 높이의 여백을 둔다 */}
              {app && (<>
                <div style={S("height:calc(58px + env(safe-area-inset-bottom))")} />
                <nav className="app-tabbar" aria-label="주요 메뉴">
                  {[
                    { key: 'home', label: '홈', icon: 'home', onClick: vm.navWeb },
                    { key: 'lecture', label: '인강', icon: 'play' },
                    { key: 'insurance', label: '보험', icon: 'shieldCheck', onClick: () => vm.entryGo('insurance') },
                    { key: 'my', label: 'MY', icon: 'user' },
                  ].map((t) => (
                    <button key={t.key} type="button" className={t.key === 'home' ? 'active' : undefined} onClick={t.onClick}>
                      {this.uiIcon(t.icon, 21, t.key === 'home' ? '#2B4FE8' : '#9AA0AB')}
                      <span>{t.label}</span>
                    </button>
                  ))}
                </nav>
              </>)}
            </div>
          </>)}

          {/* ── 약관·상품설명서 전문 (앱 전용) ──
              앱에는 주소창이 없어 새 탭으로 열면 돌아올 길이 없다. 화면 안에 띄우고
              좌상단에 되돌아가는 버튼을 둔다. */}
          {(vm.entry === 'policy') && (<>
            <div style={S("background:#fff;display:flex;flex-direction:column;width:100%;height:100dvh")}>
              <div style={S("flex:none;width:100%;background:#fff;border-bottom:1px solid #ECEEF1;display:flex;align-items:center;gap:12px;min-height:52px;padding:10px 16px;box-sizing:border-box")}>
                <span className="hov-link" style={S("font-size:13.5px;font-weight:700;color:#5C626C;cursor:pointer;flex:none")}
                      onClick={() => vm.entryGo('insurance')}>‹ 이전 화면</span>
                <span style={S("flex:1;min-width:0;font-size:15px;font-weight:900;color:#16181D;letter-spacing:-0.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>약관·상품설명서 전문</span>
              </div>
              <iframe src={vm.policyUrl} title="재수없수 교육보험 보통약관 전문"
                      style={S("flex:1;width:100%;border:0;background:#fff")} />
            </div>
          </>)}

          {/* ── 전체 강사 페이지 (랜딩 라인업 → '전체 강사 보기') ──
              한 명당 카드 하나로 세로로만 쌓는다. */}
          {(vm.entry === 'instructors') && (<>
            <div style={S("background:#fff;display:flex;flex-direction:column;width:100%;min-height:100dvh")}>
              <div style={S("width:100%;background:#fff;border-bottom:1px solid #ECEEF1;position:sticky;top:0;z-index:8")}>
                <div style={S(A(
                  "max-width:1160px;margin:0 auto;min-height:60px;padding:10px 20px;display:flex;align-items:center;gap:14px",
                  "margin:0 auto;min-height:52px;padding:10px 16px;display:flex;align-items:center;gap:12px",
                ))}>
                  <span className="hov-link" style={S("font-size:13.5px;font-weight:700;color:#5C626C;cursor:pointer;flex:none")}
                        onClick={() => vm.entryGo('landing')}>‹ 메가에듀패스</span>
                </div>
              </div>

              <div style={S(A(
                "width:100%;max-width:900px;margin:0 auto;padding:clamp(18px,2.4vw,26px) 20px 60px;box-sizing:border-box",
                "width:100%;margin:0 auto;padding:14px 16px 32px;box-sizing:border-box",
              ))}>
                <div style={S(A(
                  "font-size:clamp(23px,3.2vw,30px);font-weight:900;color:#16181D;letter-spacing:-1px",
                  "font-size:23px;font-weight:900;color:#16181D;letter-spacing:-1px",
                ))}>과목별 대표 강사</div>
                <div style={S("font-size:13px;color:#7A808B;margin-top:8px;line-height:1.6;word-break:keep-all")}>
                  전체 강사진 48명 중 과목별 대표 강사를 소개합니다.
                </div>

                <div style={S("display:flex;flex-direction:column;gap:22px;margin-top:28px")}>
                  {this.instructors.map((t, ti) => {
                    const bc = '#2B4FE8'; // 카드마다 다른 과목색 대신, 6장 모두 같은 메인 브랜드 컬러로 통일
                    return (
                    <React.Fragment key={ti}>
                      {/* 카드 — 흰 배경 + 연한 회색 테두리 + 옅은 그림자만. 색은 프로필 영역 안에서만 쓴다 */}
                      <section style={S("border:1px solid #E9EAEC;border-radius:12px;background:#fff;box-shadow:0 1px 3px rgba(16,24,40,0.04);overflow:hidden")}>
                        {/* 프로필 — 첨부해주신 실제 강사 소개 배너 참고: 과목색으로 옅게 물든 배경,
                            좌측 상단 과목 배지 → 슬로건(헤드라인) → 한 줄 설명 순, 좌하단은 '과목 이름'만
                            군더더기 없이. 사진 크기·배치는 그대로 유지. */}
                        <div style={S(`height:300px;position:relative;overflow:hidden;background:${bc}12`)}>
                          {t.img ? (
                            <img src={t.cut || t.img} alt={`${t.n} 선생님`} style={S(t.n === '한희지'
                              ? "position:absolute;right:-10px;bottom:-62px;height:110%;width:auto;object-position:bottom right;z-index:1"
                              : `position:absolute;right:${t.n === '차미래' ? '-4px' : t.n === '이윤서' ? '-34px' : t.n === '최지현' ? '-10px' : t.n === '노재희' ? '0' : '-2px'};bottom:${t.n === '차미래' ? '-27px' : t.n === '이윤서' ? '-2px' : t.n === '박혜준' ? '-7px' : t.n === '최지현' ? '-7px' : t.n === '노재희' ? '3px' : '0'};height:${t.n === '최지현' ? '94%' : t.n === '차미래' ? '102%' : t.n === '이윤서' ? '96%' : t.n === '노재희' ? '90%' : '94%'};width:auto;object-position:bottom right;z-index:1`
                            )} />
                          ) : (
                            <div style={S(`position:absolute;right:16px;bottom:64px;width:104px;height:104px;border-radius:50%;background:${bc}18;display:flex;align-items:center;justify-content:center`)}>{this.subjectIcon(t.icon, 54, bc)}</div>
                          )}
                          <div style={S(`position:absolute;left:0;bottom:0;width:48%;height:48%;background:linear-gradient(90deg,${bc}12 0%,${bc}12 62%,${bc}00 100%);z-index:2;pointer-events:none`)} />
                          <div style={S("position:absolute;left:18px;top:20px;right:36%;bottom:132px;z-index:2;overflow:hidden")}>
                            <span style={S(`display:inline-block;font-size:12.5px;font-weight:800;color:${bc}`)}>{t.cardSubject || t.s}</span>
                            <div style={S("font-size:23px;font-weight:900;color:#16181D;line-height:1.32;letter-spacing:-0.5px;word-break:keep-all;margin-top:11px")}>
                              {/* 슬로건 마지막 단어(과목명)는 자연 줄바꿈에 기대지 않고 항상 따로 떨어뜨린다 */}
                              {t.slogan.slice(0, t.slogan.lastIndexOf(' '))}<br/>{t.slogan.slice(t.slogan.lastIndexOf(' ') + 1)}
                            </div>
                            <div style={S("font-size:13.5px;color:#6B7280;line-height:1.55;margin-top:9px;word-break:keep-all")}>{t.blurb}</div>
                          </div>
                          {/* 누적 수강생과 강사 이름은 하나의 하단 정렬 그룹으로 묶는다.
                              예전엔 수강생 숫자가 위쪽 스택(슬로건·소개)에 얹혀 있어서, 소개 문구가
                              세 줄이 되는 강사에서는 아래로 밀려 이름과 겹쳤다(배너 높이 300px 고정).
                              같은 흐름에 두면 문구 길이와 무관하게 간격이 유지된다. */}
                          <div style={S("position:absolute;left:18px;right:36%;bottom:16px;z-index:3")}>
                            <div style={S("font-size:11px;font-weight:700;color:#9AA0AB")}>누적 수강생</div>
                            <div style={S(`font-size:32px;font-weight:900;color:${bc};letter-spacing:-1px;margin-top:3px;line-height:1.1`)}>{t.students}</div>
                            <div style={S(`margin-top:12px;font-size:15px;font-weight:700;color:#2A2E34;${['차미래','이윤서','한희지','최지현','노재희'].includes(t.n) ? `text-shadow:0 1px 0 ${bc}12,1px 0 0 ${bc}12,0 -1px 0 ${bc}12,-1px 0 0 ${bc}12,0 2px 8px rgba(0,0,0,0.06);` : ''}`)}>
                              {t.n}
                            </div>
                          </div>
                        </div>
                        <div style={S("padding:14px 20px 0;font-size:12px;color:#7A808B")}>{t.field}</div>

                        <div style={S("padding:0 20px 20px")}>
                          {/* 누적 수강생은 배너 안으로 옮겨 여기서는 대표 강의만 */}
                          <div style={S("font-size:13px;color:#4F5662;margin-top:12px;line-height:1.6;word-break:keep-all")}>
                            대표 강의 <span style={S("font-weight:800;color:#16181D")}>{t.mainCourse}</span>
                          </div>

                          {/* 버튼 2개 — 동일 크기, 대표 강의 보기만 메인 컬러로 강조 */}
                          <div style={S("display:flex;gap:8px;margin-top:16px")}>
                            <div style={S("flex:1;height:44px;border-radius:10px;border:1px solid #E2E4E8;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#4F5662;cursor:default")}>커리큘럼 보기</div>
                            <div style={S(`flex:1;height:44px;border-radius:10px;background:${bc};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;cursor:default`)}>대표 강의 보기</div>
                          </div>
                        </div>
                      </section>
                    </React.Fragment>
                  );})}
                </div>

                <div style={S("text-align:center;margin-top:24px")}>
                  <span className="hov-link" style={S("font-size:13px;color:#9AA0AB;cursor:pointer")}
                        onClick={() => vm.entryGo('landing')}>‹ 메가에듀패스 홈으로 돌아가기</span>
                </div>
              </div>
              {app && <div style={S("height:calc(58px + env(safe-area-inset-bottom))")} />}
            </div>
          </>)}

          {/* ── 재수없수 보험 상세 페이지 (랜딩 프로모 → '자세히 알아보기') ── */}
          {((vm.entry === 'insurance' || (vm.payBackEntry === 'insurance' && ['terms'].includes(vm.entry)))) && (<>
            <div style={S("background:#fff;display:flex;flex-direction:column;width:100%;min-height:100dvh")}>
              {/* 상단바 — 인강 사이트로 돌아가는 경로를 항상 열어둔다 */}
              <div style={S("width:100%;background:#fff;border-bottom:1px solid #ECEEF1;position:sticky;top:0;z-index:8")}>
                <div style={S("max-width:1160px;margin:0 auto;min-height:60px;padding:10px 20px;display:flex;align-items:center;gap:14px;flex-wrap:wrap")}>
                  <span className="hov-link" style={S("font-size:13.5px;font-weight:700;color:#5C626C;cursor:pointer;flex:none")} onClick={() => vm.entryGo('landing')}>‹ 메가에듀패스</span>
                  <div style={S("flex:1;min-width:0;display:flex;align-items:center")}>
                    <span style={S("font-size:15px;font-weight:900;color:#00462A;letter-spacing:-0.5px;white-space:nowrap")}>재수없수 재수비용 보장보험</span>
                  </div>
                </div>
              </div>

              {/* 히어로 */}
              <div style={S("width:100%;background:linear-gradient(160deg,#DCECE4 0%,#EAF7EC 100%)")}>
                <div style={S("max-width:820px;margin:0 auto;padding:clamp(36px,5vw,56px) 20px;text-align:center")}>
                  <div style={S("display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;color:#0B8F58;background:#fff;border:1px solid #9FD3B8;border-radius:20px;padding:6px 13px")}>인강 임베디드 보험</div>
                  <div style={S("font-size:clamp(24px,4vw,34px);font-weight:900;color:#00462A;letter-spacing:-1.2px;margin-top:18px;line-height:1.25;word-break:keep-all")}>열심히 했는데 수능날 무너졌다면,<br/>다시 시작할 비용은 저희가 부담할게요</div>
                  <div style={S("font-size:clamp(13.5px,1.5vw,15px);color:#3E5B4C;margin-top:16px;line-height:1.8;word-break:keep-all")}>성적이 예측 밴드를 크게 벗어나 재수를 하게 되면 재수학원·인강 수강료를 보장합니다.<br/>보험료는 가구소득·거주지역·월교육비 등 비성적 객관 지표로 개인마다 다르게 산정됩니다.</div>
                </div>
              </div>

              {/* 공감 말풍선 — 비용 그래프(숫자)로 넘어가기 전에 "왜 이 이야기가 나에게 해당되는가"를 먼저 만든다.
                  풀-폭 밴드가 아니라 흰 배경 위에 뜬 가운데 라운드 카드로 축소해, 폭을 줄이고 히어로와의
                  구분을 더 또렷하게 한다. 좌/우 번갈아 배치는 유지. */}
              <div style={S("width:100%;background:#fff;display:flex;justify-content:center;padding:clamp(22px,3.4vw,38px) 20px")}>
                <div style={S("width:100%;max-width:640px;background:#C9E5D5;border-radius:clamp(20px,2.4vw,28px);padding:clamp(34px,4.6vw,48px) clamp(22px,3.6vw,40px);box-sizing:border-box")}>
                  <div style={S("text-align:center")}>
                    <div style={S("display:inline-block;font-size:12px;font-weight:800;color:#0B7A4A;background:#fff;border-radius:20px;padding:6px 14px;box-shadow:0 2px 8px rgba(0,70,42,0.05)")}>재수, 마음보다 먼저 계산기를 두드리게 됩니다</div>
                    <div style={S("font-size:clamp(20px,3.2vw,26px);font-weight:900;color:#00462A;letter-spacing:-1px;margin-top:18px;line-height:1.4;word-break:keep-all")}>재수를 고민하게 되는 순간,<br/>가장 먼저 걱정되는 건 비용입니다</div>
                    <div style={S("font-size:13px;color:#2E4A3E;margin-top:12px;line-height:1.7;word-break:keep-all")}>실제로 많이 하시는 이야기들이에요.</div>
                  </div>

                  <div style={S("display:flex;flex-direction:column;gap:clamp(9px,1.2vw,12px);margin-top:clamp(20px,2.6vw,26px)")}>
                    {[
                      // 불운 → 성적 기복 → 비용 이중부담 → 대비 수단 부재 순. 급락 원인(배탈·긴장 등)은
                      // 약관이 원인을 불문하고 낙폭으로만 판정하므로 특정하지 않는다.
                      // 강조 세그먼트는 단어 의미가 드러나도록 웹툰풍 효과(fxWord)를 준다.
                      { side: 'left',  who: '고3 학생', icon: 'slipFace', parts: [{t:'1년 내내 잘 봤는데 수능 하루 '},{t:'삐끗',fx:'tilt'},{t:'하면, 그동안 한 게 다 날아가는 건가요?'}] },
                      { side: 'right', who: '고3 학생', icon: 'swingFace', parts: [{t:'성적이 '},{t:'오르락내리락',fx:'wave'},{t:'하는데, 그걸 딱 하루로 판단한다는 게 불안해요.'}] },
                      { side: 'left',  who: '고3 학부모', icon: 'heavyFace', parts: [{t:'이미 1년 동안 인강, 교재, 모의고사까지 다 들었는데 다시 시작하려니 '},{t:'부담',fx:'heavy'},{t:'돼요.'}] },
                      { side: 'right', who: '고1 학부모', icon: 'moneyFace', parts: [{t:'재수학원비가 '},{t:'수백만 원에서 수천만 원까지',fx:'grow'},{t:' 든다는데, 미리 대비할 방법은 없을까요?'}] },
                    ].map((b, bi) => {
                      const isLeft = b.side === 'left';
                      return (
                        <React.Fragment key={bi}>
                          <div style={S(`display:flex;align-items:flex-start;gap:9px;justify-content:${isLeft ? 'flex-start' : 'flex-end'}`)}>
                            {isLeft && (<span style={S("flex:none;width:48px;height:48px;border-radius:50%;background:#C9E5D5;display:flex;align-items:center;justify-content:center;margin-top:0;box-shadow:0 4px 10px rgba(0,70,42,0.08)")}>{this.uiIcon(b.icon, 32, '#06734A', 2.05)}</span>)}
                            <div style={S(`position:relative;max-width:min(78%,320px);background:#fff;border-radius:15px;padding:13px clamp(15px,2vw,18px);box-shadow:0 2px 9px rgba(0,70,42,0.05);animation:heroIn .5s cubic-bezier(.16,.84,.44,1) both;animation-delay:${bi * 90}ms`)}>
                              {/* 말풍선 꼬리 — 아이콘 쪽을 향하게 */}
                              <span style={S(`position:absolute;top:18px;${isLeft ? 'left:-4px' : 'right:-4px'};width:12px;height:12px;background:#fff;transform:rotate(45deg);border-radius:2px`)}></span>
                              <div style={S("position:relative;font-size:10.5px;font-weight:800;color:#3E9E74;letter-spacing:-0.2px")}>{b.who}</div>
                              <div style={S("position:relative;font-size:clamp(13px,1.4vw,14px);color:#24463A;line-height:1.85;margin-top:5px;font-weight:600;word-break:keep-all")}>
                                {b.parts.map((p, pj) => p.fx
                                  ? this.fxWord(p.t, p.fx, pj)
                                  : (<React.Fragment key={pj}>{p.t}</React.Fragment>))}
                              </div>
                            </div>
                            {!isLeft && (<span style={S("flex:none;width:48px;height:48px;border-radius:50%;background:#C9E5D5;display:flex;align-items:center;justify-content:center;margin-top:0;box-shadow:0 4px 10px rgba(0,70,42,0.08)")}>{this.uiIcon(b.icon, 32, '#06734A', 2.05)}</span>)}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* 공감 → 숫자로 넘기는 연결부 */}
                  <div style={S("display:flex;flex-direction:column;align-items:center;gap:5px;margin-top:clamp(18px,2.4vw,24px)")}>
                    {[0.28, 0.44, 0.6].map((o, oi) => (
                      <React.Fragment key={oi}>
                        <span style={S(`width:5px;height:5px;border-radius:50%;background:rgba(0,70,42,${o})`)}></span>
                      </React.Fragment>
                    ))}
                    <div style={S("font-size:13px;font-weight:800;color:#00462A;margin-top:11px;text-align:center;line-height:1.7;word-break:keep-all")}>그래서 먼저, 재수에 실제로 얼마가 드는지부터 정리했습니다.</div>
                  </div>
                </div>
              </div>

              {/* 재수 비용 — 왜 보장이 필요한가 */}
              <div style={S("max-width:900px;margin:0 auto;padding:clamp(36px,5vw,52px) 20px 20px;width:100%;box-sizing:border-box")}>
                <div style={S("text-align:center")}>
                  <div style={S("font-size:13px;font-weight:800;color:#0B7A4A")}>WHY IT MATTERS</div>
                  <div style={S("font-size:clamp(21px,3vw,26px);font-weight:900;color:#16181D;letter-spacing:-1px;margin-top:6px;word-break:keep-all")}>재수, 1년에 얼마나 들까요?</div>
                  {/* '…3,000만원까지 / 듭니다.' 로 끊기지 않도록 금액과 서술어를 묶는다 */}
                  <div style={S("font-size:13.5px;color:#7A808B;margin-top:10px;line-height:1.7;word-break:keep-all")}>재수 형태에 따라 1년에 {vm.costBars.minLabel}에서 <span style={S("white-space:nowrap")}>{vm.costBars.maxLabel}까지 듭니다.</span><br/>재수없수는 이 비용의 <b style={S("color:#0B7A4A")}>70%</b>를 보장합니다.</div>
                </div>

                {/* 범례 — 색만으로 구분되지 않도록 항상 노출 */}
                <div style={S("display:flex;align-items:center;justify-content:center;gap:clamp(16px,2.4vw,28px);margin-top:22px;flex-wrap:wrap")}>
                  {[['#0B8F58','보험이 보장 (70%)'],['#C9E5D5','자기부담 (30%)']].map((l,li)=>(<React.Fragment key={li}>
                    <div style={S("display:flex;align-items:center;gap:9px")}>
                      <span style={S(`width:16px;height:16px;border-radius:4px;flex:none;background:${l[0]}`)}></span>
                      <span style={S("font-size:clamp(18px,2.6vw,22px);color:#16181D;font-weight:800;letter-spacing:-0.5px")}>{l[1]}</span>
                    </div>
                  </React.Fragment>))}
                </div>

                <div style={S("margin-top:20px;border:1px solid #E7EAEF;border-radius:20px;background:#fff;padding:clamp(18px,2.6vw,26px)")}>
                  {vm.costBars.rows.map((b, bi) => (
                    <React.Fragment key={bi}>
                      <div style={S(`display:flex;align-items:center;gap:clamp(8px,1.4vw,14px);padding:13px 0;border-top:${bi === 0 ? '0' : '1px solid #F4F6F8'}`)}>
                        <div style={S("flex:none;width:clamp(72px,9vw,96px);font-size:12.5px;font-weight:700;color:#3A3E46;word-break:keep-all;line-height:1.35")}>{b.form}</div>
                        <div style={S("flex:1;min-width:0")}>
                          {/* 막대 길이 = 연 비용 / 최대값. 채움 70%(보장) + 트랙 30%(자기부담), 사이 2px 서피스 갭 */}
                          <div style={S(`width:${b.pct}%;min-width:44px;height:20px;display:flex;gap:2px`)}>
                            <div style={S("flex:7;background:#0B8F58;border-radius:0")}></div>
                            <div style={S("flex:3;background:#C9E5D5;border-radius:0 4px 4px 0")}></div>
                          </div>
                        </div>
                        <div style={S("flex:none;width:clamp(74px,8vw,92px);text-align:right")}>
                          <div style={S("font-size:14px;font-weight:900;color:#16181D;font-variant-numeric:tabular-nums")}>{b.annualLabel}</div>
                          <div style={S("font-size:10.5px;color:#9AA0AB;margin-top:1px")}>연 기준</div>
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>

                <div style={S("font-size:11.5px;color:#9AA0AB;margin-top:14px;line-height:1.7;word-break:keep-all")}>
                  ※ 재수 형태별 월 비용에 12개월을 적용한 금액입니다. 초록색 구간이 재수없수가 보장하는 부분으로, 아래 표의 <b style={S("color:#7A808B")}>연 최대 보장</b> 금액과 같습니다.
                </div>
              </div>

              {/* 가입부터 보장까지의 흐름 */}
              <div style={S("max-width:1160px;margin:0 auto;padding:clamp(36px,5vw,52px) 20px 20px;width:100%;box-sizing:border-box")}>
                <div style={S("text-align:center")}>
                  <div style={S("font-size:13px;font-weight:800;color:#0B7A4A")}>HOW IT WORKS</div>
                  <div style={S("font-size:clamp(21px,3vw,26px);font-weight:900;color:#16181D;letter-spacing:-1px;margin-top:6px;word-break:keep-all")}>가입부터 보장까지, 이렇게 진행돼요</div>
                </div>
                <div style={S("display:flex;gap:clamp(10px,1.6vw,16px);margin-top:28px;flex-wrap:wrap;align-items:stretch")}>
                  {vm.flowSteps.map((f, fi) => (
                    <React.Fragment key={fi}>
                      <div className="hov-lift" style={S("flex:1 1 210px;min-width:0;border:1px solid #E7EAEF;border-radius:18px;padding:22px 20px;background:#fff;display:flex;flex-direction:column")}>
                        <span style={S("align-self:flex-start;font-size:11px;font-weight:900;color:#0B7A4A;background:#C9E5D5;border-radius:20px;padding:5px 12px")}>STEP {fi + 1}</span>
                        <div style={S("font-size:15.5px;font-weight:900;color:#16181D;margin-top:14px;letter-spacing:-0.4px;word-break:keep-all")}>{f.title}</div>
                        <div style={S("font-size:12.5px;color:#7A808B;margin-top:8px;line-height:1.65;word-break:keep-all")}>{f.desc}</div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* 티어 비교표 */}
              <div style={S("max-width:1160px;margin:0 auto;padding:clamp(36px,5vw,52px) 20px 20px;width:100%;box-sizing:border-box")}>
                <div style={S("text-align:center")}>
                  <div style={S("font-size:13px;font-weight:800;color:#0B7A4A")}>COVERAGE PLANS</div>
                  <div style={S("font-size:clamp(21px,3vw,26px);font-weight:900;color:#16181D;letter-spacing:-1px;margin-top:6px;word-break:keep-all")}>재수 형태에 맞춰 고르는 보장</div>
                  <div style={S("font-size:13.5px;color:#7A808B;margin-top:10px;line-height:1.7;word-break:keep-all")}>보장이 클수록 보험료가 올라가요. 아래 금액은 포트폴리오 기준선이며,<br/>가입 후 모의고사 성적이 연동되면 개인 요율로 다시 산정됩니다.</div>
                </div>

                <div style={S("margin-top:26px;overflow-x:auto;border:1px solid #E7EAEF;border-radius:20px;background:#fff")}>
                  <table style={S("width:100%;min-width:660px;border-collapse:collapse;font-size:13px;table-layout:fixed")}>
                    <thead>
                      <tr>
                        <th style={S("background:#E2F1E8;color:#073F2A;font-size:11.5px;font-weight:700;text-align:left;padding:14px 18px;white-space:nowrap;border-bottom:1px solid #CFE0D6;width:150px")}>구분</th>
                        {vm.tierRows.map((t, ti) => (
                          <React.Fragment key={ti}>
                            <th style={S(`width:auto;padding:14px 16px;text-align:center;border-bottom:2px solid ${t.ink};border-left:1px solid #F0F2F4;background:${t.tint}`)}>
                              <div style={S(`font-size:17px;font-weight:900;letter-spacing:-0.4px;color:${t.ink}`)}>{t.tier}</div>
                              <div style={S("font-size:11.5px;color:#7A808B;margin-top:4px;font-weight:600")}>{t.form}</div>
                            </th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: '월 보험료', key: 'premiumLabel', accent: true, suffix: '원~' },
                        { label: '연 최대 보장', sub: '중증 사고 시', key: 'sevLabel' },
                        { label: '경증 사고 보장', key: 'mildLabel' },
                        { label: '추천 대상', key: 'forWhom', small: true },
                      ].map((row, ri) => (
                        <React.Fragment key={ri}>
                          <tr>
                            <td style={S("padding:15px 18px;border-bottom:1px solid #F0F2F4;background:#FCFDFC;vertical-align:middle")}>
                              <div style={S("font-size:12.5px;font-weight:700;color:#3A3E46")}>{row.label}</div>
                              {row.sub && (<div style={S("font-size:10.5px;color:#9AA0AB;margin-top:2px")}>{row.sub}</div>)}
                            </td>
                            {vm.tierRows.map((t, ti) => (
                              <React.Fragment key={ti}>
                                <td style={S(`padding:15px 16px;text-align:center;border-bottom:1px solid #F0F2F4;border-left:1px solid #F0F2F4;vertical-align:middle;background:${t.tint}`)}>
                                  {row.accent ? (
                                    <span style={S(`font-size:20px;font-weight:900;color:${t.ink};letter-spacing:-0.5px`)}>{t[row.key]}<span style={S("font-size:12px;font-weight:700")}>{row.suffix}</span></span>
                                  ) : (
                                    <span style={S(`color:#2E323A;line-height:1.55;${row.small ? 'font-size:11.5px;font-weight:500;color:#6B7078' : 'font-size:14px;font-weight:800'}`)}>{t[row.key]}</span>
                                  )}
                                </td>
                              </React.Fragment>
                            ))}
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={S("font-size:11.5px;color:#9AA0AB;margin-top:14px;line-height:1.7")}>
                  ※ 보장은 수능 성적이 자기 성적대(밴드) 하단을 벗어나 급락하고 <b style={S("color:#7A808B")}>실제 재수가 확인된 경우</b>에 지급됩니다(최초 1회한, 경증·중증 중복 지급 없음). 급락 판정은 선언한 응시과목의 가중합 잔차를 선언 조합별 표준편차로 표준화해 산정합니다.
                </div>
              </div>

              {/* 가입 전 핵심 요약 — 약관·상품설명서의 3대 축(보장대상/보험료/제한)만 뽑아 카드로 */}
              <div style={S("max-width:1160px;margin:0 auto;padding:clamp(36px,5vw,52px) 20px 20px;width:100%;box-sizing:border-box")}>
                <div style={S("text-align:center")}>
                  <div style={S("font-size:13px;font-weight:800;color:#0B7A4A")}>KEY POINTS</div>
                  <div style={S("font-size:clamp(21px,3vw,26px);font-weight:900;color:#16181D;letter-spacing:-1px;margin-top:6px;word-break:keep-all")}>가입 전 꼭 확인해야 할 내용</div>
                  <div style={S("font-size:13.5px;color:#7A808B;margin-top:10px;line-height:1.7;word-break:keep-all;max-width:600px;margin-left:auto;margin-right:auto")}>약관과 상품설명서의 핵심만 정리했습니다. 자세한 내용은 약관·상품설명서 원문에서 확인하세요.</div>
                </div>
                <div style={S("display:flex;gap:16px;margin-top:26px;flex-wrap:wrap")}>
                  {vm.keyPoints.map((k, ki) => (
                    <React.Fragment key={ki}>
                      <div className="hov-lift" style={S("flex:1 1 280px;min-width:0;background:#fff;border:1px solid #84C2A3;border-radius:20px;padding:clamp(20px,2.6vw,26px);display:flex;flex-direction:column;box-shadow:0 6px 18px rgba(0,70,42,0.06)")}>
                        <span style={S("width:44px;height:44px;border-radius:13px;flex:none;background:#C9E5D5;border:1px solid #9FD3B8;display:flex;align-items:center;justify-content:center")}>{this.uiIcon(k.icon, 23, '#0B7A4A')}</span>
                        <div style={S("font-size:16px;font-weight:900;color:#00462A;margin-top:14px;letter-spacing:-0.4px")}>{k.title}</div>
                        <div style={S("font-size:13.5px;font-weight:700;color:#0B7A4A;margin-top:8px;line-height:1.65;word-break:keep-all")}>{k.lead}</div>
                        {k.points ? (
                          <div style={S("margin-top:13px;display:flex;flex-direction:column;gap:9px;flex:1")}>
                            {k.points.map((pt, pj) => (
                              <div key={pj} style={S("display:flex;gap:9px;align-items:flex-start")}>
                                <span style={S("flex:none;width:19px;height:19px;border-radius:50%;background:#0B7A4A;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-top:1px")}>{pj + 1}</span>
                                <span style={S("flex:1;min-width:0;font-size:13px;color:#2E4A3E;line-height:1.6;font-weight:600;word-break:keep-all")}>{pt}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={S("font-size:13px;color:#2E4A3E;font-weight:600;margin-top:13px;line-height:1.75;word-break:keep-all;flex:1")}>{k.body}</div>
                        )}
                        <div style={S("font-size:11px;color:#8FA79A;margin-top:14px;padding-top:12px;border-top:1px solid #EAF2ED;word-break:keep-all")}>근거 · {k.ref}</div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* 보장되지 않는 경우 — 숨기지 않고 정면에 둔다 */}
              <div style={S("max-width:900px;margin:0 auto;padding:clamp(36px,5vw,52px) 20px 20px;width:100%;box-sizing:border-box")}>
                <div style={S("text-align:center")}>
                  <div style={S("font-size:13px;font-weight:800;color:#B45309")}>BEFORE YOU JOIN</div>
                  <div style={S("font-size:clamp(21px,3vw,26px);font-weight:900;color:#16181D;letter-spacing:-1px;margin-top:6px;word-break:keep-all")}>이런 경우에는 보장되지 않아요</div>
                  <div style={S("font-size:13.5px;color:#7A808B;margin-top:10px;line-height:1.7;word-break:keep-all")}>가입 전에 꼭 확인하세요. 아래 항목은 보험금이 지급되지 않는 경우입니다.</div>
                </div>
                <div style={S("margin-top:24px;border:1px solid #F0DBA6;background:#FFFBF2;border-radius:20px;padding:clamp(16px,2.4vw,22px);display:flex;flex-direction:column;gap:2px")}>
                  {[
                    ['성적이 떨어졌지만 재수를 하지 않은 경우','실제 발생한 재수 비용을 보전하는 상품이므로, 급락 사실만으로는 지급하지 않습니다.'],
                    ['고의로 시험을 포기하거나 백지·불성실 답안을 제출한 경우','응시 이력·중간 성취도 추이·감독관 기록 등 객관 자료를 종합해 심사합니다.'],
                    ['선언한 과목을 실제로 응시하지 않은 경우','해당 과목은 판정에서 제외되며, 잔여 선언과목이 2과목 미만이면 지급하지 않습니다. 질병·부상 등 부득이한 사유는 증빙 제출 시 별도 심사합니다.'],
                    ['부정행위 등으로 성적이 무효 처리된 경우','시험 규정 위반으로 성적이 무효가 되면 급락 판정 자체가 불가합니다.'],
                    ['청약 시 고지사항을 사실과 다르게 알린 경우','계약 전 알릴 의무(고지의무) 위반으로 보아 보험금을 지급하지 않고 계약을 해지합니다.'],
                    ['성적표 등 판정에 필요한 자료를 제출하지 않은 경우','갱신 시점과 보험금 청구 시 성적표·성적증명서를 제출해야 합니다.'],
                    ['유학·해외진학·취업 등으로 진로를 변경한 경우','수능을 통한 국내 대입을 포기한 경우로, 통지의무 대상입니다.'],
                    ['전쟁·내란·천재지변 등 일반 면책 사유','다만 천재지변으로 인한 시험 자체의 연기·취소는 회사가 별도로 정한 기준에 따라 처리합니다.'],
                  ].map((x,xi)=>(<React.Fragment key={xi}>
                    <div style={S(`display:flex;gap:12px;align-items:flex-start;padding:13px 4px;border-top:${xi===0?'0':'1px solid #F5E8CC'}`)}>
                      <span style={S("flex:none;margin-top:1px;display:flex")}>{this.uiIcon('xCircle', 18, '#C6821A')}</span>
                      <div style={S("flex:1;min-width:0")}>
                        <div style={S("font-size:13.5px;font-weight:800;color:#7A5A12;line-height:1.5;word-break:keep-all")}>{x[0]}</div>
                        <div style={S("font-size:12px;color:#96793C;margin-top:4px;line-height:1.6;word-break:keep-all")}>{x[1]}</div>
                      </div>
                    </div>
                  </React.Fragment>))}
                </div>
                <div style={S("font-size:11.5px;color:#9AA0AB;margin-top:14px;line-height:1.7;word-break:keep-all")}>
                  ※ 대기기간은 가입일부터 수능 시험일까지의 기간과 수능 후 보험금 지급심사에 소요되는 기간을 말합니다. 사고는 수능 시험 이후에만 성립하므로 별도의 면책 대기기간은 두지 않습니다(별표2).{' '}
                  <a href={vm.policyUrl + '#' + vm.anchors.지급제한} target="_blank" rel="noreferrer" style={S("color:#0B7A4A;font-weight:700")}>전체 지급제한사항 보기 ↗</a>
                </div>
              </div>

              {/* FAQ */}
              <div style={S("max-width:820px;margin:0 auto;padding:clamp(36px,5vw,52px) 20px 20px;width:100%;box-sizing:border-box")}>
                <div style={S("text-align:center")}>
                  <div style={S("font-size:13px;font-weight:800;color:#0B7A4A")}>FAQ</div>
                  <div style={S("font-size:clamp(21px,3vw,26px);font-weight:900;color:#16181D;letter-spacing:-1px;margin-top:6px")}>자주 묻는 질문</div>
                </div>
                <div style={S("margin-top:26px;border:1px solid #E7EAEF;border-radius:18px;overflow:hidden;background:#fff")}>
                  {vm.faqs.map((f, fi) => (
                    <React.Fragment key={fi}>
                      <div style={S(`border-top:${fi === 0 ? '0' : '1px solid #F0F2F4'}`)}>
                        <div style={S(`display:flex;align-items:center;gap:12px;padding:18px 20px;cursor:pointer;background:${f.open ? '#FAFCFB' : '#fff'}`)} onClick={f.onClick}>
                          <span style={S(`font-size:15px;font-weight:900;flex:none;color:${f.open ? '#0B8F58' : '#C3C8D0'}`)}>Q</span>
                          <span style={S(`flex:1;min-width:0;font-size:14px;font-weight:700;line-height:1.5;word-break:keep-all;color:${f.open ? '#00462A' : '#2E323A'}`)}>{f.q}</span>
                          <span style={S(`font-size:11px;flex:none;transition:transform .2s;transform:rotate(${f.open ? '180' : '0'}deg);color:${f.open ? '#0B8F58' : '#9AA0AB'}`)}>▼</span>
                        </div>
                        {f.open && (
                          <div style={S("padding:0 20px 20px 47px;animation:riseIn .22s ease")}>
                            <div style={S("font-size:13px;color:#5C626C;line-height:1.8;word-break:keep-all")}>{f.a}</div>
                          </div>
                        )}
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* 청약서 작성 전 준비할 정보 — 실제 청약서 1~7 구성과 맞춘다 */}
              <div style={S("max-width:860px;margin:0 auto;padding:clamp(36px,5vw,52px) 20px 20px;width:100%;box-sizing:border-box")}>
                <div style={S("text-align:center")}>
                  <div style={S("font-size:13px;font-weight:800;color:#0B7A4A")}>APPLICATION</div>
                  <div style={S("font-size:clamp(21px,3vw,26px);font-weight:900;color:#16181D;letter-spacing:-1px;margin-top:6px;word-break:keep-all")}>청약서 작성 전 준비할 정보</div>
                  <div style={S("font-size:13.5px;color:#7A808B;margin-top:10px;line-height:1.7;word-break:keep-all;max-width:560px;margin-left:auto;margin-right:auto")}>미리 확인해 두시면 작성이 빨라집니다. 성적 자료는 교육청·평가원 원본으로 확인합니다.</div>
                </div>

                <div style={S("margin-top:24px;background:#F7FBF9;border:1px solid #84C2A3;border-radius:20px;padding:clamp(14px,2vw,20px);display:flex;flex-direction:column")}>
                  {vm.applyPrep.map((p, pi) => (
                    <React.Fragment key={pi}>
                      <div style={S(`display:flex;gap:14px;align-items:flex-start;padding:14px 6px;border-top:${pi === 0 ? '0' : '1px solid #E2EFE8'}`)}>
                        <span style={S("width:26px;height:26px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:900;background:#fff;border:1px solid #84C2A3;color:#0B7A4A;margin-top:1px")}>{p.no}</span>
                        <div style={S("flex:1;min-width:0")}>
                          <div style={S("font-size:14px;font-weight:800;color:#00462A;line-height:1.5;word-break:keep-all")}>{p.title}</div>
                          <div style={S("font-size:12.5px;color:#5C7268;margin-top:5px;line-height:1.75;word-break:keep-all")}>{p.desc}</div>
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>

                <div style={S("font-size:12.5px;font-weight:800;color:#0B7A4A;margin-top:22px;margin-bottom:2px")}>약관·상품설명서 원문</div>
                {/* 원문 바로가기 — 청약서 작성 전 약관과 상품설명서를 먼저 확인하도록 배치 */}
                <div style={S("margin-top:16px")}>
                  {/* 앱에서는 새 탭으로 열면 돌아올 길이 없다(주소창이 없다) — 화면 안에서 연다 */}
                  {app ? (
                    <div className="hov-btn" role="button" tabIndex={0}
                         onClick={() => vm.entryGo('policy', 'insurance')}
                         onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') vm.entryGo('policy', 'insurance'); }}
                         style={S("cursor:pointer;background:#fff;border:1.5px solid #84C2A3;color:#00462A;border-radius:14px;padding:14px 18px;font-size:13.5px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;word-break:keep-all")}>
                      <span style={S("flex:none;display:flex")}>{this.uiIcon('book', 18, '#0B7A4A')}</span>약관·상품설명서 전문 보기
                    </div>
                  ) : (
                    <a className="hov-btn" href={vm.policyUrl} target="_blank" rel="noreferrer"
                       style={S("text-decoration:none;background:#fff;border:1.5px solid #84C2A3;color:#00462A;border-radius:14px;padding:14px 18px;font-size:13.5px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;word-break:keep-all")}>
                      <span style={S("flex:none;display:flex")}>{this.uiIcon('book', 18, '#0B7A4A')}</span>약관·상품설명서 전문 보기 <span style={S("font-size:11px;color:#6E8A7C;flex:none")}>↗</span>
                    </a>
                  )}
                </div>

                <div style={S("display:flex;gap:10px;margin-top:18px;align-items:stretch")}>
                  <div className="hov-btn" role="button" tabIndex={0}
                     style={S("flex:1 1 auto;min-width:0;background:linear-gradient(135deg,#00462A,#0A5F3C);color:#fff;border-radius:14px;padding:16px 24px;font-size:14.5px;font-weight:900;display:flex;align-items:center;justify-content:center;cursor:pointer;word-break:keep-all")}
                     onClick={() => vm.entryGo('terms', 'insurance')}
                     onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') vm.entryGo('terms', 'insurance'); }}>
                    청약서 작성 시작하기 →
                  </div>
                </div>
                <div style={S("font-size:11.5px;color:#8FA79A;margin-top:10px;line-height:1.7;text-align:center;word-break:keep-all")}>
                  실제 가입은 약관·상품설명 확인 후 청약서 작성으로 이어집니다. 피보험자가 미성년자인 경우 법정대리인의 동의와 서명이 필요합니다.
                </div>

                {/* 중요 고지 문구 — 노란 박스 없이 일반 보조 안내 텍스트로 */}
                <div style={S("margin-top:16px")}>
                  <div style={S("font-size:11px;color:#9AA0AB;line-height:1.7;word-break:keep-all")}>
                    본 화면은 보험 가입 이해를 돕기 위한 요약 안내이며, 실제 보장 내용과 지급 제한 사항은 약관 및 상품설명서를 기준으로 합니다.
                  </div>
                </div>
              </div>

              <div style={S("max-width:1160px;margin:0 auto;padding:26px 20px 48px;width:100%;box-sizing:border-box;text-align:center")}>
                <span className="hov-link" style={S("font-size:13px;color:#9AA0AB;cursor:pointer")} onClick={() => vm.entryGo('landing')}>‹ 메가에듀패스 홈으로 돌아가기</span>
              </div>
            </div>
          </>)}

          {/* ── 인강 임베디드 가입 온보딩 ── */}
          {(['pay','tiers','terms','apply','done'].includes(vm.entry)) && (<>
            <div style={S(['apply','done'].includes(vm.entry)
              ? "position:fixed;inset:0;background:#E9ECEE;z-index:50;overflow-y:auto;display:flex;justify-content:center;align-items:flex-start;-webkit-overflow-scrolling:touch"
              : "position:fixed;inset:0;background:rgba(12,20,16,0.55);z-index:50;display:flex;align-items:center;justify-content:center;padding:20px")}>
             <div style={S(['apply','done'].includes(vm.entry)
              ? "width:100%;max-width:860px;min-height:100%;background:#F5F6F5;position:relative;display:flex;flex-direction:column;box-shadow:0 0 60px rgba(0,0,0,0.08)"
              : "width:100%;max-width:560px;max-height:92vh;background:#F5F6F5;border-radius:22px;overflow-y:auto;position:relative;box-shadow:0 24px 70px rgba(0,0,0,0.35);-webkit-overflow-scrolling:touch")}>
              {/* 상단바 + 진행 표시 (sticky) */}
              <div style={S("position:sticky;top:0;height:52px;box-sizing:border-box;z-index:3;display:flex;align-items:center;gap:8px;padding:0 14px;background:#fff;border-bottom:1px solid #E6E6E6")}>
                <span style={S("font-size:19px;color:#555;cursor:pointer")} onClick={() => {
                  if (vm.entry === 'apply') {
                    // 나가기를 택했는데 방금 지나온 약관 동의 팝업이 다시 뜨면 갇힌 느낌이 든다.
                    // 작성을 접은 것이므로 보험 상세 페이지로 되돌린다.
                    if (window.confirm('지금 나가면 작성 중인 청약서 내용이 모두 사라져요. 나가시겠어요?')) vm.entryGo('insurance');
                  } else {
                    vm.entryGo(vm.payBackEntry || 'landing');
                  }
                }}>{vm.entry === 'apply' ? '‹' : '✕'}</span>
                <span style={S("flex:1;font-size:13px;font-weight:800;color:#111")}>{({pay:'메가에듀패스 · 강의 결제',tiers:'보험 상품 선택',terms:'약관·상품설명 확인',apply:'보험 청약서 작성',done:'가입 완료'})[vm.entry]}</span>
              </div>

              <div style={S(['apply','done'].includes(vm.entry) ? "padding:24px 30px 44px;display:flex;flex-direction:column;gap:14px;flex:1" : "padding:16px;display:flex;flex-direction:column;gap:12px")}>
                {(vm.entry === 'pay') && (<>
                  <div style={S("background:#fff;border:1px solid #E6E6E6;border-radius:20px;padding:15px")}>
                    <div style={S("font-size:9.5px;color:#2B4FE8;font-weight:800")}>메가에듀 · 인강 결제</div>
                    <div style={S("font-size:14px;font-weight:800;color:#111;margin-top:8px;line-height:1.4")}>2026 올인원 메가패스 · 전 강좌 무제한</div>
                    <div style={S("font-size:10.5px;color:#888;margin-top:3px")}>국어·수학·영어·탐구 전 강좌 · 12개월</div>
                    <div style={S("display:flex;justify-content:space-between;align-items:baseline;margin-top:12px;border-top:1px solid #F0F0F0;padding-top:12px")}>
                      <span style={S("font-size:11px;color:#888")}>강의 수강료</span>
                      <span style={S("font-size:17px;font-weight:800;color:#111")}>396,000원</span>
                    </div>
                  </div>
                  <div style={S(`border-radius:18px;padding:14px 15px;border:1px solid ${vm.onbForm.insChecked ? '#8CCFB0' : '#E0E0E0'};background:${vm.onbForm.insChecked ? '#F4FBF7' : '#fff'};cursor:pointer`)} onClick={() => vm.setOnb({ insChecked: !vm.onbForm.insChecked })}>
                    <div style={S("display:flex;align-items:flex-start;gap:10px")}>
                      <div style={S(`width:22px;height:22px;border-radius:6px;flex:none;display:flex;align-items:center;justify-content:center;margin-top:1px;background:${vm.onbForm.insChecked ? '#0B8F58' : '#fff'};border:1.5px solid ${vm.onbForm.insChecked ? '#0B8F58' : '#CCC'};color:#fff;font-size:12px`)}>{vm.onbForm.insChecked ? '✓' : ''}</div>
                      <div style={S("flex:1;min-width:0")}>
                        <div style={S("display:flex;align-items:flex-start;justify-content:space-between;gap:10px")}>
                          <div>
                            <div style={S("font-size:13px;font-weight:800;color:#111;line-height:1.35")}>재수없수 재수비용 보장보험 함께 가입</div>
                            <div style={S("font-size:10.5px;color:#0B8F58;font-weight:700;margin-top:3px")}>월 1,800원대부터 · 비성적 객관 지표 기반 개인 산정</div>
                          </div>
                          <span style={S("font-size:10px;color:#0B8F58;font-weight:800;white-space:nowrap;margin-top:2px")} onClick={(e) => { e.stopPropagation(); vm.entryGo('insurance'); }}>자세히 보기</span>
                        </div>
                        <div style={S("font-size:10.5px;color:#555;line-height:1.55;margin-top:8px;word-break:keep-all")}>수능 성적이 예측 밴드보다 크게 하락해 재수가 확정되면 재수 비용을 보장합니다.</div>
                      </div>
                    </div>
                  </div>
                  <div style={S("font-size:9.5px;color:#999;line-height:1.5")}>※ 체크 시 간단한 설문·상품 선택·약관 동의·청약서 작성 후 가입이 완료됩니다.</div>
                </>)}

                {(vm.entry === 'tiers') && (<>
                  <div style={S("font-size:11.5px;color:#555;line-height:1.6")}>재수 형태별 보장 상품이에요. <b style={S("color:#111")}>보장이 클수록 보험료가 올라가요.</b> 하나를 선택하세요.<br/><span style={S("font-size:9.5px;color:#999")}>※ 아래는 포트폴리오 기준 요율이며, 성적 연동 후 개인 요율로 재산정됩니다.</span></div>
                  {(vm.tiers || []).map((t, i) => (
                    <React.Fragment key={i}>
                      <div style={S(`border-radius:20px;padding:15px 16px;background:#fff;border:1.5px solid ${vm.onbForm.tier === t.tier ? '#0B8F58' : '#E6E6E6'}`)}>
                        <div style={S("display:flex;align-items:center;justify-content:space-between;cursor:pointer")} onClick={() => vm.setOnb({ tier: t.tier })}>
                          <div style={S("display:flex;align-items:center;gap:8px")}>
                            <span style={S("font-size:14px;font-weight:800;color:#111")}>{t.tier}</span>
                            <span style={S("font-size:10px;color:#888;background:#F2F2F2;border-radius:20px;padding:2px 9px")}>{t.form}</span>
                          </div>
                          <div style={S(`width:20px;height:20px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;background:${vm.onbForm.tier === t.tier ? '#0B8F58' : '#DDD'}`)}>{vm.onbForm.tier === t.tier ? '✓' : ''}</div>
                        </div>
                        <div style={S("display:flex;justify-content:space-between;align-items:flex-end;margin-top:12px;cursor:pointer")} onClick={() => vm.setOnb({ tier: t.tier })}>
                          <div>
                            <div style={S("font-size:9px;color:#999")}>연 최대 보장 (중증 사고 시)</div>
                            <div style={S("font-size:13px;font-weight:800;color:#111;margin-top:2px")}>{(t.cover_sev/10000).toLocaleString('ko-KR')}만원</div>
                          </div>
                          <div style={S("text-align:right")}>
                            <div style={S("font-size:9px;color:#999")}>월 보험료</div>
                            <div style={S("font-size:19px;font-weight:900;color:#0B8F58")}>{t.monthly_premium.toLocaleString('ko-KR')}<span style={S("font-size:11px;font-weight:700")}>원~</span></div>
                          </div>
                        </div>
                        <div style={S("margin-top:12px;border-top:1px solid #F0F0F0;padding-top:10px;display:flex;align-items:center;justify-content:center;gap:5px;cursor:pointer")} onClick={() => vm.toggleTierDetail(t.tier)}>
                          <span style={S("font-size:10.5px;font-weight:700;color:#0B8F58")}>보장 상세 {vm.expandedTier === t.tier ? '접기' : '자세히'}</span>
                          <span style={S(`font-size:9px;color:#0B8F58;transition:transform .2s;transform:rotate(${vm.expandedTier === t.tier ? '180' : '0'}deg)`)}>▼</span>
                        </div>
                        {(vm.expandedTier === t.tier) && (<>
                          <div style={S("background:#F8FAF9;border-radius:14px;padding:12px 13px;margin-top:8px;display:flex;flex-direction:column;gap:9px;animation:riseIn .25s ease")}>
                            {[['🟡','경증 사고','수능 성적이 예측 밴드 하단(−1.75σ)을 벗어난 경우',`최대 ${(t.cover_mild/10000).toLocaleString('ko-KR')}만원 · 재수비용 6개월분(70%)`],['🔴','중증 사고','−2.25σ 이하로 크게 하락한 경우',`최대 ${(t.cover_sev/10000).toLocaleString('ko-KR')}만원 · 재수비용 12개월분(70%)`],['💳','지급 방식','보통약관은 보험가입금액 정액 지급','실비 보상은 가입 후 앱에서 신청하는 재수학원비 지원 특약(선택)'],['📅','보장 조건','수능 1회 고정 · 별도 면책 대기기간 없음','재수(재응시) 실행이 확인되어야 지급']].map((r,ri)=>(
                              <React.Fragment key={ri}>
                                <div style={S("display:flex;gap:9px;align-items:flex-start")}>
                                  <span style={S("font-size:12px;flex:none;margin-top:1px")}>{r[0]}</span>
                                  <div style={S("flex:1;min-width:0")}>
                                    <div style={S("font-size:10.5px;font-weight:700;color:#111")}>{r[1]} <span style={S("font-weight:500;color:#888")}>· {r[2]}</span></div>
                                    <div style={S("font-size:10px;color:#0B8F58;font-weight:600;margin-top:2px")}>{r[3]}</div>
                                  </div>
                                </div>
                              </React.Fragment>
                            ))}
                          </div>
                        </>)}
                      </div>
                    </React.Fragment>
                  ))}
                </>)}

                {(vm.entry === 'terms') && (<>
                  <div style={S("font-size:12px;font-weight:800;color:#111")}>약관·상품설명서 주요 내용</div>
                  <div style={S("background:#fff;border:1px solid #E6E6E6;border-radius:16px;padding:14px;font-size:10px;color:#555;line-height:1.7;max-height:250px;overflow-y:auto")}>
                    {[['제5조 청약철회','보험증권을 받은 날부터 15일 이내 철회 가능, 접수일부터 3영업일 이내 보험료 전액 반환.'],['제13조 심각도별 지급','밴드 하단을 벗어난 정도로 경증(−1.75σ)/중증(−2.25σ) 구분, 보험금 차등 지급(최초 1회한).'],['제15조 부지급','고의 급락·재수 미이행·선언 과목 미응시·부정행위·고지의무 위반·자료 미제출·진로 변경 시 부지급.'],['제16·22조 갱신·산정','가구소득·거주지역·월교육비 등 비성적 객관 지표와 사전 공시 파라미터로 보험료를 산정.'],['제25·29조 인상 상한','1회 및 누적 보험료 변동에 상한(캡)을 두어 급격한 인상을 제한.'],['제20·36조 데이터','급락 판정은 교육청·평가원 원본 성적을 사용하고, 성적 자료는 산정 목적과 분리 관리.']].map((r,i)=>(
                      <React.Fragment key={i}>
                        <div style={S("padding:7px 0;border-bottom:1px solid #F2F2F2")}><b style={S("color:#0B8F58")}>{r[0]}</b> — {r[1]}</div>
                      </React.Fragment>
                    ))}
                    <div style={S("margin-top:8px;color:#999")}>※ 전체 조항은 가입 후 AI 상담(노재수)에서 약관 원문 근거로 확인할 수 있어요.</div>
                  </div>
                  {[['agree1', '[필수] 보험 약관 및 상품설명서 주요 내용을 확인했습니다'], ['agree2', '[필수] 상품 보장·지급·면책 조건을 이해했습니다']].map(([key, label], i) => (
                    <React.Fragment key={i}>
                      <div style={S("display:flex;align-items:center;gap:10px;cursor:pointer")} onClick={() => vm.setOnb({ [key]: !vm.onbForm[key] })}>
                        <div style={S(`width:22px;height:22px;border-radius:6px;flex:none;display:flex;align-items:center;justify-content:center;background:${vm.onbForm[key] ? '#0B8F58' : '#fff'};border:1.5px solid ${vm.onbForm[key] ? '#0B8F58' : '#CCC'};color:#fff;font-size:12px`)}>{vm.onbForm[key] ? '✓' : ''}</div>
                        <span style={S("font-size:11px;color:#333")}>{label}</span>
                      </div>
                    </React.Fragment>
                  ))}
                </>)}

                {(vm.entry === 'apply') && (<>
                  <div style={S("display:flex;flex-direction:column;align-items:center;text-align:center;background:linear-gradient(135deg,#0B7A4A,#12A566);border-radius:16px;padding:20px 22px;margin-bottom:4px")}>
                    <div style={S("font-size:19px;font-weight:900;color:#fff;letter-spacing:-0.5px")}>재수없수 재수비용 보장보험 청약서</div>
                    <div style={S("font-size:12px;color:rgba(255,255,255,0.85);margin-top:5px;line-height:1.55")}>계약자·피보험자 정보와 고지사항을 정확히 작성해 주세요. 입력하신 내용은 요율 산정과 보장 심사에 사용됩니다.</div>
                  </div>
                  <div style={S("background:#fff;border:1px solid #DADADA;border-radius:6px;padding:0;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.05)")}>
                    {/* 문서 헤더 */}
                    <div style={S("background:#0B7A4A;color:#fff;padding:14px 16px")}>
                      <div style={S("font-size:14px;font-weight:800;letter-spacing:0.5px")}>보험 청약서 <span style={S("font-size:10px;font-weight:500;opacity:0.8")}>(가입 설문)</span></div>
                    </div>
                    <div style={S("padding:14px 15px;display:flex;flex-direction:column;gap:16px")}>

                      {/* 가입 상품 선택 */}
                      <div>
                        <div style={S("font-size:11.5px;font-weight:800;color:#0B7A4A;border-bottom:2px solid #0B7A4A;padding-bottom:4px")}>1. 가입 상품 선택</div>
                        <div style={S("margin-top:9px")}>
                          <div style={S("font-size:10px;font-weight:700;color:#333;margin-bottom:5px")}>가입 시점 <span style={S("font-size:8.5px;font-weight:500;color:#999")}>(늦게 가입할수록 보험료가 올라가요 — 별표2)</span></div>
                          <div style={S("display:flex;gap:6px;flex-wrap:wrap")}>
                            {vm.enrollWindows.map((w, wi) => (
                              <div key={wi} onClick={w.onClick} style={S(`font-size:10.5px;font-weight:600;padding:7px 12px;border-radius:8px;cursor:pointer;border:1.5px solid ${w.selected?'#0B7A4A':'#DDD'};background:${w.selected?'#0B7A4A':'#fff'};color:${w.selected?'#fff':'#555'}`)}>{w.label}</div>
                            ))}
                          </div>
                        </div>
                        {/* 앱에서는 4열이면 '스탠다드'가 두 줄로 끊긴다 */}
                        <div style={S(A(
                          "display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:12px",
                          "display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px",
                        ))}>
                          {vm.tierRows.map((t, ti) => (
                            <div key={ti} onClick={()=>vm.setOnb({tier:t.tier})} style={S(`box-sizing:border-box;min-height:72px;border-radius:10px;border:1.5px solid ${vm.onbForm.tier===t.tier?'#0B7A4A':'#DDE5E0'};background:${vm.onbForm.tier===t.tier?'#F0FAF4':'#fff'};padding:9px 8px;cursor:pointer;display:flex;flex-direction:column;justify-content:space-between`)}>
                              <div style={S("display:flex;align-items:center;justify-content:space-between;gap:5px")}>
                                <span style={S(`font-size:11px;font-weight:900;color:${vm.onbForm.tier===t.tier?'#0B7A4A':'#222'}`)}>{t.tier}</span>
                                <span style={S(`width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;background:${vm.onbForm.tier===t.tier?'#0B7A4A':'#D1D5DB'}`)}>{vm.onbForm.tier===t.tier?'✓':''}</span>
                              </div>
                              <div>
                                <div style={S("font-size:9px;color:#6B7280;font-weight:700")}>{t.form}</div>
                                <div style={S("font-size:11px;color:#111;font-weight:900;margin-top:2px")}>{t.premiumLabel}원~</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div onClick={vm.toggleApplyTierTable} style={S("margin-top:9px;border:1px solid #B9D6C7;border-radius:10px;background:#F6FBF8;color:#0B7A4A;height:36px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:10.5px;font-weight:900;cursor:pointer")}>
                          <span>{vm.applyTierTableOpen ? '티어표 접기' : '티어표 펼쳐보기'}</span>
                          <span style={S(`font-size:9px;transition:transform .2s;transform:rotate(${vm.applyTierTableOpen ? '180' : '0'}deg)`)}>▼</span>
                        </div>
                        {vm.applyTierTableOpen && (
                          <div style={S("margin-top:8px;border:1px solid #D7E6DE;border-radius:10px;overflow:hidden;background:#fff")}>
                            <div style={S("display:grid;grid-template-columns:1.05fr .85fr .9fr .9fr 1.35fr;background:#E2F1E8;color:#073F2A;font-size:9.5px;font-weight:900;border-bottom:1px solid #CFE0D6")}>
                              {['상품','월 보험료','경증 보장','중증 보장','추천 대상'].map((h,hi)=><div key={hi} style={S("padding:8px 7px")}>{h}</div>)}
                            </div>
                            {vm.tierRows.map((t, ti) => (
                              <div key={ti} onClick={()=>vm.setOnb({tier:t.tier})} style={S(`display:grid;grid-template-columns:1.05fr .85fr .9fr .9fr 1.35fr;align-items:center;border-top:${ti===0?'0':'1px solid #EDF2EF'};background:${vm.onbForm.tier===t.tier?'#F0FAF4':'#fff'};cursor:pointer`)}>
                                <div style={S(`padding:8px 7px;font-size:10px;font-weight:900;color:${vm.onbForm.tier===t.tier?'#0B7A4A':'#111'}`)}>{vm.onbForm.tier===t.tier?'✓ ':''}{t.tier}<div style={S("font-size:8px;color:#6B7280;font-weight:700;margin-top:1px")}>{t.form}</div></div>
                                <div style={S("padding:8px 7px;font-size:9.5px;font-weight:800;color:#111")}>{t.premiumLabel}원~</div>
                                <div style={S("padding:8px 7px;font-size:9.5px;color:#111;font-weight:700")}>{t.mildLabel}</div>
                                <div style={S("padding:8px 7px;font-size:9.5px;color:#111;font-weight:700")}>{t.sevLabel}</div>
                                <div style={S("padding:8px 7px;font-size:8.5px;color:#4B5563;line-height:1.35")}>{t.forWhom}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 피보험자 기본정보 */}
                      <div>
                        <div style={S("font-size:11.5px;font-weight:800;color:#0B7A4A;border-bottom:2px solid #0B7A4A;padding-bottom:4px")}>2. 피보험자 기본정보</div>
                        <div style={S("margin-top:9px")}>
                          <div style={S("font-size:10px;font-weight:700;color:#333;margin-bottom:5px")}>피보험자 (학생) 성명 · 연락처</div>
                          <div style={S("display:flex;gap:6px;flex-wrap:wrap")}>
                            <input value={vm.apply.p_name} onChange={e=>vm.setApply({p_name:e.target.value})} placeholder="성명" style={S("flex:1;min-width:70px;box-sizing:border-box;border:1px solid #DDD;border-radius:8px;padding:9px 11px;font-size:11px;font-family:inherit;outline:none")} />
                            <input value={vm.apply.p_phone} onChange={e=>vm.setApply({p_phone:this._phoneFmt(e.target.value)})} inputMode="numeric" maxLength={13} placeholder="010-0000-0000 (선택)" style={S("flex:1.3;min-width:120px;box-sizing:border-box;border:1px solid #DDD;border-radius:8px;padding:9px 11px;font-size:11px;font-family:inherit;outline:none")} />
                          </div>
                          <div style={S("font-size:8.5px;color:#999;margin:6px 0 4px")}>생년월일</div>
                          {this._dob('p_birth', 2004, 2011)}
                        </div>
                        <div style={S("display:flex;gap:6px;margin-top:11px")}>
                          <input value={vm.apply.school} onChange={e=>vm.setApply({school:e.target.value})} placeholder="학교 (예: OO고)" style={S("flex:1;min-width:0;box-sizing:border-box;border:1px solid #DDD;border-radius:8px;padding:9px 11px;font-size:11px;font-family:inherit;outline:none")} />
                          <input value={vm.apply.target_univ} onChange={e=>vm.setApply({target_univ:e.target.value})} placeholder="목표 대학·학과 (선택)" style={S("flex:1;min-width:0;box-sizing:border-box;border:1px solid #DDD;border-radius:8px;padding:9px 11px;font-size:11px;font-family:inherit;outline:none")} />
                        </div>
                      </div>

                      {/* Ⅰ 계약 관계자 */}
                      <div>
                        <div style={S("font-size:11.5px;font-weight:800;color:#0B7A4A;border-bottom:2px solid #0B7A4A;padding-bottom:4px")}>3. 계약 관계자</div>
                        <div style={S("font-size:8.5px;color:#C0304A;margin-top:5px")}>※ 피보험자가 미성년자이므로 계약자는 법정대리인(보호자)이 됩니다</div>
                        <div style={S("margin-top:9px")}>
                          <div style={S("font-size:10px;font-weight:700;color:#333;margin-bottom:5px")}>계약자 (법정대리인)</div>
                          <div style={S("display:flex;gap:6px;flex-wrap:wrap")}>
                            <input value={vm.apply.c_name} onChange={e=>vm.setApply({c_name:e.target.value})} placeholder="성명" style={S("flex:1;min-width:70px;box-sizing:border-box;border:1px solid #DDD;border-radius:8px;padding:9px 11px;font-size:11px;font-family:inherit;outline:none")} />
                            <input value={vm.apply.c_phone} onChange={e=>vm.setApply({c_phone:this._phoneFmt(e.target.value)})} inputMode="numeric" maxLength={13} placeholder="010-0000-0000" style={S("flex:1.3;min-width:120px;box-sizing:border-box;border:1px solid #DDD;border-radius:8px;padding:9px 11px;font-size:11px;font-family:inherit;outline:none")} />
                          </div>
                          <div style={S("font-size:8.5px;color:#999;margin:6px 0 4px")}>생년월일</div>
                          {this._dob('c_birth', 1960, 2006)}
                          <div style={S("display:flex;gap:6px;margin-top:8px")}>
                            {['부','모','기타'].map((o,oi)=>(<div key={oi} onClick={()=>vm.setApply({c_rel:o})} style={S(`font-size:10px;font-weight:600;padding:6px 13px;border-radius:8px;cursor:pointer;border:1.5px solid ${vm.apply.c_rel===o?'#0B7A4A':'#DDD'};background:${vm.apply.c_rel===o?'#0B7A4A':'#fff'};color:${vm.apply.c_rel===o?'#fff':'#666'}`)}>{o}</div>))}
                            <span style={S("font-size:9px;color:#999;align-self:center")}>피보험자와의 관계</span>
                          </div>
                        </div>
                      </div>

                      {/* Ⅱ 가입 자격 */}
                      <div>
                        <div style={S("font-size:11.5px;font-weight:800;color:#0B7A4A;border-bottom:2px solid #0B7A4A;padding-bottom:4px")}>4. 가입 자격 확인 <span style={S("font-size:8.5px;color:#C0304A")}>필수</span></div>
                        {[['현재 학년','q_grade',['고1','고2','고3(6월 모평 전)'],'고3 6월 모의평가 이후 신규가입 불가'],['대기기간 안내','q_wait',['확인함'],'가입일~수능 시행일 및 수능 후 심사기간 — 별도의 면책 대기기간은 없음'],['성적자료 제출 동의','q_data',['동의','미동의'],'미동의 시 가입 불가'],['요율지표 증빙서류 제출 동의','q_evidence',['동의','미동의'],'가구소득·거주지역·월교육비 증빙서류 — 미동의 시 가입 불가']].map((q,qi)=>(
                          <React.Fragment key={qi}>
                            <div style={S("margin-top:9px")}>
                              <div style={S("font-size:10px;font-weight:600;color:#333")}>{q[0]}</div>
                              <div style={S("display:flex;gap:6px;flex-wrap:wrap;margin-top:5px")}>
                                {q[2].map((o,oi)=>(<div key={oi} onClick={()=>vm.setApply({[q[1]]:o})} style={S(`font-size:10.5px;font-weight:600;padding:7px 12px;border-radius:8px;cursor:pointer;border:1.5px solid ${vm.apply[q[1]]===o?'#0B7A4A':'#DDD'};background:${vm.apply[q[1]]===o?'#0B7A4A':'#fff'};color:${vm.apply[q[1]]===o?'#fff':'#555'}`)}>{o}</div>))}
                              </div>
                              <div style={S(`font-size:9px;color:${(q[1] === 'q_data' || q[1] === 'q_evidence') ? '#C0304A' : '#999'};margin-top:3px`)}>{q[3]}</div>
                            </div>
                          </React.Fragment>
                        ))}
                      </div>

                      {/* Ⅲ 고지사항 */}
                      <div>
                        <div style={S("font-size:11.5px;font-weight:800;color:#0B7A4A;border-bottom:2px solid #0B7A4A;padding-bottom:4px")}>5. 계약 전 알릴 의무 (고지) <span style={S("font-size:8.5px;color:#C0304A")}>필수</span></div>
                        {[['d2','최근 1년 내 학업 중단·휴학·유급 경험이 있습니까?'],['d3','학업에 지장을 주는 질병·장애가 있습니까?'],['d4','타사 유사 교육·재수 보험에 가입되어 있습니까?'],['d5','유학·해외진학·취업 등 수능 외 진로 계획이 있습니까?']].map((q,qi)=>(
                          <React.Fragment key={qi}>
                            <div style={S("display:flex;align-items:center;gap:8px;margin-top:8px")}>
                              <span style={S("flex:1;min-width:0;font-size:10px;color:#333;line-height:1.4")}>{qi+1}. {q[1]}</span>
                              <div style={S("display:flex;gap:5px;flex:none")}>
                                {['아니오','예'].map((o,oi)=>(<div key={oi} onClick={()=>vm.setApply({[q[0]]:o})} style={S(`font-size:10px;font-weight:600;padding:6px 11px;border-radius:8px;cursor:pointer;border:1.5px solid ${vm.apply[q[0]]===o?'#0B7A4A':'#DDD'};background:${vm.apply[q[0]]===o?'#0B7A4A':'#fff'};color:${vm.apply[q[0]]===o?'#fff':'#666'}`)}>{o}</div>))}
                              </div>
                            </div>
                          </React.Fragment>
                        ))}
                      </div>

                      {/* Ⅳ 요율 산출 문항 */}
                      <div>
                        <div style={S("font-size:11.5px;font-weight:800;color:#0B7A4A;border-bottom:2px solid #0B7A4A;padding-bottom:4px")}>6. 보험료 산출 문항 <span style={S("font-size:8.5px;color:#0B8F58")}>요율 반영 — 이 3개 항목만 사용</span></div>
                        <div style={S("font-size:8.5px;color:#999;margin-top:5px")}>※ 성적과 무관한 객관 지표 · 증빙서류로 확인</div>
                        {[
                          ['가구소득 (월평균)','income',vm.incomeOptions],
                          ['거주지역 (지역규모 → 학원밀집도지수)','region',vm.regionOptions],
                          ['월교육비 (피보험자 1인 기준)','edu_cost',vm.eduCostOptions]
                        ].map((q,qi)=>(
                          <React.Fragment key={qi}>
                            <div style={S("margin-top:9px")}>
                              <div style={S("font-size:10px;font-weight:600;color:#333")}>{qi+1}. {q[0]}</div>
                              <div style={S("display:flex;gap:6px;flex-wrap:wrap;margin-top:5px")}>
                                {q[2].map((o,oi)=>(<div key={oi} onClick={()=>vm.setApply({[q[1]]:o})} style={S(`font-size:10px;font-weight:600;padding:7px 11px;border-radius:8px;cursor:pointer;border:1.5px solid ${vm.apply[q[1]]===o?'#0B8F58':'#DDD'};background:${vm.apply[q[1]]===o?'rgba(11,143,88,0.08)':'#fff'};color:${vm.apply[q[1]]===o?'#0B8F58':'#666'}`)}>{o}</div>))}
                              </div>
                            </div>
                          </React.Fragment>
                        ))}
                      </div>

                      {/* 응시과목 선언 */}
                      <div>
                        <div style={S("font-size:11.5px;font-weight:800;color:#0B7A4A;border-bottom:2px solid #0B7A4A;padding-bottom:4px")}>7. 응시과목 선언 <span style={S("font-size:8.5px;color:#999")}>고3 9월 갱신(최종 갱신) 시 확정</span></div>
                        <div style={S("font-size:8.5px;color:#999;margin-top:5px;line-height:1.5")}>※ 급락 판정은 여기서 선언한 과목만으로 산출합니다. 최소 2과목 이상 선언해야 하며, 선언 이후에는 변경할 수 없습니다.</div>
                        <div style={S("display:flex;gap:6px;flex-wrap:wrap;margin-top:9px")}>
                          {[['국어','subj_kor'],['수학','subj_math'],['영어','subj_eng'],['사회탐구','subj_soc'],['과학탐구','subj_sci']].map(([label,key],si)=>(
                            <div key={si} onClick={()=>vm.setApply({[key]: !vm.apply[key]})} style={S(`font-size:10.5px;font-weight:600;padding:7px 12px;border-radius:8px;cursor:pointer;border:1.5px solid ${vm.apply[key]?'#0B7A4A':'#DDD'};background:${vm.apply[key]?'#0B7A4A':'#fff'};color:${vm.apply[key]?'#fff':'#555'}`)}>{label}</div>
                          ))}
                        </div>
                        {[vm.apply.subj_kor,vm.apply.subj_math,vm.apply.subj_eng,vm.apply.subj_soc,vm.apply.subj_sci].filter(Boolean).length < 2 && (
                          <div style={S("font-size:9px;color:#C0304A;margin-top:5px")}>최소 2과목 이상 선언해 주세요.</div>
                        )}
                      </div>

                      {/* Ⅴ 포트폴리오·통계 분석용 참고 문항 */}
                      <div>
                        <div style={S("font-size:11.5px;font-weight:800;color:#0B7A4A;border-bottom:2px solid #0B7A4A;padding-bottom:4px")}>8. 포트폴리오·통계 분석용 참고 문항 <span style={S("font-size:8.5px;color:#999")}>요율 미반영</span></div>
                        <div style={S("font-size:8.5px;color:#999;margin-top:5px;line-height:1.5")}>※ 보험료 산출·인수심사·보험금 지급 판정에 일절 사용되지 않으며, 응답하지 않아도 가입 및 보험료에 불이익이 없습니다.</div>
                        {[
                          ['재학 중인 고등학교 유형','school_type',['특목고·자율고','일반고','기타(특성화고 등)']],
                          ['대입 준비 방향(정시지향도)','q_direction',['수시 중심','정시 중심','수시·정시 병행']],
                          ['목표 대학권역','target_area',['인서울','수도권(서울 제외, 경기·인천)','지방']],
                          ['주당 공부시간','study_time',['10시간 미만','10~20시간','20~30시간','30시간 이상']],
                          ['형제·자매 중 재수 경험자가 있습니까?','sibling',['없음','있음','해당 없음(외동)']]
                        ].map((q,qi)=>(
                          <React.Fragment key={qi}>
                            <div style={S("margin-top:9px")}>
                              <div style={S("font-size:10px;font-weight:600;color:#333")}>{qi+1}. {q[0]}</div>
                              <div style={S("display:flex;gap:6px;flex-wrap:wrap;margin-top:5px")}>
                                {q[2].map((o,oi)=>(<div key={oi} onClick={()=>vm.setApply({[q[1]]:o})} style={S(`font-size:10px;font-weight:600;padding:7px 11px;border-radius:8px;cursor:pointer;border:1.5px solid ${vm.apply[q[1]]===o?'#0B8F58':'#DDD'};background:${vm.apply[q[1]]===o?'rgba(11,143,88,0.08)':'#fff'};color:${vm.apply[q[1]]===o?'#0B8F58':'#666'}`)}>{o}</div>))}
                              </div>
                            </div>
                          </React.Fragment>
                        ))}
                        <div style={S("display:flex;align-items:center;gap:8px;margin-top:9px")}>
                          <span style={S("flex:1;min-width:0;font-size:9.5px;color:#333;line-height:1.4")}>포트폴리오·통계 분석용 참고 문항의 수집·이용에 동의합니다</span>
                          <div style={S("display:flex;gap:5px;flex:none")}>
                            {['동의','미동의'].map((o,oi)=>(<div key={oi} onClick={()=>vm.setApply({stat_consent:o})} style={S(`font-size:9.5px;font-weight:600;padding:6px 9px;border-radius:8px;cursor:pointer;border:1.5px solid ${vm.apply.stat_consent===o?'#0B8F58':'#DDD'};background:${vm.apply.stat_consent===o?'rgba(11,143,88,0.08)':'#fff'};color:${vm.apply.stat_consent===o?'#0B8F58':'#666'}`)}>{o}</div>))}
                          </div>
                        </div>
                      </div>

                      {/* Ⅵ 개인정보 동의 */}
                      <div>
                        <div style={S("font-size:11.5px;font-weight:800;color:#0B7A4A;border-bottom:2px solid #0B7A4A;padding-bottom:4px")}>9. 개인정보 수집·이용 동의</div>
                        {[['pi_req','[필수] 성명·생년월일·연락처, 가구소득·거주지역·월교육비(요율지표), 고1~고3 학력평가·모의평가·수능 성적 (거래종료 후 5년)'],['pi_opt','[선택] 고등학교 유형, 정시지향도, 목표대학권역, 주당 공부시간, 형제·자매 재수 이력 (가명처리, 3년)'],['pi_counsel','[선택] 심리상담 관련 응답 (서비스 종료 시까지)']].map((q,qi)=>(
                          <React.Fragment key={qi}>
                            <div style={S("display:flex;align-items:center;gap:8px;margin-top:8px")}>
                              <span style={S("flex:1;min-width:0;font-size:9.5px;color:#333;line-height:1.4")}>{q[1]}</span>
                              <div style={S("display:flex;gap:5px;flex:none")}>
                                {['동의','미동의'].map((o,oi)=>(<div key={oi} onClick={()=>vm.setApply({[q[0]]:o})} style={S(`font-size:9.5px;font-weight:600;padding:6px 9px;border-radius:8px;cursor:pointer;border:1.5px solid ${vm.apply[q[0]]===o?'#0B8F58':'#DDD'};background:${vm.apply[q[0]]===o?'rgba(11,143,88,0.08)':'#fff'};color:${vm.apply[q[0]]===o?'#0B8F58':'#666'}`)}>{o}</div>))}
                              </div>
                            </div>
                          </React.Fragment>
                        ))}
                        <div style={S("font-size:9px;color:#C0304A;margin-top:6px")}>※ 필수 미동의 시 계약 체결 불가</div>
                      </div>

                      {/* Ⅶ 자필서명 */}
                      <div>
                        <div style={S("font-size:11.5px;font-weight:800;color:#0B7A4A;border-bottom:2px solid #0B7A4A;padding-bottom:4px")}>10. 확인 및 자필서명</div>
                        <div style={S("font-size:9px;color:#666;line-height:1.6;margin-top:7px")}>본인은 위 사항을 사실대로 기재하였으며, 계약 전 알릴 의무와 그 위반 시의 불이익(계약 해지 및 보험금 부지급)에 대한 설명을 듣고 이해하였습니다. 또한 상품설명서 및 약관을 교부받고 주요 내용에 대한 설명을 들었으며, 성적표·요율지표 증빙서류 등 관련 서류의 확인·제출에 동의합니다.</div>
                        <div style={S("margin-top:11px")}>
                          <div style={S("font-size:10px;font-weight:700;color:#333;margin-bottom:5px")}>전자서명 <span style={S("font-size:8.5px;font-weight:500;color:#999")}>(계약자·법정대리인 성명을 다시 입력하면 서명을 대신합니다)</span></div>
                          <input value={vm.apply.sign_name} onChange={e=>{const v=e.target.value; vm.setApply({sign_name:v, sign: v.trim() !== '' && v.trim() === (vm.apply.c_name||'').trim()});}} placeholder={vm.apply.c_name ? `${vm.apply.c_name}` : '계약자(법정대리인) 성명 입력'} style={S(`width:100%;box-sizing:border-box;border:1px solid ${vm.apply.sign_name && !vm.apply.sign ? '#C0304A' : '#DDD'};border-radius:8px;padding:9px 11px;font-size:13px;font-family:'KoddiUDOnGothic',cursive;outline:none`)} />
                          {vm.apply.sign_name && !vm.apply.sign && (
                            <div style={S("font-size:8.5px;color:#C0304A;margin-top:4px")}>계약자(법정대리인) 성명({vm.apply.c_name || '위에서 입력한 성명'})과 일치하지 않습니다</div>
                          )}
                        </div>
                        <div style={S(`display:flex;align-items:center;gap:10px;margin-top:10px;background:${vm.apply.sign?'rgba(11,143,88,0.06)':'#FAFAFA'};border:1.5px solid ${vm.apply.sign?'#0B8F58':'#DDD'};border-radius:14px;padding:12px 13px`)}>
                          <div style={S(`width:22px;height:22px;border-radius:6px;flex:none;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;background:${vm.apply.sign?'#0B8F58':'#fff'};border:1.5px solid ${vm.apply.sign?'#0B8F58':'#CCC'}`)}>{vm.apply.sign?'✓':''}</div>
                          <span style={S("font-size:10.5px;color:#333;line-height:1.4")}>본인은 위 청약 내용을 확인하고 <b style={S("color:#0B8F58")}>전자서명에 동의</b>합니다. 전자서명자(계약자): {vm.apply.c_name||'법정대리인'}</span>
                        </div>
                      </div>

                    </div>
                  </div>
                </>)}

                {(vm.entry === 'done') && (<>
                  <div style={S("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:12px;padding:30px 10px;animation:riseIn .4s ease")}>
                    <div style={S("width:70px;height:70px;border-radius:50%;background:#0B8F58;display:flex;align-items:center;justify-content:center;font-size:35px;color:#fff")}>✓</div>
                    <div style={S("font-size:22px;font-weight:900;color:#111")}>가입이 완료됐어요!</div>
                    <div style={S("font-size:11.5px;color:#666;line-height:1.6")}>{vm.apply.p_name || vm.onbForm.name || '학생'}님, <b style={S("color:#0B8F58")}>{vm.onbForm.tier}</b> 상품에 가입되었어요.<br/>청약 정보가 저장되었고, 가입 이후 성적 등록 및<br/>보험료 변동 확인은 재수없수 앱에서 이용할 수 있어요.</div>
                    {/* 백엔드가 방금 확정한 월납·보장금 — 화면에서 다시 계산하지 않는다 */}
                    {vm.enrolledQuote && vm.enrolledQuote.monthly_premium != null && (
                      <div style={S("width:100%;max-width:560px;margin-top:16px;background:linear-gradient(135deg,#F2FBF6,#FFFFFF);border:1px solid #BEE3CE;border-radius:18px;box-sizing:border-box;padding:16px 18px;text-align:left")}>
                        <div style={S("font-size:10px;font-weight:800;color:#0B8F58;letter-spacing:0.3px")}>확정된 계약 조건</div>
                        <div style={S("display:flex;align-items:baseline;gap:6px;margin-top:7px")}>
                          <span style={S("font-size:26px;font-weight:900;color:#00462A;letter-spacing:-1px")}>{vm.enrolledQuote.monthly_premium.toLocaleString('ko-KR')}</span>
                          <span style={S("font-size:12px;font-weight:800;color:#00462A")}>원 / 월</span>
                          <span style={S("font-size:10.5px;color:#6B7C72;margin-left:auto")}>{vm.remainingLabel} 가입 · {vm.enrolledQuote.remaining_months}개월 납입</span>
                        </div>
                        {vm.enrolledQuote.coverage && (
                          <div style={S("display:flex;gap:8px;margin-top:12px;flex-wrap:wrap")}>
                            {[['경증 사고 시', vm.enrolledQuote.coverage.mild], ['중증 사고 시', vm.enrolledQuote.coverage.severe]].map((r, ri) => (
                              <div key={ri} style={S("flex:1 1 140px;background:#fff;border:1px solid #DCEBE3;border-radius:12px;padding:9px 11px")}>
                                <div style={S("font-size:9.5px;color:#6B7C72")}>{r[0]}</div>
                                <div style={S("font-size:14px;font-weight:900;color:#00462A;margin-top:2px")}>{(r[1] / 10000).toLocaleString('ko-KR')}만원</div>
                              </div>
                            ))}
                          </div>
                        )}
                        <a href={vm.policyUrl + '#' + vm.anchors.보험료표} target="_blank" rel="noreferrer" style={S("display:inline-block;margin-top:11px;font-size:10px;font-weight:700;color:#0B8F58;text-decoration:none")}>약관 별표4 — 보험료 산출 기준 보기 ↗</a>
                      </div>
                    )}

                    <div style={S("width:100%;max-width:560px;margin-top:18px;background:#fff;border:1px solid #D9E3DE;border-radius:18px;box-sizing:border-box;overflow:hidden;text-align:left")}>
                      <div style={S("padding:15px 18px;background:#F7FAF8;border-bottom:1px solid #E5ECE8;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap")}>
                        <div>
                          <div style={S("font-size:13.5px;font-weight:900;color:#00462A;line-height:1.4;word-break:keep-all")}>모바일 계약관리 안내</div>
                          <div style={S("font-size:10.5px;color:#6B7C72;margin-top:3px;word-break:keep-all")}>가입 이후 조회·변경·청구 업무는 재수없수 앱에서 이용할 수 있습니다.</div>
                        </div>
                        <span style={S("font-size:10px;font-weight:800;color:#0B8F58;background:#EAF7EC;border:1px solid #CDE7D9;border-radius:20px;padding:5px 10px;white-space:nowrap")}>앱 설치 권장</span>
                      </div>
                      <div style={S("padding:16px 18px;display:grid;grid-template-columns:1fr 1fr;gap:10px")}>
                        {['계약 및 보장내역 조회','성적 등록·보험료 변동 확인','보험금 청구 진행 확인','중요 알림 수신'].map((txt, ti) => (
                          <div key={ti} style={S("display:flex;align-items:flex-start;gap:7px;font-size:10.8px;color:#4F5E56;line-height:1.5;word-break:keep-all")}>
                            <span style={S("color:#0B8F58;font-weight:900;flex:none")}>✓</span>{txt}
                          </div>
                        ))}
                      </div>
                      {/* 앱 진입 — 방금 발급된 student_id 를 넘겨 앱이 이 계약을 바로
                          불러오게 한다 (웹 → 앱 핸드오프). */}
                      <div style={S("padding:0 18px 17px;display:flex;gap:9px;flex-wrap:wrap")}>
                        <a className="hov-btn" href={vm.appUrl} target="_blank" rel="noreferrer" style={S("flex:1 1 100%;text-decoration:none;background:linear-gradient(135deg,#00462A,#0B8F58);color:#fff;border-radius:12px;height:46px;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:900")}>재수없수 앱에서 내 계약 보기 →</a>
                        <a className="hov-btn" href="https://play.google.com/store" target="_blank" rel="noreferrer" style={S("flex:1 1 150px;text-decoration:none;background:#0B8F58;color:#fff;border-radius:12px;height:42px;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:800")}>안드로이드 앱 설치</a>
                        <a className="hov-btn" href="https://www.apple.com/app-store/" target="_blank" rel="noreferrer" style={S("flex:1 1 150px;text-decoration:none;background:#0B8F58;color:#fff;border-radius:12px;height:42px;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:800")}>iOS 앱 설치</a>
                      </div>
                      {!vm.enrolledId && (
                        <div style={S("margin:0 18px 16px;background:#FFF6E9;border:1px solid #F0D9B5;border-radius:12px;padding:10px 12px;font-size:10.5px;color:#8A6220;line-height:1.55;word-break:keep-all")}>
                          ⚠️ 서버에 저장되지 않은 데모 진행이라 앱에서 이 계약을 불러올 수 없어요.
                        </div>
                      )}
                    </div>
                  </div>
                </>)}
              </div>

              {/* 하단 CTA (sticky) */}
              {(vm.entry !== 'done') && (
              <div style={S("position:sticky;bottom:0;box-sizing:border-box;z-index:3;padding:12px 16px;background:#fff;border-top:1px solid #E6E6E6")}>
                {(vm.entry === 'pay') && (
                  <div style={S("background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:14px;font-weight:700;border-radius:16px;height:52px;display:flex;align-items:center;justify-content:center;cursor:pointer")} onClick={() => vm.entryGo('tiers')}>{vm.onbForm.insChecked ? '보험 포함하고 다음으로 →' : '결제하고 계속 →'}</div>
                )}
                {(vm.entry === 'tiers') && (
                  <div style={S("background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:14px;font-weight:700;border-radius:16px;height:52px;display:flex;align-items:center;justify-content:center;cursor:pointer")} onClick={() => vm.entryGo('terms')}>{vm.onbForm.tier} 선택하고 계속 →</div>
                )}
                {(vm.entry === 'terms') && (
                  <div style={S(`color:#fff;font-size:14px;font-weight:700;border-radius:16px;height:52px;display:flex;align-items:center;justify-content:center;cursor:pointer;background:${vm.onbForm.agree1 && vm.onbForm.agree2 ? '#0B8F58' : '#C7CBD1'}`)} onClick={() => (vm.onbForm.agree1 && vm.onbForm.agree2) && vm.entryGo('apply')}>동의하고 청약서 작성 →</div>
                )}
                {(vm.entry === 'apply') && (
                  <div style={S(`color:#fff;font-size:14px;font-weight:700;border-radius:16px;height:52px;display:flex;align-items:center;justify-content:center;cursor:pointer;background:${vm.applyValid ? '#0B8F58' : '#C7CBD1'}`)} onClick={() => vm.applyValid && vm.submitEnroll()}>{vm.applyValid ? '청약서 제출하고 가입 완료' : '필수 항목을 모두 작성해 주세요'}</div>
                )}
              </div>
              )}
             </div>
            </div>
          </>)}

          {/* ── 로딩(분석 중) 오버레이 ── */}
          {(vm.loading) && (<>
            <div style={S("position:fixed;inset:0;background:linear-gradient(160deg,#076B41,#0B8F58 55%,#23C088);z-index:70;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:32px")}>
              <img src={IMG_F7F53234} alt="" style={S("width:74px;height:74px;object-fit:contain")} />
              <div style={S("font-size:20px;font-weight:800;color:#fff;text-align:center;line-height:1.4;letter-spacing:-0.3px")}>재수없는 우리 아이!<br/>부담없는 우리집!</div>
              <div style={S("width:40px;height:40px;border:4px solid rgba(255,255,255,0.28);border-top-color:#fff;border-radius:50%;animation:spin 0.9s linear infinite;margin-top:4px")}></div>
              <div style={S("font-size:11.5px;font-weight:600;color:rgba(255,255,255,0.9);text-align:center;min-height:18px")}>{vm.loadStage || '준비하고 있어요…'}</div>
            </div>
          </>)}

          {/* ── 청약 제출 실패 ──
              기존에는 실패해도 가입완료 화면으로 넘어가 사용자에게 성공처럼 보였다.
              이제 청약서에 머문 채 원인을 알리고 재시도할 수 있게 한다. */}
          {(vm.enrollError && !vm.loading) && (<>
            <div role="dialog" aria-modal="true" aria-labelledby="enroll-error-title"
                 style={S("position:fixed;inset:0;background:rgba(16,24,20,0.55);z-index:80;display:flex;align-items:center;justify-content:center;padding:22px")}>
              <div style={S("width:100%;max-width:380px;background:#fff;border-radius:20px;padding:22px 20px;box-sizing:border-box;box-shadow:0 24px 60px rgba(0,0,0,0.22)")}>
                <div style={S("font-size:42px;line-height:1")}>⚠️</div>
                <div id="enroll-error-title" style={S("font-size:15.5px;font-weight:900;color:#1A1C22;margin-top:13px")}>청약서를 제출하지 못했어요</div>
                <div style={S("font-size:11.5px;color:#6B7280;line-height:1.6;margin-top:8px;word-break:keep-all")}>
                  작성하신 내용은 그대로 남아 있어요. 잠시 후 다시 시도해 주세요.
                </div>
                <div style={S("margin-top:11px;background:#F7F8FA;border:1px solid #E8EAEE;border-radius:10px;padding:9px 11px;font-size:10px;color:#8A9099;word-break:break-all;line-height:1.5")}>{vm.enrollError}</div>
                <div style={S("display:flex;gap:8px;margin-top:16px")}>
                  <div className="hov-btn" role="button" tabIndex={0} onClick={vm.retryEnroll}
                       onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') vm.retryEnroll(); }}
                       style={S("flex:1;background:#0B8F58;color:#fff;font-size:12.5px;font-weight:800;border-radius:12px;height:46px;display:flex;align-items:center;justify-content:center;cursor:pointer")}>다시 시도</div>
                  <div className="hov-btn" role="button" tabIndex={0} onClick={vm.dismissEnrollError}
                       onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') vm.dismissEnrollError(); }}
                       style={S("flex:1;background:#fff;border:1.5px solid #DDE1E6;color:#4B5563;font-size:12.5px;font-weight:800;border-radius:12px;height:46px;display:flex;align-items:center;justify-content:center;cursor:pointer")}>청약서로 돌아가기</div>
                </div>
              </div>
            </div>
          </>)}
        </div>
      </div>
    );
  }
}
export default Component;