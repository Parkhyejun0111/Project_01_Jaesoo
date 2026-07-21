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
const IMG_D810F4E9 = "data:image/png;base64,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";
const IMG_F7F53234 = "/jaesoo_character.png";

const SEL = "display:inline-flex;align-items:center;padding:8px 14px;border-radius:20px;font-size:11px;font-weight:700;border:1.5px solid #0B8F58;background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;cursor:pointer;white-space:nowrap";
const UNSEL = "display:inline-flex;align-items:center;padding:8px 14px;border-radius:20px;font-size:11px;font-weight:400;border:1px solid #E5E5E5;background:#fff;color:#666;cursor:pointer;white-space:nowrap";

class Component extends React.Component {
  state = {
    activeTab: 'grades',
    gradeSeg: 0,
    a2Filter: 'all',
    converterScreen: 'intro',
    save_m: 200, siblingCount: 2, retireGoal: 40000, income_m: 700, opp_on: false,
    costForm: '재수종합학원', costAdjPct: 100, region: '수도권',
    homeScreen: 'ins01', myScreen: 'main', gradeState: 'needs_check',
    llmAnswer: '', llmFrom: 'ins01', llmInput: '', llmMessages: [], llmLoading: false, appealSubject: '국어', appealReason: '인식 오류',
    discountModalOpen: false, coverageModalOpen: false, quadrantModalOpen: false,
    loggedIn: false, notifOpen: false, scanWarningOpen: false,
    notifToggles: { exam: true, billing: true, appeal: true, marketing: false },
    // 개인화/로그인/온보딩
    student: null, studentId: null, studentList: [], loading: false, loadStage: '',
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
  }

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
  componentDidUpdate() {
    const el = this.chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }

  // 채팅 첫 인사 + 상단 추천 질문(3~4개)
  llmGreeting = { role: 'ai', text: '안녕하세요! 😊 저는 재수없는 수험생을 위한 AI 도우미 No(노)재수예요!\n\n약관과 보험료 산정 근거를 실제 약관 문서에 근거해 설명해드릴게요. 아래 추천 질문을 누르거나, 궁금한 점을 직접 입력해 물어보세요.', pages: [] };
  RECO_QS = [
    '보험금은 언제, 어떻게 받나요?',
    '보험료는 어떤 기준으로 산정되나요?',
    '청약철회는 어떻게 하나요?',
    '보장에서 제외되는 경우는 뭔가요?',
  ];

  // 채팅 화면 진입 — 대화를 첫 인사로 초기화
  openLlm = (from) => this.setState({ homeScreen: 'llm', llmFrom: from, llmMessages: [this.llmGreeting], llmInput: '', llmLoading: false });

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
  // 우리 동네 시세: 지역별 평균 대비 배율(%)
  regions = [
    { name: '서울 학군지', pct: 120, desc: '강남·목동·중계 등' },
    { name: '서울 비학군지', pct: 105, desc: '서울 그 외 지역' },
    { name: '수도권', pct: 100, desc: '경기·인천 (기준)' },
    { name: '지방', pct: 85, desc: '광역시·지방권' },
  ];

  chipList(options, curVal, keyName) {
    const NONE_UNSEL = UNSEL.replace('border:1px solid #E5E5E5', 'border:1px solid #0B8F58').replace('background:#fff', 'background:rgba(11,143,88,0.12)').replace('color:#666', 'color:#0B8F58');
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

    const mkTab = (key) => {
      const active = s.activeTab === key;
      return {
        iconColor: active ? '#fff' : '#999',
        labelColor: active ? '#0B8F58' : '#999',
        labelWeight: active ? 700 : 400,
        circleStyle: `width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${active ? '#0B8F58' : 'transparent'}`,
        onClick: () => this.setState({ activeTab: key }),
      };
    };
    const homeTab = mkTab('home'), gradesTab = mkTab('grades'), converterTab = mkTab('converter'), mypageTab = mkTab('mypage');

    const fmtWon = n => n.toLocaleString('ko-KR') + '만원';

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
    ];
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
      goIns02: () => this.setState({ homeScreen: 'ins02' }),
      backIns01: () => this.setState({ homeScreen: 'ins01' }),
      goLlm: () => this.openLlm('ins01'),
      goLlmFromDetail: () => this.openLlm('ins02'),
      goLlmSeeded: () => { this.openLlm('ins01'); this.askLLM('왜 수학 변동성이 보험료에 영향을 주나요?'); },
      backIns02: () => this.setState({ homeScreen: 'ins02' }),
      backLlm: () => this.setState({ homeScreen: s.llmFrom }),
      llmBackLabel: s.llmFrom === 'ins02' ? '보험현황 상세' : '보험현황',
      llmFactors: this.llmFactorDefs, llmChips, llmAnswer: s.llmAnswer,
      llmMessages: s.llmMessages, llmLoading: s.llmLoading,
      llmInput: s.llmInput,
      onLlmInput: e => this.setState({ llmInput: e.target.value }),
      submitLlm: () => { const q = (this.state.llmInput || '').trim(); if (q) this.askLLM(q); },

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
      examHistory: this.examLabels.map((label, i) => ({
        label,
        kor: this.subjects.국어.traj[i], math: this.subjects.수학.traj[i],
        eng: this.subjects.영어.traj[i], sci: this.subjects.탐구.traj[i],
        percentile: Math.round(comp[i]),
      })).reverse(),
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
        this.setState({ converterScreen: map[s.converterScreen] || 'intro' });
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
      goResult: () => this.setState({ converterScreen: 'result' }),
      costForm: s.costForm,
      formCapLabel: fmtWon(form.cap) + '/월',
      formVoucherPct: form.voucherPct, formCashPct: 100 - form.voucherPct,
      oppAmountLabel: fmtWon(this.OPP_AMOUNT),
      hasAnyCard, noCards: !hasAnyCard,
      saveMonths, tuitionSemesters, retirePct, incomeMonths,
      costSelfLabel: fmtWon(selfPay), costCoveredLabel: fmtWon(covered),
      backToInput: () => this.setState({ converterScreen: 'input' }),
      goToGrades: () => this.setState({ activeTab: 'grades', gradeSeg: 0 }),
      homeTab, gradesTab, converterTab, mypageTab,
    };
  }

  render() {
    const vm = this.renderVals();
    return (
      <div style={S("height:100vh;display:flex;align-items:center;justify-content:center;padding:16px 20px;box-sizing:border-box;background:#0b0b0d")}>
        <div style={S("width:393px;height:100%;max-height:852px;background:#fff;border-radius:52px;border:9px solid #1b1b1e;box-shadow:0 24px 60px rgba(0,0,0,0.55);overflow:hidden;display:flex;flex-direction:column;position:relative")}>
          <div style={S("position:absolute;top:11px;left:50%;transform:translateX(-50%);width:118px;height:26px;background:#0b0b0d;border-radius:22px;z-index:40")}></div>
          <div style={S("height:44px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 26px;font-size:13px;font-weight:700;color:#111")}>
            <span>9:41</span>
            <div style={S("display:flex;align-items:center;gap:5px")}>
              <div style={S("display:flex;align-items:flex-end;gap:2px;height:9px")}>
                <div style={S("width:3px;height:4px;background:#111;border-radius:1px")}></div>
                <div style={S("width:3px;height:6px;background:#111;border-radius:1px")}></div>
                <div style={S("width:3px;height:8px;background:#111;border-radius:1px")}></div>
                <div style={S("width:3px;height:9px;background:#111;border-radius:1px")}></div>
              </div>
              <div style={S("width:22px;height:11px;border:1.3px solid #111;border-radius:3px;padding:1.3px;display:flex")}>
                <div style={S("flex:1;background:#111;border-radius:1px")}></div>
              </div>
            </div>
          </div>
          {/* ── 메가스터디 인강 랜딩 (첫 화면) ── */}
          {(!vm.loggedIn && vm.entry !== 'login') && (<>
            <div style={S("flex:1;overflow-y:auto;background:#fff;display:flex;flex-direction:column")}>
              <div style={S("flex:none;height:50px;display:flex;align-items:center;gap:6px;padding:0 18px;border-bottom:1px solid #EEE")}>
                <span style={S("font-size:16px;font-weight:800;color:#3A3A3A;letter-spacing:-0.3px")}>megastudy</span>
                <span style={S("width:19px;height:19px;border-radius:50%;background:#2B4FE8;color:#fff;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center")}>M</span>
              </div>
              {/* 검정 히어로 */}
              <div style={S("background:#0A0A0C;padding:34px 22px 30px;text-align:center")}>
                <div style={S("font-size:25px;font-weight:900;letter-spacing:1px;background:linear-gradient(90deg,#4E7CFF,#8FB4FF);-webkit-background-clip:text;background-clip:text;color:transparent")}>UPDATE YOU</div>
                <div style={S("font-size:33px;font-weight:900;color:#fff;letter-spacing:-1.5px;margin-top:6px")}>2026 <span style={S("color:#fff")}>메가패스</span></div>
                <div style={S("font-size:11px;color:#8A8A8A;margin-top:12px;font-style:italic;letter-spacing:1px")}>COMING SOON · 합격까지 무제한</div>
              </div>
              {/* 블루 캠페인 밴드 */}
              <div style={S("background:linear-gradient(135deg,#1F44E6,#2E56F5);padding:22px;text-align:center")}>
                <div style={S("font-size:11.5px;font-weight:700;color:#fff")}><span style={S("border-bottom:2px solid #fff;padding-bottom:1px")}>반박 불가</span>, 결과로 증명된 공식!</div>
                <div style={S("font-size:29px;font-weight:900;color:#fff;letter-spacing:-1px;margin-top:12px;line-height:1.15;text-shadow:0 2px 8px rgba(0,0,0,0.25)")}>불변의 법칙</div>
                <div style={S("font-size:25px;font-weight:900;color:#9BE23B;letter-spacing:-1px;margin-top:6px")}>메가스터디</div>
              </div>
              {/* 상품 카드 */}
              <div style={S("padding:16px 18px;display:flex;flex-direction:column;gap:12px")}>
                <div style={S("border:1px solid #E6E6E6;border-radius:20px;overflow:hidden")}>
                  <div style={S("background:#F7F8FA;padding:14px 16px")}>
                    <span style={S("font-size:9px;font-weight:800;color:#fff;background:#2B4FE8;border-radius:4px;padding:3px 7px")}>BEST</span>
                    <div style={S("font-size:14.5px;font-weight:800;color:#111;margin-top:9px;line-height:1.4")}>2026 메가패스 · 국·수·영·탐 전 강좌</div>
                    <div style={S("font-size:10.5px;color:#888;margin-top:4px")}>현우진 · 김동욱 · 이명학 등 · 12개월 무제한</div>
                  </div>
                  <div style={S("padding:14px 16px;display:flex;align-items:center;justify-content:space-between")}>
                    <div>
                      <div style={S("font-size:9.5px;color:#AAA;text-decoration:line-through")}>460,000원</div>
                      <div style={S("font-size:20px;font-weight:900;color:#111")}>396,000<span style={S("font-size:12px;font-weight:700")}>원</span></div>
                    </div>
                    <div style={S("background:#2B4FE8;color:#fff;font-size:13px;font-weight:800;border-radius:14px;padding:12px 24px;cursor:pointer")} onClick={() => vm.entryGo('pay')}>수강신청 ›</div>
                  </div>
                </div>
                <div style={S("background:rgba(11,143,88,0.06);border:1px solid #BEE3CE;border-radius:16px;padding:12px 14px;display:flex;align-items:center;gap:9px")}>
                  <span style={S("font-size:17px;flex:none")}>🛡️</span>
                  <span style={S("font-size:10.5px;color:#0B8F58;font-weight:600;line-height:1.5")}>결제 시 <b>재수없수 학습성취 보장보험</b>을 옵션으로 함께 가입할 수 있어요.</span>
                </div>
              </div>
              <div style={S("margin-top:auto;padding:18px;text-align:center;border-top:1px solid #F2F2F2")}>
                <span style={S("font-size:11px;color:#888")}>이미 재수없수 회원이신가요? </span>
                <span style={S("font-size:11px;color:#0B8F58;font-weight:800;cursor:pointer")} onClick={() => vm.entryGo('login')}>로그인 ›</span>
              </div>
            </div>
          </>)}

          {/* ── 재수없수 로그인 (아이디/비밀번호) ── */}
          {(!vm.loggedIn && vm.entry === 'login') && (<>
            <div style={S("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;gap:10px")}>
              <img src={IMG_F7F53234} alt="재수없수 로고" style={S("width:64px;height:64px;object-fit:contain;margin-bottom:6px")} />
              <div style={S("font-size:21px;font-weight:900;color:#0B8F58;letter-spacing:-0.8px")}>재수없수</div>
              <div style={S("font-size:11px;color:#888;margin-bottom:18px")}>온전히 공부에 집중할 수 있도록</div>
              <input type="text" placeholder="아이디" style={S("width:100%;height:48px;border:1px solid #E5E5E5;border-radius:16px;padding:0 14px;font-size:12px;font-family:inherit;box-sizing:border-box")} />
              <input type="password" placeholder="비밀번호" style={S("width:100%;height:48px;border:1px solid #E5E5E5;border-radius:16px;padding:0 14px;font-size:12px;font-family:inherit;box-sizing:border-box;margin-top:8px")} />
              <div style={S("width:100%;background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:13px;font-weight:700;border-radius:16px;height:50px;display:flex;align-items:center;justify-content:center;margin-top:16px;cursor:pointer")} onClick={vm.doLogin}>로그인</div>
              <div style={S("font-size:10px;color:#999;margin-top:14px;cursor:pointer")} onClick={() => vm.entryGo('landing')}>← 인강 홈으로</div>
            </div>
          </>)}
          {(vm.loggedIn) && (<>
            <div style={S("height:62px;flex:none;display:flex;align-items:center;justify-content:center;position:relative;border-bottom:1px solid #F2F2F2")}>
              <div style={S("display:flex;align-items:center;gap:9px")}>
                <img src={IMG_F7F53234} alt="재수없수 로고" style={S("width:46px;height:46px;object-fit:contain")} />
                <span style={S("font-size:22px;font-weight:900;color:#0B8F58;letter-spacing:-0.8px")}>재수없수</span>
              </div>
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
                    <div style={S("background:#fff;border:1px solid #E2E2E2;border-left:4px solid #D9534F;border-radius:16px;padding:10px 12px;margin-top:10px;font-size:12px;color:#555;line-height:1.6")}>
                      빨간 선(48점)은 
                      <b>보험 보장 기준선</b>
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
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-left:4px solid #0B8F58;border-radius:22px;padding:15px 16px")}>
                    <div style={S("font-size:12.5px;font-weight:700;color:#111")}>💡 고3 성적이 내려간 것처럼 보여도 걱정 마세요</div>
                    <div style={S("font-size:10.5px;color:#333;line-height:1.6;margin-top:8px")}>
                      고3이 되면 재수생들이 시험에 들어와서 등수(백분위)가 자연스럽게 내려가요. 
                      <b>실력이 떨어진 게 아니라 경쟁자가 늘어난 것</b>
                       — 위 예상 점수는 이 효과를 빼고 계산했어요.
                    </div>
                  </div>
                </>)}
                {(vm.segIs1) && (<>
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:18px")}>
                    <div style={S("display:flex;align-items:center;justify-content:space-between")}>
                      <span style={S("font-size:14px;font-weight:800;color:#111")}>성적 꾸준함 점수</span>
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
                      점수가 클수록 시험마다 성적이 <b>꾸준</b>하다는 뜻이에요. 지금은 <b style={S("color:#111")}>{vm.topVolSubj}</b> 과목의 등락이 가장 커서, 이 과목의 컨디션 관리가 보험료 안정에 도움이 돼요.
                    </div>
                  </div>

                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:18px")}>
                    <div style={S("font-size:13.5px;font-weight:800;color:#111")}>과목별 변동성</div>
                    <div style={S("font-size:10px;color:#999;margin-top:4px")}>숫자가 클수록 성적 기복이 큰 과목이에요</div>
                    <div style={S("display:flex;flex-direction:column;gap:11px;margin-top:14px")}>
                      {(vm.volCards || []).map((v, $index) => {
                        const p = ({국어:{fill:'#E4F5EC',ink:'#0B7A4A'},수학:{fill:'#E7F0FE',ink:'#1E56C8'},영어:{fill:'#FCE9F2',ink:'#C43B7E'},탐구:{fill:'#FCF1DF',ink:'#C06A08'}})[v.name] || {fill:'#F1EAFD',ink:'#6B3AD1'};
                        return (
                        <React.Fragment key={$index}>
                          <div style={S(`background:linear-gradient(145deg,${p.fill} 0%,rgba(255,255,255,0.72) 135%);border:1.5px solid rgba(255,255,255,0.85);border-radius:18px;padding:13px 14px;box-shadow:0 7px 18px rgba(0,0,0,0.05),inset 0 1px 2px rgba(255,255,255,0.95)`)}>
                            <div style={S("display:flex;align-items:center;gap:11px")}>
                              <div style={S(`width:34px;height:34px;border-radius:11px;background:rgba(255,255,255,0.85);box-shadow:0 2px 6px rgba(0,0,0,0.06),inset 0 1px 1px #fff;color:${p.ink};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex:none`)}>{v.icon}</div>
                              <span style={S(`font-size:12.5px;font-weight:800;color:${p.ink};flex:1;min-width:0`)}>{v.name}</span>
                              <span style={S(`font-size:19px;font-weight:800;color:${p.ink};flex:none`)}>{v.vol}</span>
                              <span style={S(`font-size:9px;font-weight:700;color:#fff;background:${p.ink};border-radius:20px;padding:3px 9px;flex:none;white-space:nowrap`)}>{v.level}</span>
                            </div>
                            <div style={S("height:10px;background:rgba(255,255,255,0.55);border-radius:6px;overflow:hidden;margin-top:11px;box-shadow:inset 0 1px 2px rgba(0,0,0,0.05)")}>
                              <div style={S(`height:100%;border-radius:6px;background:${p.ink};opacity:0.85;width:${Math.min(v.vol,100)}%`)}></div>
                            </div>
                          </div>
                        </React.Fragment>
                        );
                      })}
                    </div>
                    <div style={S("font-size:9.5px;color:#AAA;margin-top:14px;line-height:1.5")}>※ 변동성 지수는 최근 모의고사 성적의 등락 폭(표준편차)을 0~100으로 환산한 값이에요.</div>
                  </div>
                </>)}
                {(vm.segIs1) && (<>
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:18px")}>
                    <div style={S("font-size:13.5px;font-weight:800;color:#111")}>과목 포지션 한눈에 보기</div>
                    <div style={S("font-size:10px;color:#999;margin-top:4px")}>가로축 = 점수 수준 · 세로축 = 성적 꾸준함. 왼쪽 아래일수록 먼저 챙겨야 해요.</div>
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
                      <text x="52" y="32" fontSize="8.5" fontWeight="700" fill="#C0304A">🚨 먼저 챙길</text>
                      <text x="228" y="32" fontSize="8.5" fontWeight="700" fill="#0B8F58" textAnchor="end">강점 💪</text>
                      <text x="52" y="197" fontSize="8.5" fontWeight="700" fill="#8A9098">🌱 차근차근</text>
                      <text x="273" y="197" fontSize="8.5" fontWeight="700" fill="#B45309" textAnchor="end">⚠️ 당일 변수</text>
                      {/* 축 화살표 */}
                      <defs><marker id="ah" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#111"></path></marker></defs>
                      <line x1="45" y1="202" x2="288" y2="202" stroke="#111" strokeWidth="1.5" markerEnd="url(#ah)"></line>
                      <line x1="45" y1="202" x2="45" y2="12" stroke="#111" strokeWidth="1.5" markerEnd="url(#ah)"></line>
                      <text x="286" y="216" fontSize="9" fontWeight="700" fill="#111" textAnchor="end">점수 높음 →</text>
                      <text x="38" y="16" fontSize="9" fontWeight="700" fill="#111" transform="rotate(-90 38 16)" textAnchor="start">꾸준함 ↑</text>
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
                  <div style={S("flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;min-height:0;justify-content:center")}>
                    <div style={S("font-size:20px;font-weight:800;color:#111;line-height:1.4")}>
                      재수 비용,
                      <br />
                      우리 집 기준으로 얼마일까요?
                    </div>
                    <img src={IMG_D810F4E9} alt="재수 비용 계산" style={S("width:150px;height:150px;object-fit:contain;margin-top:24px")} />
                    <div style={S("font-size:13px;color:#888;line-height:1.6;margin-top:14px")}>
                      학원비 통계가 아니라, 
                      <b>우리 집의 저축·등록금·노후 계획</b>
                      <br />
                      단위로 바꿔서 보여드려요.
                    </div>
                  </div>
                  <div style={S("font-size:12px;color:#0B8F58;font-weight:700;margin-bottom:14px")}>입력하신 정보는 보험료와 무관하며 기기에만 저장돼요.</div>
                  <div style={S("background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:15px;font-weight:700;border-radius:16px;height:54px;width:100%;display:flex;align-items:center;justify-content:center")} onClick={vm.startInput}>1분 만에 계산하기</div>
                </>)}
                {(vm.convIs.input) && (<>
                  <div style={S("display:flex;align-items:center;gap:6px")} onClick={vm.backConv}>
                    <span style={S("font-size:15px;color:#555")}>‹</span>
                    <span style={S("font-size:11px;color:#555")}>뒤로</span>
                  </div>
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-left:4px solid #0B8F58;border-radius:16px;padding:11px 12px;font-size:10px;color:#333;line-height:1.6")}>
                    🔒 여기 입력하는 정보는 
                    <b>보험료 계산에 쓰이지 않고</b>
                    , 서버로 보내지 않고 
                    <b>이 기기에만 저장</b>
                    돼요. 언제든 지울 수 있어요.
                  </div>
                  <div>
                    <div style={S("font-size:11px;font-weight:700;color:#111")}>월 평균 저축액</div>
                    <div style={S("display:flex;gap:6px;flex-wrap:wrap;margin-top:8px")}>
                      {(vm.saveChips || []).map((c, $index) => (
                        <React.Fragment key={$index}>
                          <div style={S(c.style)} onClick={c.onClick}>
                            {c.label}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                    {(vm.saveIsAvg) && (<>
                      <div style={S("font-size:8.5px;color:#999;margin-top:4px")}>미입력 시 평균 가구 기준값(180만원)이 적용돼요</div>
                    </>)}
                  </div>
                  <div>
                    <div style={S("font-size:11px;font-weight:700;color:#111")}>자녀 수</div>
                    <div style={S("display:flex;gap:6px;flex-wrap:wrap;margin-top:8px")}>
                      {(vm.siblingChips || []).map((c, $index) => (
                        <React.Fragment key={$index}>
                          <div style={S(c.style)} onClick={c.onClick}>
                            {c.label}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={S("display:flex;justify-content:space-between;align-items:baseline")}>
                      <span style={S("font-size:11px;font-weight:700;color:#111")}>노후 자금 목표액</span>
                    </div>
                    <div style={S("display:flex;gap:6px;flex-wrap:wrap;margin-top:8px")}>
                      {(vm.retireChips || []).map((c, $index) => (
                        <React.Fragment key={$index}>
                          <div style={S(c.style)} onClick={c.onClick}>
                            {c.label}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={S("display:flex;justify-content:space-between;align-items:baseline")}>
                      <span style={S("font-size:11px;font-weight:700;color:#111")}>월 가처분 소득</span>
                    </div>
                    <div style={S("display:flex;gap:6px;flex-wrap:wrap;margin-top:8px")}>
                      {(vm.incomeChips || []).map((c, $index) => (
                        <React.Fragment key={$index}>
                          <div style={S(c.style)} onClick={c.onClick}>
                            {c.label}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                    {(vm.incomeIsAvg) && (<>
                      <div style={S("font-size:8.5px;color:#999;margin-top:4px")}>미입력 시 평균 가구 기준값(660만원)이 적용돼요</div>
                    </>)}
                  </div>
                  <div style={S("background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:15px;font-weight:700;border-radius:20px;height:58px;width:100%;box-sizing:border-box;flex:none;display:flex;align-items:center;justify-content:center;margin-top:4px")} onClick={vm.goCostBase}>다음</div>
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
                  <div style={S("display:grid;grid-template-columns:1fr 1fr;gap:8px")}>
                    {(vm.formChips || []).map((c, $index) => (
                      <React.Fragment key={$index}>
                        <div style={S(`${c.style};font-size:13.5px;padding:12px 10px;width:100%;box-sizing:border-box;justify-content:center;text-align:center`)} onClick={c.onClick}>
                          {c.label}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:20px 18px")}>
                    <div style={S("display:flex;justify-content:space-between;font-size:13px;padding:6px 0")}>
                      <span style={S("color:#555")}>월 평균 비용</span>
                      <span style={S("font-weight:700;color:#111")}>
                        {vm.formMonthlyLabel}
                      </span>
                    </div>
                    <div style={S("font-size:11px;color:#999;line-height:1.6;margin-top:4px")}>
                      {vm.formNote}
                    </div>
                    <div style={S("border-top:1px solid #E5E5E5;margin-top:14px;padding-top:12px;display:flex;justify-content:space-between;align-items:baseline")}>
                      <span style={S("font-size:14px;font-weight:700;color:#111")}>10개월 누적 연간 총액</span>
                      <span style={S("font-size:21px;font-weight:800;color:#0B8F58")}>
                        {vm.costTotalLabel}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div style={S("font-size:14px;font-weight:700;color:#111")}>우리 동네 시세에 맞게 조정</div>
                    <div style={S("font-size:10.5px;color:#888;margin-top:4px")}>지역마다 학원 시세가 달라요. 우리 동네를 골라주세요.</div>
                    <div style={S("display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px")}>
                      {(vm.regionChips || []).map((r, $index) => (
                        <React.Fragment key={$index}>
                          <div style={S(`border-radius:16px;padding:11px 12px;cursor:pointer;box-sizing:border-box;border:1.5px solid ${r.sel ? '#0B8F58' : '#E5E5E5'};background:${r.sel ? 'rgba(11,143,88,0.07)' : '#fff'}`)} onClick={r.onClick}>
                            <div style={S(`font-size:12px;font-weight:700;color:${r.sel ? '#0B8F58' : '#111'}`)}>{r.name}</div>
                            <div style={S("font-size:9px;color:#999;margin-top:2px")}>{r.desc}</div>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                    <div style={S("font-size:11px;color:#0B8F58;font-weight:700;margin-top:10px")}>
                      {vm.adjLabel}
                    </div>
                  </div>
                  <div style={S("background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:15px;font-weight:700;border-radius:16px;min-height:60px;flex:none;box-sizing:border-box;padding:18px;display:flex;align-items:center;justify-content:center;margin-top:4px")} onClick={vm.goResult}>우리 집 기준으로 환산하기</div>
                </>)}
                {(vm.convIs.result) && (<>
                  <div style={S("display:flex;align-items:center;gap:6px")} onClick={vm.backConv}>
                    <span style={S("font-size:15px;color:#555")}>‹</span>
                    <span style={S("font-size:11px;color:#555")}>뒤로</span>
                  </div>
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:18px 16px;text-align:center")}>
                    <div style={S("font-size:12px;font-weight:700;color:#111")}>1년동안 발생하는 재수 비용은 얼마일까요?</div>
                    <div style={S("font-size:31px;font-weight:900;color:#0B8F58;margin-top:10px")}>
                      {vm.costTotalLabel}
                    </div>
                    <div style={S("font-size:9.5px;color:#999;margin-top:6px")}>
                      {vm.costForm} · {vm.adjSignLabel} 시세 반영
                    </div>
                  </div>
                  <div style={S("background:#0B8F58;border-radius:22px;padding:15px 16px")}>
                    <div style={S("display:flex;align-items:center;gap:8px")}>
                      <span style={S("font-size:12px;font-weight:700;color:#fff;white-space:nowrap")}>지금 가입한 보장을 적용하면</span>
                      <span style={S("font-size:8.5px;background:#fff;border-radius:20px;padding:2px 8px;color:#0B8F58;font-weight:700;white-space:nowrap;flex-shrink:0")}>스탠다드</span>
                    </div>
                    <div style={S("display:flex;align-items:center;gap:10px;margin-top:12px")}>
                      <div style={S("flex:1")}>
                        <div style={S("font-size:9px;color:rgba(255,255,255,0.75)")}>보장 없이</div>
                        <div style={S("font-size:13px;font-weight:700;color:rgba(255,255,255,0.9)")}>
                          {vm.costTotalLabel}
                        </div>
                      </div>
                      <span style={S("color:#fff;font-size:15px")}>→</span>
                      <div style={S("flex:1")}>
                        <div style={S("font-size:9px;color:rgba(255,255,255,0.75)")}>내 부담</div>
                        <div style={S("font-size:21px;font-weight:800;color:#fff")}>
                          {vm.costSelfLabel}
                        </div>
                      </div>
                    </div>
                    <div style={S("font-size:9.5px;font-weight:700;color:#fff;margin-top:6px")}>
                      보험이 
                      <b>
                        {vm.costCoveredLabel}
                      </b>
                       함께 부담해요
                    </div>
                    <div style={S("font-size:9px;color:rgba(255,255,255,0.85);margin-top:8px")}>
                      현물(바우처) {vm.formVoucherPct}% + 현금(실손) {vm.formCashPct}% 지급 · 월 보장 상한 {vm.formCapLabel}
                    </div>
                    <div style={S("font-size:9px;color:rgba(255,255,255,0.7);margin-top:8px;line-height:1.5")}>이 시뮬레이션은 실제 보장 상품의 예시 조건을 대입한 결과이며, 가입 시점·인수 조건·특약 구성 및 제휴 학원 계약 상태에 따라 최종 지급 금액과 자기부담금은 달라질 수 있어요.</div>
                  </div>
                  {(vm.hasAnyCard) && (<>
                    <div style={S("font-size:14px;font-weight:900;color:#111;margin-bottom:-2px")}>📊 이 금액, 우리집엔 얼마나 클까요?</div>
                    <div style={S("font-size:10px;color:#999;margin-top:-8px")}>연간 재수 비용을 우리집 가계 단위로 바꿔봤어요</div>
                    <div style={S("display:flex;flex-direction:column;gap:12px")}>
                      {[
                        {show:vm.saveMonths, icon:'💰', label:'우리집 월 저축액으로', val:vm.saveMonths, unit:'개월', sub:'이만큼 저축해야 모을 수 있는 금액', cap:24, fill:'#E4F5EC', ink:'#0B7A4A'},
                        {show:vm.tuitionSemesters, icon:'🎓', label:'동생 대학 등록금으로', val:vm.tuitionSemesters, unit:'학기', sub:'이만큼 대학교를 다닐 수 있는 학기', cap:8, fill:'#E7F0FE', ink:'#1E56C8'},
                        {show:vm.retirePct, icon:'🏦', label:'노후 자금 목표 대비', val:vm.retirePct, unit:'%', sub:'노후 목표액에서 차지하는 비중', cap:100, fill:'#FCF1DF', ink:'#C06A08'},
                        {show:vm.incomeMonths, icon:'💵', label:'우리집 월 소득으로', val:vm.incomeMonths, unit:'개월', sub:'몇 달치 소득에 해당하는 금액', cap:12, fill:'#F1EAFD', ink:'#6B3AD1'},
                      ].filter(x=>x.show).map((x,xi)=>(
                        <React.Fragment key={xi}>
                          <div style={S(`background:linear-gradient(145deg,${x.fill} 0%,rgba(255,255,255,0.72) 135%);border:1.5px solid rgba(255,255,255,0.85);border-radius:24px;padding:17px 18px;box-shadow:0 10px 26px rgba(0,0,0,0.055),inset 0 1px 2px rgba(255,255,255,0.95);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)`)}>
                            <div style={S("display:flex;align-items:center;gap:12px")}>
                              <div style={S("width:44px;height:44px;border-radius:16px;background:rgba(255,255,255,0.85);box-shadow:0 2px 7px rgba(0,0,0,0.07),inset 0 1px 1px #fff;display:flex;align-items:center;justify-content:center;font-size:21px;flex:none")}>{x.icon}</div>
                              <div style={S(`flex:1;min-width:0;font-size:12.5px;font-weight:800;color:${x.ink}`)}>{x.label}</div>
                              <div style={S("display:flex;align-items:baseline;gap:2px;flex:none")}>
                                <span style={S(`font-size:32px;font-weight:800;line-height:0.9;color:${x.ink}`)}>{x.val}</span>
                                <span style={S(`font-size:13px;font-weight:700;color:${x.ink}`)}>{x.unit}</span>
                              </div>
                            </div>
                            <div style={S("height:12px;background:rgba(255,255,255,0.55);border-radius:8px;margin-top:14px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,0.05)")}>
                              <div style={S(`height:100%;border-radius:8px;background:${x.ink};opacity:0.85;width:${Math.max(Math.min(Number(x.val)/x.cap,1)*100,7)}%`)}></div>
                            </div>
                            <div style={S(`font-size:9.5px;color:${x.ink};opacity:0.72;margin-top:7px`)}>{x.sub}이에요</div>
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
                  <div style={S("background:#fff;border:1px solid #E5E5E5;color:#555;font-size:12px;font-weight:700;border-radius:16px;height:48px;display:flex;align-items:center;justify-content:center")} onClick={vm.backToInput}>입력 수정</div>
                </>)}
              </>)}
              {(vm.isHome) && (<>
                {(vm.homeIs.ins01) && (<>
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
                          {vm.coverPeriod}
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
                    <div style={S("background:#fff;border:1px solid #E5E5E5;color:#555;font-size:14px;font-weight:700;border-radius:16px;height:50px;display:flex;align-items:center;justify-content:center;margin-top:16px")} onClick={vm.goIns02}>상세 내역 보기 ›</div>
                  </div>
                  <div style={S("background:linear-gradient(145deg,#FFF7D6,#FFFBEC);border:1.5px solid #F1E3A6;border-radius:22px;padding:15px 17px;display:flex;align-items:center;gap:12px;box-shadow:0 6px 16px rgba(212,180,60,0.12)")}>
                    <span style={S("font-size:24px;flex:none")}>💛</span>
                    <div style={S("min-width:0")}>
                      <div style={S("font-size:12.5px;font-weight:800;color:#8A6D1A")}>우리 아이 성적이 오르면 보험료도 내려가요</div>
                      <div style={S("font-size:10.5px;color:#A98B2E;margin-top:2px;line-height:1.5")}>모의고사가 갱신될 때마다 변동성이 반영돼 재산정돼요</div>
                    </div>
                  </div>
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
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:18px")}>
                    <div style={S("font-size:13.5px;font-weight:700;color:#111")}>보험료에 영향을 준 요소</div>
                    {(vm.riskFactors || []).map((r, $index) => (
                      <React.Fragment key={$index}>
                        <div style={S("margin-top:12px")}>
                          <div style={S("display:flex;justify-content:space-between;font-size:12px;color:#555")}>
                            <span>
                              {r.name}
                            </span>
                            <span style={S("font-weight:700;color:#111")}>
                              {r.level}
                            </span>
                          </div>
                          <div style={S("height:7px;border-radius:20px;background:#E9E9E9;margin-top:5px")}>
                            <div style={S(`height:7px;border-radius:20px;background:#0B8F58;width:${r.pct}%`)}></div>
                          </div>
                        </div>
                      </React.Fragment>
                    ))}
                    <div style={S("font-size:10px;color:#AAA;margin-top:12px")}>※ 실제 보험료는 계리 엔진이 계산하며, 이 화면은 영향 요소를 쉽게 풀어 보여줍니다.</div>
                  </div>
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:18px")}>
                    <div style={S("font-size:13.5px;font-weight:700;color:#111")}>월별 납입 내역</div>
                    {(vm.payments || []).map((p, $index) => (
                      <React.Fragment key={$index}>
                        <div style={S("display:flex;justify-content:space-between;font-size:12.5px;padding:10px 0;border-bottom:1px solid #EEE")}>
                          <span style={S("color:#555")}>
                            {p.date}
                          </span>
                          <span style={S("font-weight:700;color:#111")}>
                            {p.amount}
                          </span>
                          <span style={S("color:#0B8F58")}>
                            {p.status}
                          </span>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                  <div style={S("background:rgba(11,143,88,0.08);border:1.5px solid #0B8F58;border-radius:22px;padding:16px 18px;display:flex;align-items:center;gap:12px;cursor:pointer")} onClick={vm.goLlmFromDetail}>
                    <div style={S("width:34px;height:34px;border-radius:50%;background:#0B8F58;display:flex;align-items:center;justify-content:center;flex:none")}>
                      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="5" y="9" width="14" height="11" rx="3"></rect>
                        <line x1="12" y1="5" x2="12" y2="9"></line>
                        <circle cx="12" cy="4" r="1.3" fill="#fff" stroke="none"></circle>
                        <circle cx="9" cy="14.5" r="1.4" fill="#fff" stroke="none"></circle>
                        <circle cx="15" cy="14.5" r="1.4" fill="#fff" stroke="none"></circle>
                        <line x1="9" y1="18" x2="15" y2="18"></line>
                      </svg>
                    </div>
                    <div style={S("flex:1;font-size:14px;font-weight:700;color:#111;line-height:1.5;word-break:keep-all")}>보험료는 어떻게 산정됐을까? AI 에이전트에게 물어보세요.</div>
                    <span style={S("color:#0B8F58;font-size:19px;font-weight:700;flex:none")}>›</span>
                  </div>
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
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:22px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center")}>
                    <div>
                      <div style={S("font-size:10.5px;line-height:1.4;color:#555")}>
                        스탠다드 · 가입일 {vm.joinedAt}
                      </div>
                      <div style={S("font-size:10px;line-height:1.4;color:#888;margin-top:4px")}>
                        다음 재평가일 {vm.renewAt}
                      </div>
                    </div>
                    <span style={S("font-size:10px;color:#0B8F58;font-weight:700;white-space:nowrap")} onClick={vm.goHomeIns01}>보험현황 ›</span>
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
                      <span style={S("font-size:11.5px;color:#111;white-space:nowrap")}>내 성적 이력 전체 보기</span>
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
                  <div style={S("background:#fff;border:1px solid #E5E5E5;color:#C0304A;font-size:11.5px;font-weight:700;border-radius:16px;height:44px;width:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:center")} onClick={vm.logout}>로그아웃</div>
                  <div style={S("text-align:center;font-size:8.5px;color:#AAA;line-height:1.5;margin-top:2px")}>고객센터 1588-2410 · 평일 9시~18시 · 주말·공휴일 11시~18시</div>
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
                  <div style={S("background:#fff;border:1px solid #E2E2E2;border-left:4px solid #0B8F58;border-radius:22px;padding:15px 16px")}>
                    <div style={S("font-size:11.5px;font-weight:700;color:#111")}>최근 모의고사 성적</div>
                    <div style={S("font-size:10.5px;color:#333;margin-top:8px")}>
                      {vm.recentGradesText}
                    </div>
                  </div>
                  <div style={S("font-size:11.5px;font-weight:700;color:#111")}>모의고사 히스토리</div>
                  {(vm.examHistory || []).map((ex, $index) => (
                    <React.Fragment key={$index}>
                      <div style={S("background:#fff;border:1px solid #E2E2E2;border-radius:20px;padding:12px 14px")}>
                        <div style={S("display:flex;justify-content:space-between;align-items:baseline")}>
                          <span style={S("font-size:11px;font-weight:700;color:#111")}>
                            {ex.label}
                          </span>
                          <span style={S("font-size:10px;color:#888")}>
                            백분위 {ex.percentile}
                          </span>
                        </div>
                        <div style={S("display:flex;justify-content:space-between;margin-top:8px;text-align:center")}>
                          <div style={S("flex:1")}>
                            <div style={S("font-size:9px;color:#888")}>국어</div>
                            <div style={S("font-size:12px;font-weight:800;color:#0B8F58;margin-top:2px")}>
                              {ex.kor}
                            </div>
                          </div>
                          <div style={S("flex:1")}>
                            <div style={S("font-size:9px;color:#888")}>수학</div>
                            <div style={S("font-size:12px;font-weight:800;color:#3B82F6;margin-top:2px")}>
                              {ex.math}
                            </div>
                          </div>
                          <div style={S("flex:1")}>
                            <div style={S("font-size:9px;color:#888")}>영어</div>
                            <div style={S("font-size:12px;font-weight:800;color:#DB2777;margin-top:2px")}>
                              {ex.eng}
                            </div>
                          </div>
                          <div style={S("flex:1")}>
                            <div style={S("font-size:9px;color:#888")}>탐구</div>
                            <div style={S("font-size:12px;font-weight:800;color:#D97706;margin-top:2px")}>
                              {ex.sci}
                            </div>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
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
              <div style={S("position:absolute;left:0;right:0;top:100px;bottom:0;background:#F5F6F5;z-index:16;display:flex;flex-direction:column")}>
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
                  <div style={S("display:flex;gap:6px;overflow-x:auto;padding-bottom:2px")}>
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
                        <div style={S("align-self:flex-end;max-width:80%;background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;border-radius:22px 16px 4px 16px;padding:10px 13px;font-size:11.5px;line-height:1.55;white-space:pre-line;word-break:keep-all")}>
                          {m.text}
                        </div>
                      ) : (
                        <div style={S("align-self:flex-start;max-width:88%;display:flex;gap:7px;align-items:flex-start")}>
                          <div style={S("width:30px;height:30px;border-radius:50%;background:#E4F0EA;flex:none;display:flex;align-items:center;justify-content:center;margin-top:2px;overflow:hidden")}>
                            <img src={IMG_F7F53234} alt="노재수" style={S("width:24px;height:24px;object-fit:contain")} />
                          </div>
                          <div style={S("background:#fff;border:1px solid #E6E6E6;border-radius:4px 16px 16px 16px;padding:11px 13px;font-size:11.5px;color:#333;line-height:1.7;word-break:keep-all")}>
                            {this.renderRich(m.text)}
                            {(m.pages && m.pages.length > 0) && (<>
                              <div style={S("margin-top:8px;font-size:9.5px;color:#0B8F58;font-weight:700;border-top:1px dashed #E0E0E0;padding-top:6px")}>
                                📄 근거: 약관 p.{m.pages.join(', p.')}
                              </div>
                            </>)}
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                  {(vm.llmLoading) && (<>
                    <div style={S("align-self:flex-start;background:#fff;border:1px solid #E6E6E6;border-radius:4px 16px 16px 16px;padding:11px 14px;font-size:11px;color:#999")}>약관 문서를 찾는 중…</div>
                  </>)}
                </div>
                <div style={S("flex:none;padding:10px 12px;border-top:1px solid #E6E6E6;background:#fff;display:flex;gap:8px;align-items:center")}>
                  <input
                    value={vm.llmInput}
                    onChange={vm.onLlmInput}
                    onKeyDown={e => { if (e.key === 'Enter') vm.submitLlm(); }}
                    placeholder="궁금한 점을 입력해 보세요"
                    style={S("flex:1;min-width:0;border:1px solid #E0E0E0;border-radius:26px;padding:11px 16px;font-size:11.5px;color:#111;outline:none;background:#F7F7F7;font-family:inherit")}
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
                  <span style={S("font-size:12px;font-weight:700;line-height:1.35;word-break:keep-all")}>보험료 산정 근거와 약관을 설명해드릴게요!</span>
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
            {(vm.notifOpen) && (<>
              <div style={S("position:absolute;inset:0;background:#fff;z-index:30;display:flex;flex-direction:column")}>
                <div style={S("height:56px;flex:none;display:flex;align-items:center;gap:8px;padding:0 16px;border-bottom:1px solid #F2F2F2")} onClick={vm.closeNotifications}>
                  <span style={S("font-size:17px;color:#555")}>‹</span>
                  <span style={S("font-size:13px;font-weight:700;color:#111")}>알림</span>
                </div>
                <div style={S("flex:1;overflow-y:auto;padding:14px 18px;display:flex;flex-direction:column;gap:10px")}>
                  {(vm.notifications || []).map((n, $index) => (
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
                  ))}
                </div>
              </div>
            </>)}
            <div style={S("height:66px;flex:none;border-top:1px solid #EEE;display:flex")}>
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
              <div style={S("flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px")} onClick={vm.gradesTab.onClick}>
                <div style={S(vm.gradesTab.circleStyle)}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={vm.gradesTab.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4,16 9,10 13,13 20,5"></polyline>
                    <polyline points="14,5 20,5 20,11"></polyline>
                  </svg>
                </div>
                <span style={S(`font-size:8.5px;font-weight:${vm.gradesTab.labelWeight};color:${vm.gradesTab.labelColor}`)}>성적분석</span>
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
          {(!vm.loggedIn && ['pay','tiers','terms','apply','done'].includes(vm.entry)) && (<>
            <div style={S("position:absolute;inset:0;background:#F5F6F5;z-index:50;overflow-y:auto;-webkit-overflow-scrolling:touch")}>
              {/* 상단바 + 진행 표시 (sticky) */}
              <div style={S("position:sticky;top:0;height:52px;box-sizing:border-box;z-index:3;display:flex;align-items:center;gap:8px;padding:0 14px;background:#fff;border-bottom:1px solid #E6E6E6")}>
                <span style={S("font-size:19px;color:#555;cursor:pointer")} onClick={() => vm.entryGo('landing')}>✕</span>
                <span style={S("flex:1;font-size:13px;font-weight:800;color:#111")}>{({pay:'메가스터디 · 강의 결제',tiers:'보험 상품 선택',terms:'약관·상품설명 확인',apply:'보험 청약서',done:'가입 완료'})[vm.entry]}</span>
                {vm.entry !== 'done' && (<span style={S("font-size:10px;font-weight:700;color:#0B8F58")}>{({pay:'1',tiers:'2',terms:'3',apply:'4'})[vm.entry]}/4</span>)}
              </div>

              <div style={S("padding:16px;display:flex;flex-direction:column;gap:12px")}>
                {(vm.entry === 'pay') && (<>
                  <div style={S("background:#fff;border:1px solid #E6E6E6;border-radius:20px;padding:15px")}>
                    <div style={S("font-size:9.5px;color:#2B4FE8;font-weight:800")}>MEGASTUDY · 인강 결제</div>
                    <div style={S("font-size:14px;font-weight:800;color:#111;margin-top:8px;line-height:1.4")}>2026 메가패스 · 전 강좌 무제한</div>
                    <div style={S("font-size:10.5px;color:#888;margin-top:3px")}>현우진 · 김동욱 · 이명학 등 · 12개월</div>
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
                          {['서울 학군지','서울 비학군지','수도권','지방'].map((o,oi)=>(<div key={oi} onClick={()=>vm.setApply({region:o})} style={S(`font-size:10px;font-weight:600;padding:7px 11px;border-radius:8px;cursor:pointer;border:1.5px solid ${vm.apply.region===o?'#0B7A4A':'#DDD'};background:${vm.apply.region===o?'#0B7A4A':'#fff'};color:${vm.apply.region===o?'#fff':'#555'}`)}>{o}</div>))}
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
                            <input value={vm.apply.c_birth} onChange={e=>vm.setApply({c_birth:e.target.value})} placeholder="생년월일" style={S("flex:1;min-width:80px;box-sizing:border-box;border:1px solid #DDD;border-radius:8px;padding:9px 11px;font-size:11px;font-family:inherit;outline:none")} />
                            <input value={vm.apply.c_phone} onChange={e=>vm.setApply({c_phone:e.target.value})} placeholder="연락처" style={S("flex:1;min-width:90px;box-sizing:border-box;border:1px solid #DDD;border-radius:8px;padding:9px 11px;font-size:11px;font-family:inherit;outline:none")} />
                          </div>
                          <div style={S("display:flex;gap:6px;margin-top:6px")}>
                            {['부','모','기타'].map((o,oi)=>(<div key={oi} onClick={()=>vm.setApply({c_rel:o})} style={S(`font-size:10px;font-weight:600;padding:6px 13px;border-radius:8px;cursor:pointer;border:1.5px solid ${vm.apply.c_rel===o?'#0B7A4A':'#DDD'};background:${vm.apply.c_rel===o?'#0B7A4A':'#fff'};color:${vm.apply.c_rel===o?'#fff':'#666'}`)}>{o}</div>))}
                            <span style={S("font-size:9px;color:#999;align-self:center")}>피보험자와의 관계</span>
                          </div>
                        </div>
                        <div style={S("margin-top:11px")}>
                          <div style={S("font-size:10px;font-weight:700;color:#333;margin-bottom:5px")}>피보험자 (학생)</div>
                          <div style={S("display:flex;gap:6px;flex-wrap:wrap")}>
                            <input value={vm.apply.p_name} onChange={e=>vm.setApply({p_name:e.target.value})} placeholder="성명" style={S("flex:1;min-width:70px;box-sizing:border-box;border:1px solid #DDD;border-radius:8px;padding:9px 11px;font-size:11px;font-family:inherit;outline:none")} />
                            <input value={vm.apply.p_birth} onChange={e=>vm.setApply({p_birth:e.target.value})} placeholder="생년월일" style={S("flex:1;min-width:90px;box-sizing:border-box;border:1px solid #DDD;border-radius:8px;padding:9px 11px;font-size:11px;font-family:inherit;outline:none")} />
                          </div>
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
                  <div style={S("background:linear-gradient(135deg,#0B8F58,#16B37A);color:#fff;font-size:14px;font-weight:700;border-radius:16px;height:52px;display:flex;align-items:center;justify-content:center;cursor:pointer")} onClick={() => vm.entryGo('login')}>재수없수 로그인하러 가기 →</div>
                )}
              </div>
            </div>
          </>)}

          {/* ── 로딩(분석 중) 오버레이 ── */}
          {(vm.loading) && (<>
            <div style={S("position:absolute;inset:0;background:linear-gradient(160deg,#076B41,#0B8F58 55%,#23C088);z-index:70;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:32px")}>
              <img src={IMG_F7F53234} alt="" style={S("width:74px;height:74px;object-fit:contain")} />
              <div style={S("font-size:20px;font-weight:800;color:#fff;text-align:center;line-height:1.4;letter-spacing:-0.3px")}>재수없는 우리 아이!<br/>부담없는 우리집!</div>
              <div style={S("width:40px;height:40px;border:4px solid rgba(255,255,255,0.28);border-top-color:#fff;border-radius:50%;animation:spin 0.9s linear infinite;margin-top:4px")}></div>
              <div style={S("font-size:11.5px;font-weight:600;color:rgba(255,255,255,0.9);text-align:center;min-height:18px")}>{vm.loadStage || '준비하고 있어요…'}</div>
            </div>
          </>)}
        </div>
      </div>
    );
  }
}
export default Component;
