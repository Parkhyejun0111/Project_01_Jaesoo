import React from "react";

// AI 챗봇 백엔드 주소. 로컬 개발은 FastAPI(main.py, :8000), 배포 시 VITE_API_URL 로 덮어씀.
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL) ||
  "http://localhost:8000";

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
const IMG_LOGO = "/logo_final_white.png";
const IMG_LOGO_DARK = "/jaesoo_logo.png";
const IMG_DONWORRY = "/donworry_icon4.png";
const IMG_NO = "/no_icon_v2.png";
const IMG_PAW = "/paw_print.png";

const SEL = "display:inline-flex;align-items:center;padding:8px 14px;border-radius:20px;font-size:11px;font-weight:700;border:1.5px solid #0B8F58;background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;cursor:pointer;white-space:nowrap";
const UNSEL = "display:inline-flex;align-items:center;padding:8px 14px;border-radius:20px;font-size:11px;font-weight:400;border:1px solid #E5E5E5;background:#fff;color:#666;cursor:pointer;white-space:nowrap";

class Component extends React.Component {
  state = {
    activeTab: 'grades',
    gradeSeg: 0,
    a2Filter: 'all',
    converterScreen: 'intro', convLoading: false, resultDetail: false,
    examOpen: {}, examSortDesc: true,
    save_m: 200, siblingCount: 2, retireGoal: 40000, income_m: 700, opp_on: false,
    costForm: '재수종합학원', costAdjPct: 100, region: '수도권',
    homeScreen: 'ins01', myScreen: 'main', gradeState: 'needs_check',
    claimScreen: 'home',
    claimElg: 'yes', claimSeverity: 'severe', claimForm: '재수종합학원',
    claimCardsOn: { k1: true, k2: true, k3: false, k4: false, k5: false, k6: false },
    claimCardTails: { k1: '4821', k2: '7715' },
    claimCostsOn: { c1: true, c2: true, c3: true, c4: true, c5: true },
    claimUpload: false, claimAgreeGuardian: false, claimAgreeFinal: false,
    claimConnectingCard: null, claimLinkReturn: 'home', claimLastSync: '2027.12.09 09:30',
    claimSubmitting: false,
    llmAnswer: '', llmFrom: 'ins01', llmInput: '', llmMessages: [], llmLoading: false, appealSubject: '국어', appealReason: '인식 오류',
    discountModalOpen: false, coverageModalOpen: false, quadrantModalOpen: false,
    policyOpen: false, policyLoading: false, policyData: [], policyFocus: null,
    paymentDetail: null, paymentsYear: null, paymentsShowAll: false,
    loggedIn: false, notifOpen: false, scanWarningOpen: false, splashDone: false,
    notifToggles: { exam: true, billing: true, appeal: true, marketing: false },
    // 개인화/로그인/온보딩
    student: null, studentId: null, studentList: [], loading: false, loadStage: '',
    mode: (typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '').endsWith('/app')) ? 'app' : 'web', // web=인강/보험 웹, app=재수없수 모바일앱
    entry: 'landing', // landing | pay | survey | tiers | terms | apply | done | login
    tiers: [], expandedTier: null,
    onbForm: { name: '', school: '', track: '자연', target_univ: '', tier: '스탠다드', region: '수도권',
               gradeYear: '고2', gender: '남', income_band: 3, retake_intent: 3, target_gap: 'near',
               monthly_saving: 100, retire_goal: 20000,
               agree1: false, agree2: false, agree3: false, insChecked: true },
    // 보험 청약서(가입설문) — 지류문서 형식 전체 항목
    apply: {
      school: '', region: '수도권', target_univ: '',       // 피보험자 기본정보
      c_name: '', c_birth: '', c_phone: '', c_rel: '부',   // Ⅰ 계약자
      p_name: '', p_birth: '',                              // Ⅰ 피보험자(학생)
      g_name: '', g_phone: '',                              // Ⅰ 법정대리인
      q_grade: '', q_direction: '', q_wait: false, q_data: '',  // Ⅱ 가입자격
      d1: '', d2: '', d3: '', d4: '', d5: '',               // Ⅲ 고지사항
      gender: '', income: '', edu_cost: '',                 // Ⅳ 요율문항
      subj_kor: false, subj_math: false, subj_eng: false, subj_soc: false, subj_sci: false,  // Ⅴ 응시과목 선언
      school_type: '', sibling: '', sibling_result: '', stat_consent: '',  // Ⅵ 통계용
      pi_req: '', pi_opt: '', pi_counsel: '',               // Ⅶ 개인정보
      sign: false,                                          // Ⅷ 자필서명
    },
  };

  // 챗봇 근거(약관 페이지) 원문 팝업
  openPolicy = async (pages, focus = null) => {
    this.setState({ policyOpen: true, policyLoading: true, policyData: [], policyFocus: focus });
    try {
      const r = await fetch(`${API_BASE}/api/policy/pages?p=${(pages || []).join(',')}`);
      const d = await r.json();
      this.setState({ policyLoading: false, policyData: d.pages || [] });
    } catch (e) {
      this.setState({ policyLoading: false, policyData: [] });
    }
  };
  closePolicy = () => this.setState({ policyOpen: false });

  loadTiers = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/tiers`);
      const d = await r.json();
      this.setState({ tiers: d.tiers || [] });
    } catch (e) { this.setState({ tiers: [] }); }
  };

  // ── 개인화 API ─────────────────────────────────────────────────────────
  loadStudentList = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/students`);
      const d = await r.json();
      this.setState({ studentList: d.students || [] });
    } catch (e) { this.setState({ studentList: [] }); }
  };

  // 로그인: 학생 프로필을 불러오고 '분석 중' 로딩 연출 후 앱 진입
  loginAs = async (studentId) => {
    const t0 = Date.now();
    this.setState({ loading: true, loadStage: '성적 데이터를 불러오는 중…' });
    try {
      await new Promise(res => setTimeout(res, 1200));
      const r = await fetch(`${API_BASE}/api/student/${studentId}`);
      const d = await r.json();
      this.setState({ loadStage: '성적 변동성·위험도를 분석하는 중…' });
      await new Promise(res => setTimeout(res, 1700));
      this.setState({ loadStage: '개인 맞춤 대시보드를 구성하는 중…' });
      await new Promise(res => setTimeout(res, 1500));
      // 로딩 화면(정체성 문구)이 최소 5초 유지되도록 보정
      const remain = 5000 - (Date.now() - t0);
      if (remain > 0) await new Promise(res => setTimeout(res, remain));
      if (d && d.student) {
        this.setState({ student: d, studentId, loggedIn: true, activeTab: 'home', homeScreen: 'ins01', loading: false, onboard: 'none' });
      } else {
        this.setState({ loading: false, loggedIn: true, activeTab: 'home' });
      }
    } catch (e) {
      this.setState({ loading: false, loggedIn: true, activeTab: 'home' });
    }
  };

  // 청약서 필수 항목 검증 (계약자·피보험자·자격·고지·요율문항·필수동의·서명)
  _applyValid = (a) => Boolean(
    a && a.c_name && a.p_name && a.q_grade && a.q_direction && a.q_data === '동의' &&
    a.d1 && a.gender && a.income && a.edu_cost && a.pi_req === '동의' && a.sign
  );

  submitEnroll = async () => {
    const f = this.state.onbForm;
    const a = this.state.apply;
    // 청약서 → 스코어카드 요율 입력 매핑
    const income_band = a.income === '450만원 초과' ? 4 : a.income === '250~450만원' ? 3 : 2;
    const retake_intent = a.d1 === '예' ? 5 : 3;
    const target_gap = f.target_gap || 'near';
    this.setState({ loading: true, loadStage: '청약 정보를 안전하게 등록하는 중…' });
    try {
      const r = await fetch(`${API_BASE}/api/enroll`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: a.p_name || '신규가입자', school: a.school, track: f.track, target_univ: a.target_univ,
          tier: f.tier, region: a.region, income_band, retake_intent, target_gap,
          gender: a.gender, terms_agreed: true,
          survey: {
            계약관계자: { 계약자겸법정대리인: { 성명: a.c_name, 생년월일: a.c_birth, 연락처: a.c_phone, 관계: a.c_rel }, 피보험자: { 성명: a.p_name, 생년월일: a.p_birth } },
            가입자격: { 학년: a.q_grade, 대입방향: a.q_direction, 대기기간확인: a.q_wait, 성적자료제출: a.q_data },
            고지사항: { 재수계획: a.d1, 학업중단: a.d2, 질병장애: a.d3, 타사보험: a.d4, 타진로: a.d5 },
            요율문항: { 성별: a.gender, 가구소득: a.income, 사교육비: a.edu_cost },
            응시과목선언: { 국어: a.subj_kor, 수학: a.subj_math, 영어: a.subj_eng, 사회탐구: a.subj_soc, 과학탐구: a.subj_sci, 재조사시점: '고3 9월 모의고사 직후' },
            통계검증: { 고교유형: a.school_type, 형제재수: a.sibling, 형제결과: a.sibling_result, 동의: a.stat_consent },
            개인정보동의: { 필수: a.pi_req, 선택: a.pi_opt, 심리상담: a.pi_counsel },
            자필서명: a.sign, 거주지역: a.region, 학교: a.school, 목표대학: a.target_univ,
          },
        }),
      });
      const d = await r.json();
      await new Promise(res => setTimeout(res, 600));
      this.setState({ loading: false, entry: 'done', enrolledId: d.student_id });
    } catch (e) {
      this.setState({ loading: false, entry: 'done', enrolledId: null });
    }
  };

  notifDefs = [
    { title: '모의고사 성적을 등록하세요', body: '9월 모의고사 성적표를 스캔하면 예상 점수와 보험료가 최신 상태로 갱신돼요.', time: '2시간 전' },
    { title: '모의고사 성적 이의신청 결과를 확인하세요', body: '제출하신 국어 이의신청 검수가 완료됐어요. 결과를 확인해보세요.', time: '1일 전' },
    { title: '이번 달 보험료가 확정됐어요', body: '전월 대비 3,000원 낮아진 42,000원으로 확정됐어요.', time: '3일 전' },
  ];

  llmFactorDefs = [
    { name: '사건 가능성', desc: '수능 당일 컨디션 난조·극심한 긴장·소음 같은 예기치 못한 일이 생길 가능성이에요.' },
    { name: '성적 취약성', desc: '같은 불운이 와도 성적이 크게 흔들릴 가능성이에요.' },
    { name: '재수 가능성', desc: '급락 이후 실제로 재수를 선택할 가능성이에요.' },
    { name: '재수 비용', desc: '사고가 발생했을 때 보장해야 할 비용이에요.' },
    { name: '안전버퍼', desc: '데이터가 아직 부족해서 예측 오차에 대비해 넣어둔 초기 여유분이에요.' },
  ];
  llmQA = {
    '왜 수학 변동성이 보험료에 영향을 주나요?': '현재 월 보험료 42,000원은 가입 티어, 보장 조건, 최근 확정 성적 흐름을 바탕으로 산정된 금액이에요. 이번 산정에서는 수학 성적의 오르내림이 비교적 크게 잡혀 성적 취약성 요인으로 반영됐어요. 수능 당일 예기치 못한 일이 생겼을 때 성적이 크게 흔들릴 가능성을 보기 때문에, 성적 변동성은 보험료 설명에서 중요한 항목이에요. 다음 재산정 전까지 수학 성적 흐름이 안정되면 보험료에 긍정적으로 반영될 수 있어요. 다만 보험료 인하는 확정이 아니며, 다음 재산정 시점의 확정 성적과 전체 산정 기준에 따라 달라질 수 있어요.',
    '성적 변동성이 뭐예요?': '시험마다 점수가 위아래로 얼마나 움직이는지를 보는 값이에요. 많이 움직일수록 수능 당일 결과가 평소와 달라질 가능성이 커서 보험료에 반영돼요.',
    '보험료가 왜 변했나요?': '최근 성적 흐름이 이전보다 안정되면서 성적 취약성 요인이 낮아졌어요. 그래서 이번 달 보험료가 전월보다 조금 내려갔어요.',
    '안전버퍼가 뭐예요?': '아직 데이터가 충분히 쌓이지 않은 초기에는 예측이 어긋날 수 있어서 여유분을 조금 더 넣어둬요. 데이터가 쌓일수록 이 여유분은 줄어들 수 있어요.',
    '데이터가 쌓이면 보험료가 바뀌나요?': '네, 모의고사 데이터가 더 쌓이면 예측이 더 정확해지고, 안전버퍼가 줄면서 보험료가 조정될 수 있어요. 다만 오르내림 모두 가능해요.',
  };

  // 채팅 메시지 영역 자동 스크롤(맨 아래로)
  componentDidMount() {
    this.loadStudentList();
    this.loadTiers();
    this._onPop = () => {
      const isApp = window.location.pathname.replace(/\/+$/, '').endsWith('/app');
      this.setState({ mode: isApp ? 'app' : 'web' });
    };
    window.addEventListener('popstate', this._onPop);
    if (this.state.mode === 'app') this._scheduleSplash();
  }

  // 스플래시 화면을 최소 노출 시간 후 자동으로 로그인 화면으로 전환
  _scheduleSplash = () => {
    clearTimeout(this._splashTimer);
    this._splashTimer = setTimeout(() => this.setState({ splashDone: true }), 2000);
  };

  componentWillUnmount() {
    if (this._onPop) window.removeEventListener('popstate', this._onPop);
    clearTimeout(this._splashTimer);
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

  // AI 채팅 로딩 캐릭터가 지나가며 남기는 발자국 위치
  chatLoadingFootprints = [10, 20, 30];

  // 빈 상태(성적/알림/납입 내역 없음) 공통 UI — 원형 하이라이트 안에 라인 아이콘 + 제목/설명
  renderEmptyState = (icon, title, desc, opts = {}) => {
    const compact = opts.compact;
    return (
      <div style={S(compact
        ? "display:flex;flex-direction:column;align-items:center;text-align:center;padding:30px 20px"
        : "flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:32px 34px")}>
        <div style={S(`width:${compact ? 72 : 120}px;height:${compact ? 72 : 120}px;border-radius:50%;background:#E3F2EA;display:flex;align-items:center;justify-content:center;margin-bottom:${compact ? 14 : 22}px;flex:none`)}>
          {icon}
        </div>
        <div style={S(compact ? "font-size:14px;font-weight:700;color:#111" : "font-size:19px;font-weight:800;color:#111;line-height:1.4")}>{title}</div>
        <div style={S(compact ? "font-size:12px;color:#999;line-height:1.6;margin-top:6px;max-width:230px" : "font-size:13.5px;color:#555;line-height:1.7;margin-top:12px;max-width:270px")}>{desc}</div>
        {opts.hint && (
          <div style={S("display:inline-flex;align-items:center;gap:6px;margin-top:20px;background:#F6F6F6;border-radius:20px;padding:8px 14px;font-size:12px;color:#555")}>{opts.hint}</div>
        )}
      </div>
    );
  };

  // AI 답변 텍스트에서 마크다운 표(| a | b |)를 실제 표로 렌더링
  renderRich = (text) => {
    const lines = String(text || '').split('\n');
    const isRow = (l) => l && l.indexOf('|') !== -1;
    const isSep = (l) => /^[\s|:-]+$/.test((l || '').trim()) && (l || '').indexOf('-') !== -1;
    const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    const out = [];
    let i = 0, buf = [];
    const flush = (k) => { if (buf.length) { out.push({ type: 'text', text: buf.join('\n'), key: 'x' + k }); buf = []; } };
    while (i < lines.length) {
      if (isRow(lines[i]) && i + 1 < lines.length && isSep(lines[i + 1])) {
        flush(i);
        const header = cells(lines[i]);
        i += 2;
        const rows = [];
        while (i < lines.length && isRow(lines[i]) && !isSep(lines[i])) { rows.push(cells(lines[i])); i++; }
        out.push({ type: 'table', header, rows, key: 't' + i });
      } else { buf.push(lines[i]); i++; }
    }
    flush(i);
    return out.map((b) => b.type === 'table' ? (
      <div key={b.key} style={S("overflow-x:auto;margin:8px 0;border:1px solid #D8E5DE;border-radius:9px")}>
        <table style={S("width:100%;border-collapse:collapse;font-size:10.5px")}>
          <thead><tr>{b.header.map((h, hi) => (<th key={hi} style={S("background:#0B8F58;color:#fff;font-weight:700;text-align:left;padding:7px 9px;white-space:nowrap")}>{h}</th>))}</tr></thead>
          <tbody>{b.rows.map((r, ri) => (<tr key={ri} style={S(`background:${ri % 2 ? '#F4F9F6' : '#fff'}`)}>{r.map((c, ci) => (<td key={ci} style={S("padding:7px 9px;border-top:1px solid #E8F0EB;color:#333;white-space:nowrap")}>{c}</td>))}</tr>))}</tbody>
        </table>
      </div>
    ) : (
      <div key={b.key} style={S("white-space:pre-line;word-break:keep-all")}>{b.text}</div>
    ));
  };

  chatScrollRef = React.createRef();
  chatInputRef = React.createRef();
  autosizeChatInput = () => {
    const el = this.chatInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };
  componentDidUpdate() {
    const el = this.chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }

  // 채팅 첫 인사 + 상단 추천 질문(3~4개)
  llmGreeting = { role: 'ai', text: '안녕하세요! 저는 재수없는 수험생을 위한 AI 도우미\nNo(노)재수예요!\n\n약관과 보험료 산정 근거를 실제 약관 문서에 근거해 설명해드릴게요. 아래 추천 질문을 누르거나, 궁금한 점을 직접 입력해 물어보세요.', pages: [], greeting: true };
  RECO_QS = [
    '보험금은 언제, 어떻게 받나요?',
    '보험료는 어떤 기준으로 산정되나요?',
    '청약철회는 어떻게 하나요?',
    '보장에서 제외되는 경우는 뭔가요?',
  ];

  // 채팅 화면 진입 — 대화를 첫 인사로 초기화
  openLlm = (from) => this.setState({ activeTab: 'home', homeScreen: 'llm', llmFrom: from, llmMessages: [this.llmGreeting], llmInput: '', llmLoading: false });

  // 실제 약관 PDF 기반 RAG 백엔드(/api/chat)에 질문을 보내 답변을 받아온다.
  //   · 사용자 질문/AI 답변을 말풍선(llmMessages)으로 채팅창에 누적
  //   · 실패(백엔드 꺼짐 등) 시 미리 준비된 llmQA 답변으로 폴백
  _llmReq = 0;
  askLLM = async (question) => {
    const q = (question || '').trim();
    if (!q || this.state.llmLoading) return;
    const reqId = ++this._llmReq;
    const history = this.state.llmMessages
      .filter(m => m.text)
      .slice(-6)
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
    this.setState(st => ({ llmMessages: [...st.llmMessages, { role: 'user', text: q }], llmInput: '', llmLoading: true }));
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, history, student_id: this.state.studentId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (reqId !== this._llmReq) return;
      const pages = [...new Set((data.sources || []).map(s => s.page))];
      this.setState(st => ({ llmMessages: [...st.llmMessages, { role: 'ai', text: data.answer || '답변을 가져오지 못했어요.', pages }], llmLoading: false }));
    } catch (e) {
      if (reqId !== this._llmReq) return;
      const fb = this.llmQA[q];
      this.setState(st => ({ llmMessages: [...st.llmMessages, { role: 'ai', text: fb || '⚠️ AI 상담 서버에 연결하지 못했어요. 백엔드(main.py)가 실행 중인지 확인해 주세요.', pages: [] }], llmLoading: false }));
    }
  };
  ocrDefs = [
    { name: '국어', grade: 2, score: 128, percentile: 88, needsCheck: true },
    { name: '수학', grade: 1, score: 135, percentile: 95, needsCheck: false },
    { name: '영어', grade: 1, score: '-', percentile: 93, needsCheck: false },
    { name: '탐구', grade: 2, score: 66, percentile: 85, needsCheck: false },
  ];
  statusHistoryDefs = [
    { label: '이의신청중', date: '2026.07.18', desc: '국어 성적 이의신청이 접수되어 운영팀이 검수하고 있어요.' },
    { label: '확인필요', date: '2026.07.15', desc: 'OCR 인식 신뢰도가 낮은 항목이 있어 확인이 필요했어요.' },
    { label: '확정', date: '2026.03.12', desc: '고3 3월 모의고사 성적이 확정되어 보험료 산정에 반영됐어요.' },
    { label: '확정', date: '2025.09.05', desc: '고2 9월 모의고사 성적이 확정됐어요.' },
  ];
  examLabels = ['고1 9월','고1 12월','고2 3월','고2 6월','고2 9월','고2 12월','고3 3월','고3 6월','고3 9월'];

  subjects = {
    국어: { color: '#0B8F58', traj: [57,47,61,67,49,43,63,60,59], vol: 85, level: '높음', levelColor: '#fff', levelBg: '#C0304A', bg: '#0B8F58', icon: '가' },
    수학: { color: '#3B82F6', traj: [66,52,58,73,70,55,69,66,76], vol: 81, level: '높음', levelColor: '#fff', levelBg: '#C0304A', bg: '#3B82F6', icon: '√x' },
    영어: { color: '#DB2777', traj: [47,44,49,52,56,56,67,64,68], vol: 16, level: '낮음', levelColor: '#fff', levelBg: '#0B8F58', bg: '#DB2777', icon: 'A' },
    탐구: { color: '#D97706', traj: [55,52,63,62,52,46,66,53,59], vol: 62, level: '보통', levelColor: '#fff', levelBg: '#B45309', bg: '#D97706', icon: '⚛' },
  };

  // 로그인 학생(state.student)의 실제 DB 데이터를 화면용 형태로 변환.
  // 없으면 기본 데모(김지민)값을 반환 → 로그인 전에도 화면이 정상 렌더.
  effective(student) {
    const meta = this.subjects;
    const order = ['국어', '수학', '영어', '탐구'];
    if (!student || !student.analysis || !student.pricing) {
      return {
        subjects: meta,
        comp: [57.1,48.6,57.3,64.3,57.6,50.2,66.3,61.3,66.1],
        muY: 63, sigma: 7,
        premium_m: 42000, prev_m: 45000,
        riskFactors: [
          { name: '성적 변동성', level: '중', pct: 45 },
          { name: '상품 레벨', level: '하', pct: 20 },
          { name: '배경 변수', level: '중', pct: 35 },
        ],
        name: '김지민', school: 'OO고등학교', target: 'OO대학교 경영학과', tier: '스탠다드',
      };
    }
    const A = student.analysis, P = student.pricing;
    const subjects = {};
    order.forEach(subj => {
      const a = A.subjects[subj];
      if (!a) return;
      const m = meta[subj];
      const vol = a.vol_index;
      const level = vol >= 65 ? '높음' : vol >= 40 ? '보통' : '낮음';
      const levelBg = vol >= 65 ? '#C0304A' : vol >= 40 ? '#B45309' : '#0B8F58';
      subjects[subj] = { color: m.color, bg: m.bg, icon: m.icon, traj: a.series, vol, level, levelColor: '#fff', levelBg };
    });
    // 종합 추이(회차별 4과목 평균)
    const len = Math.max(...order.map(x => (A.subjects[x] ? A.subjects[x].series.length : 0)));
    const comp = [];
    for (let i = 0; i < len; i++) {
      let sum = 0, cnt = 0;
      order.forEach(x => { const ser = A.subjects[x] && A.subjects[x].series; if (ser && ser[i] != null) { sum += ser[i]; cnt++; } });
      comp.push(cnt ? Math.round(sum / cnt * 10) / 10 : 0);
    }
    const c = P.contributions;
    const volMax = Math.max(...Object.values(subjects).map(x => x.vol));
    const rf = [
      { name: '성적 변동성', level: volMax >= 65 ? '높음' : volMax >= 40 ? '보통' : '낮음', pct: Math.round(c['성적 변동성'] * 100) },
      { name: '상품 레벨', level: P.tier, pct: Math.round(c['상품 레벨'] * 100) },
      { name: '배경 변수', level: '보통', pct: Math.round(c['배경 변수'] * 100) },
    ];
    const st = student.student || {};
    return {
      subjects, comp,
      muY: A.composite.predicted, sigma: Math.max(Math.round(A.composite.sigma), 3),
      premium_m: P.monthly_premium, prev_m: Math.round(P.monthly_premium * 1.06 / 1000) * 1000,
      riskFactors: rf,
      name: st.name || '학생', school: st.school || '', target: st.target_univ || '', tier: P.tier,
    };
  }

  saveOptions = [{l:'선택안함',v:null},{l:'50만원 미만',v:25},{l:'50~100',v:75},{l:'100~150',v:125},{l:'150~250',v:200},{l:'250만원 이상',v:300}];
  siblingOptions = [{l:'선택안함',v:null},{l:'1명',v:1},{l:'2명',v:2},{l:'3명 이상',v:3}];
  retireOptions = [{l:'선택안함',v:null},{l:'1억 미만',v:7500},{l:'1~3억',v:20000},{l:'3~5억',v:40000},{l:'5~7억',v:60000},{l:'7억 이상',v:80000}];
  incomeOptions = [{l:'선택안함',v:null},{l:'300만원 미만',v:250},{l:'300~450',v:375},{l:'450~600',v:525},{l:'600~800',v:700},{l:'800만원 이상',v:900}];
  SAVE_AVG = 180; INCOME_AVG = 660; SEMESTER_COST = 355.3; OPP_AMOUNT = 3800;
  costForms = {
    '독학재수(독서실·인강)': { monthly: 3.6, total: 36, note: '인강 패스 평균(메가스터디·대성마이맥) 기준', cap: 70, voucherPct: 100 },
    '단과 통학': { monthly: 58.6, total: 586, note: '단과 강의료 + 교재 등 부대비용 평균', cap: 100, voucherPct: 60 },
    '재수종합학원': { monthly: 191, total: 1910, note: '메이저 재종합반 5개사 평균(시대인재·강남대성 등)', cap: 140, voucherPct: 40 },
    '기숙학원': { monthly: 360, total: 3600, note: '상위 기숙학원 5개사 평균', cap: 200, voucherPct: 20 },
  };

  // ── 보험금 청구(수능 이후) ──
  EXAM_DATE = '2026-11-19';
  CLAIM_RATE = 0.7;
  CLAIM_LIMITS = {
    '독학재수(독서실·인강)': { mild: 2100000, severe: 4200000 },
    '단과 통학': { mild: 4200000, severe: 8400000 },
    '재수종합학원': { mild: 7020000, severe: 14040000 },
    '기숙학원': { mild: 10500000, severe: 21000000 },
  };
  CLAIM_CARDS_META = [
    { id: 'k1', name: '신한카드', short: '신한', color: '#1E4FD8' },
    { id: 'k2', name: '국민카드', short: 'KB', color: '#6B5B3E' },
    { id: 'k3', name: '삼성카드', short: '삼성', color: '#1428A0' },
    { id: 'k4', name: '현대카드', short: '현대', color: '#1F1F1F' },
    { id: 'k5', name: '롯데카드', short: '롯데', color: '#C8102E' },
    { id: 'k6', name: '하나카드', short: '하나', color: '#00857D' },
  ];
  CLAIM_COSTS_META = {
    1: [
      { id: 'c1', date: '2026.12.08', name: '재수학원 1분기 등록금', amt: 4800000, card: 'k1', auto: true },
      { id: 'c2', date: '2027.01.14', name: '교재·모의고사 패키지', amt: 400000, card: 'k2', auto: true },
    ],
    2: [
      { id: 'c3', date: '2027.02.03', name: '재수학원 2분기 등록금', amt: 3200000, card: 'k1', auto: true },
      { id: 'c4', date: '2027.04.20', name: '재수학원 3분기 등록금', amt: 3000000, card: 'k1', auto: true },
      { id: 'c5', date: '2027.05.11', name: '파이널 특강·모의고사', amt: 600000, card: null, auto: false },
    ],
  };
  CLAIM_ROUND_META = {
    1: { label: '1차 (6월)', period: '2027.01.01 ~ 05.31', window: '2027.06.01 ~ 06.30', deadline: '6월 30일', date: '2027.06.09 09:41', no: 'RC-2027-0091' },
    2: { label: '2차 (12월)', period: '2027.06.01 ~ 11.30', window: '2027.12.01 ~ 12.31', deadline: '12월 31일', date: '2027.12.09 09:41', no: 'RC-2027-0188' },
  };
  CLAIM_GRADE_PROFILE = {
    no: { x: 143, y: 78, score: 52, drop: 11, col: '#5C6360' },
    mild: { x: 100, y: 118, score: 43, drop: 20, col: '#E5484D' },
    severe: { x: 66, y: 135, score: 30, drop: 33, col: '#E5484D' },
  };

  examPassed() {
    return new Date() >= new Date(this.EXAM_DATE);
  }
  claimYear() {
    return new Date(this.EXAM_DATE).getFullYear() + 1;
  }
  // 청구 회차·창 상태를 "실제 오늘 날짜" 대비로 계산: 수능 다음 해 6월(1차)·12월(2차)에만 열림
  claimRoundWindow() {
    const now = new Date();
    const y = this.claimYear();
    const r1Open = new Date(`${y}-06-01`), r1Close = new Date(`${y}-06-30T23:59:59`);
    const r2Open = new Date(`${y}-12-01`), r2Close = new Date(`${y}-12-31T23:59:59`);
    if (now > r2Close) return { round: 2, window: 'dead', nextOpen: null };
    if (now >= r2Open) return { round: 2, window: 'open', nextOpen: null };
    if (now >= r1Close) return { round: 2, window: 'wait', nextOpen: r2Open };
    if (now >= r1Open) return { round: 1, window: 'open', nextOpen: null };
    return { round: 1, window: 'wait', nextOpen: r1Open };
  }
  fmtDateDot(d) {
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }
  claimLimit(s) {
    if (s.claimElg === 'no') return 0;
    const lim = this.CLAIM_LIMITS[s.claimForm];
    return s.claimSeverity === 'severe' ? lim.severe : lim.mild;
  }
  claimVisibleCosts(round, s) {
    return this.CLAIM_COSTS_META[round].filter(c => !c.auto || !!(s.claimCardsOn && s.claimCardsOn[c.card]));
  }
  claimEngine(s) {
    const r = s.claimRound;
    const sumOn = (list) => list.reduce((sum, c) => sum + ((s.claimCostsOn && s.claimCostsOn[c.id] !== false) ? c.amt : 0), 0);
    const prevCost = r === 2 ? sumOn(this.claimVisibleCosts(1, s)) : 0;
    const limit = this.claimLimit(s);
    const prevPaid = r === 2 ? Math.min(prevCost * this.CLAIM_RATE, limit) : 0;
    const thisCost = sumOn(this.claimVisibleCosts(r, s));
    const cumCost = prevCost + thisCost;
    const rawEnt = cumCost * this.CLAIM_RATE;
    const cumEnt = Math.min(rawEnt, limit);
    return {
      round: r, prevCost, prevPaid, thisCost, cumCost, rawEnt, cumEnt,
      capped: rawEnt > limit, payout: cumEnt - prevPaid, remaining: Math.max(0, limit - cumEnt),
    };
  }

  // 우리 동네 시세: 지역별 평균 대비 배율(%)
  regions = [
    { name: '서울 학군지', pct: 120, desc: '강남·목동·중계 등' },
    { name: '서울 비학군지', pct: 105, desc: '서울 그 외 지역' },
    { name: '수도권', pct: 100, desc: '경기·인천 (기준)' },
    { name: '지방', pct: 85, desc: '광역시·지방권' },
  ];

  chipList(options, curVal, keyName) {
    const NONE_UNSEL = UNSEL.replace('border:1px solid #E5E5E5', 'border:1px solid #0B8F58').replace('color:#666', 'color:#0B8F58');
    const NONE_SEL = SEL;
    return options.map(o => {
      const isNone = o.v === null;
      const sel = o.v === curVal;
      return {
        label: o.l,
        style: sel ? (isNone ? NONE_SEL : SEL) : (isNone ? NONE_UNSEL : UNSEL),
        onClick: () => this.setState(s => ({ [keyName]: s[keyName] === o.v ? null : o.v })),
      };
    });
  }

  x1(i) { return 14 + i * (321 - 40) / 9; }
  y1(v) { return 6 + (80 - v) / 50 * 150; }
  x2(i) { return i * 290 / 8; }
  y2(v) { return 4 + (85 - v) / 50 * 142; }

  renderVals() {
    const s = this.state;

    // ── 개인화(eff): 로그인 학생이 있으면 그 학생의 실제 DB 데이터로 대체 ──
    const eff = this.effective(s.student);
    const comp = eff.comp;
    const muY = eff.muY, sigUp = eff.sigma, sigDown = eff.sigma, baseline = 48;
    const a1Points = comp.map((v,i) => ({ x: this.x1(i), y: this.y1(v) }));
    const last = a1Points[8];
    const predX = this.x1(9);
    const a1Pred = { px: predX, py: this.y1(muY), lx: last.x, ly: last.y, ly2: this.y1(muY) - 10 };
    const a1Band = `${last.x},${last.y} ${predX},${this.y1(muY+sigUp)} ${predX},${this.y1(muY-sigDown)}`;
    const gridVals = [30,40,50,60,70,80];
    const a1Grid = gridVals.map(v => ({ y: this.y1(v), ty: this.y1(v)+3, label: String(v) }));
    const baseY = this.y1(baseline);
    const a1Baseline = { x1: last.x, x2: 321, y: baseY, ty: baseY - 4 };
    const a1Line = a1Points.map(p => `${p.x},${p.y}`).join(' ');
    const xLabelsText = ['고1 9월','고1 12월','고2 3월','고2 6월','고2 9월','고2 12월','고3 3월','고3 6월','고3 9월','수능예상'];
    const a1XLabels = xLabelsText.map((t,i) => ({ x: this.x1(i), text: t }));

    const subjNames = Object.keys(eff.subjects);
    const a2Lines = subjNames.map(name => {
      const sub = eff.subjects[name];
      const pts = sub.traj.map((v,i) => ({ x: this.x2(i), y: this.y2(v) }));
      return { color: sub.color, points: pts.map(p=>`${p.x},${p.y}`).join(' '), pts, visible: s.a2Filter === 'all' || s.a2Filter === name };
    });
    const a2Chips = ['전체', ...subjNames].map(name => {
      const val = name === '전체' ? 'all' : name;
      const sel = s.a2Filter === val;
      return { label: name, style: sel ? SEL : UNSEL, onClick: () => this.setState({ a2Filter: val }) };
    });

    const volCards = subjNames.map(name => {
      const sub = eff.subjects[name];
      return { name, vol: sub.vol, color: sub.color, bg: sub.bg, icon: sub.icon, level: sub.level, levelColor: sub.levelColor, levelBg: sub.levelBg, borderColor: sub.color + '55' };
    });
    // 개인화 변동성 요약(성적 꾸준함 카드용)
    const _volList = subjNames.map(n => eff.subjects[n].vol);
    const avgVol = _volList.length ? Math.round(_volList.reduce((a, b) => a + b, 0) / _volList.length) : 0;
    const stability = Math.max(0, 100 - avgVol);
    const topVolSubj = subjNames[_volList.indexOf(Math.max(..._volList))] || '';
    const stabilityLabel = stability >= 65 ? '안정적' : stability >= 45 ? '보통' : '관리 필요';
    const stabilityColor = stability >= 65 ? '#0B8F58' : stability >= 45 ? '#B45309' : '#C0304A';
    // 과목 포지션(점수×변동성) 사분면 + 집중 보완 우선순위 (개인화)
    const quadBuckets = { urgent: [], dayrisk: [], grow: [], strong: [] };
    const priorityList = subjNames.map(n => {
      const sub = eff.subjects[n];
      const mean = Math.round(sub.traj.reduce((a, b) => a + b, 0) / sub.traj.length);
      const highScore = mean >= 60, highVol = sub.vol >= 50;
      const key = highVol ? (highScore ? 'dayrisk' : 'urgent') : (highScore ? 'strong' : 'grow');
      quadBuckets[key].push({ name: n, bg: sub.bg });
      const tag = highVol ? (highScore ? '당일 변수 관리' : '집중 보완 필요') : (highScore ? '강점 유지' : '차근차근 향상');
      return { name: n, bg: sub.bg, vol: sub.vol, mean, risk: sub.vol - mean * 0.5, highVol, highScore, tag };
    }).sort((a, b) => b.risk - a.risk);

    const rolling = [4.8,4.7,6.0,6.5,5.3,5.6];
    const rmin = Math.min(...rolling), rmax = Math.max(...rolling);
    const b3pts = rolling.map((v,i) => ({ x: i*130/5, y: 4 + (rmax-v)/(rmax-rmin||1)*36 }));
    const b3Points = b3pts.map(p=>`${p.x},${p.y}`).join(' ');
    const peakIdx = rolling.indexOf(rmax);
    const b3Peak = b3pts[peakIdx];
    const b3Latest = b3pts[5];

    const gradeSegChips = ['성적 추이','집중 보완 과목'].map((label,i) => ({
      label, style: s.gradeSeg === i ? SEL.replace('20px','9px') + ';flex:1;justify-content:center' : UNSEL.replace('20px','9px') + ';flex:1;justify-content:center;background:transparent;border:none',
      onClick: () => this.setState({ gradeSeg: i }),
    }));

    const form = this.costForms[s.costForm];
    const total = Math.round(form.total * (s.costAdjPct/100));
    const monthlyAdj = total / 10;
    const bMonth = Math.min(monthlyAdj, form.cap);
    const selfPay = Math.round((monthlyAdj - bMonth) * 10);
    const covered = total - selfPay;

    const saveVal = s.save_m ?? this.SAVE_AVG;
    const saveIsAvg = s.save_m == null;
    const saveMonths = Math.max(Math.round(total/saveVal), 1);

    const incomeVal = s.income_m ?? this.INCOME_AVG;
    const incomeIsAvg = s.income_m == null;
    const incomeMonths = Math.round(total/incomeVal);

    const tuitionSemesters = s.siblingCount >= 2 ? (Math.round((total/this.SEMESTER_COST)*2)/2).toString().replace(/\.0$/,'') : null;
    const retirePct = s.retireGoal ? Math.round(total/s.retireGoal*100) : null;
    const hasAnyCard = true;

    const formChips = Object.keys(this.costForms).map(name => ({
      label: name, style: s.costForm === name ? SEL : UNSEL,
      onClick: () => this.setState({ costForm: name, costAdjPct: 100, region: '수도권' }),
    }));

    const mkTab = (key, opts = {}) => {
      const active = opts.active !== undefined ? opts.active : s.activeTab === key;
      return {
        iconColor: active ? '#fff' : '#999',
        labelColor: active ? '#0B8F58' : '#999',
        labelWeight: active ? 700 : 400,
        circleStyle: `width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${active ? '#0B8F58' : 'transparent'}`,
        onClick: opts.onClick || (() => this.setState({ activeTab: key })),
      };
    };
    const homeTab = mkTab('home', { active: s.activeTab === 'home' && s.homeScreen !== 'llm' });
    const gradesTab = mkTab('grades'), converterTab = mkTab('converter'), mypageTab = mkTab('mypage');
    const aiTab = mkTab('ai', { active: s.activeTab === 'home' && s.homeScreen === 'llm', onClick: () => this.openLlm('ins01') });

    const fmtWon = n => n.toLocaleString('ko-KR') + '만원';
    const saveValLabel = fmtWon(saveVal);
    const incomeValLabel = fmtWon(incomeVal);
    const semesterCostLabel = fmtWon(this.SEMESTER_COST);
    const retireGoalLabel = s.retireGoal ? fmtWon(s.retireGoal) : '';

    const premium_m = eff.premium_m, prev_m = eff.prev_m;
    const premiumLabel = premium_m.toLocaleString('ko-KR') + '원';
    const deltaVal = premium_m - prev_m;
    const deltaLabel = (deltaVal >= 0 ? '+' : '-') + Math.abs(deltaVal).toLocaleString('ko-KR') + '원';
    const deltaColor = deltaVal <= 0 ? '#0B8F58' : '#D9534F';
    const joinedAt = '2025.03.02', renewAt = '2026.12.01', coverPeriod = '2025.03 ~ 2026.12 (자동 갱신)';
    const riskFactors = eff.riskFactors;
    const payments = [
      { date: '2026년 7월', amount: '45,000원', status: '완료' },
      { date: '2026년 6월', amount: '45,000원', status: '완료' },
      { date: '2026년 5월', amount: '48,000원', status: '완료' },
      { date: '2026년 4월', amount: '48,000원', status: '완료' },
      { date: '2026년 3월', amount: '46,500원', status: '완료' },
      { date: '2026년 2월', amount: '44,000원', status: '완료' },
      { date: '2026년 1월', amount: '44,000원', status: '완료' },
      { date: '2025년 12월', amount: '47,000원', status: '완료' },
      { date: '2025년 11월', amount: '47,000원', status: '완료' },
      { date: '2025년 10월', amount: '43,500원', status: '완료' },
      { date: '2025년 9월', amount: '43,500원', status: '완료' },
      { date: '2025년 8월', amount: '41,000원', status: '완료' },
      { date: '2025년 7월', amount: '41,000원', status: '완료' },
      { date: '2025년 6월', amount: '39,500원', status: '완료' },
      { date: '2025년 5월', amount: '39,500원', status: '완료' },
      { date: '2025년 4월', amount: '38,000원', status: '완료' },
      { date: '2025년 3월', amount: '38,000원', status: '완료' },
    ];
    const paymentYearOf = (p) => { const m = /(\d+)년/.exec(p.date || ''); return m ? m[1] : ''; };
    const paymentYears = [...new Set(payments.map(paymentYearOf))].sort((a, b) => b - a);
    const paymentsYear = paymentYears.includes(s.paymentsYear) ? s.paymentsYear : paymentYears[0];
    const paymentsOfYear = payments.filter(p => paymentYearOf(p) === paymentsYear);
    const PAYMENTS_PAGE = 6;
    const paymentsShowAll = !!s.paymentsShowAll;
    const paymentsVisible = paymentsShowAll ? paymentsOfYear : paymentsOfYear.slice(0, PAYMENTS_PAGE);
    const paymentsRemainCount = paymentsOfYear.length - paymentsVisible.length;
    const paymentsYearTotal = paymentsOfYear.reduce((sum, p) => sum + parseInt(p.amount.replace(/[^0-9]/g, ''), 10), 0);
    const paymentsTotalLabel = paymentsYearTotal.toLocaleString('ko-KR') + '원';
    const paymentsReceiptNo = 'RCPT-' + joinedAt.replace(/\./g, '') + '-' + String(payments.length).padStart(3, '0');
    let paymentDetailView = null;
    if (s.paymentDetail) {
      const p = s.paymentDetail;
      const dm = /(\d+)년\s*(\d+)월/.exec(p.date || '');
      const y = dm ? dm[1] : '', mo = dm ? dm[2].padStart(2, '0') : '';
      const amountNum = parseInt(String(p.amount).replace(/[^0-9]/g, ''), 10) || 0;
      const supplyAmount = Math.round(amountNum / 1.1);
      const vat = amountNum - supplyAmount;
      paymentDetailView = {
        date: p.date, amount: p.amount,
        approvalNo: `${y}${mo}05-${String(amountNum % 90000 + 10000)}`,
        paidAt: `${y}.${mo}.05 10:15:22`,
        method: '신한카드 (****-1092)',
        supplyAmountLabel: supplyAmount.toLocaleString('ko-KR') + '원',
        vatLabel: vat.toLocaleString('ko-KR') + '원',
      };
    }
    const llmChips = this.RECO_QS.map(q => ({
      label: q, style: UNSEL,
      onClick: () => this.askLLM(q),
    }));

    const gradeBadgeMap = {
      needs_check: { label: '확인필요', color: '#fff', bg: '#B45309', desc: 'OCR로 인식한 성적 중 확인이 필요한 항목이 있어요. 결과를 확인해 주세요.' },
      appeal: { label: '이의신청중', color: '#fff', bg: '#7C3AED', desc: '제출하신 이의신청을 운영팀이 검수하고 있어요. 완료되면 알려드려요.' },
      confirmed: { label: '확정', color: '#fff', bg: '#0B8F58', desc: '최근 모의고사 성적이 확정되어 성적분석과 보험료 산정에 반영됐어요.' },
      none: { label: '미등록', color: '#fff', bg: '#888', desc: '아직 등록된 성적이 없어요. 모의고사 성적표를 등록해 주세요.' },
    };
    const gb = gradeBadgeMap[s.gradeState];
    const ocrRows = this.ocrDefs.map(o => ({
      name: o.name, grade: o.grade, score: o.score, percentile: o.percentile,
      badgeLabel: o.needsCheck ? '확인필요' : '정상',
      badgeStyle: o.needsCheck ? 'font-size:8.5px;font-weight:700;color:#fff;background:#B45309;padding:3px 9px;border-radius:20px;white-space:nowrap' : 'font-size:8.5px;font-weight:700;color:#fff;background:#0B8F58;padding:3px 9px;border-radius:20px;white-space:nowrap',
    }));
    const appealSubjectChips = this.ocrDefs.map(o => ({
      label: o.name, style: s.appealSubject === o.name ? SEL : UNSEL,
      onClick: () => this.setState({ appealSubject: o.name }),
    }));
    const appealReasonChips = ['인식 오류', '등급 다름', '기타'].map(r => ({
      label: r, style: s.appealReason === r ? SEL : UNSEL,
      onClick: () => this.setState({ appealReason: r }),
    }));

    const examGradeOf = (v) => v>=96?1:v>=89?2:v>=77?3:v>=60?4:v>=40?5:v>=23?6:v>=11?7:v>=4?8:9;
    const examDates = ['2023.09.06','2023.11.16','2024.03.28','2024.06.04','2024.09.04','2024.11.14','2025.03.27','2025.06.04','2025.09.03'];
    const examSubjNames = ['국어','수학','영어','탐구'];
    const examHistoryChron = this.examLabels.map((label, i) => {
      const percentile = Math.round(comp[i]);
      const prevPercentile = i > 0 ? Math.round(comp[i - 1]) : null;
      const subjectsRow = examSubjNames.map(name => {
        const traj = this.subjects[name].traj;
        const score = traj[i];
        const prevScore = i > 0 ? traj[i - 1] : null;
        const grade = examGradeOf(score);
        const prevGrade = prevScore != null ? examGradeOf(prevScore) : null;
        return { name, score, grade, gradeDiff: prevGrade != null ? grade - prevGrade : null };
      });
      return { label, date: examDates[i] || '', percentile, percentileDiff: prevPercentile != null ? percentile - prevPercentile : null, subjects: subjectsRow };
    });
    const examSortDesc = s.examSortDesc !== false;
    const examHistory = examSortDesc ? [...examHistoryChron].reverse() : examHistoryChron;
    const examAllOpen = examHistoryChron.length > 0 && examHistoryChron.every(e => !!(s.examOpen || {})[e.label]);

    // ── 보험금 청구(수능 이후) ──
    const examPassed = this.examPassed();
    const wonFmt = n => Math.round(n).toLocaleString('ko-KR') + '원';
    const manFmt = n => Math.round(n / 10000).toLocaleString('ko-KR') + '만원';
    const claimNo = s.claimElg === 'no';
    const claimGradeLabel = s.claimSeverity === 'severe' ? '중증' : '경증';
    const claimRW = this.claimRoundWindow();
    const claimEffState = { ...s, claimRound: claimRW.round, claimWindow: claimRW.window };
    const claimLimit = this.claimLimit(claimEffState);
    const claimEngine = this.claimEngine(claimEffState);
    const claimRoundMeta = this.CLAIM_ROUND_META[claimRW.round];
    const claimYear = this.claimYear();
    const claimExamDateLabel = this.fmtDateDot(new Date(this.EXAM_DATE));
    const claimJudgeDateLabel = this.fmtDateDot(new Date(new Date(this.EXAM_DATE).getTime() + 15 * 86400000));
    const claimValidityEndLabel = `${claimYear}.12.31`;
    const claimDaysUntilOpen = claimRW.nextOpen ? Math.max(0, Math.ceil((claimRW.nextOpen - new Date()) / 86400000)) : 0;
    const claimLinkedCards = this.CLAIM_CARDS_META.filter(c => s.claimCardsOn[c.id]).map(c => ({ ...c, tail: s.claimCardTails[c.id] || '' }));
    const claimOffCards = this.CLAIM_CARDS_META.filter(c => !s.claimCardsOn[c.id]);
    const claimCardOf = (id) => this.CLAIM_CARDS_META.find(c => c.id === id);
    const claimGauge = (paid, pending, dark) => {
      const rest = Math.max(0, claimLimit - paid - pending);
      const pct = (v) => claimLimit ? (v / claimLimit * 100) : 0;
      return { paid, pending, rest, paidPct: pct(paid), pendingPct: pct(pending), restPct: pct(rest), dark };
    };
    const claimCostRow = (c, tappable) => {
      const k = c.card ? claimCardOf(c.card) : null;
      const on = s.claimCostsOn[c.id] !== false;
      return { ...c, on, tappable, cardMeta: k, metaLabel: c.date + (k ? ' · ' + k.name + ' ' + (s.claimCardTails[k.id] || '') : ''), amtLabel: wonFmt(c.amt) };
    };

    let claimEligibilityView = null;
    {
      const key = claimNo ? 'no' : s.claimSeverity;
      const p = this.CLAIM_GRADE_PROFILE[key];
      claimEligibilityView = {
        profile: p,
        title: claimNo ? '이번 수능은\n보장 대상이 아니에요' : '보장 자격이 확인됐어요',
        lede: claimNo ? '수능 성적은 자동으로 연동돼요. 아래는 판정에 쓰인 실제 값이에요.' : '수능 성적은 자동으로 연동돼요. 확정 전까지 등급별로 나뉜 예상 보장이에요.',
        verdictKind: claimNo ? 'no' : s.claimSeverity,
        verdictLabel: claimNo ? '보장 대상이 아니에요' : (s.claimSeverity === 'severe' ? '중증 등급으로 보장 대상이에요' : '경증 등급으로 보장 대상이에요'),
        verdictDesc: claimNo
          ? `수능 ${p.score}점, 예상 점수 63점 대비 ${p.drop}점 하락했지만, 보장 기준선 48점은 넘었어요. 기준선(예상 범위 하단) 대비 15점 초과 하락이어야 보장돼요.`
          : (s.claimSeverity === 'severe'
            ? `수능 ${p.score}점, 예상 점수 63점 대비 ${p.drop}점 하락했어요. 25점 이상 하락한 중증 등급으로, ${s.claimForm} 중증 보장이 적용돼요.`
            : `수능 ${p.score}점, 예상 점수 63점 대비 ${p.drop}점 하락했어요. 15~24점 하락한 경증 등급으로, ${s.claimForm} 경증 보장이 적용돼요.`),
        tierLine: s.claimForm,
        gradeLine: claimGradeLabel,
        limitLine: wonFmt(claimLimit),
      };
    }

    // ── 홈 진입 카드(examPassed일 때 대체 표시) ──
    let claimHome = null;
    if (examPassed) {
      let kind, title, desc, gaugeData;
      if (claimNo) {
        kind = 'no'; title = '이번 수능은 보장 대상이 아니에요';
        desc = '하락폭이 보장 기준을 넘지 못했어요. 판정 근거를 확인하고 이의를 신청할 수 있어요.';
        gaugeData = null;
      } else if (claimRW.window === 'dead') {
        kind = 'dead'; title = '보장 자격이 종료됐어요';
        desc = `${claimYear}년 12월 31일이 지나 남은 한도 ${manFmt(claimEngine.remaining)}이 소멸했어요.`;
        gaugeData = claimGauge(claimEngine.cumEnt, 0, false);
      } else if (claimRW.window === 'wait') {
        kind = 'wait'; title = `${claimRoundMeta.label.charAt(0)}차 청구는 ${claimRW.round === 1 ? '6월 1일' : '12월 1일'}부터 열려요`;
        desc = `그 사이 결제 내역을 자동으로 모으고 있어요. 모인 금액 ${manFmt(claimEngine.thisCost)}.`;
        gaugeData = claimGauge(claimEngine.prevPaid, 0, false);
      } else {
        kind = 'open'; title = `${claimRoundMeta.label.charAt(0)}차 청구가 열렸어요`;
        desc = `${claimRoundMeta.deadline}까지 제출할 수 있어요. 연동된 결제 ${manFmt(claimEngine.thisCost)}이 준비돼 있어요.`;
        gaugeData = claimGauge(claimEngine.prevPaid, 0, true);
      }
      claimHome = {
        kind, title, desc, gauge: gaugeData,
        eligLine: claimNo ? `${claimExamDateLabel} 판정 · 비대상` : `${claimExamDateLabel} 판정 · ${claimGradeLabel} · 한도 ${manFmt(claimLimit)}`,
        linkedCount: claimLinkedCards.length,
        prevPaidLine: claimRW.round === 2 ? `1차 지급완료 · ${manFmt(claimEngine.prevPaid)}` : '아직 청구 내역이 없어요',
      };
    }

    return {
      isGrades: s.activeTab === 'grades',
      isConverter: s.activeTab === 'converter',
      isHome: s.activeTab === 'home',
      isMypage: s.activeTab === 'mypage',

      homeIs: { ins01: s.homeScreen === 'ins01', ins02: s.homeScreen === 'ins02', llm: s.homeScreen === 'llm' },
      showAiFab: s.activeTab === 'home' && s.homeScreen !== 'llm',
      discountModalOpen: s.discountModalOpen, coverageModalOpen: s.coverageModalOpen,
      openDiscountModal: () => this.setState({ discountModalOpen: true }),
      openCoverageModal: () => this.setState({ coverageModalOpen: true }),
      closeModals: () => this.setState({ discountModalOpen: false, coverageModalOpen: false }),
      quadrantModalOpen: s.quadrantModalOpen,
      openQuadrantModal: () => this.setState({ quadrantModalOpen: true }),
      closeQuadrantModal: () => this.setState({ quadrantModalOpen: false }),
      stopClick: e => e.stopPropagation(),
      loggedIn: s.loggedIn, showLogin: !s.loggedIn,
      login: () => this.setState({ loggedIn: true, activeTab: 'home' }),
      logout: () => this.setState({ loggedIn: false, activeTab: 'home', notifOpen: false, student: null, studentId: null }),
      // 개인화/로그인/온보딩 노출
      studentName: eff.name, studentSchool: eff.school, studentTarget: eff.target, studentTier: eff.tier,
      stability, stabilityLabel, stabilityColor, avgVol, topVolSubj, quadBuckets, priorityList,
      studentList: s.studentList, loginAs: this.loginAs,
      loading: s.loading, loadStage: s.loadStage,
      entry: s.entry, onbForm: s.onbForm, enrolledId: s.enrolledId, tiers: s.tiers,
      expandedTier: s.expandedTier,
      toggleTierDetail: (name) => this.setState(st => ({ expandedTier: st.expandedTier === name ? null : name })),
      entryGo: (screen) => this.setState({ entry: screen }),
      mode: s.mode,
      splashDone: s.splashDone,
      skipSplash: () => { clearTimeout(this._splashTimer); this.setState({ splashDone: true }); },
      navApp: () => {
        try { window.history.pushState({}, '', '/app'); } catch (e) {}
        this.setState({ mode: 'app', entry: 'login', splashDone: false });
        this._scheduleSplash();
      },
      navWeb: () => { try { window.history.pushState({}, '', '/'); } catch (e) {} this.setState({ mode: 'web', entry: 'landing' }); },
      selectTier: (t) => this.setState(st => ({ onbForm: { ...st.onbForm, tier: t }, entry: 'terms' })),
      setOnb: (patch) => this.setState(st => ({ onbForm: { ...st.onbForm, ...patch } })),
      apply: s.apply,
      setApply: (patch) => this.setState(st => ({ apply: { ...st.apply, ...patch } })),
      applyValid: this._applyValid(s.apply),
      submitEnroll: this.submitEnroll,
      doLogin: () => this.loginAs(s.enrolledId || 'stu_jimin'),
      notifOpen: s.notifOpen,
      openNotifications: () => this.setState({ notifOpen: true }),
      closeNotifications: () => this.setState({ notifOpen: false }),
      policyOpen: s.policyOpen, policyLoading: s.policyLoading, policyData: s.policyData, policyFocus: s.policyFocus,
      openPolicy: this.openPolicy, closePolicy: this.closePolicy,
      notifications: this.notifDefs,
      scanWarningOpen: s.scanWarningOpen,
      openScanWarning: () => this.setState({ scanWarningOpen: true }),
      closeScanWarning: () => this.setState({ scanWarningOpen: false }),
      backMy: () => {
        const map = { scan: 'main', analyzing: 'main', result: 'main', appeal: 'result', statusDetail: 'main', gradeHistory: 'main', payment: 'main', address: 'main', notifSettings: 'main', terms: 'main' };
        this.setState({ myScreen: map[s.myScreen] || 'main' });
      },
      coverageByForm: Object.keys(this.costForms).map(name => {
        const f = this.costForms[name];
        return { name, capLabel: fmtWon(f.cap), voucherPct: f.voucherPct, cashPct: 100 - f.voucherPct };
      }),
      premiumLabel, renewAt, joinedAt, coverPeriod, dday: 134,
      deltaLabel, deltaColor, riskFactors, payments,
      paymentsTotalLabel, paymentsReceiptNo,
      paymentYearChips: paymentYears.map(y => ({
        year: y, active: y === paymentsYear,
        onClick: () => this.setState({ paymentsYear: y, paymentsShowAll: false }),
      })),
      paymentsVisible, paymentsRemainCount, paymentsShowAll,
      togglePaymentsShowAll: () => this.setState(s2 => ({ paymentsShowAll: !s2.paymentsShowAll })),
      paymentDetailView,
      openPaymentDetail: (p) => this.setState({ paymentDetail: p }),
      closePaymentDetail: () => this.setState({ paymentDetail: null }),
      goIns02: () => this.setState({ homeScreen: 'ins02' }),
      backIns01: () => this.setState({ homeScreen: 'ins01' }),

      // ── 보험금 청구 ──
      examPassed,
      claimHome,
      claimEligibilityView,
      claimRoundMeta, claimEngine, claimLimit, claimGradeLabel, claimNo,
      claimForm: s.claimForm, claimSeverity: s.claimSeverity, claimRound: claimRW.round, claimWindow: claimRW.window,
      claimJudgeDateLabel, claimValidityEndLabel, claimExamDateLabel, claimDaysUntilOpen, claimYear,
      claimGaugeMain: examPassed ? claimGauge(claimEngine.prevPaid, s.claimScreen === 'calc' ? claimEngine.payout : 0, false) : null,
      claimIs: {
        home: s.claimScreen === 'home', eligibility: s.claimScreen === 'eligibility', syncing: s.claimScreen === 'syncing',
        link: s.claimScreen === 'link', cardConnecting: s.claimScreen === 'cardConnecting', intro: s.claimScreen === 'intro',
        step1: s.claimScreen === 'step1', pay: s.claimScreen === 'pay', calc: s.claimScreen === 'calc',
        submitting: s.claimScreen === 'submitting', done: s.claimScreen === 'done', status: s.claimScreen === 'status',
        windowClosed: s.claimScreen === 'windowClosed', expired: s.claimScreen === 'expired',
      },
      goClaim: (screen) => this.setState({ claimScreen: screen }),
      backClaimHome: () => this.setState({ claimScreen: 'home' }),

      claimLinkedCards, claimOffCards,
      claimLinkSummary: (() => {
        const collected = [...this.claimVisibleCosts(1, s), ...this.claimVisibleCosts(2, s)].filter(c => c.auto);
        const total = collected.reduce((sum, c) => sum + c.amt, 0);
        return { count: claimLinkedCards.length, items: collected.length, totalLabel: manFmt(total), lastSync: s.claimLastSync, recent: collected.slice(-3).reverse().map(c => claimCostRow(c, false)) };
      })(),
      openClaimLink: (from) => {
        this.setState({ claimLinkReturn: from || 'home' });
        const anyLinked = Object.values(this.state.claimCardsOn).some(Boolean);
        if (!anyLinked) { this.setState({ claimScreen: 'link' }); return; }
        this.setState({ claimScreen: 'syncing' });
        setTimeout(() => { this.setState({ claimLastSync: '방금', claimScreen: 'link' }); }, 900);
      },
      backClaimLink: () => this.setState(s2 => ({ claimScreen: s2.claimLinkReturn || 'home' })),
      claimConnectingCard: s.claimConnectingCard ? claimCardOf(s.claimConnectingCard) : null,
      connectClaimCard: (id) => {
        this.setState({ claimConnectingCard: id, claimScreen: 'cardConnecting' });
        setTimeout(() => {
          this.setState(s2 => {
            const tails = { ...s2.claimCardTails };
            if (!tails[id]) tails[id] = String(1000 + Math.floor(Math.random() * 8999));
            return { claimCardsOn: { ...s2.claimCardsOn, [id]: true }, claimCardTails: tails, claimScreen: 'link' };
          });
        }, 1200);
      },
      toggleClaimCard: (id) => this.setState(s2 => ({ claimCardsOn: { ...s2.claimCardsOn, [id]: !s2.claimCardsOn[id] } })),
      toggleClaimCost: (id) => this.setState(s2 => ({ claimCostsOn: { ...s2.claimCostsOn, [id]: s2.claimCostsOn[id] === false ? true : false } })),
      claimAutoCosts1: this.claimVisibleCosts(1, s).filter(c => c.auto).map(c => claimCostRow(c, true)),
      claimManualCosts1: this.claimVisibleCosts(1, s).filter(c => !c.auto).map(c => claimCostRow(c, true)),
      claimStepCosts: this.claimVisibleCosts(claimRW.round, s).filter(c => c.auto).map(c => claimCostRow(c, true))
        .concat(this.claimVisibleCosts(claimRW.round, s).filter(c => !c.auto).map(c => claimCostRow(c, true))),
      claimWindowCosts: this.claimVisibleCosts(claimRW.round, s).map(c => claimCostRow(c, false)),
      claimUpload: s.claimUpload,
      toggleClaimUpload: () => this.setState(s2 => ({ claimUpload: !s2.claimUpload })),
      claimAgreeGuardian: s.claimAgreeGuardian,
      toggleClaimAgreeGuardian: () => this.setState(s2 => ({ claimAgreeGuardian: !s2.claimAgreeGuardian })),
      claimAgreeFinal: s.claimAgreeFinal,
      toggleClaimAgreeFinal: () => this.setState(s2 => ({ claimAgreeFinal: !s2.claimAgreeFinal })),
      claimStep1CtaDisabled: !(claimEngine.thisCost > 0 && s.claimAgreeGuardian),
      claimStep3CtaDisabled: !s.claimAgreeFinal,
      goClaimStep1: () => this.setState({ claimScreen: 'step1' }),
      goClaimPay: () => this.setState({ claimScreen: 'pay' }),
      goClaimCalc: () => this.setState({ claimScreen: 'calc' }),
      claimFormVoucherPct: this.costForms[s.claimForm].voucherPct,
      claimFormCashPct: 100 - this.costForms[s.claimForm].voucherPct,
      claimVoucherAmt: wonFmt(claimEngine.payout * this.costForms[s.claimForm].voucherPct / 100),
      claimCashAmt: wonFmt(claimEngine.payout - claimEngine.payout * this.costForms[s.claimForm].voucherPct / 100),
      submitClaim: () => {
        this.setState({ claimScreen: 'submitting' });
        setTimeout(() => this.setState({ claimScreen: 'done' }), 1300);
      },
      wonFmt, manFmt,
      goLlm: () => this.openLlm('ins01'),
      goLlmSeeded: () => { this.openLlm('ins01'); this.askLLM('왜 수학 변동성이 보험료에 영향을 주나요?'); },
      backIns02: () => this.setState({ homeScreen: 'ins02' }),
      backLlm: () => this.setState({ homeScreen: s.llmFrom }),
      llmBackLabel: s.llmFrom === 'ins02' ? '보험현황 상세' : '보험현황',
      llmFactors: this.llmFactorDefs, llmChips, llmAnswer: s.llmAnswer,
      llmMessages: s.llmMessages, llmLoading: s.llmLoading,
      llmInput: s.llmInput,
      onLlmInput: e => this.setState({ llmInput: e.target.value }),
      submitLlm: () => {
        const q = (this.state.llmInput || '').trim();
        if (!q) return;
        this.askLLM(q);
        if (this.chatInputRef.current) this.chatInputRef.current.style.height = 'auto';
      },

      myIs: { main: s.myScreen === 'main', statusDetail: s.myScreen === 'statusDetail', gradeHistory: s.myScreen === 'gradeHistory', scan: s.myScreen === 'scan', analyzing: s.myScreen === 'analyzing', result: s.myScreen === 'result', appeal: s.myScreen === 'appeal', payment: s.myScreen === 'payment', address: s.myScreen === 'address', notifSettings: s.myScreen === 'notifSettings', terms: s.myScreen === 'terms' },
      goStatusDetail: () => this.setState({ myScreen: 'statusDetail' }),
      goGradeHistory: () => this.setState({ myScreen: 'gradeHistory' }),
      goPayment: () => this.setState({ myScreen: 'payment' }),
      goAddress: () => this.setState({ myScreen: 'address' }),
      goNotifSettings: () => this.setState({ myScreen: 'notifSettings' }),
      goTerms: () => this.setState({ myScreen: 'terms' }),
      notifSettingRows: [
        { key: 'exam', label: '성적표 등록 알림' },
        { key: 'billing', label: '보험료 산정 알림' },
        { key: 'appeal', label: '이의신청 처리 알림' },
        { key: 'marketing', label: '혜택 및 이벤트 알림' },
      ].map(n => {
        const on = s.notifToggles[n.key];
        return {
          label: n.label,
          toggleStyle: `width:44px;height:26px;border-radius:20px;position:relative;cursor:pointer;background:${on?'#0B8F58':'#DDD'}`,
          knobStyle: `width:20px;height:20px;border-radius:50%;background:#fff;position:absolute;top:3px;left:${on?21:3}px;transition:left .15s`,
          onClick: () => this.setState(st => ({ notifToggles: { ...st.notifToggles, [n.key]: !st.notifToggles[n.key] } })),
        };
      }),
      termsRows: ['보험상품 약관'],
      statusHistory: this.statusHistoryDefs,
      examHistory, examAllOpen,
      examSortDesc,
      toggleExamSort: () => this.setState(s2 => ({ examSortDesc: (s2.examSortDesc === false) ? true : false })),
      examOpen: s.examOpen || {},
      toggleExamOpen: (label) => this.setState(s2 => ({ examOpen: { ...s2.examOpen, [label]: !s2.examOpen[label] } })),
      toggleAllExams: () => {
        const next = {};
        examHistoryChron.forEach(e => { next[e.label] = !examAllOpen; });
        this.setState({ examOpen: next });
      },
      gradeBadgeLabel: gb.label,
      gradeBadgeStyle: `font-size:9.5px;font-weight:700;color:${gb.color};background:${gb.bg};padding:3px 9px;border-radius:20px;white-space:nowrap`,
      gradeStateDesc: gb.desc,
      recentGradesText: s.gradeState === 'confirmed' ? '2026년 9월 모의고사 · 백분위 63 (전 과목 확정)' : '확인 대기 중',
      goHomeIns01: () => this.setState({ activeTab: 'home', homeScreen: 'ins01' }),
      goToGradesHistory: () => this.setState({ activeTab: 'grades', gradeSeg: 0 }),
      goScan: () => this.setState({ myScreen: 'scan' }),
      goAnalyzing: () => { this.setState({ myScreen: 'analyzing' }); setTimeout(() => this.setState({ myScreen: 'result' }), 1200); },
      confirmGrades: () => this.setState({ gradeState: 'confirmed', myScreen: 'main' }),
      goAppeal: () => this.setState({ myScreen: 'appeal' }),
      submitAppeal: () => this.setState({ gradeState: 'appeal', myScreen: 'main' }),
      ocrRows, appealSubjectChips, appealReasonChips,
      segIs0: s.gradeSeg === 0, segIs1: s.gradeSeg === 1, segIs2: s.gradeSeg === 2,
      gradeSegChips,
      a1Band, a1Grid, a1Baseline, a1Line, a1Pred, a1Points, a1XLabels,
      a2Chips, a2Lines, a2GridYs: [4,29,54,79,104,129].map(y=>y+21).slice(0,6),
      volCards,
      b3Points, b3Peak, b3Latest,

      convIs: {
        intro: s.converterScreen === 'intro',
        input: s.converterScreen === 'input',
        costbase: s.converterScreen === 'costbase',
        result: s.converterScreen === 'result',
      },
      startInput: () => this.setState({ converterScreen: 'input' }),
      backConv: () => {
        const map = { input: 'intro', costbase: 'input', result: 'costbase' };
        this.setState({ converterScreen: map[s.converterScreen] || 'intro', resultDetail: false });
      },
      saveChips: this.chipList(this.saveOptions, s.save_m, 'save_m'),
      siblingChips: this.chipList(this.siblingOptions, s.siblingCount, 'siblingCount'),
      retireChips: this.chipList(this.retireOptions, s.retireGoal, 'retireGoal'),
      incomeChips: this.chipList(this.incomeOptions, s.income_m, 'income_m'),
      saveIsAvg, incomeIsAvg,
      oppOn: s.opp_on,
      oppToggleStyle: `width:44px;height:26px;border-radius:20px;position:relative;cursor:pointer;background:${s.opp_on?'#0B8F58':'#DDD'}`,
      oppKnobStyle: `width:20px;height:20px;border-radius:50%;background:#fff;position:absolute;top:3px;left:${s.opp_on?21:3}px;transition:left .15s`,
      toggleOpp: () => this.setState({ opp_on: !s.opp_on }),
      goCostBase: () => this.setState({ converterScreen: 'costbase' }),
      formChips,
      formMonthlyLabel: fmtWon(Math.round(form.monthly)),
      formTotalLabel: fmtWon(form.total),
      formNote: form.note,
      costTotalLabel: fmtWon(total),
      costAdjPct: s.costAdjPct,
      regionChips: this.regions.map(r => ({
        name: r.name, desc: r.desc, sel: s.region === r.name,
        onClick: () => this.setState({ region: r.name, costAdjPct: r.pct }),
      })),
      adjLabel: s.costAdjPct === 100
        ? `${s.region} 시세 기준 (전국 평균과 동일)`
        : `${s.region} 시세 기준 (전국 평균의 ${s.costAdjPct}%)`,
      adjSignLabel: s.region,
      convLoading: s.convLoading,
      goResult: () => {
        this.setState({ convLoading: true, resultDetail: false });
        setTimeout(() => this.setState({ convLoading: false, converterScreen: 'result' }), 1700);
      },
      costForm: s.costForm,
      formCapLabel: fmtWon(form.cap) + '/월',
      formVoucherPct: form.voucherPct, formCashPct: 100 - form.voucherPct,
      oppAmountLabel: fmtWon(this.OPP_AMOUNT),
      hasAnyCard, noCards: !hasAnyCard,
      resultDetail: s.resultDetail,
      toggleResultDetail: () => this.setState(s2 => ({ resultDetail: !s2.resultDetail })),
      saveMonths, tuitionSemesters, retirePct, incomeMonths,
      saveValLabel, incomeValLabel, semesterCostLabel, retireGoalLabel,
      costSelfLabel: fmtWon(selfPay), costCoveredLabel: fmtWon(covered),
      backToInput: () => this.setState({ converterScreen: 'input', resultDetail: false }),
      goToGrades: () => this.setState({ activeTab: 'grades', gradeSeg: 0 }),
      homeTab, gradesTab, converterTab, mypageTab, aiTab,
    };
  }

  render() {
    const vm = this.renderVals();
    return (
      <div style={S(`min-height:100dvh;display:flex;justify-content:center;background:${vm.mode === 'app' ? '#EDEFF3' : '#fff'}`)}>
        <div style={vm.mode === 'app'
          ? S("width:100%;max-width:460px;height:100dvh;background:#fff;overflow:hidden;display:flex;flex-direction:column;position:relative;box-shadow:0 0 40px rgba(0,0,0,0.06)")
          : S("width:100%;min-height:100dvh;background:#fff;position:relative;display:flex;flex-direction:column")}>
          {/* ── 인강 데스크톱 웹페이지 (첫 화면 · 웹) ── */}
          {(vm.mode === 'web' && !['apply','done'].includes(vm.entry)) && (<>
            <div style={S("background:#fff;display:flex;flex-direction:column;width:100%")}>
              {/* ① 상단 유틸리티 바 */}
              <div style={S("width:100%;background:#1A1C22;color:#B9BEC9")}>
                <div style={S("max-width:1160px;margin:0 auto;height:34px;padding:0 20px;display:flex;align-items:center;gap:16px;font-size:11.5px")}>
                  <span style={S("cursor:pointer")}>고객센터</span>
                  <span style={S("cursor:pointer")}>학습Q&amp;A</span>
                  <span style={S("cursor:pointer")}>수강권 등록</span>
                  <div style={S("flex:1")}></div>
                  <span style={S("cursor:pointer")}>회원가입</span>
                  <span style={S("color:#8DE0AE;font-weight:700;cursor:pointer")} onClick={vm.navApp}>재수없수 로그인 ›</span>
                </div>
              </div>
              {/* ② 헤더 · 글로벌 내비 (sticky) */}
              <div style={S("width:100%;background:#fff;border-bottom:1px solid #ECEEF1;position:sticky;top:0;z-index:8")}>
                <div style={S("max-width:1160px;margin:0 auto;height:66px;padding:0 20px;display:flex;align-items:center;gap:26px")}>
                  <div style={S("display:flex;align-items:center;gap:8px;cursor:pointer")} onClick={vm.navWeb}>
                    <span style={S("width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#2B4FE8,#3F6BFF);color:#fff;font-size:14px;font-weight:900;display:flex;align-items:center;justify-content:center")}>M</span>
                    <span style={S("font-size:20px;font-weight:900;color:#1A1C22;letter-spacing:-0.6px")}>메가에듀<span style={S("color:#2B4FE8")}>패스</span></span>
                  </div>
                  <div style={S("flex:1;display:flex;align-items:center;gap:24px")}>
                    {['인강','교재','모의고사','학습관리','입시정보','합격수기'].map((m,mi)=>(<React.Fragment key={mi}><span style={S(`font-size:14.5px;font-weight:700;cursor:pointer;color:${mi===0?'#2B4FE8':'#3A3E46'}`)}>{m}</span></React.Fragment>))}
                  </div>
                  <div style={S("display:flex;align-items:center;gap:6px;height:38px;padding:0 14px;background:#F3F5F8;border-radius:20px;width:200px")}>
                    <span style={S("font-size:13px;color:#9AA0AB")}>🔎</span>
                    <span style={S("font-size:12.5px;color:#9AA0AB")}>강좌·교재 검색</span>
                  </div>
                  <div style={S("background:#2B4FE8;color:#fff;font-size:13.5px;font-weight:800;border-radius:22px;padding:10px 20px;cursor:pointer;white-space:nowrap")} onClick={() => vm.entryGo('pay')}>패스 신청</div>
                </div>
              </div>

              {/* ③ 히어로 */}
              <div style={S("width:100%;background:radial-gradient(1200px 400px at 70% 0%,#16204A 0%,#0A0A0C 60%)")}>
                <div style={S("max-width:1160px;margin:0 auto;padding:56px 20px 52px;display:flex;align-items:center;gap:40px;flex-wrap:wrap")}>
                  <div style={S("flex:1;min-width:300px")}>
                    <div style={S("display:inline-block;font-size:12px;font-weight:800;color:#9BE23B;border:1px solid rgba(155,226,59,0.5);border-radius:20px;padding:5px 12px")}>2026 대비 · 얼리버드 진행중</div>
                    <div style={S("font-size:46px;font-weight:900;color:#fff;letter-spacing:-2px;margin-top:20px;line-height:1.12")}>합격까지<br/>무제한 <span style={S("background:linear-gradient(90deg,#4E7CFF,#8FB4FF);-webkit-background-clip:text;background-clip:text;color:transparent")}>올패스</span></div>
                    <div style={S("font-size:15px;color:#AEB4C0;margin-top:16px;line-height:1.7")}>국·수·영·탐 전 강좌 12개월 무제한 수강.<br/>결제 한 번으로 대표 강사진의 전 커리큘럼을 모두 담았습니다.</div>
                    <div style={S("display:flex;gap:12px;margin-top:28px;flex-wrap:wrap")}>
                      <div style={S("background:#2B4FE8;color:#fff;font-size:15px;font-weight:800;border-radius:14px;padding:15px 30px;cursor:pointer")} onClick={() => vm.entryGo('pay')}>수강신청 →</div>
                      <div style={S("background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.25);font-size:15px;font-weight:700;border-radius:14px;padding:15px 26px;cursor:pointer")}>커리큘럼 보기</div>
                    </div>
                  </div>
                  <div style={S("flex:none;width:320px;display:flex;flex-direction:column;gap:12px")}>
                    {[['누적 수강생','1,240,000+'],['대표 강사','48명'],['평균 만족도','4.9 / 5.0']].map((r,ri)=>(<React.Fragment key={ri}>
                      <div style={S("background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between")}>
                        <span style={S("font-size:13px;color:#AEB4C0;font-weight:600")}>{r[0]}</span>
                        <span style={S("font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px")}>{r[1]}</span>
                      </div>
                    </React.Fragment>))}
                  </div>
                </div>
              </div>

              {/* ④ 신뢰 밴드 */}
              <div style={S("width:100%;background:linear-gradient(135deg,#1F44E6,#2E56F5)")}>
                <div style={S("max-width:1160px;margin:0 auto;padding:22px 20px;display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap")}>
                  <span style={S("font-size:15px;font-weight:800;color:#fff")}>결과로 증명된 합격 공식,</span>
                  <span style={S("font-size:19px;font-weight:900;color:#9BE23B;letter-spacing:-0.5px")}>불변의 법칙 · 메가에듀패스</span>
                </div>
              </div>

              {/* ⑤ 패스 상품 그리드 */}
              <div style={S("max-width:1160px;margin:0 auto;padding:56px 20px 20px;width:100%;box-sizing:border-box")}>
                <div style={S("font-size:13px;font-weight:800;color:#2B4FE8")}>PASS LINE-UP</div>
                <div style={S("font-size:28px;font-weight:900;color:#16181D;letter-spacing:-1px;margin-top:6px")}>목표에 맞는 패스를 선택하세요</div>
                <div style={S("display:flex;gap:18px;margin-top:26px;flex-wrap:wrap")}>
                  {[
                    {tag:'BEST',tagC:'#2B4FE8',title:'올인원 메가패스',sub:'국·수·영·탐 전 강좌 · 12개월 무제한',was:'460,000',now:'396,000',hot:true},
                    {tag:'단과',tagC:'#0B8F58',title:'단과 집중 패스',sub:'약점 과목 단과 3강좌 자유 선택',was:'240,000',now:'198,000',hot:false},
                    {tag:'재종',tagC:'#E0821A',title:'재종 통학 패스',sub:'재수종합 커리큘럼 + 담임관리',was:'1,980,000',now:'1,670,000',hot:false},
                    {tag:'기숙',tagC:'#B03A5B',title:'프리미엄 기숙 패스',sub:'전일제 기숙 + 밀착 컨설팅',was:'2,900,000',now:'2,500,000',hot:false},
                  ].map((p,pi)=>(<React.Fragment key={pi}>
                    <div style={S(`flex:1;min-width:250px;border:1px solid ${p.hot?'#B9CCFF':'#E7EAEF'};border-radius:20px;overflow:hidden;background:#fff;box-shadow:${p.hot?'0 14px 34px rgba(43,79,232,0.14)':'0 6px 18px rgba(20,25,40,0.04)'};display:flex;flex-direction:column`)}>
                      <div style={S(`padding:18px 18px 14px;background:${p.hot?'linear-gradient(135deg,#EEF3FF,#F7F9FF)':'#F8F9FB'}`)}>
                        <span style={S(`font-size:10px;font-weight:900;color:#fff;background:${p.tagC};border-radius:5px;padding:3px 8px`)}>{p.tag}</span>
                        <div style={S("font-size:17px;font-weight:900;color:#16181D;margin-top:12px;letter-spacing:-0.4px")}>{p.title}</div>
                        <div style={S("font-size:12.5px;color:#7A808B;margin-top:6px;line-height:1.5;min-height:36px")}>{p.sub}</div>
                      </div>
                      <div style={S("padding:16px 18px;display:flex;flex-direction:column;gap:12px;flex:1")}>
                        <div>
                          <div style={S("font-size:11.5px;color:#B4B9C2;text-decoration:line-through")}>{p.was}원</div>
                          <div style={S("font-size:23px;font-weight:900;color:#16181D")}>{p.now}<span style={S("font-size:13px;font-weight:700")}>원</span></div>
                        </div>
                        <div style={S("margin-top:auto;background:#2B4FE8;color:#fff;font-size:13.5px;font-weight:800;border-radius:12px;height:44px;display:flex;align-items:center;justify-content:center;cursor:pointer")} onClick={() => vm.entryGo('pay')}>수강신청 ›</div>
                      </div>
                    </div>
                  </React.Fragment>))}
                </div>
              </div>

              {/* ⑥ 대표 강사 라인업 */}
              <div style={S("max-width:1160px;margin:0 auto;padding:44px 20px 20px;width:100%;box-sizing:border-box")}>
                <div style={S("display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:8px")}>
                  <div>
                    <div style={S("font-size:13px;font-weight:800;color:#2B4FE8")}>TOP INSTRUCTORS</div>
                    <div style={S("font-size:26px;font-weight:900;color:#16181D;letter-spacing:-1px;margin-top:6px")}>대표 강사 라인업</div>
                  </div>
                  <span style={S("font-size:13px;color:#7A808B;cursor:pointer")}>전체 강사 보기 ›</span>
                </div>
                <div style={S("display:flex;gap:16px;margin-top:24px;flex-wrap:wrap")}>
                  {[
                    {n:'김서준',s:'국어',c:'#5B7CFA'},{n:'이도현',s:'수학',c:'#0B8F58'},
                    {n:'박지훈',s:'영어',c:'#E0821A'},{n:'최유나',s:'사회탐구',c:'#B03A5B'},
                    {n:'정민재',s:'과학탐구',c:'#7A5BFA'},
                  ].map((t,ti)=>(<React.Fragment key={ti}>
                    <div style={S("flex:1;min-width:180px;border:1px solid #EDEFF2;border-radius:18px;overflow:hidden;background:#fff")}>
                      <div style={S(`height:120px;background:linear-gradient(160deg,${t.c},${t.c}CC);display:flex;align-items:flex-end;justify-content:center`)}>
                        <span style={S("font-size:52px")}>🧑‍🏫</span>
                      </div>
                      <div style={S("padding:14px 16px")}>
                        <span style={S(`font-size:11px;font-weight:800;color:${t.c}`)}>{t.s}</span>
                        <div style={S("font-size:16px;font-weight:900;color:#16181D;margin-top:4px")}>{t.n} <span style={S("font-size:12px;font-weight:600;color:#9AA0AB")}>선생님</span></div>
                      </div>
                    </div>
                  </React.Fragment>))}
                </div>
              </div>

              {/* ⑦ 재수없수 보험 프로모 섹션 */}
              <div style={S("width:100%;background:linear-gradient(160deg,#EAF7EC 0%,#F4FBF5 100%);margin-top:44px")}>
                <div style={S("max-width:1160px;margin:0 auto;padding:52px 20px;display:flex;align-items:center;gap:44px;flex-wrap:wrap")}>
                  <div style={S("flex:1;min-width:300px")}>
                    <div style={S("display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;color:#0B8F58;background:#fff;border:1px solid #BEE3CE;border-radius:20px;padding:6px 13px")}>🛡️ 인강 임베디드 보험</div>
                    <div style={S("font-size:32px;font-weight:900;color:#0B5E3A;letter-spacing:-1.2px;margin-top:18px;line-height:1.2")}>수강신청과 함께,<br/>재수없수로 마음까지 든든하게</div>
                    <div style={S("font-size:14.5px;color:#3E5B4C;margin-top:16px;line-height:1.75")}>혹시 모를 성적 급락과 재수라는 변수에 대비하는 <b>학습성취 보장보험</b>. 결제 단계에서 옵션으로 함께 가입하고, 전용 앱에서 우리 아이 성적·보험료를 한눈에 확인하세요.</div>
                    <div style={S("display:flex;gap:12px;margin-top:26px;flex-wrap:wrap")}>
                      <div style={S("background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:14.5px;font-weight:800;border-radius:14px;padding:15px 28px;cursor:pointer")} onClick={() => vm.entryGo('pay')}>보험 함께 알아보기 →</div>
                      <div style={S("background:#fff;color:#0B8F58;border:1px solid #BEE3CE;font-size:14.5px;font-weight:700;border-radius:14px;padding:15px 24px;cursor:pointer")} onClick={vm.navApp}>재수없수 앱 열기</div>
                    </div>
                  </div>
                  <div style={S("flex:none;width:340px;display:flex;flex-direction:column;gap:12px")}>
                    {[
                      ['📊','우리 아이 성적 리포트','과목별 변동성·예상 백분위를 시각화'],
                      ['💬','AI 도우미 노재수','약관·보험료를 쉬운 말로 설명'],
                      ['💰','돈워리 대시보드','재정적 혜택을 한눈에 환산'],
                    ].map((b,bi)=>(<React.Fragment key={bi}>
                      <div style={S("background:#fff;border:1px solid rgba(11,143,88,0.14);border-radius:16px;padding:16px 18px;display:flex;align-items:center;gap:14px;box-shadow:0 8px 20px rgba(11,143,88,0.06)")}>
                        <span style={S("font-size:26px;flex:none")}>{b[0]}</span>
                        <div>
                          <div style={S("font-size:14.5px;font-weight:800;color:#0B5E3A")}>{b[1]}</div>
                          <div style={S("font-size:12px;color:#6C8579;margin-top:3px")}>{b[2]}</div>
                        </div>
                      </div>
                    </React.Fragment>))}
                  </div>
                </div>
              </div>

              {/* ⑧ 합격 후기 */}
              <div style={S("max-width:1160px;margin:0 auto;padding:52px 20px 20px;width:100%;box-sizing:border-box")}>
                <div style={S("text-align:center")}>
                  <div style={S("font-size:13px;font-weight:800;color:#2B4FE8")}>REVIEWS</div>
                  <div style={S("font-size:26px;font-weight:900;color:#16181D;letter-spacing:-1px;margin-top:6px")}>합격이 증명합니다</div>
                </div>
                <div style={S("display:flex;gap:18px;margin-top:28px;flex-wrap:wrap")}>
                  {[
                    ['“변동성 큰 수학을 집중 관리하니 실전에서 흔들리지 않았어요.”','서울대 경영 · 김O은'],
                    ['“패스 하나로 전 과목을 돌릴 수 있어 시간을 아꼈습니다.”','연세대 전기전자 · 이O준'],
                    ['“재수없수 리포트로 부모님과 상담이 훨씬 수월했어요.”','고려대 미디어 · 박O아'],
                  ].map((r,ri)=>(<React.Fragment key={ri}>
                    <div style={S("flex:1;min-width:260px;border:1px solid #EDEFF2;border-radius:18px;padding:22px;background:#fff")}>
                      <div style={S("font-size:15px;color:#FFC53D")}>★★★★★</div>
                      <div style={S("font-size:14.5px;color:#2E323A;line-height:1.7;margin-top:12px;font-weight:600")}>{r[0]}</div>
                      <div style={S("font-size:12.5px;color:#9AA0AB;margin-top:14px")}>{r[1]}</div>
                    </div>
                  </React.Fragment>))}
                </div>
              </div>

              {/* ⑨ 하단 CTA 배너 */}
              <div style={S("max-width:1160px;margin:44px auto 0;padding:0 20px;width:100%;box-sizing:border-box")}>
                <div style={S("background:radial-gradient(800px 300px at 20% 0%,#2B4FE8 0%,#16204A 70%);border-radius:24px;padding:40px;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap")}>
                  <div>
                    <div style={S("font-size:24px;font-weight:900;color:#fff;letter-spacing:-0.8px")}>지금 시작하면, 합격이 가까워집니다</div>
                    <div style={S("font-size:14px;color:#B9C2E0;margin-top:8px")}>얼리버드 혜택은 조기 마감될 수 있어요.</div>
                  </div>
                  <div style={S("background:#9BE23B;color:#16204A;font-size:15px;font-weight:900;border-radius:14px;padding:16px 34px;cursor:pointer")} onClick={() => vm.entryGo('pay')}>수강신청 →</div>
                </div>
              </div>

              {/* ⑩ 푸터 */}
              <div style={S("width:100%;background:#14161B;color:#8A909C;margin-top:48px")}>
                <div style={S("max-width:1160px;margin:0 auto;padding:40px 20px 48px")}>
                  <div style={S("display:flex;gap:40px;flex-wrap:wrap;margin-bottom:26px")}>
                    {[
                      ['서비스',['인강','교재','모의고사','합격수기']],
                      ['고객지원',['공지사항','자주 묻는 질문','1:1 문의','수강권 등록']],
                      ['재수없수',['상품 안내','보장 내용','약관 다운로드','앱 다운로드']],
                    ].map((col,ci)=>(<React.Fragment key={ci}>
                      <div style={S("min-width:140px")}>
                        <div style={S("font-size:13px;font-weight:800;color:#E4E7EC;margin-bottom:12px")}>{col[0]}</div>
                        {col[1].map((l,li)=>(<React.Fragment key={li}><div style={S("font-size:12.5px;color:#8A909C;margin-bottom:8px;cursor:pointer")}>{l}</div></React.Fragment>))}
                      </div>
                    </React.Fragment>))}
                  </div>
                  <div style={S("border-top:1px solid #262A31;padding-top:20px;font-size:11.5px;color:#6B717C;line-height:1.9")}>
                    <div style={S("font-size:15px;font-weight:900;color:#E4E7EC;margin-bottom:10px")}>메가에듀패스</div>
                    (주)메가에듀 · 대표 홍길동 · 사업자등록번호 000-00-00000 · 서울특별시 강남구 테헤란로 000<br/>
                    본 페이지는 포트폴리오용 데모이며 실제 강좌·강사·가격 정보가 아닙니다. 「재수없수 학습성취 보장보험」은 가상의 상품 예시입니다.<br/>
                    © 2026 MEGA EDU PASS. All rights reserved.
                  </div>
                </div>
              </div>
            </div>
          </>)}

          {/* ── 재수없수 스플래시 화면 (로그인 진입 전) ── */}
          {(vm.mode === 'app' && !vm.loggedIn && !vm.splashDone) && (<>
            <div
              style={S("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;position:relative;overflow:hidden;background:linear-gradient(135deg,#076B41 0%,#0B8F58 48%,#23C088 100%);cursor:pointer")}
              onClick={vm.skipSplash}
            >
              <img src={IMG_LOGO} alt="재수없수 로고" style={S("width:180px;height:180px;object-fit:contain")} />
              <div style={S("display:flex;gap:7px;margin-top:34px")}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={S(`width:7px;height:7px;border-radius:50%;background:#fff;animation:pulse 1.2s ease-in-out ${i * 0.2}s infinite`)}></div>
                ))}
              </div>
              <div style={S("position:absolute;bottom:78px;font-size:10.5px;color:rgba(255,255,255,0.75);letter-spacing:-0.2px")}>화면을 탭하면 바로 시작해요</div>

              {/* 화면 하단에서 왼쪽 → 오른쪽으로 걸어가는 캐릭터 */}
              <div style={S("position:absolute;left:0;right:0;bottom:0;height:64px;overflow:hidden")}>
                <div style={S("position:absolute;bottom:8px;width:50px;height:50px;animation:su-walk-x 2.4s linear infinite")}>
                  <img src={IMG_F7F53234} alt="재수없수 캐릭터" style={S("width:100%;height:100%;object-fit:contain;animation:su-walk-y 0.5s ease-in-out infinite")} />
                </div>
              </div>
            </div>
          </>)}

          {/* ── 재수없수 로그인 (아이디/비밀번호) ── */}
          {(vm.mode === 'app' && !vm.loggedIn && vm.splashDone) && (<>
            <div style={S("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;gap:10px")}>
              <img src={IMG_F7F53234} alt="재수없수 로고" style={S("width:64px;height:64px;object-fit:contain;margin-bottom:6px")} />
              <div style={S("font-size:21px;font-weight:900;color:#0B8F58;letter-spacing:-0.8px")}>재수없수</div>
              <div style={S("font-size:12px;color:#0B8F58;font-weight:500;margin-bottom:18px;letter-spacing:-0.2px")}>재수없는 우리 아이! 부담없는 우리집!</div>
              <input type="text" placeholder="아이디" style={S("width:100%;height:48px;border:1px solid #E5E5E5;border-radius:16px;padding:0 14px;font-size:12px;font-family:inherit;box-sizing:border-box")} />
              <input type="password" placeholder="비밀번호" style={S("width:100%;height:48px;border:1px solid #E5E5E5;border-radius:16px;padding:0 14px;font-size:12px;font-family:inherit;box-sizing:border-box;margin-top:8px")} />
              <div style={S("width:100%;background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:13px;font-weight:700;border-radius:16px;height:50px;display:flex;align-items:center;justify-content:center;margin-top:16px;cursor:pointer")} onClick={vm.doLogin}>로그인</div>
              <div style={S("font-size:10px;color:#999;margin-top:14px;cursor:pointer")} onClick={vm.navWeb}>← 인강 홈으로</div>
            </div>
          </>)}
          {(vm.mode === 'app' && vm.loggedIn) && (<>
            <div style={S("height:62px;flex:none;display:flex;align-items:center;justify-content:center;position:relative;border-bottom:1px solid #F2F2F2")}>
              <img src={IMG_LOGO_DARK} alt="재수없수 로고" style={S("width:40px;height:40px;border-radius:12px;object-fit:cover")} />
              <div style={S("position:absolute;right:18px;display:flex")} onClick={vm.openNotifications}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#0B8F58" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"></path>
                  <path d="M10 19a2 2 0 0 0 4 0"></path>
                </svg>
              </div>
            </div>
            <div style={S("flex:1;overflow-y:auto;padding:18px 20px 130px;display:flex;flex-direction:column;gap:15px;background:#fff")}>
              {(vm.isGrades) && (<>
                <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:12px 14px;display:flex;align-items:center;gap:12px")}>
                  <div style={S("width:46px;height:46px;border-radius:50%;flex:none;background:repeating-linear-gradient(45deg,#0B8F58,#0B8F58 4px,#004F2E 4px,#004F2E 8px)")}></div>
                  <div style={S("flex:1;min-width:0")}>
                    <div style={S("display:flex;align-items:center;gap:6px")}>
                      <span style={S("font-size:13px;font-weight:700;color:#111")}>{vm.studentName} 학생</span>
                      <span style={S("font-size:8.5px;font-weight:700;background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;padding:2px 8px;border-radius:20px")}>고3</span>
                    </div>
                    <div style={S("font-size:10px;color:#888;margin-top:2px")}>모의고사 9회 분석 완료 · 9월 갱신</div>
                  </div>
                </div>
                <div style={S("background:#F0F0F0;border-radius:16px;padding:4px;display:flex;gap:4px")}>
                  {(vm.gradeSegChips || []).map((chip, $index) => (
                    <React.Fragment key={$index}>
                      <div style={S(chip.style)} onClick={chip.onClick}>
                        {chip.label}
                      </div>
                    </React.Fragment>
                  ))}
                </div>
                {(vm.segIs0) && (<>
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:15px 16px")}>
                    <div style={S("display:flex;align-items:center;justify-content:space-between")}>
                      <span style={S("font-size:12.5px;font-weight:700;color:#111;white-space:nowrap")}>수능 예상 점수</span>
                      <span style={S("font-size:9.5px;font-weight:700;color:#fff;background:#0B8F58;padding:3px 9px;border-radius:20px;white-space:nowrap;flex-shrink:0")}>↗ 오르는 중</span>
                    </div>
                    <div style={S("display:flex;align-items:baseline;gap:8px;margin-top:8px")}>
                      <span style={S("font-size:29px;font-weight:800;color:#111")}>백분위 63</span>
                      <span style={S("font-size:11px;color:#888")}>예상 범위 56 ~ 70</span>
                    </div>
                    <div style={S("font-size:10.5px;color:#555;line-height:1.6;margin-top:8px")}>
                      지금까지 본 모의고사 9번의 흐름으로 계산했어요. 백분위 63은 
                      <b>전국에서 상위 37%</b>
                      라는 뜻이에요.
                    </div>
                    <svg viewBox="0 0 321 192" style={S("width:100%;margin-top:10px")}>
                      <polygon points={vm.a1Band} fill="#0B8F58" opacity="0.15"></polygon>
                      {(vm.a1Grid || []).map((g, $index) => (
                        <React.Fragment key={$index}>
                          <line x1="14" y1={g.y} x2="321" y2={g.y} stroke="#EDEDED" strokeWidth="1"></line>
                          <text x="4" y={g.ty} fontSize="9" fill="#AAA" textAnchor="start">
                            {g.label}
                          </text>
                        </React.Fragment>
                      ))}
                      <line x1={vm.a1Baseline.x1} y1={vm.a1Baseline.y} x2={vm.a1Baseline.x2} y2={vm.a1Baseline.y} stroke="#D9534F" strokeWidth="1.5" strokeDasharray="4 3"></line>
                      <text x={vm.a1Baseline.x2} y={vm.a1Baseline.ty} fontSize="11" fontWeight="700" fill="#D9534F" textAnchor="end">보장 기준선 48점</text>
                      <polyline points={vm.a1Line} fill="none" stroke="#0B8F58" strokeWidth="2.5"></polyline>
                      <line x1={vm.a1Pred.lx} y1={vm.a1Pred.ly} x2={vm.a1Pred.px} y2={vm.a1Pred.py} stroke="#0B8F58" strokeWidth="2" strokeDasharray="5 3"></line>
                      {(vm.a1Points || []).map((p, $index) => (
                        <React.Fragment key={$index}>
                          <circle cx={p.x} cy={p.y} r="3" fill="#0B8F58"></circle>
                        </React.Fragment>
                      ))}
                      <circle cx={vm.a1Pred.px} cy={vm.a1Pred.py} r="4.5" fill="#fff" stroke="#0B8F58" strokeWidth="2.5"></circle>
                      <text x={vm.a1Pred.px} y={vm.a1Pred.ly2} fontSize="10" fontWeight="800" fill="#0B8F58" textAnchor="middle">63</text>
                      {(vm.a1XLabels || []).map((lb, $index) => (
                        <React.Fragment key={$index}>
                          <text x={lb.x} y="188" fontSize="7.5" fill="#AAA" textAnchor="middle">
                            {lb.text}
                          </text>
                        </React.Fragment>
                      ))}
                    </svg>
                    <div style={S("background:#FCE9EC;border-radius:16px;padding:10px 12px;margin-top:10px;font-size:12px;color:#9A3B3B;line-height:1.6")}>
                      빨간 선(48점)은 <b style={S("color:#9A3B3B")}>보험 보장 기준선</b>
                      이에요. 평소 예상 범위보다 15점 넘게 떨어지는 건 실력이 아니라 '그날의 불운'으로 보고, 이 선 아래로 내려가 재수하게 되면 보험이 재수 비용을 보장해요.
                    </div>
                  </div>
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:15px 16px")}>
                    <div style={S("display:flex;align-items:center;justify-content:space-between")}>
                      <span style={S("font-size:12.5px;font-weight:700;color:#111;white-space:nowrap")}>과목별 성적 추이</span>
                      <div style={S("text-align:right;white-space:nowrap")}>
                        <span style={S("font-size:9.5px;color:#888")}>평균</span>
                        <span style={S("font-size:15px;font-weight:800;color:#111")}>2.15등급</span>
                        <span style={S("font-size:10px;color:#AAA")}>(상위 28%)</span>
                      </div>
                    </div>
                    <div style={S("display:flex;gap:6px;margin-top:10px;flex-wrap:wrap")}>
                      {(vm.a2Chips || []).map((chip, $index) => (
                        <React.Fragment key={$index}>
                          <div style={S(chip.style)} onClick={chip.onClick}>
                            {chip.label}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                    <div style={S("display:flex;margin-top:12px")}>
                      <div style={S("width:26px;flex:none;display:flex;flex-direction:column;justify-content:space-between;height:150px;font-size:9px;color:#AAA;text-align:right;padding-right:4px")}>
                        <span>85</span>
                        <span>75</span>
                        <span>65</span>
                        <span>55</span>
                        <span>45</span>
                        <span>35</span>
                      </div>
                      <svg viewBox="0 0 290 150" style={S("flex:1;min-width:0")}>
                        {(vm.a2GridYs || []).map((gy, $index) => (
                          <React.Fragment key={$index}>
                            <line x1="0" y1={gy} x2="290" y2={gy} stroke="#F0F0F0" strokeWidth="1"></line>
                          </React.Fragment>
                        ))}
                        {(vm.a2Lines || []).map((ln, $index) => (
                          <React.Fragment key={$index}>
                            {(ln.visible) && (<>
                              <polyline points={ln.points} fill="none" stroke={ln.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"></polyline>
                              {(ln.pts || []).map((p, $index) => (
                                <React.Fragment key={$index}>
                                  <circle cx={p.x} cy={p.y} r="3" fill={ln.color}></circle>
                                </React.Fragment>
                              ))}
                            </>)}
                          </React.Fragment>
                        ))}
                      </svg>
                    </div>
                    <div style={S("display:flex;justify-content:space-between;font-size:8.5px;color:#AAA;padding-left:34px;margin-top:6px")}>
                      <span>고1 9월</span>
                      <span>고2 3월</span>
                      <span>고2 9월</span>
                      <span>고3 3월</span>
                      <span>고3 9월</span>
                    </div>
                    <div style={S("text-align:center;font-size:9.5px;color:#555;margin-top:10px")}>
                      <span style={S("color:#0B8F58")}>●</span>
                       국어&nbsp;&nbsp;
                      <span style={S("color:#3B82F6")}>●</span>
                       수학&nbsp;&nbsp;
                      <span style={S("color:#DB2777")}>●</span>
                       영어&nbsp;&nbsp;
                      <span style={S("color:#D97706")}>●</span>
                       탐구
            
                    </div>
                  </div>
                  <div style={S("background:#E4F5EC;border-radius:22px;padding:15px 16px")}>
                    <div style={S("font-size:12.5px;font-weight:700;color:#0B8F58")}>💡 고3 성적이 내려간 것처럼 보여도 걱정 마세요</div>
                    <div style={S("font-size:10.5px;color:#3F5B4E;line-height:1.6;margin-top:8px")}>
                      고3이 되면 재수생들이 시험에 들어와서 등수(백분위)가 자연스럽게 내려가요.
                      <b>실력이 떨어진 게 아니라 경쟁자가 늘어난 것</b>
                       — 위 예상 점수는 이 효과를 빼고 계산했어요.
                    </div>
                  </div>
                </>)}
                {(vm.segIs1) && (<>
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:18px")}>
                    <div style={S("display:flex;align-items:center;justify-content:space-between")}>
                      <span style={S("font-size:14px;font-weight:800;color:#111")}>안정성 점수</span>
                      <span style={S(`font-size:10.5px;font-weight:700;color:#fff;background:${vm.stabilityColor};padding:4px 11px;border-radius:20px;flex:none`)}>{vm.stabilityLabel}</span>
                    </div>
                    <div style={S("display:flex;align-items:baseline;gap:6px;margin-top:14px")}>
                      <span style={S(`font-size:39px;font-weight:900;color:${vm.stabilityColor};line-height:1`)}>{vm.stability}</span>
                      <span style={S("font-size:14px;font-weight:700;color:#BBB")}>/ 100</span>
                    </div>
                    <div style={S("height:12px;background:#EEF1EF;border-radius:7px;margin-top:14px;overflow:hidden")}>
                      <div style={S(`height:100%;border-radius:7px;background:${vm.stabilityColor};width:${vm.stability}%`)}></div>
                    </div>
                    <div style={S("font-size:11.5px;color:#666;line-height:1.65;margin-top:14px")}>
                      점수가 클수록 시험마다 성적이 <b>안정적</b>이라는 뜻이에요. 지금은 <b style={S("color:#111")}>{vm.topVolSubj}</b> 과목의 등락이 가장 커서, 이 과목의 컨디션 관리가 보험료 안정에 도움이 돼요.
                    </div>
                  </div>

                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:18px")}>
                    <div style={S("display:flex;align-items:baseline;justify-content:space-between")}>
                      <span style={S("font-size:13.5px;font-weight:800;color:#111")}>과목별 안정성</span>
                      <span style={S("font-size:9px;color:#B4B9C2;font-weight:600")}>낮음 ← 0 · 100 → 높음</span>
                    </div>
                    <div style={S("font-size:10px;color:#999;margin-top:4px")}>숫자가 클수록 성적이 안정적인 과목이에요</div>
                    <div style={S("display:flex;flex-direction:column;margin-top:12px")}>
                      {(vm.volCards || []).map((v, $index) => {
                        const p = ({국어:{ink:'#0B7A4A'},수학:{ink:'#1E56C8'},영어:{ink:'#C43B7E'},탐구:{ink:'#C06A08'}})[v.name] || {ink:'#6B3AD1'};
                        const stab = Math.max(0, 100 - v.vol);
                        const w = Math.min(stab, 100);
                        const stabLevel = v.level === '높음' ? '낮음' : v.level === '낮음' ? '높음' : '보통';
                        return (
                        <React.Fragment key={$index}>
                          <div style={S(`display:flex;align-items:center;gap:10px;padding:9px 0;${$index>0?'border-top:1px solid #F2F3F5;':''}`)}>
                            <span style={S(`font-size:12px;font-weight:800;color:#2E323A;width:30px;flex:none`)}>{v.name}</span>
                            <div style={S("flex:1;min-width:0;height:9px;background:#F0F1F4;border-radius:5px;position:relative;overflow:hidden")}>
                              <div style={S(`position:absolute;left:0;top:0;bottom:0;border-radius:5px;background:${p.ink};opacity:0.9;width:${w}%`)}></div>
                            </div>
                            <span style={S(`font-size:15px;font-weight:900;color:${p.ink};width:26px;text-align:right;flex:none;letter-spacing:-0.5px`)}>{stab}</span>
                            <span style={S(`font-size:9px;font-weight:800;color:${p.ink};background:${p.ink}1A;border-radius:20px;padding:3px 8px;flex:none;width:34px;text-align:center;box-sizing:border-box`)}>{stabLevel}</span>
                          </div>
                        </React.Fragment>
                        );
                      })}
                    </div>
                    <div style={S("font-size:9.5px;color:#AAA;margin-top:12px;line-height:1.5;white-space:nowrap;letter-spacing:-0.1px")}>※ 안정성 지수는 최근 모의고사 성적의 등락 폭(표준편차)이 작을수록 높게 환산한 값이에요.</div>
                  </div>
                </>)}
                {(vm.segIs1) && (<>
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:18px")}>
                    <div style={S("font-size:13.5px;font-weight:800;color:#111")}>과목 포지션 한눈에 보기</div>
                    <div style={S("font-size:10px;color:#999;margin-top:4px")}>가로축 = 점수 수준 · 세로축 = 안정성. 왼쪽 아래일수록 먼저 챙겨야 해요.</div>
                    <svg viewBox="0 0 300 230" style={S("width:100%;margin-top:12px")}>
                      {/* 사분면 배경 */}
                      <rect x="45" y="18" width="117" height="92" fill="#F3F4F6"></rect>
                      <rect x="162" y="18" width="118" height="92" fill="#E4F5EC"></rect>
                      <rect x="45" y="110" width="117" height="92" fill="#FCE9EC"></rect>
                      <rect x="162" y="110" width="118" height="92" fill="#FCF1DF"></rect>
                      {/* 중앙 분할선 */}
                      <line x1="162" y1="18" x2="162" y2="202" stroke="#fff" strokeWidth="2"></line>
                      <line x1="45" y1="110" x2="280" y2="110" stroke="#fff" strokeWidth="2"></line>
                      {/* 사분면 라벨 */}
                      <text x="52" y="197" fontSize="8.5" fontWeight="700" fill="#C0304A">🚨 먼저 챙길</text>
                      <text x="273" y="32" fontSize="8.5" fontWeight="700" fill="#0B8F58" textAnchor="end">💪 강점 </text>
                      <text x="52" y="32" fontSize="8.5" fontWeight="700" fill="#8A9098">🌱 차근차근</text>
                      <text x="273" y="197" fontSize="8.5" fontWeight="700" fill="#B45309" textAnchor="end">⚠️ 당일 변수</text>
                      {/* 축 화살표 */}
                      <defs><marker id="ah" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#111"></path></marker></defs>
                      <line x1="45" y1="202" x2="288" y2="202" stroke="#111" strokeWidth="1.5" markerEnd="url(#ah)"></line>
                      <line x1="45" y1="202" x2="45" y2="12" stroke="#111" strokeWidth="1.5" markerEnd="url(#ah)"></line>
                      <text x="286" y="216" fontSize="9" fontWeight="500" fill="#111" textAnchor="end">점수 높음 →</text>
                      <text x="37" y="20" fontSize="9" fontWeight="500" fill="#111" textAnchor="end">안정성 ↑</text>
                      {/* 과목 점 */}
                      {(vm.priorityList || []).map((p, $pi) => {
                        const cx = 45 + (Math.min(Math.max(p.mean,25),95)-25)/70*235;
                        const cy = 20 + Math.min(Math.max(p.vol,0),100)/100*180;
                        return (
                          <React.Fragment key={$pi}>
                            <circle cx={cx} cy={cy} r="8" fill={p.bg} stroke="#fff" strokeWidth="2"></circle>
                            <text x={cx} y={cy-11} fontSize="10" fontWeight="800" fill={p.bg} textAnchor="middle">{p.name}</text>
                          </React.Fragment>
                        );
                      })}
                    </svg>
                  </div>

                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:18px")}>
                    <div style={S("font-size:13.5px;font-weight:800;color:#111;margin-bottom:4px")}>집중 보완 우선순위</div>
                    <div style={S("display:flex;flex-direction:column;gap:11px;margin-top:10px")}>
                      {(vm.priorityList || []).slice(0,3).map((p, $pi) => (
                        <React.Fragment key={$pi}>
                          <div style={S(`border-left:4px solid ${p.bg};background:#FAFAFA;border-radius:0 12px 12px 0;padding:12px 14px`)}>
                            <div style={S("display:flex;align-items:center;gap:8px")}>
                              <span style={S(`font-size:9px;font-weight:800;color:#fff;background:${$pi===0?'#C0304A':$pi===1?'#B45309':'#5C6470'};border-radius:20px;padding:3px 9px;flex:none`)}>{$pi+1}순위</span>
                              <span style={S("font-size:13px;font-weight:800;color:#111")}>{p.name}</span>
                              <span style={S(`font-size:10px;font-weight:700;color:${p.bg};margin-left:auto`)}>{p.tag}</span>
                            </div>
                            <div style={S("font-size:10.5px;color:#666;line-height:1.6;margin-top:8px")}>
                              평균 백분위 <b style={S("color:#111")}>{p.mean}</b> · 변동성 <b style={S("color:#111")}>{p.vol}</b>. {p.highVol ? '성적 기복이 커서 수능 당일 결과가 갈릴 수 있는 과목이에요. 점수 향상보다 기복을 줄이는 게 목표예요.' : (p.highScore ? '점수도 좋고 꾸준해요. 지금 방식을 그대로 유지하면 됩니다.' : '아직 점수 향상 여지가 있어요. 기본기를 차근차근 쌓아가요.')}
                            </div>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </>)}
              </>)}
              {(vm.isConverter) && (<>
                {(vm.convIs.intro) && (<>
                  <div style={S("flex:1;display:flex;flex-direction:column;justify-content:space-between;align-items:center;text-align:center;min-height:0")}>
                    <div style={S("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;min-height:0")}>
                      <div style={S("font-size:30px;font-weight:500;color:#2F3D36;line-height:1.4;margin-top:37px;flex:none")}>
                        <span style={S("color:#0B8F58;font-weight:800")}>재수 비용</span>,
                        <br />
                        우리 집 기준으로 <span style={S("color:#0B8F58;font-weight:800")}>얼마</span>일까요?
                      </div>
                      <div style={S("flex:1;width:100%;display:flex;align-items:center;justify-content:center;min-height:0")}>
                        <img src={IMG_DONWORRY} alt="재수 비용 계산" style={S("width:190px;height:auto")} />
                      </div>
                    </div>
                    <div style={S("width:100%;flex:none;margin-bottom:-90px")}>
                      <div style={S("font-size:12px;color:#0B8F58;font-weight:500;margin-bottom:14px")}>입력하신 정보는 보험료와 무관하며 기기에만 저장돼요.</div>
                      <div style={S("background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:15px;font-weight:700;border-radius:16px;height:54px;width:100%;display:flex;align-items:center;justify-content:center")} onClick={vm.startInput}>1분 만에 계산하기</div>
                    </div>
                  </div>
                </>)}
                {(vm.convIs.input) && (<>
                  <div style={S("display:flex;align-items:center;gap:6px")} onClick={vm.backConv}>
                    <span style={S("font-size:15px;color:#555")}>‹</span>
                    <span style={S("font-size:11px;color:#555")}>뒤로</span>
                  </div>
                  <div style={S("background:#fff;border:1px solid #EAF0EC;border-radius:18px;padding:15px 15px 16px;box-shadow:0 4px 14px rgba(11,143,88,0.05)")}>
                    <div style={S("display:flex;align-items:center;gap:7px")}>
                      <span style={S("font-size:15px")}>💰</span>
                      <span style={S("font-size:12.5px;font-weight:800;color:#1A2620")}>월 평균 저축액</span>
                    </div>
                    <div style={S("display:flex;gap:7px;flex-wrap:wrap;margin-top:11px")}>
                      {(vm.saveChips || []).map((c, $index) => (
                        <React.Fragment key={$index}>
                          <div style={S(c.style)} onClick={c.onClick}>
                            {c.label}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                    {(vm.saveIsAvg) && (<>
                      <div style={S("font-size:9px;color:#A6ADA9;margin-top:8px")}>미입력 시 평균 가구 기준값(180만원)이 적용돼요</div>
                    </>)}
                  </div>
                  <div style={S("background:#fff;border:1px solid #EAF0EC;border-radius:18px;padding:15px 15px 16px;box-shadow:0 4px 14px rgba(11,143,88,0.05)")}>
                    <div style={S("display:flex;align-items:center;gap:7px")}>
                      <span style={S("font-size:15px")}>👨‍👩‍👧</span>
                      <span style={S("font-size:12.5px;font-weight:800;color:#1A2620")}>자녀 수</span>
                    </div>
                    <div style={S("display:flex;gap:7px;flex-wrap:wrap;margin-top:11px")}>
                      {(vm.siblingChips || []).map((c, $index) => (
                        <React.Fragment key={$index}>
                          <div style={S(c.style)} onClick={c.onClick}>
                            {c.label}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                  <div style={S("background:#fff;border:1px solid #EAF0EC;border-radius:18px;padding:15px 15px 16px;box-shadow:0 4px 14px rgba(11,143,88,0.05)")}>
                    <div style={S("display:flex;align-items:center;gap:7px")}>
                      <span style={S("font-size:15px")}>🌱</span>
                      <span style={S("font-size:12.5px;font-weight:800;color:#1A2620")}>노후 자금 목표액</span>
                    </div>
                    <div style={S("display:flex;gap:7px;flex-wrap:wrap;margin-top:11px")}>
                      {(vm.retireChips || []).map((c, $index) => (
                        <React.Fragment key={$index}>
                          <div style={S(c.style)} onClick={c.onClick}>
                            {c.label}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                  <div style={S("background:#fff;border:1px solid #EAF0EC;border-radius:18px;padding:15px 15px 16px;box-shadow:0 4px 14px rgba(11,143,88,0.05)")}>
                    <div style={S("display:flex;align-items:center;gap:7px")}>
                      <span style={S("font-size:15px")}>🏠</span>
                      <span style={S("font-size:12.5px;font-weight:800;color:#1A2620")}>월 가처분 소득</span>
                    </div>
                    <div style={S("display:flex;gap:7px;flex-wrap:wrap;margin-top:11px")}>
                      {(vm.incomeChips || []).map((c, $index) => (
                        <React.Fragment key={$index}>
                          <div style={S(c.style)} onClick={c.onClick}>
                            {c.label}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                    {(vm.incomeIsAvg) && (<>
                      <div style={S("font-size:9px;color:#A6ADA9;margin-top:8px")}>미입력 시 평균 가구 기준값(660만원)이 적용돼요</div>
                    </>)}
                  </div>
                  <div style={S("font-size:10px;color:#888;line-height:1.6")}>
                    🔒 여기 입력하는 정보는 <b>보험료 계산에 쓰이지 않고</b> 서버로 보내지 않고 <b>이 기기에만 저장</b>돼요. 언제든 지울 수 있어요.
                  </div>
                  <div style={S("background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:15px;font-weight:600;border-radius:20px;height:40px;width:100%;box-sizing:border-box;flex:none;display:flex;align-items:center;justify-content:center;margin-top:4px")} onClick={vm.goCostBase}>다음</div>
                </>)}
                {(vm.convIs.costbase) && (<>
                  <div style={S("display:flex;align-items:center;gap:6px")} onClick={vm.backConv}>
                    <span style={S("font-size:15px;color:#555")}>‹</span>
                    <span style={S("font-size:11px;color:#555")}>뒤로</span>
                  </div>
                  <div>
                    <div style={S("font-size:17px;font-weight:700;color:#111")}>재수에 드는 비용부터 정해요</div>
                    <div style={S("font-size:12.5px;color:#888;margin-top:6px")}>평균 통계로 시작하고, 우리 동네 시세에 맞게 조정하세요.</div>
                  </div>
                  {/* ① 재수 유형 선택 */}
                  <div style={S("background:#fff;border:1px solid #EAF0EC;border-radius:18px;padding:15px 15px 16px;box-shadow:0 4px 14px rgba(11,143,88,0.05)")}>
                    <div style={S("display:flex;align-items:center;gap:7px;margin-bottom:11px")}>
                      <span style={S("font-size:15px")}>🎯</span>
                      <span style={S("font-size:12.5px;font-weight:800;color:#1A2620")}>재수 유형 선택</span>
                    </div>
                    <div style={S("display:grid;grid-template-columns:1fr 1fr;gap:8px")}>
                      {(vm.formChips || []).map((c, $index) => (
                        <React.Fragment key={$index}>
                          <div style={S(`${c.style};font-size:13.5px;padding:12px 10px;width:100%;box-sizing:border-box;justify-content:center;text-align:center`)} onClick={c.onClick}>
                            {c.label}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                  {/* ② 우리 동네 시세 조정 */}
                  <div style={S("background:#fff;border:1px solid #EAF0EC;border-radius:18px;padding:15px 15px 16px;box-shadow:0 4px 14px rgba(11,143,88,0.05)")}>
                    <div style={S("display:flex;align-items:center;gap:7px")}>
                      <span style={S("font-size:15px")}>📍</span>
                      <span style={S("font-size:12.5px;font-weight:800;color:#1A2620")}>우리 동네 시세에 맞게 조정</span>
                    </div>
                    <div style={S("font-size:10.5px;color:#888;margin-top:4px")}>지역마다 학원 시세가 달라요. 우리 동네를 골라주세요.</div>
                    <div style={S("display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px")}>
                      {(vm.regionChips || []).map((r, $index) => (
                        <React.Fragment key={$index}>
                          <div style={S(`border-radius:16px;padding:11px 12px;cursor:pointer;box-sizing:border-box;border:1.5px solid ${r.sel ? '#0B8F58' : '#E5E5E5'};background:${r.sel ? 'rgba(11,143,88,0.07)' : '#fff'}`)} onClick={r.onClick}>
                            <div style={S(`font-size:12px;font-weight:400;color:${r.sel ? '#0B8F58' : '#111'}`)}>{r.name}</div>
                            <div style={S("font-size:9px;color:#999;margin-top:2px")}>{r.desc}</div>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                    <div style={S("font-size:11px;color:#0B8F58;font-weight:400;margin-top:10px")}>
                      {vm.adjLabel}
                    </div>
                  </div>
                  {/* ③ 월 평균 비용 요약 (연두-연노랑) */}
                  <div style={S("background:linear-gradient(140deg,#EAF7EC 0%,#FBFBE6 100%);border:1.5px solid #CFE9D6;border-radius:22px;padding:20px 18px;box-shadow:0 8px 22px rgba(11,143,88,0.08)")}>
                    <div style={S("display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:2px 0")}>
                      <span style={S("color:#4B6B58;font-weight:500")}>월 평균 비용</span>
                      <span style={S("font-weight:800;color:#0B5E3A")}>
                        {vm.formMonthlyLabel}
                      </span>
                    </div>
                    <div style={S("font-size:11px;color:#7B9384;line-height:1.6;margin-top:5px")}>
                      {vm.formNote}
                    </div>
                    <div style={S("border-top:1px dashed #C6DFCD;margin-top:14px;padding-top:13px;display:flex;justify-content:space-between;align-items:baseline")}>
                      <span style={S("font-size:14px;font-weight:800;color:#1A2620")}>10개월 누적 연간 총액</span>
                      <span style={S("font-size:23px;font-weight:900;color:#0B8F58;letter-spacing:-0.5px")}>
                        {vm.costTotalLabel}
                      </span>
                    </div>
                  </div>
                  <div style={S("background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:15px;font-weight:600;border-radius:16px;height:40px;width:100%;flex:none;box-sizing:border-box;display:flex;align-items:center;justify-content:center;margin-top:4px")} onClick={vm.goResult}>우리 집 기준으로 환산하기</div>
                </>)}
                {(vm.convIs.result) && (<>
                  <div style={S("display:flex;align-items:center;gap:6px")} onClick={vm.backConv}>
                    <span style={S("font-size:15px;color:#555")}>‹</span>
                    <span style={S("font-size:11px;color:#555")}>뒤로</span>
                  </div>
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:18px 16px;text-align:center")}>
                    <div style={S("font-size:14px;font-weight:500;color:#111")}>1년동안 발생하는 재수 비용은 얼마일까요?</div>
                    <div style={S("font-size:31px;font-weight:900;color:#0B8F58;margin-top:10px")}>
                      {vm.costTotalLabel}
                    </div>
                    <div style={S("font-size:9.5px;color:#999;margin-top:6px")}>
                      {vm.costForm} · {vm.adjSignLabel} 시세 반영
                    </div>
                  </div>
                  <div style={S("background:#0B8F58;border-radius:26px;padding:40px 20px")}>
                    <div style={S("display:flex;align-items:center;gap:8px")}>
                      <span style={S("font-size:17px;font-weight:700;color:#fff;white-space:nowrap")}>지금 가입한 보장을 적용하면</span>
                      <span style={S("font-size:12px;background:#fff;border-radius:20px;padding:4px 12px;color:#0B8F58;font-weight:700;white-space:nowrap;flex-shrink:0")}>스탠다드</span>
                    </div>
                    <div style={S("display:flex;align-items:center;gap:12px;margin-top:22px")}>
                      <div style={S("flex:1")}>
                        <div style={S("font-size:13px;color:rgba(255,255,255,0.75)")}>보장 없이</div>
                        <div style={S("font-size:19px;font-weight:700;color:rgba(255,255,255,0.9)")}>
                          {vm.costTotalLabel}
                        </div>
                      </div>
                      <span style={S("color:#fff;font-size:20px")}>→</span>
                      <div style={S("flex:1")}>
                        <div style={S("font-size:13px;color:rgba(255,255,255,0.75)")}>내 부담</div>
                        <div style={S("font-size:30px;font-weight:800;color:#fff")}>
                          {vm.costSelfLabel}
                        </div>
                      </div>
                    </div>
                    <div style={S("font-size:14px;font-weight:700;color:#fff;margin-top:16px")}>
                      보험이 <b>{vm.costCoveredLabel}을</b> 함께 부담해요
                    </div>
                     <div style={S("font-size:11px;color:#fff;margin-top:8px")}>현물(바우처) {vm.formVoucherPct}% + 현금(실손) {vm.formCashPct}% 지급 · 월 보장 상한 {vm.formCapLabel}</div>
                  </div>
                  {(vm.hasAnyCard) && (<>
                    <div style={S("display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:16px;margin-bottom:-2px")}>
                      <div style={S("font-size:14px;font-weight:900;color:#111")}><span style={S("background:linear-gradient(to top, #F1E3A6 44%, transparent 44%)")}>{vm.costTotalLabel}</span>, 우리집엔 얼마나 클까요?</div>
                      <span style={S("display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;color:#0B8F58;background:rgba(11,143,88,0.1);border:1px solid rgba(11,143,88,0.3);border-radius:20px;padding:5px 11px;white-space:nowrap;flex:none;cursor:pointer")} onClick={vm.toggleResultDetail}>
                        {(vm.resultDetail) ? (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14h6v6"></path><path d="M20 10h-6V4"></path><path d="M14 10l7-7"></path><path d="M3 21l7-7"></path></svg>
                        ) : (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"></path><path d="M16 3h3a2 2 0 0 1 2 2v3"></path><path d="M8 21H5a2 2 0 0 1-2-2v-3"></path><path d="M16 21h3a2 2 0 0 0 2-2v-3"></path></svg>
                        )}
                        {vm.resultDetail ? '간단히 접기' : '상세히 보기'}
                      </span>
                    </div>
                    <div style={S("font-size:10px;color:#999;margin-top:-8px")}>연간 재수 비용을 우리집 가계 단위로 바꿔봤어요</div>
                    <div style={S(`display:flex;flex-direction:column;gap:${vm.resultDetail ? 12 : 8}px;transition:gap .28s ease`)}>
                      {[
                        {id:'save', show:vm.saveMonths, icon:'💰', label:'우리집 월 저축액으로', val:vm.saveMonths, unit:'개월', sub:'이만큼 저축해야 모을 수 있는 금액이에요', cap:24, fill:'#E4F5EC', ink:'#0B7A4A', formula:`${vm.costTotalLabel} ÷ ${vm.saveValLabel} = ${vm.saveMonths}개월`},
                        {id:'tuition', show:vm.tuitionSemesters, icon:'🎓', label:'동생 대학 등록금으로', val:vm.tuitionSemesters, unit:'학기', sub:'이만큼 대학교를 다닐 수 있는 학기예요', cap:8, fill:'#E7F0FE', ink:'#1E56C8', formula:`${vm.costTotalLabel} ÷ ${vm.semesterCostLabel} = ${vm.tuitionSemesters}학기`},
                        {id:'retire', show:vm.retirePct, icon:'🏦', label:'노후 자금 목표 대비', val:vm.retirePct, unit:'%', sub:'노후 목표액에서 차지하는 비중이에요', cap:100, fill:'#FCF1DF', ink:'#C06A08', formula:`${vm.costTotalLabel} ÷ ${vm.retireGoalLabel} × 100 = ${vm.retirePct}%`},
                        {id:'income', show:vm.incomeMonths, icon:'💵', label:'우리집 월 소득으로', val:vm.incomeMonths, unit:'개월', sub:'몇 달치 소득에 해당하는 금액이에요', cap:12, fill:'#F1EAFD', ink:'#6B3AD1', formula:`${vm.costTotalLabel} ÷ ${vm.incomeValLabel} = ${vm.incomeMonths}개월`},
                      ].filter(x=>x.show).map((x,xi)=>(
                        <React.Fragment key={xi}>
                          <div style={S(`background:linear-gradient(145deg,${x.fill} 0%,rgba(255,255,255,0.72) 135%);border:1.5px solid rgba(255,255,255,0.85);border-radius:24px;padding:${vm.resultDetail ? '15px 18px' : '11px 16px'};box-shadow:0 10px 26px rgba(0,0,0,0.055),inset 0 1px 2px rgba(255,255,255,0.95);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);transition:padding .28s ease`)}>
                            <div style={S("display:flex;align-items:center;gap:12px")}>
                              <div style={S("width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.85);box-shadow:0 2px 7px rgba(0,0,0,0.07),inset 0 1px 1px #fff;display:flex;align-items:center;justify-content:center;font-size:19px;flex:none")}>{x.icon}</div>
                              <div style={S(`flex:1;min-width:0;font-size:12.5px;font-weight:800;color:${x.ink}`)}>{x.label}</div>
                              <div style={S("display:flex;align-items:baseline;gap:2px;flex:none")}>
                                <span style={S(`font-size:22px;font-weight:800;line-height:0.9;color:${x.ink}`)}>{x.val}</span>
                                <span style={S(`font-size:12px;font-weight:700;color:${x.ink}`)}>{x.unit}</span>
                              </div>
                            </div>
                            <div style={S(`overflow:hidden;transition:max-height .32s ease, opacity .28s ease, margin-top .32s ease;max-height:${vm.resultDetail ? '200px' : '0px'};opacity:${vm.resultDetail ? 1 : 0};margin-top:${vm.resultDetail ? '14px' : '0px'}`)}>
                              <div style={S("height:12px;background:rgba(255,255,255,0.55);border-radius:8px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,0.05)")}>
                                <div style={S(`height:100%;border-radius:8px;background:${x.ink};opacity:0.85;width:${Math.max(Math.min(Number(x.val)/x.cap,1)*100,7)}%`)}></div>
                              </div>
                              <div style={S(`font-size:9.5px;color:${x.ink};opacity:0.72;margin-top:7px`)}>{x.sub}</div>
                              <div style={S(`font-size:13px;font-weight:700;color:${x.ink};background:rgba(255,255,255,0.6);border-radius:10px;padding:8px 10px;margin-top:10px;text-align:center;letter-spacing:0px`)}>{x.formula}</div>
                            </div>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </>)}
                  {(vm.noCards) && (<>
                    <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:14px 16px;font-size:11px;color:#555")}>
                      가계 정보를 입력하면 우리 집 단위로 바꿔 보여드려요. 
                      <span style={S("color:#0B8F58;font-weight:700")} onClick={vm.backToInput}>입력하러 가기 ›</span>
                    </div>
                  </>)}
                  <div style={S("font-size:8.5px;color:#AAA")}>환산은 이해를 돕기 위한 참고 계산이에요. 실제 가계 상황과 다를 수 있어요.</div>
                  <div style={S("font-size:8.5px;color:#AAA;line-height:1.5")}>이 시뮬레이션은 실제 보장 상품의 예시 조건을 대입한 결과이며, 가입 시점·인수 조건·특약 구성 및 제휴 학원 계약 상태에 따라 최종 지급 금액과 자기부담금은 달라질 수 있어요.</div>
                  <div style={S("background:#fff;border:1px solid #E5E5E5;color:#555;font-size:13px;font-weight:500;border-radius:16px;height:32px;flex:none;display:flex;align-items:center;justify-content:center")} onClick={vm.backToInput}>입력 수정</div>
                </>)}
              </>)}
              {(vm.isHome) && (<>
                {(vm.homeIs.ins01) && (<>
                {!(vm.examPassed) && (<>
                  <div style={S("background:linear-gradient(135deg,#076B41 0%,#0B8F58 48%,#23C088 100%);border-radius:26px;padding:22px 20px;color:#fff;box-shadow:0 10px 26px rgba(0,74,44,0.30)")}>
                    <div style={S("font-size:17px;font-weight:900")}>{vm.studentName} 학생 학부모님, 안녕하세요 👋</div>
                    <div style={S("font-size:11.5px;color:rgba(255,255,255,0.88);margin-top:6px;line-height:1.55")}>우리 아이, 오늘도 목표를 향해 가고 있어요.<br/>성적이 오르면 보험료도 함께 관리돼요.</div>
                    <div style={S("display:flex;gap:10px;margin-top:18px")}>
                      <div style={S("flex:1;background:rgba(255,255,255,0.17);border-radius:20px;padding:13px 14px")}>
                        <div style={S("font-size:9.5px;color:rgba(255,255,255,0.82)")}>이번 달 보험료</div>
                        <div style={S("font-size:18px;font-weight:900;margin-top:4px;line-height:1.1")}>{vm.premiumLabel}</div>
                      </div>
                      <div style={S("flex:1;background:rgba(255,255,255,0.17);border-radius:20px;padding:13px 14px")}>
                        <div style={S("font-size:9.5px;color:rgba(255,255,255,0.82)")}>재산정까지</div>
                        <div style={S("font-size:18px;font-weight:900;margin-top:4px;line-height:1.1;color:#B9F5D0")}>D-{vm.dday}</div>
                      </div>
                    </div>
                  </div>
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:16px 18px")}>
                    <div style={S("font-size:13.5px;font-weight:700;color:#111")}>가입 정보</div>
                    <div style={S("display:flex;flex-direction:column;gap:9px;margin-top:12px;font-size:12.5px;color:#555")}>
                      <div style={S("display:flex;justify-content:space-between")}>
                        <span>가입 티어</span>
                        <span style={S("font-weight:700;color:#111")}>스탠다드</span>
                      </div>
                      <div style={S("display:flex;justify-content:space-between")}>
                        <span>가입일</span>
                        <span style={S("font-weight:700;color:#111")}>
                          {vm.joinedAt}
                        </span>
                      </div>
                      <div style={S("display:flex;justify-content:space-between")}>
                        <span>보장 기간</span>
                        <span style={S("font-weight:700;color:#111")}>
                          {vm.coverPeriod.replace('(자동 갱신)', '')}
                          <span style={S("font-weight:400")}>(자동 갱신)</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:20px 18px")}>
                    <div style={S("display:flex;justify-content:space-between;align-items:center")}>
                      <span style={S("font-size:13px;color:#888")}>현재 월 보험료</span>
                      <span style={S("font-size:10.5px;font-weight:700;color:#fff;background:#0B8F58;padding:4px 10px;border-radius:20px;white-space:nowrap")}>스탠다드</span>
                    </div>
                    <div style={S("font-size:35px;font-weight:800;color:#111;margin-top:8px")}>
                      {vm.premiumLabel}
                    </div>
                    <div style={S("font-size:12px;color:#888;margin-top:8px")}>
                      다음 갱신일 {vm.renewAt} · 재산정까지 D-{vm.dday}
                    </div>
                    <div style={S("border-top:1px solid #EEE;margin-top:16px;padding-top:16px")}>
                      <div style={S("display:flex;justify-content:space-between;align-items:center")}>
                        <span style={S("font-size:13.5px;font-weight:700;color:#111")}>왜 이 금액일까요?</span>
                        <span style={S("font-size:10.5px;color:#999")}>영향 요소 {(vm.riskFactors || []).length}</span>
                      </div>
                      {(vm.riskFactors || []).map((r, $index) => {
                        const badge = (r.level === '높음' || r.level === '상')
                          ? { bg: '#FBE4E8', fg: '#C0304A' }
                          : (r.level === '낮음' || r.level === '하')
                          ? { bg: '#DFF3E7', fg: '#0B8F58' }
                          : { bg: '#FBEFD8', fg: '#B45309' };
                        return (
                          <React.Fragment key={$index}>
                            <div style={S("margin-top:12px")}>
                              <div style={S("display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#555")}>
                                <span>{r.name}</span>
                                <span style={S(`font-size:10px;font-weight:700;color:${badge.fg};background:${badge.bg};padding:2px 9px;border-radius:20px`)}>{r.level}</span>
                              </div>
                              <div style={S("height:7px;border-radius:20px;background:#E9E9E9;margin-top:5px")}>
                                <div style={S(`height:7px;border-radius:20px;background:#0B8F58;width:${r.pct}%`)}></div>
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                    <div style={S("background:#fff;border:1px solid #E5E5E5;color:#555;font-size:14px;font-weight:700;border-radius:16px;height:50px;display:flex;align-items:center;justify-content:center;margin-top:16px")} onClick={vm.goIns02}>납입 내역 보기 ›</div>
                  </div>
                  <div style={S("background:linear-gradient(145deg,#FFF7D6,#FFFBEC);border:1.5px solid #F1E3A6;border-radius:22px;padding:15px 17px;display:flex;align-items:center;gap:12px;box-shadow:0 6px 16px rgba(212,180,60,0.12)")}>
                    <span style={S("font-size:24px;flex:none")}>💛</span>
                    <div style={S("min-width:0")}>
                      <div style={S("font-size:12.5px;font-weight:800;color:#8A6D1A")}>우리 아이 성적이 오르면 보험료도 내려가요</div>
                      <div style={S("font-size:10.5px;color:#A98B2E;margin-top:2px;line-height:1.5")}>모의고사가 갱신될 때마다 변동성이 반영돼 재산정돼요</div>
                    </div>
                  </div>
                </>)}
                {(vm.examPassed) && (<>
                  {(vm.claimIs.home) && (<>
                    <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:16px 18px")}>
                      <div style={S("font-size:13.5px;font-weight:700;color:#111")}>가입 정보</div>
                      <div style={S("display:flex;flex-direction:column;gap:9px;margin-top:12px;font-size:12.5px;color:#555")}>
                        <div style={S("display:flex;justify-content:space-between")}><span>가입 티어</span><span style={S("font-weight:700;color:#111")}>스탠다드</span></div>
                        <div style={S("display:flex;justify-content:space-between")}><span>가입한 재수 형태</span><span style={S("font-weight:700;color:#111")}>{vm.claimForm}</span></div>
                      </div>
                    </div>
                    <div style={S(`border-radius:16px;padding:18px;cursor:pointer;${vm.claimHome.kind === 'open' ? 'background:#0B8F58' : vm.claimHome.kind === 'wait' ? 'background:#fff;border:1px solid #E2E2E2' : 'background:#F4F5F4;border:1px solid #E2E2E2'}`)}
                      onClick={() => vm.goClaim(vm.claimHome.kind === 'no' ? 'eligibility' : vm.claimHome.kind === 'dead' ? 'expired' : vm.claimHome.kind === 'wait' ? 'windowClosed' : 'intro')}>
                      <div style={S(`font-size:12px;font-weight:700;color:${vm.claimHome.kind === 'open' ? '#CFE9DB' : vm.claimHome.kind === 'wait' ? '#0B8F58' : '#888'}`)}>{vm.claimHome.eligLine}</div>
                      <div style={S(`font-size:17px;font-weight:800;margin-top:5px;line-height:1.4;color:${vm.claimHome.kind === 'open' ? '#fff' : '#111'}`)}>{vm.claimHome.title}</div>
                      <div style={S(`font-size:12.5px;margin-top:6px;line-height:1.55;color:${vm.claimHome.kind === 'open' ? '#DBEFE4' : '#555'}`)}>{vm.claimHome.desc}</div>
                      {(vm.claimHome.gauge) && (<>
                        <div style={S("margin-top:15px")}>
                          <div style={S(`display:flex;height:10px;border-radius:20px;overflow:hidden;background:${vm.claimHome.gauge.dark ? 'rgba(255,255,255,0.28)' : '#E9E9E9'}`)}>
                            <div style={S(`width:${vm.claimHome.gauge.paidPct}%;background:${vm.claimHome.gauge.dark ? '#fff' : '#0B8F58'}`)}></div>
                            <div style={S(`width:${vm.claimHome.gauge.pendingPct}%;background:${vm.claimHome.gauge.dark ? 'rgba(255,255,255,0.6)' : '#6FC79B'}`)}></div>
                          </div>
                          <div style={S("display:flex;gap:12px;margin-top:9px;flex-wrap:wrap")}>
                            {(vm.claimHome.gauge.paid > 0) && (<div style={S(`display:flex;align-items:center;gap:5px;font-size:11px;color:${vm.claimHome.gauge.dark ? '#CFE9DB' : '#888'}`)}><span style={S(`width:8px;height:8px;border-radius:3px;background:${vm.claimHome.gauge.dark ? '#fff' : '#0B8F58'}`)}></span>기지급 <b style={S(`font-weight:700;color:${vm.claimHome.gauge.dark ? '#fff' : '#111'}`)}>{vm.manFmt(vm.claimHome.gauge.paid)}</b></div>)}
                            <div style={S(`display:flex;align-items:center;gap:5px;font-size:11px;color:${vm.claimHome.gauge.dark ? '#CFE9DB' : '#888'}`)}><span style={S(`width:8px;height:8px;border-radius:3px;background:${vm.claimHome.gauge.dark ? 'rgba(255,255,255,0.28)' : '#E9E9E9'}`)}></span>잔여 <b style={S(`font-weight:700;color:${vm.claimHome.gauge.dark ? '#fff' : '#111'}`)}>{vm.manFmt(vm.claimHome.gauge.rest)}</b></div>
                          </div>
                        </div>
                      </>)}
                      <div style={S(`font-size:14px;font-weight:700;border-radius:12px;height:46px;display:flex;align-items:center;justify-content:center;margin-top:15px;${vm.claimHome.kind === 'open' ? 'background:#fff;color:#0B8F58' : vm.claimHome.kind === 'wait' ? 'background:rgba(11,143,88,0.1);color:#00703E' : 'background:#E8EAE9;color:#555'}`)}>
                        {vm.claimHome.kind === 'no' ? '판정 근거 보기' : vm.claimHome.kind === 'dead' ? '최종 정산 보기' : vm.claimHome.kind === 'wait' ? '청구 일정 보기' : '청구 시작하기'}
                      </div>
                    </div>
                    <div style={S("display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid #E2E2E2;border-radius:16px;padding:15px 16px;cursor:pointer")} onClick={() => vm.goClaim('eligibility')}>
                      <span style={S("font-size:13px;font-weight:700;color:#111")}>보장 자격 상세<span style={S("display:block;font-size:11.5px;font-weight:400;color:#888;margin-top:3px")}>{vm.claimHome.eligLine}</span></span>
                      <span style={S("color:#BBB")}>›</span>
                    </div>
                    {!(vm.claimNo) && (<>
                      <div style={S("display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid #E2E2E2;border-radius:16px;padding:15px 16px;cursor:pointer")} onClick={() => vm.openClaimLink('home')}>
                        <span style={S("font-size:13px;font-weight:700;color:#111")}>결제 내역 연동<span style={S("display:block;font-size:11.5px;font-weight:400;color:#888;margin-top:3px")}>{vm.claimHome.linkedCount ? `${vm.claimHome.linkedCount}개 카드 연동됨` : '연동된 카드가 없어요'}</span></span>
                        <span style={S("color:#BBB")}>›</span>
                      </div>
                      <div style={S("display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid #E2E2E2;border-radius:16px;padding:15px 16px;cursor:pointer")} onClick={() => vm.goClaim('status')}>
                        <span style={S("font-size:13px;font-weight:700;color:#111")}>내 청구 내역<span style={S("display:block;font-size:11.5px;font-weight:400;color:#888;margin-top:3px")}>{vm.claimHome.prevPaidLine}</span></span>
                        <span style={S("color:#BBB")}>›</span>
                      </div>
                    </>)}
                  </>)}
                  {(vm.claimIs.eligibility) && (<>
                    <div style={S("display:flex;align-items:center;gap:6px")} onClick={() => vm.goClaim('home')}>
                      <span style={S("font-size:15px;color:#555")}>‹</span>
                      <span style={S("font-size:12px;color:#555")}>보험현황</span>
                    </div>
                    <span style={S("display:inline-block;font-size:11px;font-weight:700;color:#0B8F58;background:#E3F2EA;padding:5px 11px;border-radius:20px;align-self:flex-start")}>보장 자격</span>
                    <h2 style={S("font-size:20px;font-weight:800;color:#111;margin-top:2px;line-height:1.35")}>{vm.claimEligibilityView.title.split('\n').map((line,li)=>(<React.Fragment key={li}>{li>0 && <br/>}{line}</React.Fragment>))}</h2>
                    <p style={S("font-size:13.5px;color:#555;line-height:1.65;margin-top:8px")}>{vm.claimEligibilityView.lede}</p>
                    <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:16px;padding:14px 16px 6px")}>
                      <svg viewBox="0 0 320 150" style={S("width:100%;height:auto")}>
                        <rect x="222" y="28" width="66" height="34" rx="7" fill="#E3F2EA"></rect>
                        <text x="255" y="22" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#00703E">예상 범위 56~70</text>
                        <line x1="20" y1="30" x2="300" y2="30" stroke="#EEE" strokeWidth="1"></line>
                        <line x1="20" y1="95" x2="300" y2="95" stroke="#E5484D" strokeWidth="2" strokeDasharray="7 5"></line>
                        <rect x="20" y="84" width="66" height="22" rx="11" fill="#E5484D"></rect>
                        <text x="53" y="99" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff">기준선 48</text>
                        <circle cx="250" cy="45" r="7" fill="#0B8F58"></circle>
                        <text x="250" y="72" textAnchor="middle" fontSize="10" fontWeight="700" fill="#0B8F58">예상 63</text>
                        <line x1={vm.claimEligibilityView.profile.x} y1="45" x2={vm.claimEligibilityView.profile.x} y2={vm.claimEligibilityView.profile.y} stroke={vm.claimEligibilityView.profile.col} strokeWidth="2" strokeDasharray="4 5"></line>
                        <circle cx={vm.claimEligibilityView.profile.x} cy={vm.claimEligibilityView.profile.y} r="8" fill="#fff" stroke={vm.claimEligibilityView.profile.col} strokeWidth="4"></circle>
                        <text x={vm.claimEligibilityView.profile.x} y={vm.claimEligibilityView.profile.y + 24} textAnchor="middle" fontSize="10.5" fontWeight="800" fill={vm.claimEligibilityView.profile.col}>수능 {vm.claimEligibilityView.profile.score}</text>
                      </svg>
                    </div>
                    <div style={S(`border-radius:16px;padding:18px;color:#fff;background:${vm.claimNo ? '#5C6360' : '#0B8F58'}`)}>
                      <div style={S(`font-size:12px;font-weight:700;color:${vm.claimNo ? '#D6DAD8' : '#CFE9DB'}`)}>보장 판정</div>
                      <div style={S("font-size:19px;font-weight:800;margin-top:4px")}>{vm.claimEligibilityView.verdictLabel}</div>
                      <div style={S(`font-size:12.5px;margin-top:6px;line-height:1.55;color:${vm.claimNo ? '#E3E6E5' : '#DBEFE4'}`)}>{vm.claimEligibilityView.verdictDesc}</div>
                    </div>
                    {!(vm.claimNo) && (<>
                      <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:16px;padding:8px 16px 12px")}>
                        <div style={S("border:0")}>
                          <div style={S("display:flex;justify-content:space-between;align-items:baseline;padding:9px 0;font-size:13px;color:#555")}><span>판정일</span><b style={S("font-size:14px;font-weight:700;color:#111")}>{vm.claimJudgeDateLabel}</b></div>
                          <div style={S("height:1px;background:#E2E2E2")}></div>
                          <div style={S("display:flex;justify-content:space-between;align-items:baseline;padding:9px 0;font-size:13px;color:#555")}><span>가입 티어 · 재수 형태</span><b style={S("font-size:14px;font-weight:700;color:#111")}>스탠다드 · {vm.claimEligibilityView.tierLine}</b></div>
                          <div style={S("height:1px;background:#E2E2E2")}></div>
                          <div style={S("display:flex;justify-content:space-between;align-items:baseline;padding:9px 0;font-size:13px;color:#555")}><span>판정 등급</span><b style={S("font-size:14px;font-weight:700;color:#111")}>{vm.claimEligibilityView.gradeLine}</b></div>
                          <div style={S("height:1px;background:#E2E2E2")}></div>
                          <div style={S("display:flex;justify-content:space-between;align-items:baseline;padding:9px 0;font-size:13px;color:#555")}><span>보장 한도</span><b style={S("font-size:14px;font-weight:700;color:#111")}>{vm.claimEligibilityView.limitLine}</b></div>
                          <div style={S("height:1px;background:#E2E2E2")}></div>
                          <div style={S("display:flex;justify-content:space-between;align-items:baseline;padding:9px 0;font-size:13px;color:#555")}><span>보장 비율</span><b style={S("font-size:14px;font-weight:700;color:#111")}>재수 비용의 70%</b></div>
                          <div style={S("height:1px;background:#E2E2E2")}></div>
                          <div style={S("display:flex;justify-content:space-between;align-items:baseline;padding:9px 0;font-size:13px;color:#555")}><span>자격 유효기간</span><b style={S("font-size:14px;font-weight:700;color:#111")}>{vm.claimValidityEndLabel}</b></div>
                        </div>
                      </div>
                      <div style={S("font-size:11px;color:#AAA;line-height:1.6;margin-top:10px")}>※ 보장 한도는 가입 티어와 판정 등급(경증·중증)에 따라 다르며, 보장 비율은 연간 총 재수 비용에 한 번 적용돼요.</div>
                    </>)}
                  </>)}
                  {(vm.claimIs.eligibility) && (
                    <div style={S("flex:none;padding:12px 0 0")}>
                      {vm.claimNo
                        ? <div style={S("background:#fff;border:1px solid #E5E5E5;color:#555;font-size:14px;font-weight:700;border-radius:14px;height:52px;display:flex;align-items:center;justify-content:center")}>판정에 이의 신청하기</div>
                        : <div style={S("background:#fff;border:1px solid #E5E5E5;color:#555;font-size:14px;font-weight:700;border-radius:14px;height:52px;display:flex;align-items:center;justify-content:center")} onClick={() => vm.goClaim('home')}>확인</div>}
                    </div>
                  )}
                  {(vm.claimIs.syncing) && (<>
                    <div style={S("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:4px;padding:32px")}>
                      <div style={S("width:40px;height:40px;border-radius:50%;border:4px solid #E3F2EA;border-top-color:#0B8F58;animation:spin 0.8s linear infinite")}></div>
                      <h2 style={S("font-size:16px;font-weight:800;color:#111;margin-top:16px")}>결제 내역을 동기화하는 중이에요</h2>
                      <p style={S("font-size:12.5px;color:#888;margin-top:4px")}>연동된 카드에서 새 결제가 있는지 확인하고 있어요</p>
                    </div>
                  </>)}
                  {(vm.claimIs.link) && (<>
                    <div style={S("display:flex;align-items:center;gap:6px")} onClick={vm.backClaimLink}>
                      <span style={S("font-size:15px;color:#555")}>‹</span>
                      <span style={S("font-size:11px;color:#555")}>뒤로</span>
                    </div>
                    <span style={S("display:inline-block;font-size:11px;font-weight:700;color:#0B8F58;background:#E3F2EA;padding:5px 11px;border-radius:20px;align-self:flex-start")}>결제 내역 연동</span>
                    <h2 style={S("font-size:19px;font-weight:800;color:#111;margin-top:2px;line-height:1.35")}>카드를 연동하면<br/>청구 결제가 자동으로 모여요</h2>
                    <p style={S("font-size:13.5px;color:#555;line-height:1.65;margin-top:8px")}>연동한 카드에서 학원·교재 결제만 골라 가져와요. 청구할 때 영수증을 하나씩 찾지 않아도 돼요.</p>
                    <div style={S(`display:flex;align-items:center;gap:11px;border-radius:14px;padding:12px 14px;background:${vm.claimLinkSummary.count ? '#E3F2EA' : '#F2F4F3'}`)}>
                      <span style={S(`width:3px;align-self:stretch;border-radius:3px;background:${vm.claimLinkSummary.count ? '#0B8F58' : '#9AA29C'}`)}></span>
                      <div>
                        <div style={S(`font-size:12.5px;font-weight:800;color:${vm.claimLinkSummary.count ? '#00703E' : '#3D4642'}`)}>{vm.claimLinkSummary.count ? `${vm.claimLinkSummary.count}개 카드에서 ${vm.claimLinkSummary.items}건, ${vm.claimLinkSummary.totalLabel} 모였어요` : '연동된 카드가 없어요'}</div>
                        <div style={S(`font-size:11.5px;margin-top:3px;line-height:1.5;color:${vm.claimLinkSummary.count ? '#4B6558' : '#6E766F'}`)}>{vm.claimLinkSummary.count ? `마지막 확인 ${vm.claimLinkSummary.lastSync} · 하루 한 번 자동으로 확인해요` : '카드를 연동하지 않으면 청구할 때마다 영수증을 직접 첨부해야 해요'}</div>
                      </div>
                    </div>
                    <div style={S("font-size:14px;font-weight:700;color:#111;margin-top:6px")}>연동된 카드</div>
                    <div style={S("display:flex;flex-direction:column;gap:8px")}>
                      {(vm.claimLinkedCards.length > 0) ? vm.claimLinkedCards.map((c, $index) => (
                        <React.Fragment key={$index}>
                          <div style={S("display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border:1px solid #E2E2E2;border-radius:14px")}>
                            <div style={S("display:flex;align-items:center;gap:11px")}>
                              <span style={S(`width:36px;height:36px;border-radius:10px;flex:none;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;background:${c.color}`)}>{c.short}</span>
                              <span style={S("font-size:13px;font-weight:700;color:#111")}>{c.name} •••• {c.tail}<small style={S("display:block;font-size:11.5px;font-weight:400;color:#888;margin-top:3px")}>{vm.claimLinkSummary.lastSync} 확인</small></span>
                            </div>
                            <span style={S("font-size:12px;font-weight:700;color:#888;cursor:pointer;white-space:nowrap")} onClick={() => vm.toggleClaimCard(c.id)}>해제</span>
                          </div>
                        </React.Fragment>
                      )) : (
                        <div style={S("border:1px dashed #D4D8D6;border-radius:14px;padding:22px 18px;text-align:center")}>
                          <div style={S("font-size:13px;font-weight:700;color:#111")}>아직 연동한 카드가 없어요</div>
                          <div style={S("font-size:11.5px;color:#888;margin-top:5px;line-height:1.55")}>아래에서 카드사를 골라 연동해 보세요</div>
                        </div>
                      )}
                    </div>
                    <div style={S("font-size:14px;font-weight:700;color:#111;margin-top:6px")}>연동할 수 있는 카드</div>
                    <div style={S("display:flex;flex-direction:column;gap:8px")}>
                      {vm.claimOffCards.map((c, $index) => (
                        <React.Fragment key={$index}>
                          <div style={S("display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border:1px solid #E2E2E2;border-radius:14px")}>
                            <div style={S("display:flex;align-items:center;gap:11px")}>
                              <span style={S(`width:36px;height:36px;border-radius:10px;flex:none;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;background:${c.color}`)}>{c.short}</span>
                              <span style={S("font-size:13px;font-weight:700;color:#111")}>{c.name}</span>
                            </div>
                            <span style={S("font-size:12px;font-weight:700;color:#0B8F58;background:#fff;border:1px solid #0B8F58;border-radius:10px;padding:7px 13px;cursor:pointer;white-space:nowrap")} onClick={() => vm.connectClaimCard(c.id)}>연동</span>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                    <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:16px;padding:15px 16px")}>
                      <div style={S("font-size:14px;font-weight:700;color:#111;margin-bottom:8px")}>어떤 결제를 가져오나요</div>
                      <div style={S("font-size:12.5px;color:#555;line-height:1.7")}>등록된 재수 학원·교육기관의 <b style={S("color:#111")}>사업자등록번호</b>와 일치하는 결제만 가져와요. 식비·교통비처럼 보장 대상이 아닌 결제는 가져오지 않아요.</div>
                    </div>
                    <div style={S("font-size:14px;font-weight:700;color:#111;margin-top:6px")}>최근 가져온 결제</div>
                    <div style={S("display:flex;flex-direction:column;gap:8px")}>
                      {(vm.claimLinkSummary.recent.length > 0) ? vm.claimLinkSummary.recent.map((c, $index) => (
                        <React.Fragment key={$index}>
                          <div style={S("display:flex;gap:11px;align-items:center;padding:12px 14px;border:1px solid #E2E2E2;border-radius:14px")}>
                            <div style={S("flex:1;min-width:0")}>
                              <div style={S("font-size:13px;font-weight:700;color:#111;line-height:1.4")}>{c.name}<span style={S("font-size:10px;font-weight:700;color:#0B8F58;background:#E3F2EA;padding:2px 6px;border-radius:6px;margin-left:6px")}>자동</span></div>
                              <div style={S("font-size:11px;color:#888;margin-top:3px")}>{c.metaLabel}</div>
                            </div>
                            <span style={S("font-size:13.5px;font-weight:800;color:#111;white-space:nowrap")}>{c.amtLabel}</span>
                          </div>
                        </React.Fragment>
                      )) : (
                        <div style={S("border:1px dashed #D4D8D6;border-radius:14px;padding:22px 18px;text-align:center")}>
                          <div style={S("font-size:13px;font-weight:700;color:#111")}>가져온 결제가 없어요</div>
                          <div style={S("font-size:11.5px;color:#888;margin-top:5px;line-height:1.55")}>카드를 연동하면 학원 결제가 여기에 모여요</div>
                        </div>
                      )}
                    </div>
                    <div style={S("font-size:11px;color:#AAA;line-height:1.6;margin-top:6px")}>※ 연동을 해제해도 이미 가져온 결제 내역은 남아있어요. 목록에서 직접 지울 수 있어요.</div>
                    <div style={S("background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:15px;font-weight:700;border-radius:14px;height:52px;display:flex;align-items:center;justify-content:center;margin-top:4px")} onClick={vm.backClaimLink}>완료</div>
                  </>)}
                  {(vm.claimIs.cardConnecting) && (vm.claimConnectingCard) && (<>
                    <div style={S("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:4px;padding:32px")}>
                      <div style={S(`width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#fff;background:${vm.claimConnectingCard.color}`)}>{vm.claimConnectingCard.short}</div>
                      <h2 style={S("font-size:16px;font-weight:800;color:#111;margin-top:16px")}>{vm.claimConnectingCard.name}와 연결하는 중이에요</h2>
                      <p style={S("font-size:12.5px;color:#888;margin-top:4px")}>본인 인증 결과를 확인하고 있어요</p>
                      <div style={S("width:22px;height:22px;border-radius:50%;border:3px solid #E3F2EA;border-top-color:#0B8F58;animation:spin 0.8s linear infinite;margin-top:18px")}></div>
                    </div>
                  </>)}
                  {(vm.claimIs.intro) && (<>
                    <div style={S("display:flex;align-items:center;gap:6px")} onClick={() => vm.goClaim('home')}>
                      <span style={S("font-size:15px;color:#555")}>‹</span>
                      <span style={S("font-size:12px;color:#555")}>보험현황</span>
                    </div>
                    <span style={S("display:inline-block;font-size:11px;font-weight:700;color:#0B8F58;background:#E3F2EA;padding:5px 11px;border-radius:20px;align-self:flex-start")}>보험금 청구</span>
                    <h2 style={S("font-size:20px;font-weight:800;color:#111;margin-top:2px;line-height:1.35")}>{vm.studentName}님의<br/>보험금 청구를 시작합니다</h2>
                    <p style={S("font-size:13.5px;color:#555;line-height:1.65;margin-top:8px")}>연간 재수 비용의 최대 <b style={S("color:#0B8F58")}>70%, 최대 {vm.manFmt(vm.claimLimit)}</b>까지 보장돼요. 6월과 12월, 연 2회 나눠 청구할 수 있어요.</p>
                    <div style={S("display:flex;align-items:center;gap:11px;background:#E3F2EA;border-radius:14px;padding:12px 14px")}>
                      <span style={S("width:3px;align-self:stretch;border-radius:3px;background:#0B8F58")}></span>
                      <div>
                        <div style={S("font-size:12.5px;font-weight:800;color:#00703E")}>{vm.claimRoundMeta.label} 청구 · {vm.claimRoundMeta.deadline} 마감</div>
                        <div style={S("font-size:11.5px;color:#4B6558;margin-top:3px;line-height:1.5")}>인정 지출 기간 {vm.claimRoundMeta.period}{vm.claimRound === 2 ? ' · 1차에 청구하지 않은 지출도 함께 낼 수 있어요' : ''}</div>
                      </div>
                    </div>
                    <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:16px;padding:16px 18px")}>
                      <div style={S("font-size:14px;font-weight:700;color:#111;margin-bottom:4px")}>청구에 필요한 것</div>
                      {[['재수 학원 등록·결제 증빙', '연동한 카드 결제에서 고르거나, 직접 첨부해요.'], ['보호자 동의', '미성년자라면 보호자 동의가 필요해요.'], ['입금 계좌', '등록된 계좌로 보험금이 입금돼요.']].map((row, $index) => (
                        <React.Fragment key={$index}>
                          <div style={S(`display:flex;gap:10px;align-items:flex-start;padding:10px 0;${$index < 2 ? 'border-bottom:1px solid #F2F2F2' : ''}`)}>
                            <div style={S("width:22px;height:22px;border-radius:50%;background:#E3F2EA;flex:none;display:flex;align-items:center;justify-content:center;margin-top:1px")}>
                              <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-6" fill="none" stroke="#0B8F58" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                            </div>
                            <div><div style={S("font-size:13.5px;font-weight:700;color:#111")}>{row[0]}</div><div style={S("font-size:12px;color:#888;margin-top:2px;line-height:1.5")}>{row[1]}</div></div>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                    <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:16px;padding:14px 16px")}>
                      <div style={S("font-size:12.5px;color:#555")}>이 순서로 <b style={S("color:#111")}>비용 증빙 → 받는 방법 → 지급액 확인</b>까지 진행돼요</div>
                    </div>
                    <div style={S("background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:15px;font-weight:700;border-radius:14px;height:52px;display:flex;align-items:center;justify-content:center;margin-top:4px")} onClick={vm.goClaimStep1}>{vm.claimRoundMeta.label} 청구 시작하기</div>
                  </>)}
                  {(vm.claimIs.step1) && (<>
                    <div style={S("display:flex;align-items:center;gap:6px")} onClick={() => vm.goClaim('intro')}>
                      <span style={S("font-size:15px;color:#555")}>‹</span>
                      <span style={S("font-size:11px;color:#555")}>뒤로</span>
                    </div>
                    <div style={S("flex:none")}>
                      <div style={S("font-size:11.5px;font-weight:700;color:#0B8F58")}>STEP 1 / 3 · 비용 증빙 · {vm.claimRoundMeta.label}</div>
                      <div style={S("display:flex;gap:5px;margin-top:7px")}>
                        <span style={S("flex:1;height:4px;border-radius:20px;background:#0B8F58")}></span>
                        <span style={S("flex:1;height:4px;border-radius:20px;background:#E7E7E7")}></span>
                        <span style={S("flex:1;height:4px;border-radius:20px;background:#E7E7E7")}></span>
                      </div>
                    </div>
                    <h2 style={S("font-size:18px;font-weight:800;color:#111;margin-top:2px;line-height:1.35")}>이번 회차에 청구할<br/>비용을 확인해 주세요</h2>
                    <div style={S("display:flex;align-items:center;justify-content:space-between;margin-top:4px")}>
                      <span style={S("font-size:14px;font-weight:700;color:#111")}>연동된 카드 결제</span>
                      <span style={S("font-size:12px;font-weight:700;color:#0B8F58;cursor:pointer")} onClick={() => vm.openClaimLink('step1')}>연동 관리</span>
                    </div>
                    <div style={S("display:flex;flex-direction:column;gap:8px")}>
                      {(vm.claimStepCosts.length > 0) ? vm.claimStepCosts.map((c, $index) => (
                        <React.Fragment key={$index}>
                          <div style={S(`display:flex;gap:11px;align-items:center;padding:12px 14px;border-radius:14px;cursor:pointer;border:1px solid ${c.on ? '#0B8F58' : '#E2E2E2'};background:${c.on ? '#F7FBF9' : '#fff'}`)} onClick={() => vm.toggleClaimCost(c.id)}>
                            <span style={S(`width:20px;height:20px;border-radius:6px;flex:none;display:flex;align-items:center;justify-content:center;border:2px solid ${c.on ? '#0B8F58' : '#CFCFCF'};background:${c.on ? '#0B8F58' : 'transparent'}`)}>
                              {c.on && <svg width="11" height="11" viewBox="0 0 12 12"><path d="M2 6l3 3 5-6" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"></path></svg>}
                            </span>
                            <div style={S("flex:1;min-width:0")}>
                              <div style={S("font-size:13px;font-weight:700;color:#111;line-height:1.4")}>{c.name}{c.auto ? <span style={S("font-size:10px;font-weight:700;color:#0B8F58;background:#E3F2EA;padding:2px 6px;border-radius:6px;margin-left:6px")}>자동</span> : <span style={S("font-size:10px;font-weight:700;color:#7A6A3F;background:#FAF3E0;padding:2px 6px;border-radius:6px;margin-left:6px")}>직접 첨부</span>}</div>
                              <div style={S("font-size:11px;color:#888;margin-top:3px")}>{c.metaLabel}</div>
                            </div>
                            <span style={S("font-size:13.5px;font-weight:800;color:#111;white-space:nowrap")}>{c.amtLabel}</span>
                          </div>
                        </React.Fragment>
                      )) : (
                        <div style={S("border:1px dashed #D4D8D6;border-radius:14px;padding:22px 18px;text-align:center")}>
                          <div style={S("font-size:13px;font-weight:700;color:#111")}>연동된 카드가 없어요</div>
                          <div style={S("font-size:11.5px;color:#888;margin-top:5px;line-height:1.55")}>카드를 연동하면 학원 결제를 자동으로 가져와요.<br/>연동하지 않으면 아래에서 직접 첨부해 주세요.</div>
                        </div>
                      )}
                    </div>
                    <div style={S(`border:1.5px dashed #CFCFCF;border-radius:14px;padding:16px;text-align:center;cursor:pointer;${vm.claimUpload ? 'border-style:solid;border-color:#0B8F58;background:#E3F2EA' : ''}`)} onClick={vm.toggleClaimUpload}>
                      <div style={S("font-size:13px;font-weight:700;color:#111")}>{vm.claimUpload ? '영수증_0511.jpg 첨부됨' : '연동되지 않은 결제 직접 첨부'}</div>
                      <div style={S("font-size:11.5px;color:#888;margin-top:3px")}>{vm.claimUpload ? '다시 선택하려면 탭하세요' : '영수증·등록증을 촬영하거나 갤러리에서 선택하세요'}</div>
                    </div>
                    <div style={S("display:flex;justify-content:space-between;align-items:center;padding:13px 16px;background:#F7FBF9;border:1px solid #CFE9DB;border-radius:14px")}>
                      <span style={S("font-size:12.5px;font-weight:700;color:#555")}>이번 회차 인정 비용</span>
                      <b style={S("font-size:16px;font-weight:800;color:#111")}>{vm.wonFmt(vm.claimEngine.thisCost)}</b>
                    </div>
                    <div style={S("display:flex;gap:10px;align-items:flex-start;padding:12px 0;cursor:pointer")} onClick={vm.toggleClaimAgreeGuardian}>
                      <span style={S(`width:22px;height:22px;border-radius:6px;border:2px solid ${vm.claimAgreeGuardian ? '#0B8F58' : '#CFCFCF'};background:${vm.claimAgreeGuardian ? '#0B8F58' : 'transparent'};flex:none;display:flex;align-items:center;justify-content:center;margin-top:1px`)}>
                        {vm.claimAgreeGuardian && <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"></path></svg>}
                      </span>
                      <span style={S("font-size:12.5px;color:#555;line-height:1.55")}>피보험자가 미성년자로, <b style={S("color:#111")}>보호자 동의</b>를 확인합니다.</span>
                    </div>
                    <div style={S("background:#FDF2F2;border:1px solid #F3C9C9;border-radius:14px;padding:13px 15px;font-size:11.5px;color:#B4363B;line-height:1.65")}>⚠ 증빙을 위조·변조하거나 사실과 다르게 제출하면 <b style={S("color:#8F2226")}>계약 해지·보험금 회수</b> 및 보험사기방지 특별법에 따른 불이익이 발생할 수 있어요.</div>
                    <div style={S(`font-size:15px;font-weight:700;border-radius:14px;height:52px;display:flex;align-items:center;justify-content:center;margin-top:4px;${vm.claimStep1CtaDisabled ? 'background:#C7D8CE;color:#fff' : 'background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;cursor:pointer'}`)} onClick={() => { if (!vm.claimStep1CtaDisabled) vm.goClaimPay(); }}>다음</div>
                  </>)}
                  {(vm.claimIs.pay) && (<>
                    <div style={S("display:flex;align-items:center;gap:6px")} onClick={() => vm.goClaim('step1')}>
                      <span style={S("font-size:15px;color:#555")}>‹</span>
                      <span style={S("font-size:11px;color:#555")}>뒤로</span>
                    </div>
                    <div style={S("flex:none")}>
                      <div style={S("font-size:11.5px;font-weight:700;color:#0B8F58")}>STEP 2 / 3 · 받는 방법</div>
                      <div style={S("display:flex;gap:5px;margin-top:7px")}>
                        <span style={S("flex:1;height:4px;border-radius:20px;background:#0B8F58")}></span>
                        <span style={S("flex:1;height:4px;border-radius:20px;background:#0B8F58")}></span>
                        <span style={S("flex:1;height:4px;border-radius:20px;background:#E7E7E7")}></span>
                      </div>
                    </div>
                    <h2 style={S("font-size:18px;font-weight:800;color:#111;margin-top:2px;line-height:1.35")}>보험금을 어떻게<br/>받을지 확인해 주세요</h2>
                    <p style={S("font-size:13.5px;color:#555;line-height:1.65;margin-top:8px")}>가입한 재수 형태에 따라 <b style={S("color:#111")}>{vm.claimForm}</b> 기준으로 나눠 지급돼요.</p>
                    <div style={S("font-size:14px;font-weight:700;color:#111;margin-top:6px")}>학원비 바우처</div>
                    <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:16px;padding:14px 16px")}>
                      <div style={S("font-size:12.5px;color:#555;line-height:1.6")}>일부 재수 학원에서는 바우처로 바로 정산할 수 있어요. 승인되면 학원에 발급돼요.</div>
                    </div>
                    <div style={S("font-size:14px;font-weight:700;color:#111;margin-top:6px")}>입금 계좌</div>
                    <div style={S("display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border:1px solid #E2E2E2;border-radius:14px")}>
                      <span style={S("font-size:13px;font-weight:700;color:#111")}>신한 •••• 4821<small style={S("display:block;font-size:11.5px;font-weight:400;color:#888;margin-top:3px")}>바우처를 뺀 나머지가 이 계좌로 입금돼요</small></span>
                      <span style={S("font-size:12px;font-weight:700;color:#0B8F58;cursor:pointer;white-space:nowrap")}>변경</span>
                    </div>
                    <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:16px;padding:8px 16px 12px")}>
                      <div style={S("display:flex;justify-content:space-between;align-items:baseline;padding:9px 0;font-size:13px;color:#555")}><span>가입한 재수 형태</span><b style={S("font-size:14px;font-weight:700;color:#111")}>{vm.claimForm}</b></div>
                      <div style={S("height:1px;background:#E2E2E2")}></div>
                      <div style={S("display:flex;justify-content:space-between;align-items:baseline;padding:9px 0;font-size:13px;color:#555")}><span>학원비 바우처</span><b style={S("font-size:14px;font-weight:700;color:#111")}>{vm.claimFormVoucherPct}%</b></div>
                      <div style={S("height:1px;background:#E2E2E2")}></div>
                      <div style={S("display:flex;justify-content:space-between;align-items:baseline;padding:9px 0;font-size:13px;color:#555")}><span>계좌 입금</span><b style={S("font-size:14px;font-weight:700;color:#111")}>{vm.claimFormCashPct}%</b></div>
                    </div>
                    <div style={S("font-size:11px;color:#AAA;line-height:1.6;margin-top:6px")}>※ 지급 비율은 가입할 때 정해진 재수 형태를 따르며, 청구 회차와 관계없이 같아요.</div>
                    <div style={S("background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:15px;font-weight:700;border-radius:14px;height:52px;display:flex;align-items:center;justify-content:center;margin-top:4px")} onClick={vm.goClaimCalc}>다음</div>
                  </>)}
                  {(vm.claimIs.calc) && (<>
                    <div style={S("display:flex;align-items:center;gap:6px")} onClick={() => vm.goClaim('pay')}>
                      <span style={S("font-size:15px;color:#555")}>‹</span>
                      <span style={S("font-size:11px;color:#555")}>뒤로</span>
                    </div>
                    <div style={S("flex:none")}>
                      <div style={S("font-size:11.5px;font-weight:700;color:#0B8F58")}>STEP 3 / 3 · 지급액 확인</div>
                      <div style={S("display:flex;gap:5px;margin-top:7px")}>
                        <span style={S("flex:1;height:4px;border-radius:20px;background:#0B8F58")}></span>
                        <span style={S("flex:1;height:4px;border-radius:20px;background:#0B8F58")}></span>
                        <span style={S("flex:1;height:4px;border-radius:20px;background:#0B8F58")}></span>
                      </div>
                    </div>
                    <h2 style={S("font-size:18px;font-weight:800;color:#111;margin-top:2px;line-height:1.35")}>이번 회차 지급액을<br/>확인해 주세요</h2>
                    <div style={S("border:1px solid #E2E2E2;border-radius:16px;padding:6px 16px 14px")}>
                      <div style={S("display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:9px 0;font-size:13px;color:#555")}><span>이번 회차 인정 비용</span><b style={S("font-size:14px;font-weight:700;color:#111")}>{vm.wonFmt(vm.claimEngine.thisCost)}</b></div>
                      {(vm.claimRound === 2) && (<>
                        <div style={S("height:1px;background:#E2E2E2;margin:5px 0")}></div>
                        <div style={S("display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:9px 0;font-size:13px;color:#555")}><span>1차 인정 비용</span><b style={S("font-size:14px;font-weight:700;color:#111")}>{vm.wonFmt(vm.claimEngine.prevCost)}</b></div>
                      </>)}
                      <div style={S("height:2px;background:#DADADA;margin:7px 0")}></div>
                      <div style={S("display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:9px 0;font-size:13px;color:#555")}><span>누적 인정 비용</span><b style={S("font-size:14px;font-weight:700;color:#111")}>{vm.wonFmt(vm.claimEngine.cumCost)}</b></div>
                      <div style={S("height:1px;background:#E2E2E2;margin:5px 0")}></div>
                      <div style={S("display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:9px 0;font-size:13px;color:#555")}><span>× 보장 비율 70%</span><b style={S("font-size:14px;font-weight:700;color:#111")}>{vm.wonFmt(vm.claimEngine.rawEnt)}</b></div>
                      <div style={S("height:1px;background:#E2E2E2;margin:5px 0")}></div>
                      <div style={S("display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:9px 0;font-size:13px;color:#555")}><span>연간 한도 {vm.manFmt(vm.claimLimit)} 적용</span><b style={S("font-size:14px;font-weight:700;color:#111")}>{vm.wonFmt(vm.claimEngine.cumEnt)}</b></div>
                      {(vm.claimEngine.capped) && (<div style={S("font-size:11px;color:#00703E;background:#E3F2EA;border-radius:8px;padding:6px 9px;margin-top:2px;line-height:1.5")}>한도를 넘어서 {vm.manFmt(vm.claimEngine.rawEnt - vm.claimEngine.cumEnt)}이 조정됐어요</div>)}
                      {(vm.claimRound === 2) && (<>
                        <div style={S("height:1px;background:#E2E2E2;margin:5px 0")}></div>
                        <div style={S("display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:9px 0;font-size:13px;color:#C2454A")}><span>− 1차 기지급</span><b style={S("font-size:14px;font-weight:700;color:#C2454A")}>−{vm.wonFmt(vm.claimEngine.prevPaid)}</b></div>
                      </>)}
                      <div style={S("height:2px;background:#DADADA;margin:7px 0")}></div>
                      <div style={S("display:flex;justify-content:space-between;align-items:baseline;padding:11px 0 4px")}><span style={S("font-size:13.5px;font-weight:700;color:#111")}>이번 지급 예정액</span><b style={S("font-size:23px;font-weight:800;color:#0B8F58;letter-spacing:-0.02em")}>{vm.wonFmt(vm.claimEngine.payout)}</b></div>
                      <div style={S("display:flex;justify-content:space-between;font-size:12px;color:#888;padding:5px 0")}><span>학원비 바우처 {vm.claimFormVoucherPct}%</span><b style={S("font-size:12.5px;font-weight:700;color:#555")}>{vm.claimVoucherAmt}</b></div>
                      <div style={S("display:flex;justify-content:space-between;font-size:12px;color:#888;padding:5px 0")}><span>계좌 입금 {vm.claimFormCashPct}%</span><b style={S("font-size:12.5px;font-weight:700;color:#555")}>{vm.claimCashAmt}</b></div>
                    </div>
                    <div style={S("font-size:14px;font-weight:700;color:#111;margin-top:6px")}>연간 한도 사용 현황</div>
                    <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:16px;padding:16px 18px")}>
                      <div style={S("display:flex;height:10px;border-radius:20px;overflow:hidden;background:#E9E9E9")}>
                        <div style={S(`width:${vm.claimGaugeMain ? (vm.claimEngine.prevPaid / (vm.claimLimit || 1) * 100) : 0}%;background:#0B8F58`)}></div>
                        <div style={S(`width:${vm.claimGaugeMain ? (vm.claimEngine.payout / (vm.claimLimit || 1) * 100) : 0}%;background:#6FC79B`)}></div>
                      </div>
                      <div style={S("display:flex;gap:12px;margin-top:9px;flex-wrap:wrap")}>
                        {(vm.claimEngine.prevPaid > 0) && (<div style={S("display:flex;align-items:center;gap:5px;font-size:11px;color:#888")}><span style={S("width:8px;height:8px;border-radius:3px;background:#0B8F58")}></span>기지급 <b style={S("color:#111;font-weight:700")}>{vm.manFmt(vm.claimEngine.prevPaid)}</b></div>)}
                        <div style={S("display:flex;align-items:center;gap:5px;font-size:11px;color:#888")}><span style={S("width:8px;height:8px;border-radius:3px;background:#6FC79B")}></span>이번 지급 <b style={S("color:#111;font-weight:700")}>{vm.manFmt(vm.claimEngine.payout)}</b></div>
                        <div style={S("display:flex;align-items:center;gap:5px;font-size:11px;color:#888")}><span style={S("width:8px;height:8px;border-radius:3px;background:#E9E9E9")}></span>잔여 <b style={S("color:#111;font-weight:700")}>{vm.manFmt(vm.claimEngine.remaining)}</b></div>
                      </div>
                    </div>
                    <div style={S("display:flex;align-items:center;gap:11px;background:#F2F4F3;border-radius:14px;padding:12px 14px")}>
                      <span style={S("width:3px;align-self:stretch;border-radius:3px;background:#9AA29C")}></span>
                      {(vm.claimRound === 1) ? (
                        <div><div style={S("font-size:12.5px;font-weight:800;color:#3D4642")}>다음 청구는 12월 1일부터예요</div><div style={S("font-size:11.5px;color:#6E766F;margin-top:3px;line-height:1.5")}>6~11월 지출은 12월에 한 번 더 청구할 수 있어요. 남은 한도 {vm.manFmt(vm.claimEngine.remaining)}.</div></div>
                      ) : (
                        <div><div style={S("font-size:12.5px;font-weight:800;color:#3D4642")}>이번이 올해 마지막 청구예요</div><div style={S("font-size:11.5px;color:#6E766F;margin-top:3px;line-height:1.5")}>남은 한도 {vm.manFmt(vm.claimEngine.remaining)}은 {vm.claimYear}년 12월 31일에 소멸해요.</div></div>
                      )}
                    </div>
                    <div style={S("display:flex;gap:10px;align-items:flex-start;padding:12px 0;cursor:pointer")} onClick={vm.toggleClaimAgreeFinal}>
                      <span style={S(`width:22px;height:22px;border-radius:6px;border:2px solid ${vm.claimAgreeFinal ? '#0B8F58' : '#CFCFCF'};background:${vm.claimAgreeFinal ? '#0B8F58' : 'transparent'};flex:none;display:flex;align-items:center;justify-content:center;margin-top:1px`)}>
                        {vm.claimAgreeFinal && <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"></path></svg>}
                      </span>
                      <span style={S("font-size:12.5px;color:#555;line-height:1.55")}>제출 내용이 사실과 같으며, 허위 제출 시 불이익에 동의합니다.</span>
                    </div>
                    <div style={S(`font-size:15px;font-weight:700;border-radius:14px;height:52px;display:flex;align-items:center;justify-content:center;margin-top:4px;${vm.claimStep3CtaDisabled ? 'background:#C7D8CE;color:#fff' : 'background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;cursor:pointer'}`)} onClick={() => { if (!vm.claimStep3CtaDisabled) vm.submitClaim(); }}>청구 제출</div>
                  </>)}
                  {(vm.claimIs.submitting) && (<>
                    <div style={S("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:4px;padding:32px")}>
                      <div style={S("width:40px;height:40px;border-radius:50%;border:4px solid #E3F2EA;border-top-color:#0B8F58;animation:spin 0.8s linear infinite")}></div>
                      <h2 style={S("font-size:16px;font-weight:800;color:#111;margin-top:16px")}>제출 내용을 확인하고 있어요</h2>
                      <p style={S("font-size:12.5px;color:#888;margin-top:4px")}>잠시만 기다려 주세요</p>
                    </div>
                  </>)}
                  {(vm.claimIs.done) && (<>
                    <div style={S("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:32px")}>
                      <div style={S("width:84px;height:84px;border-radius:50%;background:#E3F2EA;display:flex;align-items:center;justify-content:center;margin-bottom:18px")}>
                        <svg width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="none" stroke="#0B8F58" strokeWidth="2.5"></circle><path d="M12 20l5 5 11-12" fill="none" stroke="#0B8F58" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                      </div>
                      <span style={S("display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;color:#fff;background:#0B8F58;padding:4px 10px;border-radius:20px")}>{vm.claimRoundMeta.label}</span>
                      <h2 style={S("font-size:22px;font-weight:800;color:#111;margin:12px 0 0")}>청구가 접수됐어요</h2>
                      <p style={S("font-size:13.5px;color:#555;line-height:1.6;margin:10px 0 0")}>심사가 완료되면 알림으로 알려드릴게요.<br/>진행 상황은 언제든 확인할 수 있어요.</p>
                      <div style={S("width:100%;background:#F8F8F8;border-radius:14px;padding:14px 16px;margin-top:20px;text-align:left")}>
                        <div style={S("display:flex;justify-content:space-between;font-size:12.5px;padding:5px 0")}><span style={S("color:#888")}>접수번호</span><b style={S("color:#111")}>{vm.claimRoundMeta.no}</b></div>
                        <div style={S("display:flex;justify-content:space-between;font-size:12.5px;padding:5px 0")}><span style={S("color:#888")}>청구 회차</span><b style={S("color:#111")}>{vm.claimRoundMeta.label}</b></div>
                        <div style={S("display:flex;justify-content:space-between;font-size:12.5px;padding:5px 0")}><span style={S("color:#888")}>인정 지출 기간</span><b style={S("color:#111")}>{vm.claimRoundMeta.period}</b></div>
                        <div style={S("display:flex;justify-content:space-between;font-size:12.5px;padding:5px 0")}><span style={S("color:#888")}>지급 예정액</span><b style={S("color:#111")}>{vm.wonFmt(vm.claimEngine.payout)}</b></div>
                        <div style={S("display:flex;justify-content:space-between;font-size:12.5px;padding:5px 0")}><span style={S("color:#888")}>예상 심사 기간</span><b style={S("color:#111")}>약 3영업일</b></div>
                      </div>
                      <div style={S("width:100%;margin-top:14px")}>
                        <div style={S("display:flex;align-items:center;gap:11px;background:#F2F4F3;border-radius:14px;padding:12px 14px")}>
                          <span style={S("width:3px;align-self:stretch;border-radius:3px;background:#9AA29C")}></span>
                          {(vm.claimRound === 1) ? (
                            <div><div style={S("font-size:12.5px;font-weight:800;color:#3D4642")}>다음 청구는 12월 1일부터</div><div style={S("font-size:11.5px;color:#6E766F;margin-top:3px;line-height:1.5")}>남은 한도 {vm.manFmt(vm.claimEngine.remaining)} · 청구창이 열리면 알려드릴게요</div></div>
                          ) : (
                            <div><div style={S("font-size:12.5px;font-weight:800;color:#3D4642")}>올해 마지막 청구예요</div><div style={S("font-size:11.5px;color:#6E766F;margin-top:3px;line-height:1.5")}>남은 한도 {vm.manFmt(vm.claimEngine.remaining)}은 12월 31일에 소멸해요</div></div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={S("flex:none;display:flex;flex-direction:column;gap:8px;padding-top:4px")}>
                      <div style={S("background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:15px;font-weight:700;border-radius:14px;height:52px;display:flex;align-items:center;justify-content:center")} onClick={() => vm.goClaim('status')}>청구 진행 상황 보기</div>
                      <div style={S("background:#fff;border:1px solid #E5E5E5;color:#555;font-size:14px;font-weight:700;border-radius:14px;height:48px;display:flex;align-items:center;justify-content:center")} onClick={() => vm.goClaim('home')}>홈으로</div>
                    </div>
                  </>)}
                  {(vm.claimIs.status) && (<>
                    <div style={S("display:flex;align-items:center;gap:6px")} onClick={() => vm.goClaim('home')}>
                      <span style={S("font-size:15px;color:#555")}>‹</span>
                      <span style={S("font-size:12px;color:#555")}>보험현황</span>
                    </div>
                    <div style={S("display:flex;align-items:center;gap:8px")}>
                      <span style={S("display:inline-block;font-size:11px;font-weight:700;color:#0B8F58;background:#E3F2EA;padding:5px 11px;border-radius:20px")}>청구 진행 상황</span>
                      <span style={S("display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;color:#00703E;background:#E3F2EA;padding:4px 10px;border-radius:20px")}>{vm.claimRoundMeta.label}</span>
                    </div>
                    <h2 style={S("font-size:18px;font-weight:800;color:#111;margin-top:2px;line-height:1.35")}>심사를 진행하고 있어요</h2>
                    <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:16px;padding:18px")}>
                      <div style={S("position:relative;padding-left:8px")}>
                        {[
                          { st: 'done', tt: '청구 접수됨', dd: vm.claimRoundMeta.date },
                          { st: 'cur', tt: '심사 진행 중', dd: '제출 서류를 확인하고 있어요 · 약 3영업일' },
                          { st: 'pending', tt: '지급 심사', dd: '최종 인정 비용으로 지급액을 확정해요' },
                          { st: 'pending', tt: '지급 완료', dd: '바우처 발급 · 계좌 입금' },
                        ].map((it, $index) => (
                          <React.Fragment key={$index}>
                            <div style={S(`display:flex;gap:14px;position:relative;padding-bottom:${$index < 3 ? '22px' : '0'}`)}>
                              {($index < 3) && <div style={S(`position:absolute;left:12px;top:22px;bottom:0;width:2px;background:${it.st === 'done' ? '#0B8F58' : '#E4E4E4'}`)}></div>}
                              <div style={S(`width:24px;height:24px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;z-index:1;background:${it.st === 'done' ? '#0B8F58' : '#fff'};${it.st === 'cur' ? 'border:3px solid #0B8F58' : (it.st === 'pending' ? 'background:#EDEDED' : '')}`)}>
                                {it.st === 'done' && <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"></path></svg>}
                              </div>
                              <div>
                                <div style={S(`font-size:14px;font-weight:700;color:${it.st === 'pending' ? '#B4B4B4' : '#111'}`)}>{it.tt}</div>
                                <div style={S(`font-size:11.5px;margin-top:2px;line-height:1.5;color:${it.st === 'cur' ? '#0B8F58' : '#888'};${it.st === 'cur' ? 'font-weight:700' : ''}`)}>{it.dd}</div>
                              </div>
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                    <div style={S("font-size:14px;font-weight:700;color:#111;margin-top:2px")}>접수 내역</div>
                    <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:16px;padding:14px 16px")}>
                      <div style={S("display:flex;flex-direction:column;gap:9px;font-size:13px;color:#555")}>
                        <div style={S("display:flex;justify-content:space-between")}><span>접수번호</span><b style={S("color:#111")}>{vm.claimRoundMeta.no}</b></div>
                        <div style={S("display:flex;justify-content:space-between")}><span>청구 회차</span><b style={S("color:#111")}>{vm.claimRoundMeta.label}</b></div>
                        <div style={S("display:flex;justify-content:space-between")}><span>인정 비용</span><b style={S("color:#111")}>{vm.wonFmt(vm.claimEngine.thisCost)}</b></div>
                        <div style={S("display:flex;justify-content:space-between")}><span>지급 예정액</span><b style={S("color:#111")}>{vm.wonFmt(vm.claimEngine.payout)}</b></div>
                      </div>
                    </div>
                    <div style={S("font-size:14px;font-weight:700;color:#111;margin-top:2px")}>지난 청구</div>
                    {(vm.claimRound === 2) ? (
                      <div style={S("display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border:1px solid #E2E2E2;border-radius:14px")}>
                        <span style={S("font-size:13px;font-weight:700;color:#111")}>1차 (6월) 지급완료<small style={S("display:block;font-size:11.5px;font-weight:400;color:#888;margin-top:3px")}>2027.06.14 입금 · 인정 비용 {vm.wonFmt(vm.claimEngine.prevCost)}</small></span>
                        <b style={S("font-size:14px")}>{vm.wonFmt(vm.claimEngine.prevPaid)}</b>
                      </div>
                    ) : (
                      <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:16px;padding:16px;text-align:center;font-size:12.5px;color:#888")}>이번이 첫 청구예요</div>
                    )}
                    <div style={S("background:#fff;border:1px solid #E5E5E5;color:#555;font-size:14px;font-weight:700;border-radius:14px;height:52px;display:flex;align-items:center;justify-content:center;margin-top:4px")} onClick={() => vm.goClaim('home')}>홈으로</div>
                  </>)}
                  {(vm.claimIs.windowClosed) && (<>
                    <div style={S("display:flex;align-items:center;gap:6px")} onClick={() => vm.goClaim('home')}>
                      <span style={S("font-size:15px;color:#555")}>‹</span>
                      <span style={S("font-size:12px;color:#555")}>보험현황</span>
                    </div>
                    <span style={S("display:inline-block;font-size:11px;font-weight:700;color:#0B8F58;background:#E3F2EA;padding:5px 11px;border-radius:20px;align-self:flex-start")}>청구 일정</span>
                    <h2 style={S("font-size:19px;font-weight:800;color:#111;margin-top:2px;line-height:1.35")}>다음 청구는<br/>{vm.claimRound === 1 ? '6월 1일' : '12월 1일'}부터 가능해요</h2>
                    <p style={S("font-size:13.5px;color:#555;line-height:1.65;margin-top:8px")}>청구는 6월과 12월, 연 2회 열려요. 그 사이 결제 내역을 자동으로 모아둘게요.</p>
                    <div style={S("text-align:center;padding:22px 18px;border:1px solid #E2E2E2;border-radius:16px")}>
                      <div style={S("font-size:12px;font-weight:700;color:#888")}>{vm.claimRoundMeta.label} 청구 시작까지</div>
                      <div style={S("font-size:38px;font-weight:800;color:#0B8F58;letter-spacing:-0.03em;margin:4px 0 2px")}>D-{vm.claimDaysUntilOpen}</div>
                      <div style={S("font-size:12.5px;color:#555")}>{vm.claimRoundMeta.window} 접수</div>
                    </div>
                    <div style={S("display:flex;align-items:center;justify-content:space-between;margin-top:4px")}>
                      <span style={S("font-size:14px;font-weight:700;color:#111")}>지급까지 모은 결제</span>
                      <span style={S("font-size:12px;font-weight:700;color:#0B8F58;cursor:pointer")} onClick={() => vm.openClaimLink('windowClosed')}>연동 관리</span>
                    </div>
                    <div style={S("display:flex;flex-direction:column;gap:8px")}>
                      {(vm.claimWindowCosts.length > 0) ? vm.claimWindowCosts.map((c, $index) => (
                        <React.Fragment key={$index}>
                          <div style={S("display:flex;gap:11px;align-items:center;padding:12px 14px;border:1px solid #E2E2E2;border-radius:14px")}>
                            <div style={S("flex:1;min-width:0")}>
                              <div style={S("font-size:13px;font-weight:700;color:#111;line-height:1.4")}>{c.name}{c.auto ? <span style={S("font-size:10px;font-weight:700;color:#0B8F58;background:#E3F2EA;padding:2px 6px;border-radius:6px;margin-left:6px")}>자동</span> : <span style={S("font-size:10px;font-weight:700;color:#7A6A3F;background:#FAF3E0;padding:2px 6px;border-radius:6px;margin-left:6px")}>직접 첨부</span>}</div>
                              <div style={S("font-size:11px;color:#888;margin-top:3px")}>{c.metaLabel}</div>
                            </div>
                            <span style={S("font-size:13.5px;font-weight:800;color:#111;white-space:nowrap")}>{c.amtLabel}</span>
                          </div>
                        </React.Fragment>
                      )) : (
                        <div style={S("border:1px dashed #D4D8D6;border-radius:14px;padding:22px 18px;text-align:center")}>
                          <div style={S("font-size:13px;font-weight:700;color:#111")}>모은 결제가 없어요</div>
                          <div style={S("font-size:11.5px;color:#888;margin-top:5px;line-height:1.55")}>카드를 연동하면 학원 결제를 자동으로 모아둬요</div>
                        </div>
                      )}
                    </div>
                    <div style={S("display:flex;justify-content:space-between;align-items:center;padding:13px 16px;background:#F7FBF9;border:1px solid #CFE9DB;border-radius:14px")}>
                      <span style={S("font-size:12.5px;font-weight:700;color:#555")}>모인 금액</span>
                      <b style={S("font-size:16px;font-weight:800;color:#111")}>{vm.wonFmt(vm.claimEngine.thisCost)}</b>
                    </div>
                    <div style={S("font-size:14px;font-weight:700;color:#111;margin-top:6px")}>연간 한도 사용 현황</div>
                    <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:16px;padding:16px 18px")}>
                      <div style={S("display:flex;height:10px;border-radius:20px;overflow:hidden;background:#E9E9E9")}>
                        <div style={S(`width:${vm.claimLimit ? (vm.claimEngine.prevPaid / vm.claimLimit * 100) : 0}%;background:#0B8F58`)}></div>
                      </div>
                      <div style={S("display:flex;gap:12px;margin-top:9px;flex-wrap:wrap")}>
                        {(vm.claimEngine.prevPaid > 0) && (<div style={S("display:flex;align-items:center;gap:5px;font-size:11px;color:#888")}><span style={S("width:8px;height:8px;border-radius:3px;background:#0B8F58")}></span>기지급 <b style={S("color:#111;font-weight:700")}>{vm.manFmt(vm.claimEngine.prevPaid)}</b></div>)}
                        <div style={S("display:flex;align-items:center;gap:5px;font-size:11px;color:#888")}><span style={S("width:8px;height:8px;border-radius:3px;background:#E9E9E9")}></span>잔여 <b style={S("color:#111;font-weight:700")}>{vm.manFmt(vm.claimLimit - vm.claimEngine.prevPaid)}</b></div>
                      </div>
                    </div>
                    <div style={S("background:#fff;border:1px solid #E5E5E5;color:#555;font-size:14px;font-weight:700;border-radius:14px;height:52px;display:flex;align-items:center;justify-content:center;margin-top:4px")} onClick={() => vm.goClaim('home')}>홈으로</div>
                  </>)}
                  {(vm.claimIs.expired) && (<>
                    <div style={S("display:flex;align-items:center;gap:6px")} onClick={() => vm.goClaim('home')}>
                      <span style={S("font-size:15px;color:#555")}>‹</span>
                      <span style={S("font-size:12px;color:#555")}>보험현황</span>
                    </div>
                    <span style={S("display:inline-block;font-size:11px;font-weight:700;color:#6E766F;background:#F0F2F1;padding:5px 11px;border-radius:20px;align-self:flex-start")}>보장 종료</span>
                    <h2 style={S("font-size:19px;font-weight:800;color:#111;margin-top:2px;line-height:1.35")}>보장 자격이<br/>{vm.claimYear}년 12월 31일에 종료됐어요</h2>
                    <p style={S("font-size:13.5px;color:#555;line-height:1.65;margin-top:8px")}>청구 가능 기간이 끝나 남은 한도는 소멸했어요. 아래는 최종 정산 내역이에요.</p>
                    <div style={S("font-size:14px;font-weight:700;color:#111;margin-top:6px")}>최종 정산</div>
                    <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:16px;padding:8px 16px 12px")}>
                      <div style={S("display:flex;justify-content:space-between;align-items:baseline;padding:9px 0;font-size:13px;color:#555")}><span>총 인정 비용</span><b style={S("font-size:14px;font-weight:700;color:#111")}>12,000,000원</b></div>
                      <div style={S("height:1px;background:#E2E2E2")}></div>
                      <div style={S("display:flex;justify-content:space-between;align-items:baseline;padding:9px 0;font-size:13px;color:#555")}><span>1차 지급 (2027.06)</span><b style={S("font-size:14px;font-weight:700;color:#111")}>3,640,000원</b></div>
                      <div style={S("height:1px;background:#E2E2E2")}></div>
                      <div style={S("display:flex;justify-content:space-between;align-items:baseline;padding:9px 0;font-size:13px;color:#555")}><span>2차 지급 (2027.12)</span><b style={S("font-size:14px;font-weight:700;color:#111")}>4,760,000원</b></div>
                      <div style={S("height:2px;background:#DADADA;margin:7px 0")}></div>
                      <div style={S("display:flex;justify-content:space-between;align-items:baseline;padding:11px 0 4px")}><span style={S("font-size:13.5px;font-weight:700;color:#111")}>총 수령액</span><b style={S("font-size:23px;font-weight:800;color:#0B8F58;letter-spacing:-0.02em")}>8,400,000원</b></div>
                      <div style={S("display:flex;justify-content:space-between;font-size:12px;color:#888;padding:5px 0")}><span>내가 낸 몫 (30%)</span><b style={S("font-size:12.5px;font-weight:700;color:#555")}>3,600,000원</b></div>
                      <div style={S("display:flex;justify-content:space-between;font-size:12px;color:#888;padding:5px 0")}><span>청구 안 하고 소멸한 한도</span><b style={S("font-size:12.5px;font-weight:700;color:#555")}>6,600,000원</b></div>
                    </div>
                    <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:16px;padding:14px 16px")}>
                      <div style={S("font-size:12.5px;color:#555;line-height:1.6")}>정산 내역이 사실과 다르다면 종료일로부터 <b style={S("color:#111")}>90일 이내</b>에 이의를 제기할 수 있어요.</div>
                    </div>
                    <div style={S("flex:none;display:flex;flex-direction:column;gap:8px;padding-top:4px")}>
                      <div style={S("background:#fff;border:1px solid #E5E5E5;color:#555;font-size:14px;font-weight:700;border-radius:14px;height:48px;display:flex;align-items:center;justify-content:center")}>이의 신청하기</div>
                      <div style={S("background:#fff;border:1px solid #E5E5E5;color:#555;font-size:14px;font-weight:700;border-radius:14px;height:48px;display:flex;align-items:center;justify-content:center")} onClick={() => vm.goClaim('home')}>홈으로</div>
                    </div>
                  </>)}
                </>)}
                </>)}
                {(vm.homeIs.ins02) && (<>
                  <div style={S("display:flex;align-items:center;gap:6px")} onClick={vm.backIns01}>
                    <span style={S("font-size:15px;color:#555")}>‹</span>
                    <span style={S("font-size:12px;color:#555")}>보험현황</span>
                  </div>
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:18px")}>
                    <div style={S("font-size:13px;color:#888")}>이번 달 보험료</div>
                    <div style={S("font-size:29px;font-weight:800;color:#111;margin-top:6px")}>
                      {vm.premiumLabel}
                    </div>
                    <div style={S(`font-size:12px;font-weight:700;color:${vm.deltaColor};margin-top:6px`)}>
                      전월 대비 {vm.deltaLabel}
                    </div>
                  </div>
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;overflow:hidden;flex:none")}>
                    <div style={S("position:relative;overflow:hidden;background:linear-gradient(135deg,#0B8F58,#16B37A);padding:22px 20px 20px;text-align:center;color:#fff")}>
                      <svg width="130" height="130" viewBox="0 0 40 48" style={S("position:absolute;top:-20px;right:-18px;opacity:0.12")}>
                        <path d="M4 2h32v40l-4-2.6-4 2.6-4-2.6-4 2.6-4-2.6-4 2.6-4-2.6-4 2.6z" fill="#fff"></path>
                        <line x1="9" y1="11" x2="31" y2="11" stroke="#0B8F58" strokeWidth="1.6"></line>
                        <line x1="9" y1="17" x2="31" y2="17" stroke="#0B8F58" strokeWidth="1.6"></line>
                        <line x1="9" y1="23" x2="23" y2="23" stroke="#0B8F58" strokeWidth="1.6"></line>
                      </svg>
                      <div style={S("width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.18);border:1.5px solid rgba(255,255,255,0.55);display:flex;align-items:center;justify-content:center;margin:0 auto;position:relative")}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </div>
                      <div style={S("font-size:15px;font-weight:800;margin-top:10px;position:relative")}>월별 납입 영수증</div>
                      <div style={S("font-size:9.5px;color:rgba(255,255,255,0.75);margin-top:4px;position:relative;letter-spacing:0.2px")}>No. {vm.paymentsReceiptNo}</div>
                    </div>
                    {(vm.payments && vm.payments.length > 0) ? (<>
                      <div style={S("padding:16px 20px;border-bottom:1px dashed #D8E5DE;display:flex;justify-content:space-between;align-items:center")}>
                        <div>
                          <div style={S("font-size:9.5px;color:#999")}>총 납입 합계</div>
                          <div style={S("font-family:ui-monospace,SFMono-Regular,Consolas,Menlo,monospace;font-size:20px;font-weight:800;color:#111;margin-top:3px;letter-spacing:-0.3px")}>{vm.paymentsTotalLabel}</div>
                        </div>
                        <div style={S("display:flex;align-items:center;gap:6px")}>
                          <span style={S("width:7px;height:7px;border-radius:50%;background:#0B8F58;flex:none;animation:pulse-ring 1.6s ease-out infinite")}></span>
                          <span style={S("font-size:10.5px;color:#0B8F58;font-weight:700;white-space:nowrap")}>전액 정상 납입</span>
                        </div>
                      </div>
                      {(vm.paymentYearChips && vm.paymentYearChips.length > 1) && (<>
                        <div style={S("display:flex;gap:6px;padding:14px 20px 0")}>
                          {vm.paymentYearChips.map((y, $index) => (
                            <React.Fragment key={$index}>
                              <span style={S(`font-size:11px;font-weight:700;padding:6px 13px;border-radius:20px;cursor:pointer;white-space:nowrap;${y.active ? 'background:#0B8F58;color:#fff' : 'background:#F2F2F2;color:#666'}`)} onClick={y.onClick}>{y.year}년</span>
                            </React.Fragment>
                          ))}
                        </div>
                      </>)}
                      <div style={S("display:flex;padding:12px 20px 4px")}>
                        <span style={S("flex:1;font-size:9px;color:#AAA;font-weight:700")}>납입 연월</span>
                        <span style={S("flex:1;text-align:center;font-size:9px;color:#AAA;font-weight:700")}>결제 금액</span>
                        <span style={S("flex:1;text-align:right;font-size:9px;color:#AAA;font-weight:700")}>처리 상태</span>
                      </div>
                      <div style={S("padding:0 20px 8px")}>
                        {vm.paymentsVisible.map((p, $index) => (
                          <React.Fragment key={$index}>
                            <div className="receipt-row" style={S(`display:flex;align-items:center;padding:11px 0;margin:0 -20px;padding-left:20px;padding-right:20px;cursor:pointer;${$index > 0 ? 'border-top:1px dashed #EEE;' : ''}`)} onClick={() => vm.openPaymentDetail(p)}>
                              <span style={S("flex:1;font-size:11.5px;color:#555")}>{p.date}</span>
                              <span style={S("flex:1;text-align:center;font-size:12.5px;font-weight:800;color:#111")}>{p.amount}</span>
                              <span style={S("flex:1;text-align:right")}>
                                <span style={S("font-size:9.5px;font-weight:700;color:#0B8F58;background:rgba(11,143,88,0.1);padding:3px 9px;border-radius:20px;white-space:nowrap")}>{p.status}</span>
                              </span>
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                      {(vm.paymentsShowAll || vm.paymentsRemainCount > 0) && (<>
                        <div style={S("padding:0 20px 16px")}>
                          <div style={S("text-align:center;font-size:11px;font-weight:700;color:#0B8F58;background:rgba(11,143,88,0.08);border-radius:12px;padding:10px;cursor:pointer")} onClick={vm.togglePaymentsShowAll}>
                            {vm.paymentsShowAll ? '접기 ‹' : `더보기 (${vm.paymentsRemainCount}건) ›`}
                          </div>
                        </div>
                      </>)}
                    </>) : (
                      <div style={S("padding:18px")}>
                        {this.renderEmptyState(
                          <svg width="38" height="38" viewBox="0 0 44 44">
                            <rect x="9" y="7" width="26" height="30" rx="4" fill="#fff" stroke="#0B8F58" strokeWidth="2.2"></rect>
                            <line x1="15" y1="16" x2="29" y2="16" stroke="#CFE9DB" strokeWidth="2.4" strokeLinecap="round"></line>
                            <line x1="15" y1="22" x2="29" y2="22" stroke="#CFE9DB" strokeWidth="2.4" strokeLinecap="round"></line>
                            <line x1="15" y1="28" x2="23" y2="28" stroke="#CFE9DB" strokeWidth="2.4" strokeLinecap="round"></line>
                          </svg>,
                          '아직 결제 내역이 없어요',
                          '첫 보험료가 결제되면 월별 결제 내역이 여기에 표시돼요.',
                          { compact: true }
                        )}
                      </div>
                    )}
                  </div>
                  {!(vm.payments && vm.payments.length > 0) && (
                    <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:14px 16px;display:flex;align-items:center;gap:12px")}>
                      <div style={S("width:38px;height:38px;border-radius:10px;background:#E3F2EA;display:flex;align-items:center;justify-content:center;flex:none;font-size:18px")}>💳</div>
                      <div style={S("font-size:12.5px;color:#555;line-height:1.55")}>다음 결제 예정일은 <b style={S("color:#111")}>{vm.renewAt}</b>이에요. 결제 수단은 마이페이지에서 관리할 수 있어요.</div>
                    </div>
                  )}
                </>)}
                {/* AI 챗봇 화면은 아래 전용 채팅 오버레이(vm.homeIs.llm)로 렌더됩니다 */}
              </>)}
              {(vm.isMypage) && (<>
                {(vm.myIs.main) && (<>
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:14px 16px;display:flex;align-items:center;gap:12px")}>
                    <div style={S("width:46px;height:46px;border-radius:50%;flex:none;background:#0B8F58")}></div>
                    <div>
                      <div style={S("display:flex;align-items:center;gap:6px")}>
                        <span style={S("font-size:13px;font-weight:700;color:#111")}>{vm.studentName} 학생</span>
                        <span style={S("font-size:8.5px;font-weight:700;background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;padding:2px 8px;border-radius:20px")}>고3</span>
                      </div>
                      <div style={S("font-size:10px;color:#888;margin-top:2px")}>{vm.studentSchool} · 목표 {vm.studentTarget}</div>
                    </div>
                  </div>
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:15px 16px")}>
                    <div style={S("font-size:11.5px;font-weight:700;color:#111;margin-bottom:6px")}>내 성적 관리</div>
                    <div style={S("display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid #EEE")} onClick={vm.goStatusDetail}>
                      <span style={S("font-size:11.5px;color:#111;white-space:nowrap")}>성적 등록 상태</span>
                      <div style={S("display:flex;align-items:center;gap:4px;flex-shrink:0")}>
                        <span style={S(vm.gradeBadgeStyle)}>
                          {vm.gradeBadgeLabel}
                        </span>
                        <span style={S("color:#AAA")}>›</span>
                      </div>
                    </div>
                    <div style={S("display:flex;justify-content:space-between;align-items:center;padding:11px 0")} onClick={vm.goGradeHistory}>
                      <span style={S("font-size:11.5px;color:#111;white-space:nowrap")}>내 모의고사 성적 이력 보기</span>
                      <span style={S("color:#AAA;flex-shrink:0")}>›</span>
                    </div>
                  </div>
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:15px 16px")}>
                    <div style={S("font-size:11.5px;font-weight:700;color:#111;margin-bottom:6px")}>내 정보 관리</div>
                    <div style={S("display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid #EEE")} onClick={vm.goPayment}>
                      <span style={S("font-size:11.5px;color:#111;white-space:nowrap")}>결제수단 관리</span>
                      <span style={S("color:#AAA;flex-shrink:0")}>›</span>
                    </div>
                    <div style={S("display:flex;justify-content:space-between;align-items:center;padding:11px 0")} onClick={vm.goAddress}>
                      <span style={S("font-size:11.5px;color:#111;white-space:nowrap")}>주소 관리</span>
                      <span style={S("color:#AAA;flex-shrink:0")}>›</span>
                    </div>
                  </div>
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:15px 16px")}>
                    <div style={S("font-size:11.5px;font-weight:700;color:#111;margin-bottom:6px")}>기타</div>
                    <div style={S("display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid #EEE")} onClick={vm.goNotifSettings}>
                      <span style={S("font-size:11.5px;color:#111;white-space:nowrap")}>알림 설정</span>
                      <span style={S("color:#AAA;flex-shrink:0")}>›</span>
                    </div>
                    <div style={S("display:flex;justify-content:space-between;align-items:center;padding:11px 0")} onClick={vm.goTerms}>
                      <span style={S("font-size:11.5px;color:#111;white-space:nowrap")}>약관 및 정책</span>
                      <span style={S("color:#AAA;flex-shrink:0")}>›</span>
                    </div>
                  </div>
                  <div style={S("background:#fff;border:1px solid #E5E5E5;color:#C0304A;font-size:11.5px;font-weight:500;border-radius:16px;height:32px;flex:none;width:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:center")} onClick={vm.logout}>로그아웃</div>
                  <div style={S("text-align:center;font-size:8.5px;color:#AAA;line-height:1.5;margin-top:2px")}>고객센터 1588-2410 · 평일 9시~18시</div>
                </>)}
                {(vm.myIs.notifSettings) && (<>
                  <div style={S("display:flex;align-items:center;gap:6px")} onClick={vm.backMy}>
                    <span style={S("font-size:15px;color:#555")}>‹</span>
                    <span style={S("font-size:11px;color:#555")}>뒤로</span>
                  </div>
                  <div style={S("font-size:12.5px;font-weight:700;color:#111")}>알림 설정</div>
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:20px;padding:4px 14px")}>
                    {(vm.notifSettingRows || []).map((n, $index) => (
                      <React.Fragment key={$index}>
                        <div style={S("display:flex;justify-content:space-between;align-items:center;padding:13px 0;border-bottom:1px solid #F0F0F0")}>
                          <span style={S("font-size:11.5px;color:#111")}>
                            {n.label}
                          </span>
                          <div style={S(n.toggleStyle)} onClick={n.onClick}>
                            <div style={S(n.knobStyle)}></div>
                          </div>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </>)}
                {(vm.myIs.terms) && (<>
                  <div style={S("display:flex;align-items:center;gap:6px")} onClick={vm.backMy}>
                    <span style={S("font-size:15px;color:#555")}>‹</span>
                    <span style={S("font-size:11px;color:#555")}>뒤로</span>
                  </div>
                  <div style={S("font-size:14px;font-weight:700;color:#111")}>보험상품 약관</div>
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:20px;padding:16px;font-size:11px;color:#555;line-height:1.8")}>
                    <b style={S("color:#111")}>제1조 (목적)</b>
                    <br />
                    이 약관은 회사가 제공하는 '재수없수 스탠다드' 보험상품(이하 "이 계약")의 체결과 이행에 관한 회사와 계약자, 피보험자 간의 권리와 의무를 정함을 목적으로 합니다.
                    <br />
                    <br />
                    <b style={S("color:#111")}>제2조 (보장 내용)</b>
                    <br />
                    피보험자가 대학수학능력시험 응시 결과 평소 예상 범위보다 15점을 초과하여 하락하고, 이로 인해 재수를 하게 되는 경우 회사는 연간 재수 비용의 최대 70%, 최대 1,500만원 한도 내에서 보험금을 지급합니다.
                    <br />
                    <br />
                    <b style={S("color:#111")}>제3조 (보험료의 산정)</b>
                    <br />
                    월 보험료는 가입 시점의 성적 데이터, 성적 변동성, 재수 가능성 등을 종합적으로 반영하여 산정되며, 매월 갱신 시 최근 확정 성적을 기준으로 재산정됩니다.
                    <br />
                    <br />
                    <b style={S("color:#111")}>제4조 (면책 사항)</b>
                    <br />
                    성적표의 위조·변조 또는 허위 제출이 확인되는 경우, 회사는 보험금을 지급하지 않으며 이미 지급된 보험금을 환수할 수 있습니다.
                    <br />
                    <br />
                    <span style={S("color:#AAA;font-size:10px")}>본 내용은 임시 예시이며, 실제 약관은 상품 설명서 및 계약서를 따릅니다.</span>
                  </div>
                </>)}
                {(vm.myIs.payment) && (<>
                  <div style={S("display:flex;align-items:center;gap:6px")} onClick={vm.backMy}>
                    <span style={S("font-size:15px;color:#555")}>‹</span>
                    <span style={S("font-size:11px;color:#555")}>뒤로</span>
                  </div>
                  <div style={S("font-size:12.5px;font-weight:700;color:#111")}>결제수단 관리</div>
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:20px;padding:14px;display:flex;justify-content:space-between;align-items:center")}>
                    <div>
                      <div style={S("font-size:11.5px;font-weight:700;color:#111")}>신한카드 (개인)</div>
                      <div style={S("font-size:10px;color:#888;margin-top:2px")}>•••• 4821 · 매월 자동이체</div>
                    </div>
                    <span style={S("font-size:9px;font-weight:700;color:#fff;background:#0B8F58;padding:3px 8px;border-radius:20px")}>기본</span>
                  </div>
                  <div style={S("background:#fff;border:1px dashed #DDD;color:#555;font-size:11px;border-radius:16px;height:46px;display:flex;align-items:center;justify-content:center")}>+ 새 결제수단 추가</div>
                </>)}
                {(vm.myIs.address) && (<>
                  <div style={S("display:flex;align-items:center;gap:6px")} onClick={vm.backMy}>
                    <span style={S("font-size:15px;color:#555")}>‹</span>
                    <span style={S("font-size:11px;color:#555")}>뒤로</span>
                  </div>
                  <div style={S("font-size:12.5px;font-weight:700;color:#111")}>주소 관리</div>
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:20px;padding:14px")}>
                    <div style={S("display:flex;justify-content:space-between;align-items:center")}>
                      <span style={S("font-size:11.5px;font-weight:700;color:#111")}>집</span>
                      <span style={S("font-size:9px;font-weight:700;color:#fff;background:#0B8F58;padding:3px 8px;border-radius:20px")}>기본</span>
                    </div>
                    <div style={S("font-size:10.5px;color:#555;margin-top:6px")}>서울특별시 강남구 테헤란로 123, 101동 1004호</div>
                  </div>
                  <div style={S("background:#fff;border:1px dashed #DDD;color:#555;font-size:11px;border-radius:16px;height:46px;display:flex;align-items:center;justify-content:center")}>+ 새 주소 추가</div>
                </>)}
                {(vm.myIs.statusDetail) && (<>
                  <div style={S("display:flex;align-items:center;gap:6px")} onClick={vm.backMy}>
                    <span style={S("font-size:15px;color:#555")}>‹</span>
                    <span style={S("font-size:11px;color:#555")}>뒤로</span>
                  </div>
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:15px 16px")}>
                    <div style={S("display:flex;justify-content:space-between;align-items:center")}>
                      <span style={S("font-size:12px;font-weight:700;color:#111")}>현재 상태</span>
                      <span style={S(vm.gradeBadgeStyle)}>
                        {vm.gradeBadgeLabel}
                      </span>
                    </div>
                    <div style={S("font-size:10.5px;color:#555;line-height:1.6;margin-top:8px")}>
                      {vm.gradeStateDesc}
                    </div>
                  </div>
                  <div style={S("font-size:11.5px;font-weight:700;color:#111")}>상태 히스토리</div>
                  {(vm.statusHistory || []).map((h, $index) => (
                    <React.Fragment key={$index}>
                      <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:20px;padding:12px 14px")}>
                        <div style={S("display:flex;justify-content:space-between;align-items:baseline")}>
                          <span style={S("font-size:11px;font-weight:700;color:#111")}>
                            {h.label}
                          </span>
                          <span style={S("font-size:8.5px;color:#AAA")}>
                            {h.date}
                          </span>
                        </div>
                        <div style={S("font-size:10px;color:#555;line-height:1.5;margin-top:4px")}>
                          {h.desc}
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                </>)}
                {(vm.myIs.gradeHistory) && (<>
                  <div style={S("display:flex;align-items:center;gap:6px")} onClick={vm.backMy}>
                    <span style={S("font-size:15px;color:#555")}>‹</span>
                    <span style={S("font-size:11px;color:#555")}>뒤로</span>
                  </div>
                  <div style={S("background:rgba(11,143,88,0.08);border:1px solid rgba(11,143,88,0.18);border-radius:22px;padding:15px 16px")}>
                    <div style={S("font-size:11.5px;font-weight:700;color:#111")}>최근 모의고사 성적</div>
                    <div style={S("font-size:10.5px;color:#333;margin-top:8px")}>
                      {vm.recentGradesText}
                    </div>
                  </div>
                  <div style={S("display:flex;align-items:center;justify-content:space-between;gap:8px")}>
                    <span style={S("font-size:11.5px;font-weight:700;color:#111")}>모의고사 히스토리</span>
                    {(vm.examHistory && vm.examHistory.length > 0) && (<>
                      <div style={S("display:flex;gap:6px;flex:none")}>
                        <span style={S("font-size:9.5px;font-weight:700;color:#0B8F58;background:rgba(11,143,88,0.1);border:1px solid rgba(11,143,88,0.3);border-radius:20px;padding:4px 9px;white-space:nowrap;cursor:pointer")} onClick={vm.toggleExamSort}>
                          {vm.examSortDesc ? '최근순' : '과거순'}
                        </span>
                        <span style={S("font-size:9.5px;font-weight:700;color:#555;background:#F2F2F2;border:1px solid #E5E5E5;border-radius:20px;padding:4px 9px;white-space:nowrap;cursor:pointer")} onClick={vm.toggleAllExams}>
                          {vm.examAllOpen ? '전체 접기' : '전체 펼치기'}
                        </span>
                      </div>
                    </>)}
                  </div>
                  {(vm.examHistory && vm.examHistory.length > 0) ? (vm.examHistory.map((ex, $index) => {
                    const open = !!vm.examOpen[ex.label];
                    const pd = ex.percentileDiff;
                    const pdColor = (pd == null || pd === 0) ? '#999' : (pd > 0 ? '#0B8F58' : '#C0304A');
                    const pdText = pd == null ? '' : (pd === 0 ? '－' : (pd > 0 ? `▲${pd}` : `▼${-pd}`));
                    return (
                    <React.Fragment key={$index}>
                      <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:18px")}>
                        <div style={S("display:flex;align-items:center;gap:10px;padding:13px 14px;cursor:pointer")} onClick={() => vm.toggleExamOpen(ex.label)}>
                          <div style={S("flex:1;min-width:0")}>
                            <div style={S("font-size:12px;font-weight:700;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{ex.label}</div>
                            <div style={S("font-size:9.5px;color:#999;margin-top:2px")}>{ex.date}</div>
                          </div>
                          <div style={S("text-align:right;flex:none;white-space:nowrap")}>
                            <span style={S("font-size:12.5px;font-weight:800;color:#111")}>백분위 {ex.percentile}</span>
                            {(pdText) && (<span style={S(`font-size:10.5px;font-weight:700;color:${pdColor};margin-left:5px`)}>{pdText}</span>)}
                          </div>
                          <span style={S(`font-size:12px;color:#AAA;flex:none;transition:transform .2s ease;transform:rotate(${open ? 90 : 0}deg)`)}>›</span>
                        </div>
                        <div style={S(`display:grid;grid-template-rows:${open ? '1fr' : '0fr'};opacity:${open ? 1 : 0};transition:grid-template-rows .3s ease, opacity .25s ease`)}>
                          <div style={S("overflow:hidden;min-height:0")}>
                            <div style={S("display:flex;gap:8px;padding:0 14px 14px;flex-wrap:wrap")}>
                              {ex.subjects.map((sub, si) => {
                                const gd = sub.gradeDiff;
                                const up = gd != null && gd < 0;
                                const down = gd != null && gd > 0;
                                const bg = up ? '#E4F5EC' : (down ? '#FCE9EC' : '#EDEDED');
                                const ink = up ? '#0B7A4A' : (down ? '#C0304A' : '#666');
                                const gradeArrow = up ? ' ▲' : (down ? ' ▼' : '');
                                return (
                                  <React.Fragment key={si}>
                                    <div style={S(`flex:1;min-width:74px;background:${bg};border-radius:14px;padding:10px;text-align:center`)}>
                                      <div style={S("font-size:9.5px;color:#888;font-weight:700")}>{sub.name}</div>
                                      <div style={S(`font-size:15px;font-weight:800;color:${ink};margin-top:4px`)}>{sub.score}<span style={S("font-size:10px;font-weight:700")}>점</span></div>
                                      <div style={S(`font-size:11px;font-weight:800;color:${ink};margin-top:3px`)}>{sub.grade}등급{gradeArrow}</div>
                                    </div>
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                    );
                  })) : this.renderEmptyState(
                    <svg width="64" height="64" viewBox="0 0 64 64">
                      <rect x="14" y="8" width="36" height="48" rx="6" fill="#fff" stroke="#0B8F58" strokeWidth="2.4"></rect>
                      <rect x="20" y="15" width="18" height="3.6" rx="1.8" fill="#CFE9DB"></rect>
                      <rect x="20" y="22" width="11" height="3" rx="1.5" fill="#E3F2EA"></rect>
                      <line x1="19" y1="48" x2="45" y2="48" stroke="#E3F2EA" strokeWidth="2" strokeLinecap="round"></line>
                      <rect x="21" y="41" width="4.6" height="7" rx="1.5" fill="#CFE9DB"></rect>
                      <rect x="27.7" y="37" width="4.6" height="11" rx="1.5" fill="#CFE9DB"></rect>
                      <rect x="34.4" y="39" width="4.6" height="9" rx="1.5" fill="#CFE9DB"></rect>
                      <rect x="41.1" y="33" width="4.6" height="15" rx="1.5" fill="#0B8F58"></rect>
                    </svg>,
                    '아직 등록된 성적이 없어요',
                    '모의고사를 본 후 자동으로 업데이트돼요'
                  )}
                </>)}
                {(vm.myIs.scan) && (<>
                  <div style={S("display:flex;align-items:center;gap:6px")} onClick={vm.backMy}>
                    <span style={S("font-size:15px;color:#555")}>‹</span>
                    <span style={S("font-size:11px;color:#555")}>뒤로</span>
                  </div>
                  <div style={S("flex:1;display:flex;flex-direction:column;justify-content:center;gap:16px;min-height:520px")}>
                    <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:16px;text-align:center")}>
                      <div style={S("font-size:31px")}>📷</div>
                      <div style={S("font-size:12.5px;font-weight:700;color:#111;margin-top:8px")}>성적표를 스캔해 주세요</div>
                      <div style={S("font-size:10px;color:#888;margin-top:6px")}>밝은 곳에서 성적표 전체가 보이도록 촬영하세요.</div>
                    </div>
                    <div style={S("display:flex;flex-direction:column;gap:8px")}>
                      <div style={S("background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:12px;font-weight:700;border-radius:16px;height:48px;display:flex;align-items:center;justify-content:center")} onClick={vm.goAnalyzing}>카메라로 촬영</div>
                      <div style={S("background:#fff;border:1px solid #E5E5E5;color:#555;font-size:11px;border-radius:16px;height:44px;display:flex;align-items:center;justify-content:center")} onClick={vm.goAnalyzing}>갤러리에서 선택</div>
                    </div>
                    <div style={S("background:#fff;border:1px solid #E2E2E2;border-left:4px solid #D9534F;border-radius:16px;padding:12px 14px")}>
                      <div style={S("font-size:10px;color:#C0304A;line-height:1.6")}>⚠ 성적표를 사실과 다르게 조작하여 제출하면 계약 해지·보험금 미지급 등 불이익이 발생할 수 있어요.</div>
                      <div style={S("font-size:9.5px;font-weight:700;color:#C0304A;margin-top:6px")} onClick={vm.openScanWarning}>자세히 보기 ›</div>
                    </div>
                  </div>
                </>)}
                {(vm.myIs.analyzing) && (<>
                  <div style={S("display:flex;align-items:center;gap:6px")} onClick={vm.backMy}>
                    <span style={S("font-size:15px;color:#555")}>‹</span>
                    <span style={S("font-size:11px;color:#555")}>뒤로</span>
                  </div>
                  <div style={S("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-height:300px")}>
                    <div style={S("width:40px;height:40px;border-radius:50%;border:3px solid #E5E5E5;border-top-color:#0B8F58;animation:spin 0.9s linear infinite")}></div>
                    <div style={S("font-size:11.5px;color:#555")}>성적표를 분석하고 있어요 · 약 10초 소요</div>
                  </div>
                </>)}
                {(vm.myIs.result) && (<>
                  <div style={S("display:flex;align-items:center;gap:6px")} onClick={vm.backMy}>
                    <span style={S("font-size:15px;color:#555")}>‹</span>
                    <span style={S("font-size:11px;color:#555")}>뒤로</span>
                  </div>
                  <div style={S("font-size:12.5px;font-weight:700;color:#111")}>OCR 결과 확인</div>
                  {(vm.ocrRows || []).map((row, $index) => (
                    <React.Fragment key={$index}>
                      <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:20px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center")}>
                        <div>
                          <div style={S("font-size:11.5px;font-weight:700;color:#111")}>
                            {row.name}
                          </div>
                          <div style={S("font-size:10px;color:#888;margin-top:2px")}>
                            {row.grade}등급 · 표준점수 {row.score} · 백분위 {row.percentile}
                          </div>
                        </div>
                        <span style={S(row.badgeStyle)}>
                          {row.badgeLabel}
                        </span>
                      </div>
                    </React.Fragment>
                  ))}
                  <div style={S("display:flex;flex-direction:column;gap:8px")}>
                    <div style={S("background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:12px;font-weight:700;border-radius:16px;height:48px;display:flex;align-items:center;justify-content:center")} onClick={vm.confirmGrades}>확인 완료</div>
                    <div style={S("background:#fff;border:1px solid #E5E5E5;color:#555;font-size:11px;border-radius:16px;height:44px;display:flex;align-items:center;justify-content:center")} onClick={vm.goAppeal}>이 결과가 다른 것 같아요</div>
                  </div>
                </>)}
                {(vm.myIs.appeal) && (<>
                  <div style={S("display:flex;align-items:center;gap:6px")} onClick={vm.backMy}>
                    <span style={S("font-size:15px;color:#555")}>‹</span>
                    <span style={S("font-size:11px;color:#555")}>뒤로</span>
                  </div>
                  <div style={S("font-size:12.5px;font-weight:700;color:#111")}>이의신청</div>
                  <div>
                    <div style={S("font-size:11px;font-weight:700;color:#111")}>대상 과목</div>
                    <div style={S("display:flex;gap:6px;flex-wrap:wrap;margin-top:8px")}>
                      {(vm.appealSubjectChips || []).map((c, $index) => (
                        <React.Fragment key={$index}>
                          <div style={S(c.style)} onClick={c.onClick}>
                            {c.label}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={S("font-size:11px;font-weight:700;color:#111")}>이의 사유</div>
                    <div style={S("display:flex;gap:6px;flex-wrap:wrap;margin-top:8px")}>
                      {(vm.appealReasonChips || []).map((c, $index) => (
                        <React.Fragment key={$index}>
                          <div style={S(c.style)} onClick={c.onClick}>
                            {c.label}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={S("font-size:11px;font-weight:700;color:#111")}>상세 사유</div>
                    <textarea placeholder="어떤 부분이 다른지 적어주세요" style={S("width:100%;height:70px;margin-top:8px;border:1px solid #E5E5E5;border-radius:16px;padding:10px;font-size:10.5px;font-family:inherit;resize:none;box-sizing:border-box")}></textarea>
                  </div>
                  <div style={S("border:1.5px dashed #DDD;border-radius:16px;height:64px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#AAA")}>증빙 이미지 첨부 (선택)</div>
                  <div style={S("background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:12px;font-weight:700;border-radius:16px;height:48px;display:flex;align-items:center;justify-content:center")} onClick={vm.submitAppeal}>제출</div>
                </>)}
              </>)}
            </div>
            {(vm.isHome && vm.homeIs.llm) && (<>
              <div style={S("position:absolute;left:0;right:0;top:62px;bottom:0;background:#EAF6EC;z-index:16;display:flex;flex-direction:column")}>
                <div style={S("flex:none;padding:10px 14px;border-bottom:1px solid #E6E6E6;background:#fff;display:flex;align-items:center;gap:9px")}>
                  <span style={S("font-size:19px;color:#555;cursor:pointer;flex:none")} onClick={vm.backLlm}>‹</span>
                  <div style={S("width:40px;height:40px;border-radius:50%;background:#E4F0EA;display:flex;align-items:center;justify-content:center;flex:none;overflow:hidden")}>
                    <img src={IMG_F7F53234} alt="노재수" style={S("width:32px;height:32px;object-fit:contain")} />
                  </div>
                  <div style={S("flex:1;min-width:0")}>
                    <div style={S("font-size:14px;font-weight:800;color:#111")}>노재수</div>
                    <div style={S("font-size:9px;color:#0B8F58;font-weight:700")}>● 약관 문서를 보고 답해드려요</div>
                  </div>
                </div>
                <div style={S("flex:none;padding:9px 12px;border-bottom:1px solid #E6E6E6;background:#fff")}>
                  <div style={S("font-size:9px;color:#888;margin-bottom:6px")}>💬 추천 질문</div>
                  <div className="reco-scroll" style={S("display:flex;gap:6px;overflow-x:auto;padding-bottom:2px")}>
                    {(vm.llmChips || []).map((c, $index) => (
                      <React.Fragment key={$index}>
                        <div style={S("flex:none;font-size:10.5px;font-weight:600;padding:8px 13px;border-radius:24px;border:1px solid #EAD289;background:#FFF8DE;color:#8A6D1A;cursor:pointer;white-space:nowrap")} onClick={c.onClick}>
                          {c.label}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <div ref={this.chatScrollRef} style={S("flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px")}>
                  {(vm.llmMessages || []).map((m, $index) => (
                    <React.Fragment key={$index}>
                      {(m.role === 'user') ? (
                        <div style={S("align-self:flex-end;max-width:80%;background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;border-radius:22px 16px 4px 16px;padding:10px 13px;font-size:14px;line-height:1.6;white-space:pre-line;word-break:keep-all;text-align:justify")}>
                          {m.text}
                        </div>
                      ) : (
                        <div style={S("align-self:flex-start;max-width:88%;display:flex;gap:7px;align-items:flex-start;animation:riseIn 0.4s ease-out")}>
                          <div style={S("width:30px;height:30px;border-radius:50%;background:#E4F0EA;flex:none;display:flex;align-items:center;justify-content:center;margin-top:2px;overflow:hidden")}>
                            <img src={IMG_F7F53234} alt="노재수" style={S("width:24px;height:24px;object-fit:contain")} />
                          </div>
                          <div style={S("background:#fff;border:1px solid #E6E6E6;border-radius:4px 16px 16px 16px;padding:11px 13px;font-size:14px;color:#333;line-height:1.75;word-break:keep-all;text-align:justify")}>
                            {m.greeting ? (
                              <div style={S("white-space:pre-line;word-break:keep-all")}>
                                {m.text.split('No')[0]}
                                <img src={IMG_NO} alt="No" style={S("height:40px;vertical-align:-11px;display:inline-block")} />
                                {m.text.split('No')[1]}
                              </div>
                            ) : this.renderRich(m.text)}
                            {(m.pages && m.pages.length > 0) && (<>
                              <div style={S("margin-top:8px;border-top:1px dashed #E0E0E0;padding-top:6px;display:flex;align-items:center;flex-wrap:wrap;gap:4px")}>
                                <span style={S("font-size:9.5px;color:#0B8F58;font-weight:700")}>📄 근거</span>
                                {m.pages.map((pg, pi) => (
                                  <React.Fragment key={pi}>
                                    <span onClick={() => vm.openPolicy(m.pages, pg)} style={S("font-size:9.5px;font-weight:800;color:#0B8F58;background:rgba(11,143,88,0.1);border:1px solid rgba(11,143,88,0.28);border-radius:20px;padding:2px 8px;cursor:pointer")}>약관 p.{pg}</span>
                                  </React.Fragment>
                                ))}
                                <span style={S("font-size:8.5px;color:#9AA6A0")}>· 클릭하면 원문 보기</span>
                              </div>
                            </>)}
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                  {(vm.llmLoading) && (<>
                    <div style={S("align-self:flex-start;width:100%;position:relative;height:56px;overflow:hidden")}>
                      {this.chatLoadingFootprints.map((p, i) => (
                        <img key={i} src={IMG_PAW} alt="" style={S(`position:absolute;left:${p}%;bottom:10px;width:11px;height:11px;object-fit:contain;opacity:0;animation:su-fp-${i + 1} 1.6s linear infinite`)} />
                      ))}
                      <div style={S("position:absolute;bottom:0;width:30px;height:30px;animation:su-walk-x-chat 1.6s linear infinite, su-char-fade 1.6s linear infinite")}>
                        <img src={IMG_F7F53234} alt="노재수" style={S("width:100%;height:100%;object-fit:contain;animation:su-hop 0.25s ease-in-out infinite")} />
                      </div>
                    </div>
                  </>)}
                </div>
                <div style={S("flex:none;padding:10px 12px;border-top:1px solid #E6E6E6;background:#fff;display:flex;gap:8px;align-items:flex-end")}>
                  <textarea
                    ref={this.chatInputRef}
                    value={vm.llmInput}
                    onChange={e => { vm.onLlmInput(e); this.autosizeChatInput(); }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); vm.submitLlm(); } }}
                    placeholder="궁금한 점을 입력해 보세요"
                    rows={1}
                    style={S("flex:1;min-width:0;overflow:hidden;resize:none;border:1px solid #E0E0E0;border-radius:18px;padding:11px 16px;font-size:11.5px;color:#111;outline:none;background:#F7F7F7;font-family:inherit;line-height:1.5")}
                  />
                  <div style={S("background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none")} onClick={vm.submitLlm}>
                    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5"></line>
                      <polyline points="6 11 12 5 18 11"></polyline>
                    </svg>
                  </div>
                </div>
              </div>
            </>)}
            {(vm.showAiFab) && (<>
              <div style={S("position:absolute;left:18px;right:18px;bottom:82px;z-index:10;display:flex;justify-content:flex-end")} onClick={vm.goLlm}>
                <div style={S("display:inline-flex;align-items:center;gap:10px;background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;border-radius:24px 24px 6px 24px;padding:12px 16px;box-shadow:0 8px 20px rgba(11,143,88,0.4);cursor:pointer;max-width:100%")}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={S("flex:none")}>
                    <rect x="5" y="9" width="14" height="11" rx="3"></rect>
                    <line x1="12" y1="5" x2="12" y2="9"></line>
                    <circle cx="12" cy="4" r="1.3" fill="#fff" stroke="none"></circle>
                    <circle cx="9" cy="14.5" r="1.4" fill="#fff" stroke="none"></circle>
                    <circle cx="15" cy="14.5" r="1.4" fill="#fff" stroke="none"></circle>
                    <line x1="9" y1="18" x2="15" y2="18"></line>
                  </svg>
                  <span style={S("font-size:13px;font-weight:500;line-height:1.35;word-break:keep-all")}>보험료 산정 근거와 약관을 설명해드릴게요!</span>
                </div>
              </div>
            </>)}
            {(vm.quadrantModalOpen) && (<>
              <div style={S("position:absolute;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:flex-end;z-index:20")} onClick={vm.closeQuadrantModal}>
                <div style={S("background:#fff;border-radius:20px 20px 0 0;padding:20px 20px 28px;width:100%;max-height:75%;overflow-y:auto")} onClick={vm.stopClick}>
                  <div style={S("width:36px;height:4px;border-radius:4px;background:#E5E5E5;margin:0 auto 14px")}></div>
                  <div style={S("font-size:17px;font-weight:800;color:#111")}>우리 아이 과목, 한눈에 보기</div>
                  <div style={S("display:flex;flex-direction:column;gap:10px;margin-top:14px")}>
                    <div style={S("background:#F5C6CB;border-radius:16px;padding:10px 14px 12px;display:flex;flex-direction:column;align-items:flex-start")}>
                      <div style={S("font-size:9.5px;font-weight:700;color:#C0304A;background:#fff;padding:2px 6px;border-radius:20px")}>🚨 가장 먼저 챙겨요 · 국어·탐구</div>
                      <div style={S("font-size:11.5px;color:#555;margin-top:5px;line-height:1.5")}>점수도 아쉽고 시험마다 달라요. 공부 1순위!</div>
                    </div>
                    <div style={S("background:#F5DDA8;border-radius:16px;padding:10px 14px 12px;display:flex;flex-direction:column;align-items:flex-start")}>
                      <div style={S("font-size:9.5px;font-weight:700;color:#B45309;background:#fff;padding:2px 6px;border-radius:20px")}>⚠️ 당일이 걱정돼요 · 수학</div>
                      <div style={S("font-size:11.5px;color:#555;margin-top:5px;line-height:1.5")}>실력은 좋은데 그날그날 달라요. 수능 당일 위험 1순위!</div>
                    </div>
                    <div style={S("background:#E0E0E0;border-radius:16px;padding:10px 14px 12px;display:flex;flex-direction:column;align-items:flex-start")}>
                      <div style={S("font-size:9.5px;font-weight:700;color:#666;background:#fff;padding:2px 6px;border-radius:20px")}>🌱 차근차근 올려요</div>
                      <div style={S("font-size:11.5px;color:#888;margin-top:5px;line-height:1.5")}>해당 과목 없음</div>
                    </div>
                    <div style={S("background:#A9E2C0;border-radius:16px;padding:10px 14px 12px;display:flex;flex-direction:column;align-items:flex-start")}>
                      <div style={S("font-size:9.5px;font-weight:700;color:#0B8F58;background:#fff;padding:2px 6px;border-radius:20px")}>💪 우리 아이 강점 · 영어</div>
                      <div style={S("font-size:11.5px;color:#555;margin-top:5px;line-height:1.5")}>점수도 좋고 꾸준해요. 지금처럼만!</div>
                    </div>
                  </div>
                  <div style={S("background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:14px;font-weight:700;border-radius:16px;height:50px;display:flex;align-items:center;justify-content:center;margin-top:18px")} onClick={vm.closeQuadrantModal}>확인했어요</div>
                </div>
              </div>
            </>)}
            {(vm.discountModalOpen) && (<>
              <div style={S("position:absolute;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:flex-end;z-index:20")} onClick={vm.closeModals}>
                <div style={S("background:#fff;border-radius:20px 20px 0 0;padding:20px 20px 28px;width:100%;max-height:70%;overflow-y:auto")} onClick={vm.stopClick}>
                  <div style={S("width:36px;height:4px;border-radius:4px;background:#E5E5E5;margin:0 auto 14px")}></div>
                  <div style={S("font-size:17px;font-weight:800;color:#111")}>📊 보험료를 줄이려면 어떻게 하면 좋을까?</div>
                  <div style={S("font-size:14px;font-weight:700;color:#111;margin-top:14px")}>수학 변동성 관리 필요</div>
                  <div style={S("font-size:12.5px;color:#333;line-height:1.6;margin-top:8px")}>최근 확정 모의고사에서 수학 성적의 변동폭이 크게 나타났어요. 다음 재산정 전까지 성적 흐름이 안정되면 보험료에 긍정적으로 반영될 수 있어요.</div>
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:16px;padding:12px 14px;margin-top:14px;font-size:12px;color:#333;line-height:1.8")}>
                    <div style={S("font-weight:700;color:#111;margin-bottom:2px")}>근거</div>
                    <div>• 최근 확정 모의고사</div>
                    <div>• 보험료 영향요인 : 성적 취약성</div>
                    <div>
                      • 다음 반영 시점 : {vm.renewAt}
                    </div>
                  </div>
                  <div style={S("font-size:10.5px;color:#999;line-height:1.6;margin-top:12px")}>※ 보험료 인하는 확정이 아니며 다음 재산정 시점의 확정 성적과 전체 산정 기준에 따라 달라질 수 있어요.</div>
                  <div style={S("background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:14px;font-weight:700;border-radius:16px;height:50px;display:flex;align-items:center;justify-content:center;margin-top:18px")} onClick={vm.closeModals}>확인했어요</div>
                </div>
              </div>
            </>)}
            {(vm.coverageModalOpen) && (<>
              <div style={S("position:absolute;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:flex-end;z-index:20")} onClick={vm.closeModals}>
                <div style={S("background:#fff;border-radius:20px 20px 0 0;padding:20px 20px 28px;width:100%;max-height:75%;overflow-y:auto")} onClick={vm.stopClick}>
                  <div style={S("width:36px;height:4px;border-radius:4px;background:#E5E5E5;margin:0 auto 14px")}></div>
                  <div style={S("font-size:17px;font-weight:800;color:#111;display:flex;align-items:center;gap:8px")}>
                    <img src={IMG_F7F53234} alt="" style={S("width:22px;height:22px;object-fit:contain")} />
                    내가 받을 수 있는 보험금은 얼마일까?
                  </div>
                  <div style={S("font-size:12.5px;color:#555;line-height:1.6;margin-top:12px")}>
                    재수하게 되면 연간 재수 비용의 최대 
                    <b>70%, 최대 1,500만원</b>
                    까지 보장돼요. 평소 예상 범위보다 15점 넘게 떨어져 재수하게 되는 경우가 대상이에요.
                  </div>
                  <div style={S("font-size:14px;font-weight:700;color:#111;margin-top:18px")}>재수 형태별 월 보장 한도</div>
                  {(vm.coverageByForm || []).map((c, $index) => (
                    <React.Fragment key={$index}>
                      <div style={S("display:flex;justify-content:space-between;font-size:12.5px;padding:10px 0;border-bottom:1px solid #F0F0F0")}>
                        <span style={S("color:#555")}>
                          {c.name}
                        </span>
                        <span style={S("font-weight:700;color:#111")}>
                          월 {c.capLabel} · 현물 {c.voucherPct}%+현금 {c.cashPct}%
                        </span>
                      </div>
                    </React.Fragment>
                  ))}
                  <div style={S("font-size:10.5px;color:#999;line-height:1.6;margin-top:14px")}>보장률·한도는 가입하신 스탠다드 약관 기준이며, 실제 지급 금액은 인수 조건·제휴 학원 계약 상태에 따라 달라질 수 있어요.</div>
                  <div style={S("background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:14px;font-weight:700;border-radius:16px;height:50px;display:flex;align-items:center;justify-content:center;margin-top:18px")} onClick={vm.closeModals}>확인했어요</div>
                </div>
              </div>
            </>)}
            {(vm.scanWarningOpen) && (<>
              <div style={S("position:absolute;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:25")} onClick={vm.closeScanWarning}>
                <div style={S("background:#fff;border-radius:24px;padding:22px 20px;width:85%;max-height:70%;overflow-y:auto")} onClick={vm.stopClick}>
                  <div style={S("font-size:14px;font-weight:800;color:#111")}>성적표 조작 시 불이익 안내</div>
                  <div style={S("font-size:10.5px;color:#555;line-height:1.7;margin-top:12px")}>
                    <div>
                      • 성적표를 위조·변조하거나 사실과 다르게 제출하는 경우, 보험사기방지 특별법에 따라 
                      <b>보험사기죄로 형사 고발</b>
                      될 수 있어요.
                    </div>
                    <div style={S("margin-top:8px")}>
                      • 확인 완료 후 위·변조 사실이 드러나면 
                      <b>보험 계약이 해지</b>
                      되고 
                      <b>이미 지급된 보험금은 환수</b>
                      될 수 있어요.
                    </div>
                    <div style={S("margin-top:8px")}>
                      • 향후 재가입이 제한되거나 
                      <b>가입 이력에 불이익 정보로 등록</b>
                      될 수 있어요.
                    </div>
                    <div style={S("margin-top:8px")}>• 이의신청 과정에서도 동일한 기준이 적용되며, 허위 이의신청 역시 같은 불이익 대상이에요.</div>
                  </div>
                  <div style={S("background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:12px;font-weight:700;border-radius:16px;height:46px;display:flex;align-items:center;justify-content:center;margin-top:16px")} onClick={vm.closeScanWarning}>확인했어요</div>
                </div>
              </div>
            </>)}
            {(vm.paymentDetailView) && (<>
              <div style={S("position:absolute;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:25")} onClick={vm.closePaymentDetail}>
                <div style={S("background:#fff;border-radius:24px;padding:22px 20px;width:85%;max-height:80%;overflow-y:auto")} onClick={vm.stopClick}>
                  <div style={S("display:flex;align-items:center;justify-content:space-between")}>
                    <div style={S("display:flex;align-items:center;gap:9px")}>
                      <div style={S("width:32px;height:32px;border-radius:10px;background:rgba(11,143,88,0.1);display:flex;align-items:center;justify-content:center;flex:none")}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0B8F58" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="3" width="12" height="18" rx="2"></rect><line x1="9" y1="8" x2="15" y2="8"></line><line x1="9" y1="12" x2="15" y2="12"></line><line x1="9" y1="16" x2="12" y2="16"></line></svg>
                      </div>
                      <span style={S("font-size:14.5px;font-weight:800;color:#111")}>납입 상세 정보</span>
                    </div>
                    <span style={S("font-size:18px;color:#999;cursor:pointer")} onClick={vm.closePaymentDetail}>✕</span>
                  </div>
                  <div style={S("border-top:1px solid #F0F0F0;margin-top:14px")}></div>
                  <div style={S("background:#FAFAFA;border-radius:18px;padding:20px 16px;margin-top:16px;text-align:center")}>
                    <span style={S("font-size:10.5px;font-weight:700;color:#0B8F58;background:rgba(11,143,88,0.1);padding:4px 11px;border-radius:20px")}>{vm.paymentDetailView.date}</span>
                    <div style={S("font-size:25px;font-weight:900;color:#111;margin-top:12px")}>{vm.paymentDetailView.amount}</div>
                    <div style={S("display:flex;align-items:center;justify-content:center;gap:5px;margin-top:8px")}>
                      <span style={S("width:16px;height:16px;border-radius:50%;background:#0B8F58;display:flex;align-items:center;justify-content:center;flex:none")}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </span>
                      <span style={S("font-size:12px;font-weight:700;color:#0B8F58")}>정상 완납</span>
                    </div>
                  </div>
                  <div style={S("display:flex;flex-direction:column;margin-top:6px")}>
                    {[
                      { label: '승인번호', value: vm.paymentDetailView.approvalNo },
                      { label: '결제 일시', value: vm.paymentDetailView.paidAt },
                      { label: '결제 수단', value: vm.paymentDetailView.method },
                      { label: '공급가액', value: vm.paymentDetailView.supplyAmountLabel },
                      { label: '부가가치세 (10%)', value: vm.paymentDetailView.vatLabel },
                    ].map((r, $index) => (
                      <React.Fragment key={$index}>
                        <div style={S(`display:flex;justify-content:space-between;align-items:center;padding:12px 0;${$index > 0 ? 'border-top:1px solid #F0F0F0;' : ''}`)}>
                          <span style={S("font-size:11.5px;color:#888")}>{r.label}</span>
                          <span style={S("font-size:11.5px;font-weight:700;color:#111")}>{r.value}</span>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                  <div style={S("background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:13.5px;font-weight:700;border-radius:14px;height:48px;display:flex;align-items:center;justify-content:center;margin-top:12px")} onClick={vm.closePaymentDetail}>확인</div>
                </div>
              </div>
            </>)}
            {(vm.convLoading) && (<>
              <div style={S("position:absolute;inset:0;background:linear-gradient(160deg,#EAF7EC,#F6FBF0);z-index:40;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:32px")}>
                <div style={S("width:44px;height:44px;border:4px solid rgba(11,143,88,0.18);border-top-color:#0B8F58;border-radius:50%;animation:spin 0.9s linear infinite")}></div>
                <div style={S("font-size:16px;font-weight:800;color:#0B5E3A;text-align:center;line-height:1.5")}>우리 집 기준으로<br/>환산하고 있어요…</div>
                <div style={S("font-size:11.5px;color:#6C8579;text-align:center")}>저축·등록금·노후 계획 단위로 바꾸는 중</div>
              </div>
            </>)}
            {(vm.policyOpen) && (<>
              <div style={S("position:absolute;inset:0;background:rgba(12,20,16,0.5);z-index:45;display:flex;align-items:flex-end")} onClick={vm.closePolicy}>
                <div style={S("width:100%;max-height:88%;background:#fff;border-radius:22px 22px 0 0;display:flex;flex-direction:column;box-shadow:0 -10px 40px rgba(0,0,0,0.2)")} onClick={e=>e.stopPropagation()}>
                  <div style={S("flex:none;padding:16px 18px 12px;border-bottom:1px solid #EEF0F1;display:flex;align-items:center;gap:10px")}>
                    <span style={S("width:34px;height:34px;border-radius:10px;background:#E4F0EA;display:flex;align-items:center;justify-content:center;font-size:16px;flex:none")}>📄</span>
                    <div style={S("flex:1;min-width:0")}>
                      <div style={S("font-size:14px;font-weight:900;color:#111")}>약관 원문 근거</div>
                      <div style={S("font-size:10px;color:#999;margin-top:2px")}>노재수가 답변에 참고한 약관 페이지 전문이에요</div>
                    </div>
                    <span style={S("font-size:20px;color:#888;cursor:pointer;flex:none")} onClick={vm.closePolicy}>✕</span>
                  </div>
                  <div style={S("flex:1;overflow-y:auto;padding:14px 16px 24px;display:flex;flex-direction:column;gap:14px;-webkit-overflow-scrolling:touch")}>
                    {(vm.policyLoading) && (<>
                      <div style={S("display:flex;flex-direction:column;align-items:center;gap:12px;padding:40px 0")}>
                        <div style={S("width:34px;height:34px;border:3px solid rgba(11,143,88,0.18);border-top-color:#0B8F58;border-radius:50%;animation:spin 0.9s linear infinite")}></div>
                        <div style={S("font-size:11.5px;color:#888")}>약관 원문을 불러오는 중…</div>
                      </div>
                    </>)}
                    {(!vm.policyLoading && vm.policyData.length === 0) && (<>
                      <div style={S("font-size:11.5px;color:#999;text-align:center;padding:40px 0")}>약관 원문을 불러오지 못했어요.</div>
                    </>)}
                    {(!vm.policyLoading) && vm.policyData.map((pg, pi) => (
                      <React.Fragment key={pi}>
                        <div style={S(`border:1.5px solid ${pg.page===vm.policyFocus?'#0B8F58':'#E7EAEC'};border-radius:16px;overflow:hidden`)}>
                          <div style={S(`padding:10px 14px;background:${pg.page===vm.policyFocus?'rgba(11,143,88,0.08)':'#F7F8F8'};display:flex;align-items:center;gap:8px`)}>
                            <span style={S("font-size:10px;font-weight:900;color:#fff;background:#0B8F58;border-radius:6px;padding:3px 8px;flex:none")}>p.{pg.page}</span>
                            <span style={S("font-size:11.5px;font-weight:800;color:#0B5E3A;flex:1;min-width:0")}>{pg.title || '약관 본문'}</span>
                          </div>
                          <div style={S("padding:13px 15px;font-size:11px;color:#3A3E44;line-height:1.85;white-space:pre-wrap;word-break:keep-all")}>{pg.text || '(이 페이지에서 추출된 본문이 없어요)'}</div>
                        </div>
                      </React.Fragment>
                    ))}
                    <div style={S("font-size:8.5px;color:#B4B9BC;text-align:center;line-height:1.5;margin-top:4px")}>※ 브라우저 인쇄본에서 추출한 원문으로, 실제 약관과 서식이 다를 수 있어요.</div>
                  </div>
                </div>
              </div>
            </>)}
            {(vm.notifOpen) && (<>
              <div style={S("position:absolute;inset:0;background:#fff;z-index:30;display:flex;flex-direction:column")}>
                <div style={S("height:56px;flex:none;display:flex;align-items:center;gap:8px;padding:0 16px;border-bottom:1px solid #F2F2F2")} onClick={vm.closeNotifications}>
                  <span style={S("font-size:17px;color:#555")}>‹</span>
                  <span style={S("font-size:13px;font-weight:700;color:#111")}>알림</span>
                </div>
                <div style={S("flex:1;overflow-y:auto;padding:14px 18px;display:flex;flex-direction:column;gap:10px")}>
                  {(vm.notifications && vm.notifications.length > 0) ? (vm.notifications.map((n, $index) => (
                    <React.Fragment key={$index}>
                      <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:20px;padding:13px 14px")}>
                        <div style={S("display:flex;justify-content:space-between;align-items:baseline")}>
                          <span style={S("font-size:11.5px;font-weight:700;color:#111")}>
                            {n.title}
                          </span>
                          <span style={S("font-size:8.5px;color:#AAA;white-space:nowrap")}>
                            {n.time}
                          </span>
                        </div>
                        <div style={S("font-size:10.5px;color:#555;line-height:1.5;margin-top:5px")}>
                          {n.body}
                        </div>
                      </div>
                    </React.Fragment>
                  ))) : this.renderEmptyState(
                    <svg width="58" height="58" viewBox="0 0 58 58">
                      <path d="M17 25a12 12 0 0 1 24 0c0 9 4 11 4 11H13s4-2 4-11" fill="#fff" stroke="#0B8F58" strokeWidth="2.4" strokeLinejoin="round"></path>
                      <path d="M24 40a5 5 0 0 0 10 0" fill="none" stroke="#0B8F58" strokeWidth="2.4" strokeLinecap="round"></path>
                      <circle cx="42" cy="18" r="6.5" fill="#CFE9DB"></circle>
                      <path d="M39.5 18l2 2 3.5-3.6" fill="none" stroke="#0B8F58" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>,
                    '새로운 알림이 없어요',
                    '보험료 재산정, 성적 등록, 청구 진행 상황이 생기면 여기서 가장 먼저 알려드릴게요.',
                    { hint: <>💡 알림 종류는 <b style={S("color:#111")}>알림 설정</b>에서 바꿀 수 있어요</> }
                  )}
                </div>
              </div>
            </>)}
            <div style={S("height:66px;flex:none;border-top:1px solid #EEE;display:flex")}>
              <div style={S("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px")} onClick={vm.aiTab.onClick}>
                <div style={S(vm.aiTab.circleStyle)}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={vm.aiTab.iconColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="9" width="14" height="11" rx="3"></rect>
                    <line x1="12" y1="5" x2="12" y2="9"></line>
                    <circle cx="12" cy="4" r="1.3" fill={vm.aiTab.iconColor} stroke="none"></circle>
                    <circle cx="9" cy="14.5" r="1.4" fill={vm.aiTab.iconColor} stroke="none"></circle>
                    <circle cx="15" cy="14.5" r="1.4" fill={vm.aiTab.iconColor} stroke="none"></circle>
                    <line x1="9" y1="18" x2="15" y2="18"></line>
                  </svg>
                </div>
                <span style={S(`font-size:8.5px;font-weight:${vm.aiTab.labelWeight};color:${vm.aiTab.labelColor}`)}>AI</span>
              </div>
              <div style={S("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px")} onClick={vm.gradesTab.onClick}>
                <div style={S(vm.gradesTab.circleStyle)}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={vm.gradesTab.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4,16 9,10 13,13 20,5"></polyline>
                    <polyline points="14,5 20,5 20,11"></polyline>
                  </svg>
                </div>
                <span style={S(`font-size:8.5px;font-weight:${vm.gradesTab.labelWeight};color:${vm.gradesTab.labelColor}`)}>성적분석</span>
              </div>
              <div style={S("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px")} onClick={vm.homeTab.onClick}>
                <div style={S(vm.homeTab.circleStyle)}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={vm.homeTab.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4,11 12,4 20,11"></polyline>
                    <path d="M6 10v9h12v-9"></path>
                    <path d="M10 19v-6h4v6"></path>
                  </svg>
                </div>
                <span style={S(`font-size:8.5px;font-weight:${vm.homeTab.labelWeight};color:${vm.homeTab.labelColor}`)}>홈</span>
              </div>
              <div style={S("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px")} onClick={vm.converterTab.onClick}>
                <div style={S(vm.converterTab.circleStyle)}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={vm.converterTab.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="4" width="16" height="16" rx="2"></rect>
                    <line x1="4" y1="10" x2="20" y2="10"></line>
                    <line x1="12" y1="10" x2="12" y2="20"></line>
                  </svg>
                </div>
                <span style={S(`font-size:8.5px;font-weight:${vm.converterTab.labelWeight};color:${vm.converterTab.labelColor}`)}>돈워리</span>
              </div>
              <div style={S("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px")} onClick={vm.mypageTab.onClick}>
                <div style={S(vm.mypageTab.circleStyle)}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={vm.mypageTab.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="3.5"></circle>
                    <path d="M5 19c0-4 3-6 7-6s7 2 7 6"></path>
                  </svg>
                </div>
                <span style={S(`font-size:8.5px;font-weight:${vm.mypageTab.labelWeight};color:${vm.mypageTab.labelColor}`)}>마이</span>
              </div>
            </div>
          </>)}

          {/* ── 인강 임베디드 가입 온보딩 ── */}
          {(vm.mode === 'web' && ['pay','tiers','terms','apply','done'].includes(vm.entry)) && (<>
            <div style={S(['apply','done'].includes(vm.entry)
              ? "position:fixed;inset:0;background:#E9ECEE;z-index:50;overflow-y:auto;display:flex;justify-content:center;align-items:flex-start;-webkit-overflow-scrolling:touch"
              : "position:fixed;inset:0;background:rgba(12,20,16,0.55);z-index:50;display:flex;align-items:center;justify-content:center;padding:20px")}>
             <div style={S(['apply','done'].includes(vm.entry)
              ? "width:100%;max-width:860px;min-height:100%;background:#F5F6F5;position:relative;display:flex;flex-direction:column;box-shadow:0 0 60px rgba(0,0,0,0.08)"
              : "width:100%;max-width:560px;max-height:92vh;background:#F5F6F5;border-radius:22px;overflow-y:auto;position:relative;box-shadow:0 24px 70px rgba(0,0,0,0.35);-webkit-overflow-scrolling:touch")}>
              {/* 상단바 + 진행 표시 (sticky) */}
              <div style={S("position:sticky;top:0;height:52px;box-sizing:border-box;z-index:3;display:flex;align-items:center;gap:8px;padding:0 14px;background:#fff;border-bottom:1px solid #E6E6E6")}>
                <span style={S("font-size:19px;color:#555;cursor:pointer")} onClick={() => vm.entryGo(vm.entry === 'apply' ? 'terms' : 'landing')}>{vm.entry === 'apply' ? '‹' : '✕'}</span>
                <span style={S("flex:1;font-size:13px;font-weight:800;color:#111")}>{({pay:'메가에듀패스 · 강의 결제',tiers:'보험 상품 선택',terms:'약관·상품설명 확인',apply:'보험 청약서 작성',done:'가입 완료'})[vm.entry]}</span>
                {vm.entry !== 'done' && (<span style={S("font-size:10px;font-weight:700;color:#0B8F58")}>{({pay:'1',tiers:'2',terms:'3',apply:'4'})[vm.entry]}/4</span>)}
              </div>

              <div style={S(['apply','done'].includes(vm.entry) ? "padding:24px 30px 44px;display:flex;flex-direction:column;gap:14px;flex:1" : "padding:16px;display:flex;flex-direction:column;gap:12px")}>
                {(vm.entry === 'pay') && (<>
                  <div style={S("background:#fff;border:1px solid #E6E6E6;border-radius:20px;padding:15px")}>
                    <div style={S("font-size:9.5px;color:#2B4FE8;font-weight:800")}>MEGA EDU · 인강 결제</div>
                    <div style={S("font-size:14px;font-weight:800;color:#111;margin-top:8px;line-height:1.4")}>2026 올인원 메가패스 · 전 강좌 무제한</div>
                    <div style={S("font-size:10.5px;color:#888;margin-top:3px")}>김서준 · 이도현 · 박지훈 등 · 12개월</div>
                    <div style={S("display:flex;justify-content:space-between;align-items:baseline;margin-top:12px;border-top:1px solid #F0F0F0;padding-top:12px")}>
                      <span style={S("font-size:11px;color:#888")}>강의 수강료</span>
                      <span style={S("font-size:17px;font-weight:800;color:#111")}>396,000원</span>
                    </div>
                  </div>
                  <div style={S(`border-radius:20px;padding:16px;border:1.5px solid ${vm.onbForm.insChecked ? '#0B8F58' : '#E0E0E0'};background:${vm.onbForm.insChecked ? 'rgba(11,143,88,0.05)' : '#fff'}`)} onClick={() => vm.setOnb({ insChecked: !vm.onbForm.insChecked })}>
                    <div style={S("display:flex;align-items:flex-start;gap:10px")}>
                      <div style={S(`width:22px;height:22px;border-radius:6px;flex:none;display:flex;align-items:center;justify-content:center;margin-top:1px;background:${vm.onbForm.insChecked ? '#0B8F58' : '#fff'};border:1.5px solid ${vm.onbForm.insChecked ? '#0B8F58' : '#CCC'};color:#fff;font-size:12px`)}>{vm.onbForm.insChecked ? '✓' : ''}</div>
                      <div style={S("flex:1;min-width:0")}>
                        <div style={S("font-size:13px;font-weight:800;color:#111")}>🛡️ 재수없수 학습성취 보장보험 함께 가입</div>
                        <div style={S("font-size:10.5px;color:#0B8F58;font-weight:700;margin-top:3px")}>월 2,000원대부터 · 성적 데이터 기반 개인 산정</div>
                        <div style={S("border-top:1px dashed #C9E5D5;margin-top:11px;padding-top:11px;display:flex;flex-direction:column;gap:7px")}>
                          {[['🎯','언제 보장?','수능 성적이 예측 밴드보다 크게 떨어져 재수하게 되면'],['💸','무엇을?','재수학원·인강 수강료를 티어별 한도 내 보장(현물+현금)'],['📈','보험료는?','모의고사 변동성·추세로 개인 산정, 성적 안정되면 인하']].map((r,i)=>(
                            <React.Fragment key={i}>
                              <div style={S("display:flex;gap:8px;align-items:flex-start")}>
                                <span style={S("font-size:12px;flex:none")}>{r[0]}</span>
                                <span style={S("font-size:10.5px;color:#444;line-height:1.5")}><b style={S("color:#111")}>{r[1]}</b> {r[2]}</span>
                              </div>
                            </React.Fragment>
                          ))}
                        </div>
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
                            {[['🟡','경증 사고','수능 백분위가 예측 밴드 하단(−2.0σ)을 벗어난 경우',`최대 ${(t.cover_mild/10000).toLocaleString('ko-KR')}만원 · 재수비용 6개월분(70%)`],['🔴','중증 사고','−2.5σ를 초과해 크게 하락한 경우',`최대 ${(t.cover_sev/10000).toLocaleString('ko-KR')}만원 · 재수비용 12개월분(70%)`],['💳','지급 방식','제휴 재수학원·인강 수강료','현물(바우처) + 현금(실손) 혼합 지급'],['📅','보장 조건','수능 1회 고정 · 대기기간 12개월','재수(재응시) 실행이 확인되어야 지급']].map((r,ri)=>(
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
                    {[['제5조 청약철회','청약일로부터 관계 법령이 정한 기간 내 철회 가능, 납입 보험료 전액 반환.'],['제13조 심각도별 지급','수능 백분위가 예측 밴드 하단을 벗어난 정도로 경증/중증 구분, 보험금 차등 지급.'],['제15조 면책','가입일 90일 면책기간, 성적표 위·변조·허위 재수 신고 등 부정청구 제외.'],['제16·22조 갱신·산정','누적 모의고사 성적으로 위험확률을 재산정해 주기적으로 보험료 갱신.'],['제25·29조 인상 상한','1회 및 누적 보험료 변동에 상한(캡)을 두어 급격한 인상을 제한.'],['제20·36조 데이터','급락 판정은 교육청·평가원 원본 성적만 사용, 성적·설문 데이터는 산정 목적에만 이용.']].map((r,i)=>(
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
                  <div style={S("display:flex;align-items:center;gap:14px;background:linear-gradient(135deg,#0B7A4A,#12A566);border-radius:16px;padding:20px 22px;margin-bottom:4px")}>
                    <span style={S("font-size:32px;flex:none")}>📝</span>
                    <div style={S("flex:1;min-width:0")}>
                      <div style={S("font-size:19px;font-weight:900;color:#fff;letter-spacing:-0.5px")}>재수없수 학습성취 보장보험 청약서</div>
                      <div style={S("font-size:12px;color:rgba(255,255,255,0.85);margin-top:5px;line-height:1.55")}>마지막 단계예요. 계약자·피보험자 정보와 고지사항을 정확히 작성해 주세요. 입력하신 내용은 요율 산정과 보장 심사에 사용됩니다.</div>
                    </div>
                    <div style={S("flex:none;background:rgba(255,255,255,0.18);border-radius:20px;padding:6px 14px;font-size:12px;font-weight:800;color:#fff")}>STEP 4/4</div>
                  </div>
                  <div style={S("background:#fff;border:1px solid #DADADA;border-radius:6px;padding:0;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.05)")}>
                    {/* 문서 헤더 */}
                    <div style={S("background:#0B7A4A;color:#fff;padding:14px 16px")}>
                      <div style={S("font-size:14px;font-weight:800;letter-spacing:0.5px")}>보험 청약서 <span style={S("font-size:10px;font-weight:500;opacity:0.8")}>(가입 설문)</span></div>
                      <div style={S("font-size:8.5px;opacity:0.75;margin-top:5px;font-family:monospace")}>증권번호 JS-______ · 접수일자 20__.__.__ · 모집인 인강임베디드</div>
                    </div>
                    <div style={S("padding:14px 15px;display:flex;flex-direction:column;gap:16px")}>

                      {/* 피보험자 기본정보 */}
                      <div>
                        <div style={S("font-size:11.5px;font-weight:800;color:#0B7A4A;border-bottom:2px solid #0B7A4A;padding-bottom:4px")}>피보험자 기본정보</div>
                        <div style={S("display:flex;gap:6px;margin-top:9px")}>
                          <input value={vm.apply.school} onChange={e=>vm.setApply({school:e.target.value})} placeholder="학교 (예: OO고)" style={S("flex:1;min-width:0;box-sizing:border-box;border:1px solid #DDD;border-radius:8px;padding:9px 11px;font-size:11px;font-family:inherit;outline:none")} />
                          <input value={vm.apply.target_univ} onChange={e=>vm.setApply({target_univ:e.target.value})} placeholder="목표 대학·학과 (선택)" style={S("flex:1;min-width:0;box-sizing:border-box;border:1px solid #DDD;border-radius:8px;padding:9px 11px;font-size:11px;font-family:inherit;outline:none")} />
                        </div>
                        <div style={S("font-size:10px;font-weight:600;color:#333;margin-top:9px;margin-bottom:5px")}>거주 지역</div>
                        <div style={S("display:flex;gap:6px;flex-wrap:wrap")}>
                          {['서울 학군지','서울 비학군지','수도권','지방'].map((o,oi)=>(<div key={oi} onClick={()=>vm.setApply({region:o})} style={S(`font-size:11px;font-weight:500;padding:7px 11px;border-radius:8px;cursor:pointer;border:1.5px solid ${vm.apply.region===o?'#0B7A4A':'#DDD'};background:${vm.apply.region===o?'#0B7A4A':'#fff'};color:${vm.apply.region===o?'#fff':'#555'}`)}>{o}</div>))}
                        </div>
                      </div>

                      {/* Ⅰ 계약 관계자 */}
                      <div>
                        <div style={S("font-size:11.5px;font-weight:800;color:#0B7A4A;border-bottom:2px solid #0B7A4A;padding-bottom:4px")}>Ⅰ. 계약 관계자</div>
                        <div style={S("font-size:8.5px;color:#B45309;margin-top:5px")}>※ 피보험자가 미성년자이므로 계약자는 법정대리인(보호자)이 됩니다</div>
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
                        <div style={S("margin-top:11px")}>
                          <div style={S("font-size:10px;font-weight:700;color:#333;margin-bottom:5px")}>피보험자 (학생)</div>
                          <input value={vm.apply.p_name} onChange={e=>vm.setApply({p_name:e.target.value})} placeholder="성명" style={S("width:100%;box-sizing:border-box;border:1px solid #DDD;border-radius:8px;padding:9px 11px;font-size:11px;font-family:inherit;outline:none")} />
                          <div style={S("font-size:8.5px;color:#999;margin:6px 0 4px")}>생년월일</div>
                          {this._dob('p_birth', 2004, 2011)}
                        </div>
                      </div>

                      {/* Ⅱ 가입 자격 */}
                      <div>
                        <div style={S("font-size:11.5px;font-weight:800;color:#0B7A4A;border-bottom:2px solid #0B7A4A;padding-bottom:4px")}>Ⅱ. 가입 자격 확인 <span style={S("font-size:8.5px;color:#C0304A")}>필수</span></div>
                        {[['현재 학년','q_grade',['고1','고2(1학기까지)'],'고2 2학기 이후 신규가입 불가'],['대입 준비 방향','q_direction',['정시 중심','수시·정시 병행','수시 중심'],'수시 중심 단독은 가입 불가'],['성적자료 제출 동의','q_data',['동의','미동의'],'미동의 시 가입 불가']].map((q,qi)=>(
                          <React.Fragment key={qi}>
                            <div style={S("margin-top:9px")}>
                              <div style={S("font-size:10px;font-weight:600;color:#333")}>{q[0]}</div>
                              <div style={S("display:flex;gap:6px;flex-wrap:wrap;margin-top:5px")}>
                                {q[2].map((o,oi)=>(<div key={oi} onClick={()=>vm.setApply({[q[1]]:o})} style={S(`font-size:10.5px;font-weight:600;padding:7px 12px;border-radius:8px;cursor:pointer;border:1.5px solid ${vm.apply[q[1]]===o?'#0B7A4A':'#DDD'};background:${vm.apply[q[1]]===o?'#0B7A4A':'#fff'};color:${vm.apply[q[1]]===o?'#fff':'#555'}`)}>{o}</div>))}
                              </div>
                              <div style={S("font-size:9px;color:#999;margin-top:3px")}>{q[3]}</div>
                            </div>
                          </React.Fragment>
                        ))}
                        <div style={S("display:flex;align-items:center;gap:8px;margin-top:9px;cursor:pointer")} onClick={()=>vm.setApply({q_wait:!vm.apply.q_wait})}>
                          <div style={S(`width:18px;height:18px;border-radius:4px;flex:none;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;background:${vm.apply.q_wait?'#0B7A4A':'#fff'};border:1.5px solid ${vm.apply.q_wait?'#0B7A4A':'#CCC'}`)}>{vm.apply.q_wait?'✓':''}</div>
                          <span style={S("font-size:10px;color:#333")}>대기기간(가입 후 12개월 내 사고 부지급) 안내를 확인함</span>
                        </div>
                      </div>

                      {/* Ⅲ 고지사항 */}
                      <div>
                        <div style={S("font-size:11.5px;font-weight:800;color:#0B7A4A;border-bottom:2px solid #0B7A4A;padding-bottom:4px")}>Ⅲ. 계약 전 알릴 의무 (고지) <span style={S("font-size:8.5px;color:#C0304A")}>필수</span></div>
                        {[['d1','현재 재수(수능 재응시)를 계획하고 있습니까?'],['d2','최근 1년 내 학업 중단·휴학·유급 경험이 있습니까?'],['d3','학업에 지장을 주는 질병·장애가 있습니까?'],['d4','타사 유사 교육·재수 보험에 가입되어 있습니까?'],['d5','유학·해외진학·취업 등 수능 외 진로 계획이 있습니까?']].map((q,qi)=>(
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
                        <div style={S("font-size:11.5px;font-weight:800;color:#0B7A4A;border-bottom:2px solid #0B7A4A;padding-bottom:4px")}>Ⅳ. 보험료 산출 문항 <span style={S("font-size:8.5px;color:#0B8F58")}>요율 반영</span></div>
                        <div style={S("font-size:8.5px;color:#999;margin-top:5px")}>※ 통계적 유의성이 검증된 항목 · 증빙서류로 확인</div>
                        {[['성별','gender',['여성','남성']],['월평균 가구소득','income',['250만원 미만','250~450만원','450만원 초과']],['월평균 사교육비(1인)','edu_cost',['10만원 미만','10~40만원','40만원 초과']]].map((q,qi)=>(
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

                      {/* Ⅴ 응시과목 선언 */}
                      <div>
                        <div style={S("font-size:11.5px;font-weight:800;color:#0B7A4A;border-bottom:2px solid #0B7A4A;padding-bottom:4px")}>Ⅴ. 수능 응시과목 선언 <span style={S("font-size:8.5px;color:#0B8F58")}>요율 반영</span></div>
                        <div style={S("font-size:8.5px;color:#999;margin-top:5px;line-height:1.5")}>※ 최소 2과목 이상 · 급락 판정은 선언 과목만의 가중합으로 산정합니다.</div>
                        <div style={S("display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin-top:8px")}>
                          {[['국어','subj_kor'],['수학','subj_math'],['영어','subj_eng'],['사회탐구','subj_soc'],['과학탐구','subj_sci']].map((o,oi)=>(<div key={oi} onClick={()=>vm.setApply({[o[1]]:!vm.apply[o[1]]})} style={S(`text-align:center;font-size:10.5px;font-weight:700;padding:10px 4px;border-radius:8px;cursor:pointer;border:1.5px solid ${vm.apply[o[1]]?'#0B8F58':'#DDD'};background:${vm.apply[o[1]]?'rgba(11,143,88,0.08)':'#fff'};color:${vm.apply[o[1]]?'#0B8F58':'#666'}`)}>{vm.apply[o[1]]?'☑ ':''}{o[0]}</div>))}
                        </div>
                        <div style={S("background:#FFF7E6;border:1px solid #F0DBA6;border-radius:8px;padding:9px 11px;margin-top:9px;font-size:9px;color:#8A6D1A;line-height:1.5")}>📌 응시과목은 <b>고3 9월 모의고사 직후(4차·최종 갱신 시점)에 다시 조사</b>하여 최종 확정합니다. 선언 이후에는 변경할 수 없습니다.</div>
                      </div>

                      {/* Ⅵ 통계·검증용 */}
                      <div>
                        <div style={S("font-size:11.5px;font-weight:800;color:#0B7A4A;border-bottom:2px solid #0B7A4A;padding-bottom:4px")}>Ⅵ. 통계·검증용 선택 문항 <span style={S("font-size:8.5px;color:#999")}>요율 미반영</span></div>
                        {[['고등학교 유형','school_type',['일반고','자율고','특목고','기타']],['형제·자매 재수 경험','sibling',['없음','있음','외동']]].map((q,qi)=>(
                          <React.Fragment key={qi}>
                            <div style={S("margin-top:9px")}>
                              <div style={S("font-size:10px;font-weight:600;color:#333")}>{q[0]}</div>
                              <div style={S("display:flex;gap:6px;flex-wrap:wrap;margin-top:5px")}>
                                {q[2].map((o,oi)=>(<div key={oi} onClick={()=>vm.setApply({[q[1]]:o})} style={S(`font-size:10px;font-weight:600;padding:7px 11px;border-radius:8px;cursor:pointer;border:1.5px solid ${vm.apply[q[1]]===o?'#5C6BC0':'#DDD'};background:${vm.apply[q[1]]===o?'rgba(92,107,192,0.1)':'#fff'};color:${vm.apply[q[1]]===o?'#3F51B5':'#666'}`)}>{o}</div>))}
                              </div>
                            </div>
                          </React.Fragment>
                        ))}
                      </div>

                      {/* Ⅶ 개인정보 동의 */}
                      <div>
                        <div style={S("font-size:11.5px;font-weight:800;color:#0B7A4A;border-bottom:2px solid #0B7A4A;padding-bottom:4px")}>Ⅶ. 개인정보 수집·이용 동의</div>
                        {[['pi_req','[필수] 성명·성적·소득 등 계약 심사·보험료 산출·지급 목적 (보유 5년)'],['pi_opt','[선택] 고교유형·형제 재수이력 통계 분석 (가명처리, 3년)'],['pi_counsel','[선택] 심리상담 지원 서비스 매칭']].map((q,qi)=>(
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

                      {/* Ⅷ 자필서명 */}
                      <div>
                        <div style={S("font-size:11.5px;font-weight:800;color:#0B7A4A;border-bottom:2px solid #0B7A4A;padding-bottom:4px")}>Ⅷ. 확인 및 자필서명</div>
                        <div style={S("font-size:9px;color:#666;line-height:1.6;margin-top:7px")}>본인은 위 사항을 사실대로 기재하였으며, 계약 전 알릴 의무와 위반 시 불이익(해지·부지급)에 대한 설명을 듣고 이해하였습니다. 상품설명서·약관을 교부받고 주요 내용 설명을 들었으며, 서류 확인·제출에 동의합니다.</div>
                        <div style={S(`display:flex;align-items:center;gap:10px;margin-top:10px;cursor:pointer;background:${vm.apply.sign?'rgba(11,143,88,0.06)':'#FAFAFA'};border:1.5px solid ${vm.apply.sign?'#0B8F58':'#DDD'};border-radius:14px;padding:12px 13px`)} onClick={()=>vm.setApply({sign:!vm.apply.sign})}>
                          <div style={S(`width:22px;height:22px;border-radius:6px;flex:none;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;background:${vm.apply.sign?'#0B8F58':'#fff'};border:1.5px solid ${vm.apply.sign?'#0B8F58':'#CCC'}`)}>{vm.apply.sign?'✓':''}</div>
                          <span style={S("font-size:10.5px;color:#333;line-height:1.4")}>위 내용에 동의하고 <b style={S("color:#0B8F58")}>전자 서명</b>합니다 ({vm.apply.p_name||vm.onbForm.name||'피보험자'} · 계약자)</span>
                        </div>
                      </div>

                    </div>
                  </div>
                </>)}

                {(vm.entry === 'done') && (<>
                  <div style={S("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:12px;padding:30px 10px;animation:riseIn .4s ease")}>
                    <div style={S("width:70px;height:70px;border-radius:50%;background:#0B8F58;display:flex;align-items:center;justify-content:center;font-size:35px;color:#fff")}>✓</div>
                    <div style={S("font-size:17px;font-weight:900;color:#111")}>가입이 완료됐어요!</div>
                    <div style={S("font-size:11.5px;color:#666;line-height:1.6")}>{vm.onbForm.name || '학생'}님, <b style={S("color:#0B8F58")}>{vm.onbForm.tier}</b> 상품에 가입되었어요.<br/>청약 정보가 안전하게 저장됐고, 인강사이트에서<br/>성적 이력을 연동해 맞춤 대시보드를 준비했어요.</div>
                  </div>
                </>)}
              </div>

              {/* 하단 CTA (sticky) */}
              <div style={S("position:sticky;bottom:0;box-sizing:border-box;z-index:3;padding:12px 16px;background:#fff;border-top:1px solid #E6E6E6")}>
                {(vm.entry === 'pay') && (
                  <div style={S("background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:14px;font-weight:700;border-radius:16px;height:52px;display:flex;align-items:center;justify-content:center;cursor:pointer")} onClick={() => vm.entryGo('tiers')}>{vm.onbForm.insChecked ? '보험 포함 결제하고 가입 진행 →' : '결제하고 계속 →'}</div>
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
                {(vm.entry === 'done') && (
                  <div style={S("background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:14px;font-weight:700;border-radius:16px;height:52px;display:flex;align-items:center;justify-content:center;cursor:pointer")} onClick={vm.navApp}>재수없수 앱으로 이동 →</div>
                )}
              </div>
             </div>
            </div>
          </>)}

          {/* ── 로딩(분석 중) 오버레이 ── */}
          {(vm.loading) && (<>
            <div style={S("position:absolute;inset:0;background:#0B8F58;z-index:70;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:32px")}>
              <img src={IMG_F7F53234} alt="" style={S("width:74px;height:74px;object-fit:contain")} />
              <div style={S("font-size:20px;font-weight:800;color:#fff;text-align:center;line-height:1.4;letter-spacing:-0.3px")}>재수없는 우리 아이!<br/>부담없는 우리집!</div>
              <div style={S("width:40px;height:40px;border:4px solid rgba(255,255,255,0.28);border-top-color:#fff;border-radius:50%;animation:spin 0.9s linear infinite;margin-top:4px")}></div>
              <div style={S("font-size:11.5px;font-weight:400;color:rgba(255,255,255,0.9);text-align:center;min-height:18px")}>{vm.loadStage || '준비하고 있어요…'}</div>
            </div>
          </>)}
        </div>
      </div>
    );
  }
}
export default Component;
