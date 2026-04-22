// web/src/App.jsx
import React, { useEffect, useMemo, useState } from "react";

const API_BASE  = "/api";
const TOKEN_KEY = "token";
const CO_KEY    = "selected_company_id";
const PAID_KEY  = "paid_tx_ids";

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
  const [vatIncluded, setVatIncluded] = useState(false); // 단가가 VAT 포함 가격인지
  const [txDate, setTxDate]   = useState(() => {
    const d = new Date(); const p = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  });
  const [docNo, setDocNo]     = useState("");
  const [memo, setMemo]       = useState("");
  const [items, setItems]     = useState([{ name:"", spec:"", qty:1, unit_price:0 }]);
  const [txList, setTxList]     = useState([]);
  const [editingTxId, setEditingTxId] = useState(null);
  const [statsText, setStatsText] = useState("");

  // 거래내역 뷰: ""=거래처별 그룹화, 특정 ID=해당 거래처 flat 테이블
  const [txFilterVendorId, setTxFilterVendorId] = useState("");
  // 거래내역 발행회사 필터: ""=전체, "none"=회사없음, 특정 ID=해당 회사
  const [txFilterCompanyId, setTxFilterCompanyId] = useState("");
  // 거래내역 정렬: "desc"=최신순, "asc"=오래된순
  const [txSortOrder, setTxSortOrder] = useState("desc");
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());

  // 매입 입금완료 체크 (localStorage 저장)
  const [paidIds, setPaidIds] = useState(() => {
    try {
      const raw = localStorage.getItem(PAID_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr.map(String) : []);
    } catch { return new Set(); }
  });
  function togglePaid(txId) {
    setPaidIds(prev => {
      const n = new Set(prev);
      const k = String(txId);
      if (n.has(k)) n.delete(k); else n.add(k);
      try { localStorage.setItem(PAID_KEY, JSON.stringify([...n])); } catch {}
      return n;
    });
  }

  // 거래처 관리: 목록 펼치기 토글
  const [vendorListOpen, setVendorListOpen] = useState(false);
  // 거래내역 필터: 거래처 선택 목록 펼치기
  const [txFilterListOpen, setTxFilterListOpen] = useState(false);
  // 거래내역 그룹 아코디언 가시성 (기본 숨김)
  const [txGroupsVisible, setTxGroupsVisible] = useState(false);
  // 거래 등록 - 거래처 검색 (거래내역까지 연동 필터)
  const [txVendorQuery, setTxVendorQuery] = useState("");
  // PDF 드래그앤드랍 상태
  const [pdfDragActive, setPdfDragActive] = useState(false);

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

  // 문서번호: 비워두면 저장 시 백엔드가 발행회사 prefix 기준 자동 생성

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
    setDocNo(tx.doc_no || "");
    setMemo(tx.description || "");
    setItems(tx.items && tx.items.length
      ? tx.items.map(it => ({ name: it.name, spec: it.spec || "", qty: it.qty, unit_price: it.unit_price }))
      : [{ name:"", spec:"", qty:1, unit_price:0 }]);
    window.scrollTo({ top: document.getElementById("tx-form")?.offsetTop || 0, behavior: "smooth" });
  }

  function cancelEditTx() {
    setEditingTxId(null);
    setMemo(""); setDocNo("");
    setItems([{ name:"", spec:"", qty:1, unit_price:0 }]);
  }

  async function saveTx() {
    if (!selectedVendorId) { alert("거래처를 선택하세요."); return; }
    const cleanItems = items
      .filter(it => (it.name || "").trim().length > 0)
      .map(it => ({ name: it.name.trim(), spec: (it.spec||"").trim() || null,
                    qty: Number(it.qty||0), unit_price: Number(it.unit_price||0) }));
    if (!cleanItems.length) { alert("품목을 1개 이상 입력하세요."); return; }
    const finalDocNo = docNo.trim() || null;
    const body = JSON.stringify({ kind: txKind, vendor_id: Number(selectedVendorId),
      company_id: selectedCoId ? Number(selectedCoId) : null,
      tx_date: new Date(txDate).toISOString(), description: memo.trim() || null,
      vat_rate: 0.1, vat_included: vatIncluded,
      doc_no: finalDocNo, items: cleanItems });
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

  // ── PDF 견적서에서 품목 스캔 ─────────────────────────────
  async function importItemsFromPdf(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("PDF 파일만 업로드 가능합니다."); return;
    }
    const fd = new FormData(); fd.append("file", file);
    const res = await apiFetch("/tx/parse-pdf", { method: "POST", body: fd });
    if (!res.ok) { alert(`스캔 실패: ${await res.text()}`); return; }
    const data = await res.json();
    if (!data.items || data.items.length === 0) {
      alert("품목을 찾지 못했습니다. PDF의 표 구조를 인식할 수 없습니다.");
      return;
    }
    const mapped = data.items.map(it => ({
      name:       it.name       || "",
      spec:       it.spec       || "",
      qty:        Number(it.qty ?? 1),
      unit_price: Number(it.unit_price ?? 0),
    }));
    // 기존 빈 행만 있으면 대체, 아니면 추가 여부 확인
    const hasContent = items.some(it => (it.name || "").trim());
    let next = mapped;
    if (hasContent) {
      const append = window.confirm(
        `${data.items.length}개 품목을 찾았습니다.\n[확인] 기존 품목 뒤에 추가\n[취소] 기존을 모두 대체`
      );
      next = append ? [...items.filter(it => (it.name||"").trim()), ...mapped] : mapped;
    }
    setItems(next.length ? next : [{ name:"", spec:"", qty:1, unit_price:0 }]);
    if (data.description && !memo) setMemo(data.description);
    alert(`✅ ${data.items.length}개 품목을 자동 입력했습니다. 내용을 확인 후 저장하세요.`);
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

  async function downloadStatsXlsx(rk, opts = {}) {
    const { kind, vendorId, filename } = opts;
    const params = new URLSearchParams({ range: rk });
    if (kind)     params.set("kind", kind);
    if (vendorId) params.set("vendor_id", String(vendorId));
    const res = await apiFetch(`/stats/xlsx?${params.toString()}`);
    if (!res.ok) { alert(`실패: ${await res.text()}`); return; }
    const blob = await res.blob();
    const suffix = [rk, kind, vendorId ? `v${vendorId}` : ""].filter(Boolean).join("_");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename || `ledger_stats_${suffix}.xlsx`;
    a.click();
  }

  // ── 거래내역 그룹핑/필터 ─────────────────────────────────
  const txVendorQueryNorm = (txVendorQuery || "").trim().toLowerCase();

  // 거래 등록 vendor select & 거래내역 그룹에 공통 적용되는 필터된 거래처
  const txFormFilteredVendors = useMemo(() => {
    if (!txVendorQueryNorm) return vendors;
    return vendors.filter(v =>
      `${v.name} ${v.biz_no || ""} ${v.ceo || ""} ${v.phone || ""} ${v.addr || ""}`
        .toLowerCase().includes(txVendorQueryNorm));
  }, [vendors, txVendorQueryNorm]);

  function matchCompany(tx) {
    if (!txFilterCompanyId) return true;
    if (txFilterCompanyId === "none") return !tx.company_id;
    return String(tx.company_id) === String(txFilterCompanyId);
  }

  const filteredTxList = useMemo(() => {
    let arr = txList;
    if (txFilterVendorId) {
      arr = arr.filter(t => String(t.vendor_id) === String(txFilterVendorId));
    }
    if (txVendorQueryNorm) {
      const allowed = new Set(txFormFilteredVendors.map(v => String(v.id)));
      arr = arr.filter(t => allowed.has(String(t.vendor_id)));
    }
    if (txFilterCompanyId) {
      arr = arr.filter(matchCompany);
    }
    const sorted = [...arr].sort((a,b) => {
      const ta = new Date(a.tx_date).getTime();
      const tb = new Date(b.tx_date).getTime();
      return txSortOrder === "asc" ? ta - tb : tb - ta;
    });
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txList, txFilterVendorId, txVendorQueryNorm, txFormFilteredVendors, txFilterCompanyId, txSortOrder]);

  const groupedTxList = useMemo(() => {
    const map = new Map();
    for (const tx of txList) {
      if (!matchCompany(tx)) continue;
      const k = String(tx.vendor_id);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(tx);
    }
    const allowedIds = txVendorQueryNorm
      ? new Set(txFormFilteredVendors.map(v => String(v.id)))
      : null;
    const out = [];
    for (const [vid, arr] of map) {
      if (allowedIds && !allowedIds.has(vid)) continue;
      const vname = arr[0]?.vendor_name ||
        vendors.find(v => String(v.id) === vid)?.name || `#${vid}`;
      const supply = arr.reduce((s,t) => s + Number(t.supply_amount||0), 0);
      const vat    = arr.reduce((s,t) => s + Number(t.vat_amount||0),    0);
      const total  = arr.reduce((s,t) => s + Number(t.total_amount||0),  0);
      const saleCount = arr.filter(t => t.kind === "매출").length;
      const buyCount  = arr.filter(t => t.kind === "매입").length;
      const items = [...arr].sort((a,b) => {
        const ta = new Date(a.tx_date).getTime();
        const tb = new Date(b.tx_date).getTime();
        return txSortOrder === "asc" ? ta - tb : tb - ta;
      });
      out.push({ vid, vname, items, count: arr.length,
                 supply, vat, total, saleCount, buyCount });
    }
    out.sort((a,b) => a.vname.localeCompare(b.vname, "ko"));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txList, vendors, txVendorQueryNorm, txFormFilteredVendors, txFilterCompanyId, txSortOrder]);

  // 회사별 거래 건수 (필터 chip 표시용) — vendor query / vendor filter 와 무관하게 전체 집계
  const companyTxCounts = useMemo(() => {
    const m = new Map();
    let noneCount = 0;
    for (const tx of txList) {
      if (!tx.company_id) { noneCount++; continue; }
      const k = String(tx.company_id);
      m.set(k, (m.get(k) || 0) + 1);
    }
    return { map: m, none: noneCount };
  }, [txList]);

  function toggleGroup(vid) {
    setExpandedGroups(prev => {
      const n = new Set(prev);
      if (n.has(vid)) n.delete(vid); else n.add(vid);
      return n;
    });
  }
  function expandAllGroups()   { setExpandedGroups(new Set(groupedTxList.map(g => g.vid))); }
  function collapseAllGroups() { setExpandedGroups(new Set()); }

  // ── 거래 행 렌더 (hideVendor: 거래처 컬럼 숨김) ──────────
  function renderTxRow(tx, hideVendor = false) {
    const when = tx.tx_date
      ? new Date(tx.tx_date).toLocaleString("ko-KR",
          {year:"2-digit",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})
      : "";
    const vname = tx.vendor_name ||
      vendors.find(x => String(x.id) === String(tx.vendor_id))?.name || String(tx.vendor_id);
    const isBuy  = tx.kind === "매입";
    const isPaid = isBuy && paidIds.has(String(tx.id));
    const rowCo  = companies.find(c => String(c.id) === String(tx.company_id));
    const rowCoColor = rowCo?.color || "#22c55e";
    const rowStyle = isPaid
      ? { background: rowCoColor+"2a", boxShadow: `inset 3px 0 0 ${rowCoColor}` }
      : undefined;
    return (
      <tr key={tx.id} className={isPaid?"txPaid":""} style={rowStyle}>
        <td>{tx.id}</td>
        <td><span className={`badge ${tx.kind==="매출"?"sale":"buy"}`}>{tx.kind}</span></td>
        {!hideVendor && <td className="ellipsis" title={vname}>{vname}</td>}
        <td className="num">{Number(tx.supply_amount||0).toLocaleString()}</td>
        <td className="num">{Number(tx.vat_amount||0).toLocaleString()}</td>
        <td className="num fw">{Number(tx.total_amount||0).toLocaleString()}</td>
        <td className="paidCell">
          {isBuy ? (
            <label className="paidToggle" title={isPaid?"입금 완료됨 — 클릭해 해제":"입금 완료 체크"}
              style={isPaid ? {background:rowCoColor+"55",borderColor:rowCoColor} : undefined}>
              <input type="checkbox" checked={isPaid}
                onChange={() => togglePaid(tx.id)} />
              <span>{isPaid ? "✅ 완료" : "☐ 미입금"}</span>
            </label>
          ) : <span className="muted small">—</span>}
        </td>
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
            if (!co) {
              return (
                <span className="coBadge coBadgeNone"
                  title="발행회사 미지정 — 클릭하면 미지정 건만 필터"
                  onClick={() => setTxFilterCompanyId("none")}>
                  ?
                </span>
              );
            }
            const color = co.color || "#2563eb";
            const short = co.name.replace(/\(주\)|주식회사|\(|\)/g,"").trim().slice(0,2);
            const isActive = String(txFilterCompanyId) === String(co.id);
            return (
              <span className={`coBadge ${isActive?"coBadgeActive":""}`}
                title={`${co.name} — 클릭하면 이 회사 거래만 필터`}
                style={{background:color+(isActive?"55":"22"),color,border:`1px solid ${color}${isActive?"aa":"55"}`}}
                onClick={() => setTxFilterCompanyId(isActive ? "" : String(co.id))}>
                {short}
              </span>
            );
          })()}
        </td>
        <td><button className="btn danger xsBtn" onClick={()=>deleteTx(tx.id)}>삭제</button></td>
      </tr>
    );
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
            <div className="h">
              거래처
              <span className="co-badge" style={{marginLeft:8}}>총 {vendors.length}개</span>
            </div>

            <div className="vendorBar">
              <div className="row" style={{gap:8}}>
                <input value={vendorQuery} onChange={e => setVendorQuery(e.target.value)}
                  placeholder="검색 (이름/사업자번호/대표자/연락처)"
                  onFocus={() => setVendorListOpen(true)}
                  style={{flex:"1 1 auto"}} />
                <button className="btn" type="button"
                  onClick={() => setVendorListOpen(o => !o)}
                  title="거래처 목록 펼치기/접기">
                  {vendorListOpen ? "▲ 목록 접기" : `▼ 전체 목록 (${filteredVendors.length})`}
                </button>
              </div>

              {/* 선택 요약 + 펼치기 버튼 */}
              {!vendorListOpen && (
                <div className="vendorPick">
                  {selectedVendor ? (
                    <div className="vendorPickSelected">
                      <span className="pill">선택됨</span>
                      <b>{selectedVendor.name}</b>
                      {selectedVendor.biz_no && <span className="muted small"> ({selectedVendor.biz_no})</span>}
                      <button className="btn small-btn" onClick={() => setSelectedVendorId("")}>해제</button>
                    </div>
                  ) : (
                    <div className="muted small">선택된 거래처가 없습니다. 검색하거나 목록을 펼쳐 선택하세요.</div>
                  )}
                </div>
              )}

              {/* 거래처 목록 (펼침) */}
              {vendorListOpen && (
                <div className="vendorList">
                  {filteredVendors.length === 0 && (
                    <div className="muted small pad" style={{textAlign:"center"}}>
                      검색 결과가 없습니다.
                    </div>
                  )}
                  {filteredVendors.map(v => {
                    const isSel = String(v.id) === String(selectedVendorId);
                    return (
                      <div key={v.id}
                        className={`vendorItem ${isSel?"on":""}`}
                        onClick={() => { setSelectedVendorId(String(v.id)); setVendorListOpen(false); }}>
                        <div className="vendorItemMain">
                          <b>{v.name}</b>
                          {v.biz_no && <span className="muted small"> · {v.biz_no}</span>}
                        </div>
                        <div className="muted small vendorItemSub">
                          {v.ceo   && <span>대표 {v.ceo}</span>}
                          {v.phone && <span>{v.phone}</span>}
                          {v.addr  && <span className="ellipsis">{v.addr}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="vendorBarBtns">
                <button className="btn" onClick={beginEditVendor} disabled={!selectedVendorId}>수정</button>
                <button className="btn danger" onClick={() => deleteVendor(selectedVendorId)} disabled={!selectedVendorId}>삭제</button>
              </div>
            </div>

            {selectedVendor && !vendorListOpen && (
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
            <div className="row txVendorSearchRow">
              <input value={txVendorQuery}
                onChange={e => setTxVendorQuery(e.target.value)}
                placeholder="🔎 거래처 검색 (이름/사업자번호/대표자) — 거래내역도 함께 필터됩니다"
                style={{flex:"1 1 auto"}} />
              {txVendorQuery && (
                <button className="btn small-btn" type="button"
                  onClick={() => setTxVendorQuery("")}>✕ 초기화</button>
              )}
              {txVendorQuery && (
                <span className="muted small">
                  {txFormFilteredVendors.length}개 일치
                </span>
              )}
            </div>
            <div className="row" style={{marginTop:8}}>
              <select value={txKind} onChange={e => setTxKind(e.target.value)}>
                <option value="매출">매출</option>
                <option value="매입">매입</option>
              </select>
              <select value={selectedVendorId} onChange={e => setSelectedVendorId(e.target.value)}>
                <option value="">거래처 선택</option>
                {txFormFilteredVendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              <input type="datetime-local" value={txDate} onChange={e => setTxDate(e.target.value)} />
            </div>
            <div className="row vatRow" style={{marginTop:8}}>
              <span className="muted small">부가세</span>
              <button type="button"
                className={`btn chip ${!vatIncluded?"chip-on":""}`}
                onClick={() => setVatIncluded(false)}>
                미포함 (별도 10%)
              </button>
              <button type="button"
                className={`btn chip ${vatIncluded?"chip-on":""}`}
                onClick={() => setVatIncluded(true)}>
                포함 (단가에 10% 포함)
              </button>
            </div>
            <div className="row" style={{marginTop:10}}>
              <input value={docNo} onChange={e => setDocNo(e.target.value)}
                placeholder="문서번호 (비우면 발행회사 기준 자동 생성)" />
            </div>
            <textarea value={memo} onChange={e => setMemo(e.target.value)}
              placeholder="메모/건명 (선택)" className="ta" />

            <div className="h2 pdfImportRow">
              <span>품목</span>
              <label className="btn small-btn pdfImportBtn" title="PDF 견적서의 표를 스캔해 품목을 자동 입력합니다.">
                📎 PDF에서 가져오기
                <input type="file" accept="application/pdf,.pdf" style={{display:"none"}}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    importItemsFromPdf(f);
                    e.target.value = "";
                  }} />
              </label>
            </div>
            <div
              className={`pdfDropZone ${pdfDragActive?"dragOn":""}`}
              onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setPdfDragActive(true); }}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); setPdfDragActive(true); }}
              onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setPdfDragActive(false); }}
              onDrop={e => {
                e.preventDefault(); e.stopPropagation(); setPdfDragActive(false);
                const f = e.dataTransfer.files?.[0];
                if (f) importItemsFromPdf(f);
              }}>
              {pdfDragActive
                ? "📥 여기에 놓으면 PDF를 스캔합니다"
                : "📎 또는 이 영역에 PDF를 드래그&드롭 하세요"}
            </div>
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
            {[["7d","1주"],["1m","1달"],["1y","1년"]].map(([k,l]) => (
              <div key={k} className="row statsRangeRow" style={{flexWrap:"wrap",gap:8,marginBottom:6}}>
                <span className="rangeLabel">최근 {l}</span>
                <button className="btn" onClick={() => loadStats(k)}>합계 조회</button>
                <button className="btn primary" onClick={() => downloadStatsXlsx(k)}>전체 백업</button>
                <button className="btn chip chip-sale"
                  onClick={() => downloadStatsXlsx(k, { kind: "매출" })}>매출만</button>
                <button className="btn chip chip-buy"
                  onClick={() => downloadStatsXlsx(k, { kind: "매입" })}>매입만</button>
              </div>
            ))}
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

            {/* 발행회사 필터 chip 바 */}
            <div className="txCoFilterBar">
              <span className="muted small txCoFilterLabel">🏢 발행회사별:</span>
              <button type="button"
                className={`btn chip ${!txFilterCompanyId?"chip-on":""}`}
                onClick={() => setTxFilterCompanyId("")}>
                전체 ({txList.length})
              </button>
              {companies.map(co => {
                const n = companyTxCounts.map.get(String(co.id)) || 0;
                const isOn = String(txFilterCompanyId) === String(co.id);
                const color = co.color || "#2563eb";
                return (
                  <button key={co.id} type="button"
                    className={`btn chip coChip ${isOn?"chip-on":""}`}
                    style={{
                      background: isOn ? color+"cc" : color+"26",
                      borderColor: color+"77",
                      color: isOn ? "#fff" : undefined,
                    }}
                    onClick={() => setTxFilterCompanyId(isOn ? "" : String(co.id))}>
                    {co.name} ({n})
                  </button>
                );
              })}
              {companyTxCounts.none > 0 && (
                <button type="button"
                  className={`btn chip ${txFilterCompanyId==="none"?"chip-on":""}`}
                  onClick={() => setTxFilterCompanyId(txFilterCompanyId==="none"?"":"none")}
                  title="발행회사가 지정되지 않은 거래">
                  미지정 ({companyTxCounts.none})
                </button>
              )}
            </div>

            {/* 필터 바 */}
            <div className="txFilterBar">
              {(() => {
                const picked = vendors.find(v => String(v.id) === String(txFilterVendorId));
                return (
                  <button className="btn txFilterPick" type="button"
                    onClick={() => setTxFilterListOpen(o => !o)}>
                    {txFilterVendorId
                      ? <>🏷️ <b>{picked?.name || `#${txFilterVendorId}`}</b> 만 보기</>
                      : <>📂 거래처별 그룹 보기 <span className="muted small">({groupedTxList.length}개 업체)</span></>}
                    <span className="chev-s">{txFilterListOpen ? "▲" : "▼"}</span>
                  </button>
                );
              })()}
              {!txFilterVendorId ? (
                <>
                  <button className="btn small-btn"
                    onClick={() => setTxGroupsVisible(v => !v)}>
                    {txGroupsVisible ? "📕 목록 숨기기" : "📖 목록 보기"}
                  </button>
                  {txGroupsVisible && (
                    <>
                      <button className="btn small-btn" onClick={expandAllGroups}>＋ 모두 펼치기</button>
                      <button className="btn small-btn" onClick={collapseAllGroups}>－ 모두 접기</button>
                    </>
                  )}
                </>
              ) : (
                <button className="btn small-btn" onClick={()=>setTxFilterVendorId("")}>← 그룹 보기로</button>
              )}
              <span className="txSortToggle">
                <span className="muted small">정렬</span>
                <button type="button"
                  className={`btn chip ${txSortOrder==="desc"?"chip-on":""}`}
                  onClick={() => setTxSortOrder("desc")}>⬇ 최신순</button>
                <button type="button"
                  className={`btn chip ${txSortOrder==="asc"?"chip-on":""}`}
                  onClick={() => setTxSortOrder("asc")}>⬆ 오래된순</button>
              </span>
            </div>

            {/* 거래처 선택 목록 (펼침) */}
            {txFilterListOpen && (
              <div className="vendorList txFilterList">
                <div
                  className={`vendorItem ${!txFilterVendorId?"on":""}`}
                  onClick={() => { setTxFilterVendorId(""); setTxFilterListOpen(false); }}>
                  <div className="vendorItemMain">
                    <b>📂 거래처별 그룹 보기</b>
                    <span className="muted small"> · 전체 {groupedTxList.length}개 업체 아코디언</span>
                  </div>
                </div>
                {vendors.length === 0 && (
                  <div className="muted small pad" style={{textAlign:"center"}}>
                    등록된 거래처가 없습니다.
                  </div>
                )}
                {vendors.map(v => {
                  const isSel = String(v.id) === String(txFilterVendorId);
                  const g = groupedTxList.find(gr => String(gr.vid) === String(v.id));
                  return (
                    <div key={v.id}
                      className={`vendorItem ${isSel?"on":""}`}
                      onClick={() => { setTxFilterVendorId(String(v.id)); setTxFilterListOpen(false); }}>
                      <div className="vendorItemMain">
                        <b>{v.name}</b>
                        {g && <span className="muted small"> · {g.count}건 / 합계 {g.total.toLocaleString()}원</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 안내 (목록 숨김 상태) */}
            {!txFilterVendorId && !txGroupsVisible && (
              <div className="muted pad txHint" style={{textAlign:"center"}}>
                거래처를 선택하거나 <b>📖 목록 보기</b> 를 눌러 전체 그룹을 펼쳐보세요.
                <br/>
                <span className="small">총 {groupedTxList.length}개 업체 · {txList.length.toLocaleString()}건</span>
              </div>
            )}

            {/* 전체(그룹) 모드 */}
            {!txFilterVendorId && txGroupsVisible && (
              <div className="txGroups">
                {groupedTxList.length === 0 && (
                  <div className="muted pad" style={{textAlign:"center"}}>거래내역이 없습니다.</div>
                )}
                {groupedTxList.map(g => {
                  const expanded = expandedGroups.has(g.vid);
                  return (
                    <div key={g.vid} className={`txGroup ${expanded?"open":""}`}>
                      <div className="txGroupHeader" onClick={()=>toggleGroup(g.vid)}>
                        <span className="chev">{expanded ? "▼" : "▶"}</span>
                        <span className="gName">{g.vname}</span>
                        <span className="gMeta">
                          <span className="pill">{g.count}건</span>
                          {g.saleCount>0 && <span className="pill pill-sale">매출 {g.saleCount}</span>}
                          {g.buyCount>0  && <span className="pill pill-buy">매입 {g.buyCount}</span>}
                        </span>
                        <span className="gSum">
                          공급가 <b>{g.supply.toLocaleString()}</b> ·
                          부가세 <b>{g.vat.toLocaleString()}</b> ·
                          합계 <b className="gTotal">{g.total.toLocaleString()}</b>원
                        </span>
                        <span className="gActions" onClick={e=>e.stopPropagation()}>
                          <button className="btn small-btn"
                            title="이 거래처 1년 엑셀 백업"
                            onClick={() => downloadStatsXlsx("1y", {
                              vendorId: g.vid,
                              filename: `ledger_${g.vname}_1y.xlsx`,
                            })}>
                            📊 엑셀
                          </button>
                        </span>
                      </div>
                      {expanded && (
                        <div className="txTable txTableGrouped">
                          <table>
                            <thead>
                              <tr>
                                <th>ID</th><th>구분</th>
                                <th>공급가</th><th>부가세</th><th className="fw">합계</th>
                                <th>입금</th>
                                <th>일시</th><th>문서번호</th>
                                <th>PDF</th><th>Excel</th>
                                <th>수정</th><th>삭제</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.items.map(tx => renderTxRow(tx, true))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 특정 거래처 선택 모드 */}
            {txFilterVendorId && (
              <div className="txTable">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th><th>구분</th><th>거래처</th>
                      <th>공급가</th><th>부가세</th><th className="fw">합계</th>
                      <th>입금</th>
                      <th>일시</th><th>문서번호</th>
                      <th>PDF</th><th>Excel</th>
                      <th>수정</th><th>삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTxList.map(tx => renderTxRow(tx, false))}
                    {filteredTxList.length === 0 && (
                      <tr><td colSpan={13} className="muted pad" style={{textAlign:"center"}}>
                        선택한 거래처의 거래내역이 없습니다.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
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

/* 거래내역 필터 바 */
.txFilterBar{display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap;}
.txFilterBar select{max-width:380px;}
.txFilterPick{
  flex:1 1 auto;min-width:240px;max-width:440px;justify-content:space-between;
  background:rgba(79,110,247,0.14);border-color:rgba(79,110,247,0.35);
}
.txFilterPick:hover{background:rgba(79,110,247,0.22);}
.chev-s{font-size:10px;color:var(--muted);margin-left:auto;}
.txFilterList{margin-top:8px;max-height:300px;}
.txHint{
  margin-top:14px;padding:24px 16px;border:1px dashed var(--border);
  border-radius:12px;background:rgba(0,0,0,0.14);line-height:1.6;
}

/* PDF 가져오기 버튼 */
.pdfImportRow{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.pdfImportBtn{
  display:inline-flex;align-items:center;gap:6px;cursor:pointer;
  background:rgba(22,163,74,0.2);border-color:rgba(22,163,74,0.45);
}
.pdfImportBtn:hover{background:rgba(22,163,74,0.4);}
.pdfDropZone{
  margin:4px 0 10px;padding:14px 16px;border:2px dashed rgba(22,163,74,0.4);
  border-radius:12px;background:rgba(22,163,74,0.06);
  text-align:center;font-size:12px;color:var(--muted);
  transition:background .15s,border-color .15s,color .15s;
}
.pdfDropZone.dragOn{
  background:rgba(22,163,74,0.22);border-color:rgba(22,163,74,0.9);
  color:var(--text);font-weight:700;
}

/* 거래 등록 거래처 검색 행 */
.txVendorSearchRow{align-items:center;gap:8px;}
.txVendorSearchRow>input{flex:1 1 auto;}

/* 발행회사 필터 chip 바 */
.txCoFilterBar{
  display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap;
  padding:8px 10px;border:1px solid var(--border);border-radius:10px;
  background:rgba(0,0,0,0.14);
}
.txCoFilterLabel{flex:0 0 auto;font-weight:700;}
.coChip{font-weight:600;}
.coChip:hover{filter:brightness(1.15);}

/* 거래 행 내 클릭 가능한 발행회사 뱃지 */
.coBadge{
  margin-left:4px;display:inline-block;padding:2px 6px;border-radius:999px;
  font-size:11px;font-weight:700;cursor:pointer;user-select:none;
  transition:filter .12s,box-shadow .12s;
}
.coBadge:hover{filter:brightness(1.2);box-shadow:0 0 0 2px rgba(255,255,255,0.12);}
.coBadgeActive{box-shadow:0 0 0 2px rgba(255,255,255,0.35);}
.coBadgeNone{background:rgba(255,255,255,0.08);color:var(--muted);border:1px dashed var(--border);}

/* 거래내역 정렬 토글 */
.txSortToggle{display:inline-flex;gap:4px;align-items:center;margin-left:auto;}
.txSortToggle .chip{height:28px;}

/* 매입 입금완료 체크 */
.paidCell{white-space:nowrap;}
.paidToggle{
  display:inline-flex;align-items:center;gap:4px;cursor:pointer;
  padding:3px 8px;border-radius:999px;font-size:11px;font-weight:700;
  border:1px solid var(--border);background:rgba(255,255,255,0.04);
  transition:background .12s,border-color .12s;user-select:none;
}
.paidToggle input{
  width:auto;height:auto;margin:0;accent-color:#22c55e;cursor:pointer;
}
.paidToggle:hover{background:rgba(255,255,255,0.08);}
.txPaid td{color:var(--text);}
.txPaid td.num,.txPaid td.fw{font-weight:700;}

/* 거래처 목록(펼침) */
.vendorList{
  max-height:320px;overflow-y:auto;
  border:1px solid var(--border);border-radius:12px;
  background:rgba(0,0,0,0.22);
  display:flex;flex-direction:column;
}
.vendorItem{
  padding:10px 12px;cursor:pointer;
  border-bottom:1px solid rgba(255,255,255,0.05);
  transition:background .12s;
}
.vendorItem:last-child{border-bottom:none;}
.vendorItem:hover{background:rgba(79,110,247,0.10);}
.vendorItem.on{background:rgba(79,110,247,0.22);border-left:3px solid #4f6ef7;}
.vendorItemMain{font-size:13px;}
.vendorItemSub{display:flex;gap:10px;flex-wrap:wrap;margin-top:2px;}
.vendorItemSub .ellipsis{max-width:220px;}
.vendorPick{
  padding:8px 12px;border:1px dashed var(--border);border-radius:10px;
  background:rgba(0,0,0,0.14);
}
.vendorPickSelected{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}

/* VAT 토글 chip */
.vatRow{align-items:center;gap:8px;}
.chip{height:28px;padding:0 12px;font-size:12px;border-radius:999px;
  background:rgba(255,255,255,0.05);}
.chip-on{background:rgba(79,110,247,0.75);border-color:rgba(79,110,247,0.95);font-weight:700;}
.chip-sale{background:rgba(79,110,247,0.25);border-color:rgba(79,110,247,0.45);}
.chip-sale:hover{background:rgba(79,110,247,0.45);}
.chip-buy{background:rgba(226,77,77,0.22);border-color:rgba(226,77,77,0.45);}
.chip-buy:hover{background:rgba(226,77,77,0.42);}

/* 통계 기간 행 */
.statsRangeRow{align-items:center;}
.rangeLabel{
  min-width:58px;font-weight:700;font-size:12px;color:var(--muted);
  background:rgba(255,255,255,0.06);padding:4px 10px;border-radius:999px;
  border:1px solid var(--border);
}

/* 그룹 헤더 내 액션 */
.gActions{display:flex;gap:4px;margin-left:8px;}

/* 거래처별 그룹 */
.txGroups{display:flex;flex-direction:column;gap:8px;margin-top:10px;}
.txGroup{
  border:1px solid var(--border);border-radius:12px;
  background:rgba(0,0,0,0.18);overflow:hidden;transition:border-color .15s;
}
.txGroup.open{border-color:rgba(79,110,247,0.45);}
.txGroupHeader{
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  padding:10px 14px;cursor:pointer;user-select:none;
  transition:background .15s;
}
.txGroupHeader:hover{background:rgba(79,110,247,0.08);}
.txGroup.open .txGroupHeader{background:rgba(79,110,247,0.10);}
.chev{font-size:10px;width:14px;color:var(--muted);flex:0 0 auto;}
.gName{font-weight:700;font-size:14px;min-width:120px;}
.gMeta{display:flex;gap:5px;flex-wrap:wrap;align-items:center;}
.pill{
  font-size:11px;padding:2px 8px;border-radius:999px;
  background:rgba(255,255,255,0.08);border:1px solid var(--border);
  color:var(--muted);font-weight:600;
}
.pill-sale{background:rgba(79,110,247,0.2);color:#93c5fd;border-color:rgba(79,110,247,0.4);}
.pill-buy{background:rgba(226,77,77,0.18);color:#fca5a5;border-color:rgba(226,77,77,0.4);}
.gSum{
  margin-left:auto;font-size:12px;color:var(--muted);
  font-variant-numeric:tabular-nums;
}
.gSum b{color:var(--text);}
.gTotal{color:#22c55e!important;font-size:13px;}

/* 그룹 내부 테이블: 거래처 컬럼 없음 → 최소폭 축소 */
.txTableGrouped{padding:4px 10px 10px;}
.txTableGrouped table{min-width:1080px;}
`;