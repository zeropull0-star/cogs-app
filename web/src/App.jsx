// web/src/App.jsx
import React, { useEffect, useMemo, useState } from "react";

const API_BASE  = "/api";
const TOKEN_KEY = "token";
const CO_KEY    = "selected_company_id";

export default function App() {
  const initToken = (() => {
    const t = localStorage.getItem(TOKEN_KEY) || "";
    return !t || t === "undefined" || t === "null" ? "" : t;
  })();

  const [token, setToken]   = useState(initToken);
  const [me, setMe]         = useState(null);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");

  // 회사
  const [companies, setCompanies] = useState([]);
  const [selectedCoId, setSelectedCoId] = useState(
    () => localStorage.getItem(CO_KEY) || ""
  );
  const [editingCoId, setEditingCoId] = useState(null);
  const [coName, setCoName]         = useState("");
  const [coBizNo, setCoBizNo]       = useState("");
  const [coCeo, setCoCeo]           = useState("");
  const [coManager, setCoManager]   = useState("");
  const [coAddr, setCoAddr]         = useState("");
  const [coPhone, setCoPhone]       = useState("");
  const [coLogo, setCoLogo]         = useState("");
  const [coSeal, setCoSeal]         = useState("");
  const [coColor, setCoColor]       = useState("#2563eb");
  const [showCoForm, setShowCoForm] = useState(false);

  // 거래처
  const [vendors, setVendors]             = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [vendorQuery, setVendorQuery]     = useState("");
  const [editingVendorId, setEditingVendorId] = useState(null);
  const [vName, setVName]       = useState("");
  const [vBizNo, setVBizNo]     = useState("");
  const [vCeo, setVCeo]         = useState("");
  const [vManager, setVManager] = useState("");
  const [vAddr, setVAddr]       = useState("");
  const [vPhone, setVPhone]     = useState("");

  // 거래 등록
  const [txKind, setTxKind]   = useState("매출");
  const [txDate, setTxDate]   = useState(() => {
    const d = new Date(); const p = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  });
  const [docNo, setDocNo]     = useState("");
  const [docNoManual, setDocNoManual] = useState(false);
  const [memo, setMemo]       = useState("");
  const [items, setItems]     = useState([{ name:"", spec:"", qty:1, unit_price:0 }]);
  const [txList, setTxList]     = useState([]);
  const [editingTxId, setEditingTxId] = useState(null);
  const [statsText, setStatsText] = useState("");

  // ── API helper ───────────────────────────────────────────
  async function apiFetch(path, opts = {}) {
    const headers = {
      ...(opts.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
    if (res.status === 401) { localStorage.removeItem(TOKEN_KEY); setToken(""); setMe(null); }
    return res;
  }

  // ── 로드 함수 ────────────────────────────────────────────
  async function loadMe() {
    if (!token) return;
    const res = await apiFetch("/auth/me");
    if (res.ok) setMe(await res.json());
  }

  async function loadCompanies() {
    if (!token) return;
    const res = await apiFetch("/companies");
    if (!res.ok) return;
    const data = Array.isArray(await res.json()) ? await res.clone().json() : [];
    // 위 코드 버그 수정
    const res2 = await apiFetch("/companies");
    if (!res2.ok) return;
    const list = await res2.json();
    setCompanies(Array.isArray(list) ? list : []);
    if (!selectedCoId && list.length) {
      const id = String(list[0].id);
      setSelectedCoId(id); localStorage.setItem(CO_KEY, id);
    }
  }

  async function loadVendors() {
    if (!token) return;
    const res = await apiFetch("/vendors");
    if (!res.ok) return;
    const list = await res.json();
    setVendors(Array.isArray(list) ? list : []);
    if (!selectedVendorId && list.length) setSelectedVendorId(String(list[0].id));
  }

  async function loadTx() {
    if (!token) return;
    const res = await apiFetch("/tx");
    if (!res.ok) return;
    setTxList(Array.isArray(await res.json()) ? await res.clone().json() : []);
    // 위 버그 수정
    const res2 = await apiFetch("/tx");
    if (!res2.ok) return;
    const data = await res2.json();
    setTxList(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    if (!token) return;
    apiFetch("/auth/me").then(r => r.ok && r.json().then(setMe));
    apiFetch("/companies").then(r => r.ok && r.json().then(list => {
      const arr = Array.isArray(list) ? list : [];
      setCompanies(arr);
      if (!selectedCoId && arr.length) {
        const id = String(arr[0].id);
        setSelectedCoId(id); localStorage.setItem(CO_KEY, id);
      }
    }));
    apiFetch("/vendors").then(r => r.ok && r.json().then(list => {
      const arr = Array.isArray(list) ? list : [];
      setVendors(arr);
      if (!selectedVendorId && arr.length) setSelectedVendorId(String(arr[0].id));
    }));
    apiFetch("/tx").then(r => r.ok && r.json().then(d => setTxList(Array.isArray(d) ? d : [])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── 로그인/아웃 ──────────────────────────────────────────
  async function onLogin() {
    const body = new URLSearchParams();
    body.set("username", username); body.set("password", password);
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) { alert(`로그인 실패: ${await res.text()}`); return; }
    const data = await res.json();
    const t = data?.access_token || "";
    if (!t || t === "undefined") { alert("로그인 토큰 오류"); return; }
    localStorage.setItem(TOKEN_KEY, t); setToken(t);
  }

  function onLogout() { localStorage.removeItem(TOKEN_KEY); setToken(""); setMe(null); }

  // ── 회사 관리 ────────────────────────────────────────────
  const selectedCo = useMemo(
    () => companies.find(c => String(c.id) === String(selectedCoId)) || null,
    [companies, selectedCoId]
  );

  // 발행회사 변경 시 → 수동 입력 중이 아니면 문서번호 미리보기 자동 갱신
  useEffect(() => {
    if (docNoManual) return; // 사용자가 직접 입력 중이면 건드리지 않음
    if (!selectedCo) { setDocNo(""); return; }
    const prefix = (selectedCo.doc_prefix || "").trim() || "BWIS";
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    const dateStr = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
    setDocNo(`${prefix}-${dateStr}-????`);
  }, [selectedCoId, selectedCo, docNoManual]);

  function beginEditCo(co) {
    setEditingCoId(co.id); setCoName(co.name || ""); setCoBizNo(co.biz_no || "");
    setCoCeo(co.ceo || ""); setCoAddr(co.addr || ""); setCoPhone(co.phone || "");
    setCoLogo(co.logo_path || ""); setCoSeal(co.seal_path || "");
    setShowCoForm(true);
  }

  function cancelEditCo() {
    setEditingCoId(null); setCoName(""); setCoBizNo(""); setCoCeo("");
    setCoManager(""); setCoAddr(""); setCoPhone(""); setCoLogo(""); setCoSeal("");
    setCoColor("#2563eb"); setShowCoForm(false);
  }

  async function saveCo() {
    if (!coName.trim()) { alert("회사명을 입력하세요."); return; }
    const payload = { name: coName.trim(), biz_no: coBizNo.trim() || null,
      ceo: coCeo.trim() || null, manager: coManager.trim() || null,
      addr: coAddr.trim() || null, phone: coPhone.trim() || null,
      logo_path: coLogo.trim() || null, seal_path: coSeal.trim() || null,
      color: coColor || "#2563eb" };
    const isEdit = editingCoId !== null;
    const url    = isEdit ? `/companies/${editingCoId}` : `/companies`;
    const res    = await apiFetch(url, { method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { alert(`저장 실패: ${await res.text()}`); return; }
    cancelEditCo();
    const res2 = await apiFetch("/companies");
    if (res2.ok) setCompanies(await res2.json());
  }

  async function deleteCo(id) {
    if (!window.confirm("이 회사를 삭제할까요?")) return;
    const res = await apiFetch(`/companies/${id}`, { method: "DELETE" });
    if (!res.ok) { alert(`삭제 실패: ${await res.text()}`); return; }
    if (String(selectedCoId) === String(id)) { setSelectedCoId(""); localStorage.removeItem(CO_KEY); }
    const res2 = await apiFetch("/companies");
    if (res2.ok) setCompanies(await res2.json());
  }

  function onSelectCo(id) {
    setSelectedCoId(id); localStorage.setItem(CO_KEY, id);
  }

  // ── 거래처 관리 ──────────────────────────────────────────
  const selectedVendor = useMemo(
    () => vendors.find(v => String(v.id) === String(selectedVendorId)) || null,
    [vendors, selectedVendorId]
  );

  const filteredVendors = useMemo(() => {
    const q = (vendorQuery || "").trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter(v =>
      `${v.name} ${v.biz_no || ""} ${v.ceo || ""} ${v.phone || ""} ${v.addr || ""}`
        .toLowerCase().includes(q));
  }, [vendors, vendorQuery]);

  function beginEditVendor() {
    if (!selectedVendor) { alert("거래처를 먼저 선택하세요."); return; }
    setEditingVendorId(selectedVendor.id);
    setVName(selectedVendor.name || ""); setVBizNo(selectedVendor.biz_no || "");
    setVCeo(selectedVendor.ceo || ""); setVManager(selectedVendor.manager || "");
    setVAddr(selectedVendor.addr || ""); setVPhone(selectedVendor.phone || "");
  }

  function cancelEditVendor() {
    setEditingVendorId(null); setVName(""); setVBizNo(""); setVCeo("");
    setVManager(""); setVAddr(""); setVPhone("");
  }

  async function saveVendor() {
    if (!vName.trim()) { alert("거래처명을 입력하세요."); return; }
    const payload = { name: vName.trim(), biz_no: vBizNo.trim() || null,
      ceo: vCeo.trim() || null, manager: vManager.trim() || null,
      addr: vAddr.trim() || null, phone: vPhone.trim() || null };
    const isEdit = editingVendorId !== null;
    const savedId = editingVendorId;
    const res = await apiFetch(isEdit ? `/vendors/${editingVendorId}` : `/vendors`, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { alert(`저장 실패: ${await res.text()}`); return; }
    cancelEditVendor();
    const res2 = await apiFetch("/vendors");
    if (res2.ok) {
      const list = await res2.json();
      setVendors(Array.isArray(list) ? list : []);
      if (isEdit && savedId) setSelectedVendorId(String(savedId));
    }
  }

  async function deleteVendor(id) {
    if (!window.confirm("선택한 거래처를 삭제할까요?")) return;
    const res = await apiFetch(`/vendors/${id}`, { method: "DELETE" });
    if (!res.ok) { alert(`삭제 실패: ${await res.text()}`); return; }
    if (String(selectedVendorId) === String(id)) setSelectedVendorId("");
    cancelEditVendor();
    const res2 = await apiFetch("/vendors");
    if (res2.ok) setVendors(await res2.json());
  }

  // ── 거래 등록 ────────────────────────────────────────────
  const supplyPreview = useMemo(
    () => items.reduce((s, it) => s + Number(it.qty||0) * Number(it.unit_price||0), 0),
    [items]
  );

  function beginEditTx(tx) {
    setEditingTxId(tx.id);
    setTxKind(tx.kind);
    setSelectedVendorId(String(tx.vendor_id));
    const d = new Date(tx.tx_date);
    const p = n => String(n).padStart(2, "0");
    setTxDate(`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`);
    setDocNo(tx.doc_no || ""); setDocNoManual(true);
    setMemo(tx.description || "");
    setItems(tx.items && tx.items.length
      ? tx.items.map(it => ({ name: it.name, spec: it.spec || "", qty: it.qty, unit_price: it.unit_price }))
      : [{ name:"", spec:"", qty:1, unit_price:0 }]);
    window.scrollTo({ top: document.getElementById("tx-form")?.offsetTop || 0, behavior: "smooth" });
  }

  function cancelEditTx() {
    setEditingTxId(null);
    setMemo(""); setDocNo(""); setDocNoManual(false);
    setItems([{ name:"", spec:"", qty:1, unit_price:0 }]);
  }

  async function saveTx() {
    if (!selectedVendorId) { alert("거래처를 선택하세요."); return; }
    const cleanItems = items
      .filter(it => (it.name || "").trim().length > 0)
      .map(it => ({ name: it.name.trim(), spec: (it.spec||"").trim() || null,
                    qty: Number(it.qty||0), unit_price: Number(it.unit_price||0) }));
    if (!cleanItems.length) { alert("품목을 1개 이상 입력하세요."); return; }
    // ????가 포함된 미리보기 값은 자동생성으로 처리
    const finalDocNo = (docNo.trim() && !docNo.includes("????")) ? docNo.trim() : null;
    const body = JSON.stringify({ kind: txKind, vendor_id: Number(selectedVendorId),
      company_id: selectedCoId ? Number(selectedCoId) : null,
      tx_date: new Date(txDate).toISOString(), description: memo.trim() || null,
      vat_rate: 0.1, doc_no: finalDocNo, items: cleanItems });
    const isEdit = editingTxId !== null;
    const res = await apiFetch(isEdit ? `/tx/${editingTxId}` : "/tx", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" }, body,
    });
    if (!res.ok) { alert(`${isEdit ? "수정" : "등록"} 실패: ${await res.text()}`); return; }
    cancelEditTx();
    const res2 = await apiFetch("/tx");
    if (res2.ok) setTxList(await res2.json());
  }

  async function deleteTx(txId) {
    if (!window.confirm(`TX ${txId} 삭제할까요?`)) return;
    const res = await apiFetch(`/tx/${txId}`, { method: "DELETE" });
    if (!res.ok) { alert(`삭제 실패: ${await res.text()}`); return; }
    const res2 = await apiFetch("/tx");
    if (res2.ok) setTxList(await res2.json());
  }

  // ── 문서 다운로드 ────────────────────────────────────────
  async function downloadDoc(txId, docTypeKo, ext, filename) {
    if (!selectedCoId) { alert("먼저 발행 회사를 선택하세요."); return; }
    const path = `/tx/${txId}/${ext}?doc_type=${encodeURIComponent(docTypeKo)}&company_id=${selectedCoId}`;
    const res  = await apiFetch(path);
    if (!res.ok) { alert(`다운로드 실패: ${await res.text()}`); return; }
    const blob   = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl; a.download = filename; a.click();
    URL.revokeObjectURL(blobUrl);
  }

  // ── 통계 ─────────────────────────────────────────────────
  async function loadStats(rk) {
    const res = await apiFetch(`/stats/summary?range=${rk}`);
    if (!res.ok) { alert(`조회 실패: ${await res.text()}`); return; }
    const d = await res.json();
    const f = n => Number(n).toLocaleString();
    setStatsText([
      `기간: ${d.range_label}`,
      `매출 — 공급가: ${f(d.sales.supply)} / 부가세: ${f(d.sales.vat)} / 합계: ${f(d.sales.total)}`,
      `매입 — 공급가: ${f(d.purchase.supply)} / 부가세: ${f(d.purchase.vat)} / 합계: ${f(d.purchase.total)}`,
      `전체 — 공급가: ${f(d.overall.supply)} / 부가세: ${f(d.overall.vat)} / 합계: ${f(d.overall.total)}`,
      `건수: ${d.count}건`,
    ].join("\n"));
  }

  async function downloadStatsXlsx(rk) {
    const res = await apiFetch(`/stats/xlsx?range=${rk}`);
    if (!res.ok) { alert(`실패: ${await res.text()}`); return; }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `ledger_stats_${rk}.xlsx`; a.click();
  }

  // ═══════════════════════════════════════════════════════════
  //  Render
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="wrap">
      <style>{css}</style>

      <header className="top">
        <div className="brand">📒 장부 시스템</div>
        <div className="right">
          {token && <>
            <span className="muted">{me?.username || "logged-in"}</span>
            <button className="btn" onClick={onLogout}>로그아웃</button>
          </>}
        </div>
      </header>

      {!token ? (
        <div className="card login">
          <div className="h">로그인</div>
          <div className="row">
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="username" />
            <input value={password} onChange={e => setPassword(e.target.value)} placeholder="password" type="password"
              onKeyDown={e => e.key === "Enter" && onLogin()} />
            <button className="btn primary" onClick={onLogin}>로그인</button>
          </div>
          <div className="muted small">기본: admin / admin1234</div>
        </div>
      ) : (
        <div className="grid">

          {/* ── 발행 회사 선택 ── */}
          <section className="card wide company-bar">
            <div className="company-bar-inner">
              <div className="co-header-row">
                <span className="co-section-title">🏢 발행 회사 선택</span>
                {!selectedCoId && (
                  <span className="co-warn">⚠️ PDF/Excel 발행 전 회사를 선택하세요</span>
                )}
                {selectedCo && (
                  <span className="co-selected-badge">✅ {selectedCo.name} 선택됨</span>
                )}
              </div>
              <div className="co-tabs">
                {companies.map(co => (
                  <button key={co.id}
                    className={`btn co-tab ${String(selectedCoId) === String(co.id) ? "co-active" : ""}`}
                    onClick={() => onSelectCo(String(co.id))}>
                    {String(selectedCoId) === String(co.id) ? "✓ " : ""}{co.name}
                  </button>
                ))}
                <button className="btn" onClick={() => { cancelEditCo(); setShowCoForm(v => !v); }}>
                  {showCoForm ? "✕ 닫기" : "+ 회사 추가"}
                </button>
              </div>
              {selectedCo && (
                <div className="co-info">
                  <span className="co-info-item">🏷 {selectedCo.biz_no || "사업자번호 없음"}</span>
                  <span className="co-info-item">👤 {selectedCo.ceo || "대표자 없음"}</span>
                  <span className="co-info-item">📞 {selectedCo.phone || "연락처 없음"}</span>
                  <div style={{marginLeft:"auto",display:"flex",gap:"6px"}}>
                    <button className="btn small-btn" onClick={() => beginEditCo(selectedCo)}>✏️ 편집</button>
                    <button className="btn danger small-btn" onClick={() => deleteCo(selectedCo.id)}>삭제</button>
                  </div>
                </div>
              )}
            </div>

            {showCoForm && (
              <div className="co-form">
                <div className="h2">{editingCoId ? "회사 수정" : "회사 추가"}</div>
                <div className="form2">
                  <input value={coName}    onChange={e=>setCoName(e.target.value)}    placeholder="회사명 (필수)" />
                  <input value={coBizNo}  onChange={e=>setCoBizNo(e.target.value)}  placeholder="사업자등록번호" />
                  <input value={coCeo}    onChange={e=>setCoCeo(e.target.value)}    placeholder="대표자" />
                  <input value={coManager} onChange={e=>setCoManager(e.target.value)} placeholder="담당자" />
                  <input value={coAddr}   onChange={e=>setCoAddr(e.target.value)}   placeholder="주소" />
                  <input value={coPhone}  onChange={e=>setCoPhone(e.target.value)}  placeholder="연락처" />
                  <input value={coLogo}   onChange={e=>setCoLogo(e.target.value)}   placeholder="로고 이미지 경로 (서버 절대경로)" />
                  <input value={coSeal}   onChange={e=>setCoSeal(e.target.value)}   placeholder="직인 이미지 경로 (서버 절대경로)" />
                  <div className="row" style={{alignItems:"center",gap:10}}>
                    <label style={{fontSize:12,color:"var(--muted)"}}>대표 색상</label>
                    <input type="color" value={coColor} onChange={e=>setCoColor(e.target.value)}
                      style={{width:40,height:30,padding:2,border:"1px solid var(--border)",borderRadius:6,cursor:"pointer"}} />
                    <span style={{fontSize:12,color:"var(--muted)"}}>{coColor}</span>
                  </div>
                  <div className="row">
                    <button className="btn primary" onClick={saveCo}>{editingCoId ? "수정 저장" : "추가"}</button>
                    <button className="btn" onClick={cancelEditCo}>취소</button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ── 거래처 관리 ── */}
          <section className="card">
            <div className="h">거래처</div>

            <div className="vendorBar">
              <input value={vendorQuery} onChange={e => setVendorQuery(e.target.value)}
                placeholder="검색 (이름/사업자번호/대표자/연락처)" />
              <select value={selectedVendorId} onChange={e => setSelectedVendorId(e.target.value)}>
                <option value="">거래처 선택</option>
                {filteredVendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name}{v.biz_no ? ` (${v.biz_no})` : ""}</option>
                ))}
              </select>
              <div className="vendorBarBtns">
                <button className="btn" onClick={beginEditVendor} disabled={!selectedVendorId}>수정</button>
                <button className="btn danger" onClick={() => deleteVendor(selectedVendorId)} disabled={!selectedVendorId}>삭제</button>
              </div>
            </div>

            {selectedVendor && (
              <div className="selectedInfo">
                <div className="name">{selectedVendor.name}</div>
                <div className="muted small">
                  {selectedVendor.biz_no ? `사업자: ${selectedVendor.biz_no} · ` : ""}
                  {selectedVendor.ceo   ? `대표: ${selectedVendor.ceo} · `    : ""}
                  {selectedVendor.phone ? `연락처: ${selectedVendor.phone}`   : ""}
                </div>
                {selectedVendor.addr && <div className="muted small">주소: {selectedVendor.addr}</div>}
              </div>
            )}

            <div className="sep" />
            <div className="h2">{editingVendorId ? "거래처 수정" : "거래처 등록"}</div>
            <div className="form">
              <input value={vName}    onChange={e=>setVName(e.target.value)}    placeholder="거래처명 (필수)" />
              <input value={vBizNo}  onChange={e=>setVBizNo(e.target.value)}  placeholder="사업자등록번호" />
              <input value={vCeo}    onChange={e=>setVCeo(e.target.value)}    placeholder="대표자" />
              <input value={vManager} onChange={e=>setVManager(e.target.value)} placeholder="담당자" />
              <input value={vAddr}   onChange={e=>setVAddr(e.target.value)}   placeholder="주소" />
              <input value={vPhone}  onChange={e=>setVPhone(e.target.value)}  placeholder="연락처" />
              <div className="row">
                <button className="btn primary" onClick={saveVendor}>
                  {editingVendorId ? "수정 저장" : "등록"}
                </button>
                {editingVendorId && <button className="btn" onClick={cancelEditVendor}>취소</button>}
              </div>
            </div>
          </section>

          {/* ── 거래 등록/수정 ── */}
          <section className="card" id="tx-form">
            <div className="h">
              {editingTxId ? <span>✏️ 거래 수정 <span className="co-info-item">TX #{editingTxId}</span></span> : "거래 등록"}
            </div>
            <div className="row">
              <select value={txKind} onChange={e => setTxKind(e.target.value)}>
                <option value="매출">매출</option>
                <option value="매입">매입</option>
              </select>
              <select value={selectedVendorId} onChange={e => setSelectedVendorId(e.target.value)}>
                <option value="">거래처 선택</option>
                {filteredVendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              <input type="datetime-local" value={txDate} onChange={e => setTxDate(e.target.value)} />
            </div>
            <div className="row" style={{marginTop:10}}>
              <input value={docNo} onChange={e => {
                  const v = e.target.value;
                  setDocNo(v);
                  setDocNoManual(v.length > 0); // 비우면 자동모드 복귀
                }}
                placeholder="문서번호 (비우면 발행회사 기준 자동 생성)" />
            </div>
            <textarea value={memo} onChange={e => setMemo(e.target.value)}
              placeholder="메모/건명 (선택)" className="ta" />

            <div className="h2">품목</div>
            <div className="items">
              {items.map((it, idx) => (
                <div key={idx} className="row itemRow">
                  <input value={it.name} onChange={e => {
                    const c=[...items]; c[idx]={...c[idx],name:e.target.value}; setItems(c);
                  }} placeholder="품목명" style={{flex:"1 1 0"}} />
                  <input value={it.spec} onChange={e => {
                    const c=[...items]; c[idx]={...c[idx],spec:e.target.value}; setItems(c);
                  }} placeholder="규격" style={{flex:"1 1 0"}} />
                  <input value={it.qty} type="number" min="0" onChange={e => {
                    const c=[...items]; c[idx]={...c[idx],qty:Number(e.target.value)}; setItems(c);
                  }} placeholder="수량" style={{maxWidth:"70px"}} />
                  <input value={it.unit_price} type="number" min="0" onChange={e => {
                    const c=[...items]; c[idx]={...c[idx],unit_price:Number(e.target.value)}; setItems(c);
                  }} placeholder="단가" style={{maxWidth:"120px"}} />
                  <span className="itemAmt">{Number(it.qty||0) * Number(it.unit_price||0) > 0
                    ? (Number(it.qty||0) * Number(it.unit_price||0)).toLocaleString() + "원"
                    : ""}</span>
                  <button className="btn danger" style={{flex:"0 0 auto"}} onClick={() => {
                    const c = items.filter((_,i)=>i!==idx);
                    setItems(c.length ? c : [{name:"",spec:"",qty:1,unit_price:0}]);
                  }}>✕</button>
                </div>
              ))}
              <div className="row" style={{marginTop:8}}>
                <button className="btn" onClick={() => setItems([...items,{name:"",spec:"",qty:1,unit_price:0}])}>
                  + 품목 추가
                </button>
                <div className="sum">공급가: {Number(supplyPreview).toLocaleString()}원</div>
              </div>
            </div>
            <div className="row" style={{marginTop:8}}>
              <button className="btn primary full" onClick={saveTx}>
                {editingTxId ? "✏️ 수정 저장" : "거래 등록"}
              </button>
              {editingTxId && (
                <button className="btn" style={{flex:"0 0 auto"}} onClick={cancelEditTx}>취소</button>
              )}
            </div>
          </section>

          {/* ── 통계/백업 ── */}
          <section className="card wide">
            <div className="h">통계 / 백업 (기간 합계)</div>
            <div className="row" style={{flexWrap:"wrap",gap:8}}>
              {[["7d","1주"],["1m","1달"],["1y","1년"]].map(([k,l]) => (
                <React.Fragment key={k}>
                  <button className="btn" onClick={() => loadStats(k)}>최근 {l} 합계</button>
                  <button className="btn primary" onClick={() => downloadStatsXlsx(k)}>최근 {l} 엑셀 백업</button>
                </React.Fragment>
              ))}
            </div>
            {statsText
              ? <pre className="statsBox">{statsText}</pre>
              : <div className="muted small" style={{marginTop:8}}>버튼을 눌러 기간 합계를 확인하세요.</div>}
          </section>

          {/* ── 거래 내역 ── */}
          <section className="card wide">
            <div className="h">
              거래내역 (총 {txList.length.toLocaleString()}건)
              {selectedCo && <span className="co-badge">발행 회사: {selectedCo.name}</span>}
            </div>
            <div className="txTable">
              <table>
                <thead>
                  <tr>
                    <th>ID</th><th>구분</th><th>거래처</th>
                    <th>공급가</th><th>부가세</th><th className="fw">합계</th>
                    <th>일시</th><th>문서번호</th>
                    <th>PDF</th><th>Excel</th>
                    <th>수정</th><th>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {txList.map(tx => {
                    const when = tx.tx_date
                      ? new Date(tx.tx_date).toLocaleString("ko-KR",{year:"2-digit",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})
                      : "";
                    const vname = tx.vendor_name ||
                      vendors.find(x=>String(x.id)===String(tx.vendor_id))?.name || String(tx.vendor_id);
                    return (
                      <tr key={tx.id}>
                        <td>{tx.id}</td>
                        <td><span className={`badge ${tx.kind==="매출"?"sale":"buy"}`}>{tx.kind}</span></td>
                        <td className="ellipsis" title={vname}>{vname}</td>
                        <td className="num">{Number(tx.supply_amount||0).toLocaleString()}</td>
                        <td className="num">{Number(tx.vat_amount||0).toLocaleString()}</td>
                        <td className="num fw">{Number(tx.total_amount||0).toLocaleString()}</td>
                        <td className="nowrap">{when}</td>
                        <td className="ellipsis" title={tx.doc_no||""}>{tx.doc_no||""}</td>
                        <td className="btnCell">
                          {[["견적서","견적서"],["발주서","발주서"],["거래명세서","명세서"]].map(([k,l])=>(
                            <button key={k} className="btn pdf-btn xsBtn"
                              onClick={()=>downloadDoc(tx.id,k,"pdf",`${l}_TX${tx.id}.pdf`)}>📄{l}</button>
                          ))}
                        </td>
                        <td className="btnCell">
                          {[["견적서","견적서"],["발주서","발주서"],["거래명세서","명세서"]].map(([k,l])=>(
                            <button key={k} className="btn excel-btn xsBtn"
                              onClick={()=>downloadDoc(tx.id,k,"excel",`${l}_TX${tx.id}.xlsx`)}>📊{l}</button>
                          ))}
                        </td>
                        <td><button className="btn xsBtn" onClick={()=>beginEditTx(tx)}>✏️</button>
                          {(() => {
                            const co = companies.find(c => String(c.id) === String(tx.company_id));
                            if (!co) return null;
                            const color = co.color || "#2563eb";
                            // 회사명 축약: 괄호/주식회사 등 제거 후 앞 2~3글자
                            const short = co.name.replace(/\(주\)|주식회사|\(|\)/g,"").trim().slice(0,2);
                            return <span style={{marginLeft:4,display:"inline-block",padding:"2px 6px",borderRadius:"999px",fontSize:"11px",fontWeight:700,background:color+"22",color,border:`1px solid ${color}55`}}>{short}</span>;
                          })()}
                        </td>
                        <td><button className="btn danger xsBtn" onClick={()=>deleteTx(tx.id)}>삭제</button></td>
                      </tr>
                    );
                  })}
                  {txList.length===0 && <tr><td colSpan={12} className="muted pad" style={{textAlign:"center"}}>거래내역이 없습니다.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      )}
    </div>
  );
}

const css = `
:root{
  --bg:#080f20;
  --card:rgba(255,255,255,0.055);
  --border:rgba(255,255,255,0.10);
  --text:rgba(255,255,255,0.93);
  --muted:rgba(255,255,255,0.60);
  --primary:#4f6ef7;
  --danger:#e24d4d;
  --green:#22c55e;
}
*{box-sizing:border-box;}
body{
  margin:0;
  background: radial-gradient(1400px 900px at 15% 5%, rgba(79,110,247,0.22),transparent),
              radial-gradient(900px 700px at 85% 15%, rgba(0,200,140,0.14),transparent),
              var(--bg);
  color:var(--text);
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans KR",sans-serif;
}
.wrap{max-width:1500px;margin:0 auto;padding:18px;}
.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
.brand{font-size:18px;font-weight:800;}
.right{display:flex;gap:10px;align-items:center;}
.grid{display:grid;grid-template-columns:380px 1fr;gap:14px;}
.wide{grid-column:1/-1;}
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px;backdrop-filter:blur(12px);}
.login{max-width:680px;margin:50px auto;}
.h{font-size:15px;font-weight:800;margin-bottom:10px;}
.h2{font-size:12px;font-weight:700;margin:10px 0 8px;opacity:.9;}
.muted{color:var(--muted);}
.small{font-size:12px;}
.pad{padding-top:10px;}
.fw{font-weight:700;}
.sep{height:1px;background:var(--border);margin:12px 0;}

input,select,button,textarea{line-height:1.2;display:inline-flex;align-items:center;}
input,select{height:40px;}
textarea{height:80px;padding:10px 12px;display:block;}
input,select,textarea{
  width:100%;background:rgba(0,0,0,0.28);
  border:1px solid var(--border);color:var(--text);
  border-radius:12px;padding:0 12px;outline:none;
}
input:focus,select:focus,textarea:focus{border-color:rgba(79,110,247,0.6);}
.ta{margin-top:10px;}

.row{display:flex;gap:8px;align-items:center;}
.row>*{flex:1;}
.row .btn{flex:0 0 auto;}
.full{width:100%;margin-top:12px;height:44px;font-size:14px;font-weight:700;}

.btn{
  height:40px;padding:0 14px;border-radius:12px;
  border:1px solid var(--border);background:rgba(255,255,255,0.07);
  color:var(--text);cursor:pointer;
  display:inline-flex;align-items:center;justify-content:center;
  gap:6px;white-space:nowrap;font-size:13px;
  transition:background .15s;
}
.btn:hover{background:rgba(255,255,255,0.12);}
.btn:disabled{opacity:.4;cursor:not-allowed;}
.primary{background:rgba(79,110,247,0.85);border-color:rgba(79,110,247,0.9);}
.primary:hover{background:rgba(79,110,247,0.97);}
.danger{background:rgba(226,77,77,0.82);border-color:rgba(226,77,77,0.9);}
.danger:hover{background:rgba(226,77,77,0.97);}
.excel-btn{background:rgba(22,163,74,0.75);border-color:rgba(22,163,74,0.9);font-weight:600;}
.excel-btn:hover{background:rgba(22,163,74,0.95);box-shadow:0 2px 8px rgba(22,163,74,0.4);}
.pdf-btn{background:rgba(220,38,38,0.7);border-color:rgba(220,38,38,0.85);font-weight:600;}
.pdf-btn:hover{background:rgba(220,38,38,0.9);box-shadow:0 2px 8px rgba(220,38,38,0.35);}
.small-btn{height:30px;padding:0 10px;font-size:12px;}

.form{display:flex;flex-direction:column;gap:10px;}
.form2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.form2>div,.form2 input{grid-column:1/-1;}

/* 회사 바 */
.company-bar{padding:14px 18px;border:2px solid rgba(79,110,247,0.4)!important;background:linear-gradient(135deg,rgba(27,42,74,0.07) 0%,rgba(37,99,235,0.04) 100%);}
.company-bar-inner{display:flex;flex-direction:column;gap:10px;}
.co-header-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.co-section-title{font-size:14px;font-weight:700;color:var(--fg);}
.co-warn{font-size:12px;color:#f59e0b;background:rgba(245,158,11,0.1);
  padding:2px 10px;border-radius:20px;border:1px solid rgba(245,158,11,0.3);}
.co-selected-badge{font-size:12px;color:#22c55e;background:rgba(34,197,94,0.1);
  padding:2px 10px;border-radius:20px;border:1px solid rgba(34,197,94,0.3);}
.co-tabs{display:flex;gap:8px;flex-wrap:wrap;}
.co-tab{border-color:var(--border);transition:all 0.15s;}
.co-active{background:rgba(27,42,74,0.9)!important;border-color:rgba(27,42,74,1)!important;
  box-shadow:0 2px 10px rgba(27,42,74,0.4)!important;font-weight:700!important;}
.co-info{display:flex;gap:8px;align-items:center;font-size:12px;color:var(--muted);
  flex-wrap:wrap;background:rgba(79,110,247,0.06);padding:8px 10px;border-radius:8px;}
.co-info-item{background:rgba(255,255,255,0.08);padding:2px 8px;border-radius:12px;
  border:1px solid var(--border);}
.co-form{margin-top:12px;padding-top:12px;border-top:1px solid var(--border);}
.co-badge{font-size:11px;font-weight:400;margin-left:10px;color:var(--muted);
  background:rgba(79,110,247,0.2);padding:2px 8px;border-radius:20px;}

/* 거래처 바 */
.vendorBar{display:flex;flex-direction:column;gap:10px;}
.vendorBarBtns{display:flex;gap:8px;}
.vendorBarBtns .btn{flex:1 1 auto;}
.selectedInfo{margin-top:10px;padding:10px 12px;border:1px solid var(--border);
  border-radius:12px;background:rgba(0,0,0,0.18);}
.selectedInfo .name{font-weight:800;margin-bottom:4px;}

/* 품목 */
.items{margin-top:8px;}
.itemRow input{min-width:0;}
.itemAmt{flex:0 0 auto;font-size:12px;font-weight:700;color:var(--primary);white-space:nowrap;min-width:80px;text-align:right;}
.sum{flex:0 0 auto;font-weight:800;font-size:13px;}

/* 배지 */
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;}
.sale{background:rgba(79,110,247,0.3);color:#93c5fd;}
.buy{background:rgba(226,77,77,0.28);color:#fca5a5;}

/* 통계 */
.statsBox{margin-top:10px;background:rgba(0,0,0,0.22);border:1px solid var(--border);
  border-radius:12px;padding:10px 12px;white-space:pre-wrap;font-size:13px;}

/* 거래내역 테이블 */
.txTable{margin-top:10px;overflow-x:auto;padding-bottom:4px;}
.txTable table{
  width:100%;border-collapse:collapse;font-size:12px;
  min-width:1200px;white-space:nowrap;
}
.txTable thead tr{
  background:rgba(79,110,247,0.18);
  border-bottom:2px solid rgba(79,110,247,0.4);
}
.txTable th{
  padding:9px 10px;text-align:left;font-weight:700;font-size:11px;
  color:rgba(255,255,255,0.75);letter-spacing:0.03em;
}
.txTable tbody tr{border-bottom:1px solid var(--border);}
.txTable tbody tr:hover{background:rgba(255,255,255,0.04);}
.txTable td{padding:7px 10px;vertical-align:middle;}
.ellipsis{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;}
.nowrap{white-space:nowrap;}
.num{text-align:right;font-variant-numeric:tabular-nums;}
.btnCell{display:flex;gap:3px;align-items:center;flex-wrap:nowrap;}
.xsBtn{height:26px!important;padding:0 7px!important;font-size:11px!important;border-radius:8px!important;}
`;