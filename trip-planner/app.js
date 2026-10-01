import { FIREBASE_CONFIG } from "./firebase-config.js";

/* ============================================================
   ค่าตั้งต้น
   ============================================================ */
const SDK = "https://www.gstatic.com/firebasejs/10.12.2";
const SUBS = ["items", "wishlist", "bookings", "expenses", "packing", "checklist", "prep"];
// [key, ชื่อเต็ม, ไอคอน, ชื่อสั้น (แถบล่างในมือถือ)]
const TABS = [
  ["plan", "แพลน", "🗓️", "แพลน"], ["wishlist", "Wishlist", "⭐", "Wishlist"], ["bookings", "การจอง", "🎫", "การจอง"],
  ["money", "ค่าใช้จ่าย", "💰", "ค่าใช้จ่าย"], ["packing", "ของที่ต้องเตรียม", "🎒", "ของเตรียม"], ["prep", "เตรียมตัว / ตม.", "🛂", "เตรียมตัว"],
];
const DEFAULT_CHECKLIST = [
  "พาสปอร์ต (อายุเหลือเกิน 6 เดือน)",
  "เช็กเงื่อนไขวีซ่า/ฟรีวีซ่าล่าสุด",
  "ประกันการเดินทาง",
  "eSIM / Pocket WiFi",
  "แลกเงิน / บัตรเดบิตสำหรับต่างประเทศ",
  "จองที่พัก",
  "จองตั๋วเครื่องบิน",
];
const SUGGESTED_PACKING = [
  "พาสปอร์ต", "เสื้อกันหนาว", "ปลั๊กแปลง", "พาวเวอร์แบงก์", "สายชาร์จ",
  "ยาประจำตัว", "ร่มพับ", "รองเท้าเดินสบาย", "กระเป๋าผ้า", "ทิชชู่เปียก", "ลิปบาล์ม / ครีมทาผิว",
];
const WISH_CATS = ["คาเฟ่", "ร้านอาหาร", "ช้อปปิ้ง", "ตามรอยศิลปิน", "ที่เที่ยว", "อื่นๆ"];
const DAY_NAMES = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
// [รหัส, ชื่อไทย, สัญลักษณ์]
const CURRENCIES = [
  ["THB", "บาท", "฿"], ["JPY", "เยน (ญี่ปุ่น)", "¥"], ["KRW", "วอน (เกาหลี)", "₩"], ["CNY", "หยวน (จีน)", "CN¥"],
  ["TWD", "ดอลลาร์ไต้หวัน", "NT$"], ["HKD", "ดอลลาร์ฮ่องกง", "HK$"], ["SGD", "ดอลลาร์สิงคโปร์", "S$"],
  ["MYR", "ริงกิต (มาเลเซีย)", "RM"], ["VND", "ดอง (เวียดนาม)", "₫"], ["LAK", "กีบ (ลาว)", "₭"],
  ["USD", "ดอลลาร์สหรัฐ", "US$"], ["EUR", "ยูโร", "€"], ["GBP", "ปอนด์", "£"], ["AUD", "ดอลลาร์ออสเตรเลีย", "A$"],
];
const curInfo = (c) => CURRENCIES.find((x) => x[0] === c) || [c, c, c + " "];
const BOOK_TYPES = ["เที่ยวบิน", "ที่พัก", "ตั๋ว/บัตรผ่าน", "รถ/รถไฟ", "อื่นๆ"];

/* ============================================================
   ตัวช่วยทั่วไป
   ============================================================ */
const app = document.getElementById("app");
const $ = (s, el = document) => el.querySelector(s);
const esc = (s = "") => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v) => (Number.isFinite(+v) ? +v : 0);
const money = (n) => num(n).toLocaleString("th-TH", { maximumFractionDigits: 2 }) + " ฿";
// ใส่ได้ทั้งชื่อสถานที่ (ค้นใน Google Maps ให้) หรือวางลิงก์ Google Maps มาตรงๆ
const isLink = (s) => /^https?:\/\//i.test(String(s || "").trim());
const mapUrl = (q) => (isLink(q) ? String(q).trim() : "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q));
const formData = (form) => Object.fromEntries(new FormData(form));
const DATE_FMT = {
  short: { day: "numeric", month: "short" },
  year: { day: "numeric", month: "short", year: "numeric" },
  long: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  weekday: { weekday: "short", day: "numeric", month: "short" },
};
const fmtDate = (iso, mode = "short") =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("th-TH", DATE_FMT[mode]) : "";

function daysBetween(start, end) {
  const out = [];
  if (!start || !end) return out;
  let d = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  while (d <= e && out.length < 60) {
    out.push(d.toISOString().slice(0, 10));
    d = new Date(d.getTime() + 864e5);
  }
  return out;
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2500);
}

function lsGet(k) { try { return localStorage.getItem(k) || ""; } catch { return ""; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

/* ============================================================
   ที่เก็บข้อมูล: Firebase (แชร์กันได้) หรือ โหมดทดลอง (เครื่องเดียว)
   ทั้งสองแบบมีคำสั่งเหมือนกัน หน้าเว็บเลยไม่ต้องรู้ว่าใช้แบบไหน
   ============================================================ */
const isConfigured = (c) => !!(c && c.apiKey && c.projectId);

async function firebaseStore(cfg) {
  const { initializeApp } = await import(`${SDK}/firebase-app.js`);
  const fs = await import(`${SDK}/firebase-firestore.js`);
  const fbApp = initializeApp(cfg);
  let db;
  try {
    // เก็บข้อมูลสำรองในเครื่อง → เปิดดูได้ตอนออฟไลน์ และแก้ตอนออฟไลน์ได้ (ส่งขึ้นเมื่อมีเน็ต)
    db = fs.initializeFirestore(fbApp, {
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
    });
  } catch {
    db = fs.getFirestore(fbApp);
  }
  const onErr = (e) => {
    console.error(e);
    toast(e.code === "permission-denied" ? "Firebase ไม่อนุญาต — เช็กหน้า Rules" : "บันทึกไม่สำเร็จ: " + (e.code || e.message));
  };
  const list = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const sub = (t, s) => fs.collection(db, "trips", t, s);
  return {
    mode: "firebase",
    listenTrips: (cb) => fs.onSnapshot(fs.collection(db, "trips"), (s) => cb(list(s)), onErr),
    listenTrip: (id, cb) =>
      fs.onSnapshot(fs.doc(db, "trips", id), (d) => cb(d.exists() ? { id: d.id, ...d.data() } : null), onErr),
    createTrip(data) {
      const ref = fs.doc(fs.collection(db, "trips"));
      fs.setDoc(ref, data).catch(onErr);
      return ref.id;
    },
    updateTrip: (id, patch) => fs.updateDoc(fs.doc(db, "trips", id), patch).catch(onErr),
    listen: (t, s, cb) => fs.onSnapshot(sub(t, s), (snap) => cb(list(snap)), onErr),
    add: (t, s, data) => fs.addDoc(sub(t, s), data).catch(onErr),
    update: (t, s, id, patch) => fs.updateDoc(fs.doc(db, "trips", t, s, id), patch).catch(onErr),
    remove: (t, s, id) => fs.deleteDoc(fs.doc(db, "trips", t, s, id)).catch(onErr),
    // ลบทริป: ต้องลบข้อมูลย่อยทุกหมวดก่อน แล้วค่อยลบตัวทริป
    async deleteTrip(id) {
      try {
        const refs = [];
        for (const s of SUBS) (await fs.getDocs(sub(id, s))).forEach((d) => refs.push(d.ref));
        for (let i = 0; i < refs.length; i += 400) {
          const batch = fs.writeBatch(db);
          refs.slice(i, i + 400).forEach((r) => batch.delete(r));
          await batch.commit();
        }
        await fs.deleteDoc(fs.doc(db, "trips", id));
      } catch (e) { onErr(e); }
    },
  };
}

function localStore() {
  const KEY = "trip-planner-local-v1";
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { db = {}; }
  db.trips ||= {};
  db.subs ||= {};
  const listeners = new Set();
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const bucket = (t, s) => ((db.subs[t] ||= {})[s] ||= {});
  const emit = () => { lsSet(KEY, JSON.stringify(db)); listeners.forEach((f) => f()); };
  const watch = (f) => { listeners.add(f); queueMicrotask(f); return () => listeners.delete(f); };
  return {
    mode: "local",
    listenTrips: (cb) => watch(() => cb(Object.entries(db.trips).map(([id, t]) => ({ id, ...clone(t) })))),
    listenTrip: (id, cb) => watch(() => cb(db.trips[id] ? { id, ...clone(db.trips[id]) } : null)),
    createTrip(data) { const id = uid(); db.trips[id] = clone(data); emit(); return id; },
    updateTrip(id, patch) { Object.assign(db.trips[id], clone(patch)); emit(); },
    listen: (t, s, cb) => watch(() => cb(Object.entries(bucket(t, s)).map(([id, d]) => ({ id, ...clone(d) })))),
    add(t, s, data) { bucket(t, s)[uid()] = clone(data); emit(); },
    update(t, s, id, patch) { const b = bucket(t, s); if (b[id]) Object.assign(b[id], clone(patch)); emit(); },
    remove(t, s, id) { delete bucket(t, s)[id]; emit(); },
    deleteTrip(id) { delete db.trips[id]; delete db.subs[id]; emit(); },
  };
}

/* ============================================================
   สถานะของหน้า
   ============================================================ */
let store;
let unsubs = [];
let trip = null;
let data = {};
let tab = "plan";
let dayIdx = 0;
let editingItemId = null;
let editingBookingId = null;
let skeletonSig = "";
let firstTripLoad = true;

const tripDays = () => daysBetween(trip?.startDate, trip?.endDate);
const members = () => trip?.members || [];
const getMe = () => { const m = lsGet("me-" + trip?.id); return members().includes(m) ? m : ""; };
const byCreated = (a, b) => num(a.createdAt) - num(b.createdAt);

/* ---------- สกุลเงิน: ทุกอย่างแปลงเป็นบาทเพื่อหารเงิน ---------- */
const tripCur = () => trip?.currency || "THB";
const isForeign = () => tripCur() !== "THB";
// เรต = 1 หน่วยเงินต่างประเทศ เท่ากับกี่บาท (0 = ยังไม่มีเรต)
const rateOf = (cur) => (!cur || cur === "THB" ? 1 : cur === tripCur() ? num(trip?.rate) : 0);
const toTHB = (amount, cur) => num(amount) * rateOf(cur || "THB");
const fmtCur = (n, cur = "THB") => {
  if (!cur || cur === "THB") return money(n);
  const digits = ["JPY", "KRW", "VND", "LAK"].includes(cur) ? 0 : 2;
  return curInfo(cur)[2] + num(n).toLocaleString("th-TH", { maximumFractionDigits: digits });
};
// แสดงยอด: เงินต่างประเทศ + (≈ บาท)
const fmtWithTHB = (n, cur) =>
  !cur || cur === "THB" ? money(n)
  : `${fmtCur(n, cur)} <span class="muted">${rateOf(cur) ? `≈ ${money(toTHB(n, cur))}` : "(ยังไม่มีเรต)"}</span>`;
// แปลงบาท → เงินปลายทาง (ไว้แสดงคู่กัน)
const thbToTrip = (thb) => (isForeign() && rateOf(tripCur()) ? ` <span class="muted">≈ ${fmtCur(thb / rateOf(tripCur()), tripCur())}</span>` : "");
const curSelect = (name, selected) => {
  const opts = [...new Set([tripCur(), "THB"])];
  return `<select name="${name}" class="cur-select">${opts.map((c) => `<option value="${c}" ${c === selected ? "selected" : ""}>${c}</option>`).join("")}</select>`;
};

const todayISO = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); // วันที่ตามเวลาไทย
const RATE_SOURCE_LABEL = {
  BOT: "ธนาคารแห่งประเทศไทย (อัตรากลางถัวเฉลี่ย)",
  "ExchangeRate-API": "ExchangeRate-API (สำรอง — ธปท. ยังไม่มีข้อมูล)",
  Frankfurter: "Frankfurter / ECB (สำรอง — ธปท. ยังไม่มีข้อมูล)",
  manual: "ใส่เอง",
};

async function fetchRate(cur) {
  // ที่มาหลัก: ธนาคารแห่งประเทศไทย — ไฟล์ data/bot-rates.json ที่ GitHub Actions อัปเดตทุกวันทำการ
  try {
    const j = await (await fetch("data/bot-rates.json", { cache: "no-cache" })).json();
    const r = j.rates?.[cur];
    if (r && num(r.mid)) return { rate: num(r.mid), source: "BOT", date: r.period };
  } catch {}
  // สำรอง 1: ExchangeRate-API / สำรอง 2: Frankfurter (ECB)
  try {
    const r = await (await fetch(`https://open.er-api.com/v6/latest/${cur}`)).json();
    if (r.result === "success" && r.rates?.THB) {
      const date = r.time_last_update_unix ? new Date(r.time_last_update_unix * 1000 + 7 * 3600e3).toISOString().slice(0, 10) : todayISO();
      return { rate: r.rates.THB, source: "ExchangeRate-API", date };
    }
  } catch {}
  try {
    const r = await (await fetch(`https://api.frankfurter.dev/v1/latest?base=${cur}&symbols=THB`)).json();
    if (r.rates?.THB) return { rate: r.rates.THB, source: "Frankfurter", date: r.date || todayISO() };
  } catch {}
  return null;
}

async function updateRate(tripId, cur, silent = false) {
  if (!cur || cur === "THB") return;
  if (!navigator.onLine) { if (!silent) toast("ออฟไลน์อยู่ — ดึงเรตไม่ได้ ใส่เรตเองได้"); return; }
  const r = await fetchRate(cur);
  if (!r) { if (!silent) toast("ดึงเรตไม่สำเร็จ — ใส่เรตเองได้"); return; }
  store.updateTrip(tripId, { rate: r.rate, rateDate: r.date, rateUpdated: todayISO(), rateSource: r.source });
  if (!silent) toast(`อัปเดตเรตแล้ว: 1 ${cur} = ${r.rate.toFixed(4)} บาท (${r.source === "BOT" ? "ธปท." : r.source})`);
}

// ข้อความอ้างอิงเรต เช่น "อ้างอิง: ธนาคารแห่งประเทศไทย (อัตรากลางถัวเฉลี่ย) ณ วันที่ 30 ก.ย. 2569"
function rateRefText() {
  const src = trip?.rateSource;
  const date = trip?.rateDate || trip?.rateUpdated;
  if (src === "manual") return `ใส่เอง${date ? ` ณ วันที่ ${fmtDate(date, "year")}` : ""}`;
  return `อ้างอิง: ${RATE_SOURCE_LABEL[src] || src || "-"}${date ? ` ณ วันที่ ${fmtDate(date, "year")}` : ""}`;
}
const sortItems = (list) =>
  [...list].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99") || byCreated(a, b));

/* ============================================================
   เปลี่ยนหน้า
   ============================================================ */
function cleanup() {
  unsubs.forEach((u) => u && u());
  unsubs = [];
  trip = null;
  data = {};
  skeletonSig = "";
  editingItemId = null;
  dayIdx = 0;
  tab = "plan";
  firstTripLoad = true;
  wishView = null;
  originSel = null;
  originLoaded = false;
  originEditing = false;
  wishFilter = "all";
  wishCatFilter = "all";
  planOpenId = null;
  editingWishId = null;
}

function route() {
  cleanup();
  const h = location.hash;
  if (h === "#/new") renderCreate();
  else if (h.startsWith("#/trip/")) {
    const [id, sub] = h.slice(7).split("/");
    if (sub === "edit") openTripEdit(decodeURIComponent(id));
    else openTrip(decodeURIComponent(id));
  }
  else renderList();
  window.scrollTo(0, 0);
}

const modeBanner = () =>
  store.mode === "local"
    ? `<div class="banner">โหมดทดลอง: ข้อมูลเก็บในเครื่องนี้เท่านั้น — ตั้งค่า Firebase แล้วทุกคนจะเห็นข้อมูลเดียวกัน</div>`
    : "";

/* ---------- หน้า: รายการทริป ---------- */
function renderList() {
  app.innerHTML = `
    <div class="list-head"><h1>ทริปของเรา</h1><a class="btn primary" href="#/new">+ Create plan</a></div>
    ${modeBanner()}
    <div id="trip-grid" class="trip-grid"><p class="muted">กำลังโหลด…</p></div>`;
  unsubs.push(store.listenTrips((list) => {
    const grid = $("#trip-grid");
    if (!grid) return;
    list.sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
    grid.innerHTML = list.length
      ? list.map((t) => `
          <a class="trip-card" href="#/trip/${encodeURIComponent(t.id)}">
            <h2>${esc(t.name)}</h2>
            <div class="muted">${esc(t.country)} · ${fmtDate(t.startDate)} – ${fmtDate(t.endDate, "year")}</div>
            <div class="muted">${(t.members || []).length} คน · ${daysBetween(t.startDate, t.endDate).length} วัน</div>
          </a>`).join("")
      : `<div class="empty">ยังไม่มีทริป — กด <b>+ Create plan</b> เพื่อสร้าง<br><br>
           <button class="btn" type="button" data-action="import">นำเข้าทริปโอซาก้าจากไฟล์เดิม</button></div>`;
  }));
}

async function importSample() {
  try {
    const res = await fetch("data/trips.json");
    const t = (await res.json()).trips[0];
    const id = store.createTrip({
      name: t.name, country: t.country, startDate: t.startDate, endDate: t.endDate,
      members: t.members, currency: t.currency || "THB", createdAt: Date.now(),
    });
    if (t.currency && t.currency !== "THB") updateRate(id, t.currency, true);
    (t.items || []).forEach((it, i) => store.add(id, "items", { ...it, createdAt: Date.now() + i }));
    DEFAULT_CHECKLIST.forEach((text, i) => store.add(id, "checklist", { text, done: false, createdAt: Date.now() + i }));
    location.hash = "#/trip/" + id;
  } catch (e) {
    console.error(e);
    toast("นำเข้าไม่สำเร็จ");
  }
}

/* ---------- หน้า: Create plan ---------- */
function tripFormFields(t = {}) {
  return `
    <div class="grid">
      <label class="wide">ชื่อทริป*<input name="name" required value="${esc(t.name)}" placeholder="เช่น โอซาก้า"></label>
      <label class="wide">ประเทศ / เมือง<input name="country" value="${esc(t.country)}" placeholder="เช่น ญี่ปุ่น"></label>
      <label>วันไป*<input type="date" name="startDate" required value="${esc(t.startDate)}"></label>
      <label>วันกลับ*<input type="date" name="endDate" required value="${esc(t.endDate)}"></label>
      <label class="wide">ข้อมูล ตม. ของประเทศปลายทาง
        <select name="destCode">${destOptions(t)}</select></label>
      <label class="wide">สกุลเงินที่ใช้ในทริป
        <select name="currency">${CURRENCIES.map(([c, n]) => `<option value="${c}" ${c === (t.currency || "THB") ? "selected" : ""}>${c} · ${n}</option>`).join("")}</select></label>
      <label class="wide">ผู้ร่วมทริป* <small class="muted">(คั่นด้วยจุลภาค หรือขึ้นบรรทัดใหม่)</small>
        <textarea name="members" rows="3" required placeholder="เอิง, มิว, พาย, เบ้น">${esc((t.members || []).join(", "))}</textarea></label>
    </div>`;
}

function readTripForm(form) {
  const f = formData(form);
  const memberList = [...new Set(f.members.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))];
  if (!f.name.trim() || !f.startDate || !f.endDate || !memberList.length) { toast("กรอกช่องที่มี * ให้ครบ"); return null; }
  if (f.endDate < f.startDate) { toast("วันกลับต้องไม่ก่อนวันไป"); return null; }
  return { name: f.name.trim(), country: f.country.trim(), startDate: f.startDate, endDate: f.endDate, currency: f.currency || "THB", destCode: f.destCode || "OTHER", members: memberList, useChecklist: f.useChecklist };
}

function renderCreate() {
  app.innerHTML = `
    <p><a href="#/">← ทริปทั้งหมด</a></p>
    <h1>Create plan</h1>
    ${modeBanner()}
    <form id="create-form" class="card form">
      ${tripFormFields()}
      <label class="check"><input type="checkbox" name="useChecklist" checked> ใส่เช็กลิสต์ก่อนเดินทางมาตรฐานให้ด้วย</label>
      <div class="actions"><button class="btn primary">สร้างทริป</button></div>
    </form>`;
}

/* ---------- หน้า: รายละเอียดทริป ---------- */
function openTrip(id) {
  app.innerHTML = `<p class="muted">กำลังโหลด…</p>`;
  SUBS.forEach((s) => (data[s] = []));
  unsubs.push(store.listenTrip(id, (t) => {
    if (!t) { app.innerHTML = `<p>ไม่พบทริปนี้ <a href="#/">กลับหน้าแรก</a></p>`; return; }
    trip = { members: [], ...t };
    if (firstTripLoad) {
      firstTripLoad = false;
      const today = new Date().toISOString().slice(0, 10);
      const i = tripDays().indexOf(today);
      if (i >= 0) dayIdx = i;
      // เรตอัตโนมัติ (ไม่ใช่ใส่เอง) → อัปเดตให้วันละครั้งตอนเปิดทริป
      if (t.currency && t.currency !== "THB" && t.rateSource !== "manual" && t.rateUpdated !== todayISO()) {
        updateRate(t.id, t.currency, true);
      }
    }
    const sig = JSON.stringify([t.name, t.country, t.startDate, t.endDate, t.members, t.currency, t.destCode]);
    const first = !skeletonSig;
    if (sig !== skeletonSig) { skeletonSig = sig; renderTripSkeleton(); }
    renderAll();
    // ยังไม่ได้เลือกว่าเป็นใคร → ถามก่อนเข้าทริป
    if (first && !getMe() && !lsGet("me-skip-" + t.id)) showMePicker();
  }));
  SUBS.forEach((s) => unsubs.push(store.listen(id, s, (list) => {
    data[s] = list;
    if (skeletonSig) renderSection(s);
  })));
}

function renderTripSkeleton() {
  const t = trip;
  const days = tripDays();
  if (dayIdx >= days.length) dayIdx = 0;
  const dayOpts = days.map((d, i) => `<option value="${d}">วันที่ ${i + 1} · ${fmtDate(d, "weekday")}</option>`).join("");
  const memberOpts = members().map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join("");
  app.innerHTML = `
  <div class="screen">
    <p><a href="#/">← ทริปทั้งหมด</a></p>
    ${modeBanner()}
    <div class="trip-head">
      <div>
        <h1>${esc(t.name)}</h1>
        <div class="muted">${esc(t.country)}${t.country ? " · " : ""}${fmtDate(t.startDate)} – ${fmtDate(t.endDate, "year")} · ${days.length} วัน</div>
        <div class="chips">${members().map((m) => `<span>${esc(m)}</span>`).join("")}</div>
      </div>
      <div class="head-actions">
        <button type="button" class="me-chip" data-action="pick-me" title="เปลี่ยนว่าฉันคือใคร">
          <span class="me-avatar" aria-hidden="true" id="me-avatar"></span>
          <span class="me-text"><small>ฉันคือ</small><b id="me-name">—</b></span>
          <span class="me-caret" aria-hidden="true">▾</span>
        </button>
        <a class="btn" href="#/trip/${encodeURIComponent(t.id)}/edit"><span aria-hidden="true"></span> แก้ไขทริป</a>
      </div>
    </div>

    <nav class="tabs main-tabs">
      ${TABS.map(([k, label, icon, short]) => `<button type="button" data-action="tab" data-tab="${k}"><span class="t-icon" aria-hidden="true">${icon}</span><span class="t-full">${label}</span><span class="t-short">${short}</span></button>`).join("")}
    </nav>

    <section data-panel="plan">
      <div class="panel-head">
        <h2>แพลนรายวัน</h2>
        <button class="btn pdf-btn" type="button" data-action="pdf">Export PDF</button>
      </div>
      <div class="tabs" id="day-tabs"></div>
      <div id="plan-list"></div>
      <form id="item-form" class="card form">
        <h3 id="item-form-title">เพิ่มกิจกรรม</h3>
        <div class="grid">
          <label>วันที่<select name="date">${dayOpts}</select></label>
          <label>เวลาถึง<input type="time" name="time"></label>
          <label class="wide">กิจกรรม*<input name="activity" required placeholder="เช่น ปราสาทโอซาก้า"></label>
          <label class="wide">สถานที่ (พิมพ์ชื่อ หรือวางลิงก์ Google Maps)<input name="place" placeholder="เช่น Osaka Castle"></label>
          <label>อยู่ที่นี่ประมาณ (นาที)<input type="number" name="stay" min="0" step="5" inputmode="numeric" placeholder="เช่น 90"></label>
          <label>ค่าใช้จ่าย
            <div class="amount-cur"><input type="number" name="cost" min="0" step="any" inputmode="decimal">${curSelect("costCurrency", tripCur())}</div></label>
          <fieldset class="sub">
            <legend>เวลาเปิด–ปิด</legend>
            <div class="hours"><input type="time" name="openTime" aria-label="เปิด"><span>–</span><input type="time" name="closeTime" aria-label="ปิด"></div>
            <div class="days"><span class="muted">วันหยุด:</span>${DAY_NAMES.map((n, i) => `<label class="day"><input type="checkbox" name="closed" value="${i}"><span>${n}</span></label>`).join("")}</div>
            <input name="hoursNote" placeholder="หมายเหตุ เช่น เข้าครั้งสุดท้าย 16:30 / หยุดวันนักขัตฤกษ์">
          </fieldset>
          <fieldset class="sub">
            <legend>การเดินทางมาที่นี่ <small class="muted">(ต่อได้หลายสาย)</small></legend>
            <div id="legs"></div>
            <button type="button" class="btn small" data-action="add-leg">+ เพิ่มสาย / ต่อรถ</button>
          </fieldset>
          <label class="wide">ลิงก์กับการจอง<select name="bookingId"><option value="">— ไม่มี —</option></select></label>
          <label class="wide">หมายเหตุ<input name="note"></label>
        </div>
        <div class="actions">
          <button class="btn primary" id="item-submit">เพิ่ม</button>
          <button class="btn" type="button" data-action="cancel-edit" id="item-cancel" hidden>ยกเลิก</button>
        </div>
      </form>
    </section>

    <section data-panel="wishlist">
      <div class="seg" role="tablist">
        <button type="button" data-action="wish-view" data-v="mine" id="seg-mine">⭐ ของเรา</button>
        <button type="button" data-action="wish-view" data-v="suggest" id="seg-suggest">✨ สถานที่แนะนำ</button>
      </div>
      <div id="suggest-view"></div>
      <div id="wish-mine">
      <button type="button" class="btn primary add-wish-btn" data-action="wish-new" id="wish-new-btn">＋ เพิ่มที่อยากไป</button>
      <form id="wish-form" class="card form" hidden>
        <h3 id="wish-form-title">เพิ่มที่อยากไป</h3>
        <div class="grid">
          <label class="wide">ชื่อร้าน / สถานที่*<input name="name" required placeholder="เช่น Ichiran Ramen Dotonbori"></label>
          <label>หมวด<select name="category">${WISH_CATS.map((c) => `<option>${c}</option>`).join("")}</select></label>
          <div class="wide prio-field"><span class="prio-label">ความอยากไป</span>
            <div class="prio-opts">${PRIORITIES.map(([v, l]) => `<label class="prio-opt"><input type="radio" name="priority" value="${v}" ${v === 2 ? "checked" : ""}><span>${"★".repeat(v)}<small>${l}</small></span></label>`).join("")}</div>
          </div>
          <label class="wide">สถานที่ (พิมพ์ชื่อ หรือวางลิงก์ Google Maps)<input name="place" placeholder="ใช้เปิดแผนที่"></label>
          <label class="wide">ลิงก์รีวิว / IG / TikTok<input type="url" name="link" placeholder="https://"></label>
          <label class="wide">ใครแนะนำ / เจอจากไหน<input name="source" placeholder="เช่น เอิงแนะนำ, เพจ xxx, TikTok @xxx"></label>
          <label>งบโดยประมาณ (ต่อคน)
            <div class="amount-cur"><input type="number" name="budget" min="0" step="any" inputmode="decimal">${curSelect("budgetCurrency", tripCur())}</div></label>
          <label>เมนูเด็ด / ต้องลอง<input name="mustTry" placeholder="เช่น ราเมนต้นตำรับ + ไข่ต้ม"></label>
          <label class="wide">ใช้เวลาเที่ยวที่นี่ประมาณ <small class="muted">(ไม่รวมเดินทาง)</small><input name="timeNeeded" placeholder="เช่น 1 ชม., 2–3 ชม., ครึ่งวัน"></label>
          <label class="wide">การเดินทาง / สถานีใกล้สุด<input name="access" placeholder="เช่น สถานีนัมบะ (สาย Midosuji) เดิน 5 นาที"></label>
          <label class="wide">หมายเหตุ<input name="note"></label>
        </div>
        <div class="actions">
          <button class="btn primary" id="wish-submit">บันทึก</button>
          <button class="btn" type="button" data-action="wish-cancel">ยกเลิก</button>
        </div>
      </form>
      <div id="wish-list"></div>
      </div>
    </section>

    <section data-panel="bookings">
      <div id="book-list"></div>
      <form id="book-form" class="card form">
        <h3 id="book-form-title">เพิ่มการจอง</h3>
        <div class="grid">
          <label>ประเภท<select name="type">${BOOK_TYPES.map((c) => `<option>${c}</option>`).join("")}</select></label>
          <label class="not-hotel">วันที่<input type="date" name="date" value="${esc(t.startDate)}"></label>
          <label class="wide"><span class="hotel-only">ชื่อที่พัก*</span><span class="not-hotel">รายละเอียด*</span><input name="title" required placeholder="เช่น Thai AirAsia FD xxx DMK→KIX"></label>
          <fieldset class="sub hotel-only">
            <legend>เข้าพัก</legend>
            <div class="stay-grid">
              <label>เช็คอิน (วันที่)<input type="date" name="checkInDate" value="${esc(t.startDate)}"></label>
              <label>เวลาเช็คอิน<input type="time" name="checkInTime" value="15:00"></label>
              <label>เช็คเอาท์ (วันที่)<input type="date" name="checkOutDate" value="${esc(t.endDate)}"></label>
              <label>เวลาเช็คเอาท์<input type="time" name="checkOutTime" value="11:00"></label>
            </div>
            <small class="muted" id="nights-preview"></small>
          </fieldset>
          <label class="not-hotel">เวลา<input type="time" name="time"></label>
          <label>เลขการจอง<input name="ref"></label>
          <label class="wide hotel-only">ที่อยู่โรงแรม <small class="muted">(ภาษาอังกฤษ — ใช้ในเอกสารโชว์ ตม. และหาตำแหน่งที่พัก)</small>
            <textarea name="address" rows="2" placeholder="เช่น 8-9 Namba-sennichimae, Chuo-ku, Osaka 542-0075"></textarea></label>
          <label class="wide"><span class="hotel-only">ลิงก์ Google Maps / ชื่อบนแผนที่ (ไม่บังคับ)</span><span class="not-hotel">สถานที่ (พิมพ์ชื่อ หรือวางลิงก์ Google Maps)</span><input name="place"></label>
          <label class="wide">หมายเหตุ<input name="note"></label>
        </div>
        <div class="actions">
          <button class="btn primary" id="book-submit">เพิ่ม</button>
          <button class="btn" type="button" data-action="cancel-book-edit" id="book-cancel" hidden>ยกเลิก</button>
        </div>
      </form>
    </section>

    <section data-panel="money">
      <div class="card" id="rate-card"></div>
      <div class="card"><h3>สรุปหารค่าใช้จ่าย <small class="muted">(หารเท่ากันทุกคน · คิดเป็นเงินบาท)</small></h3><div id="settle"></div></div>
      <div class="card"><h3>รายการที่จ่ายไปแล้ว</h3><div id="expense-list"></div></div>
      <form id="expense-form" class="card form">
        <h3>เพิ่มค่าใช้จ่าย</h3>
        <div class="grid">
          <label class="wide">รายการ*<input name="title" required placeholder="เช่น ค่าอาหารเย็น"></label>
          <label>จำนวนเงิน*
            <div class="amount-cur"><input type="number" name="amount" min="0" step="any" required inputmode="decimal">${curSelect("currency", tripCur())}</div>
            <small class="muted" id="expense-preview"></small></label>
          <label>ใครจ่าย<select name="paidBy">${memberOpts}</select></label>
          <label>วันที่<select name="date"><option value="">—</option>${dayOpts}</select></label>
        </div>
        <div class="actions"><button class="btn primary">เพิ่ม</button></div>
      </form>
    </section>

    <section data-panel="packing">
      <div class="card"><h3>ความคืบหน้าของทุกคน</h3><div id="pack-progress"></div></div>
      <div class="card">
        <h3>ของของฉัน</h3>
        <p id="pack-need-me" class="muted">เลือก “ฉันคือใคร?” ด้านบนก่อน เพื่อจัดรายการของตัวเอง</p>
        <div id="pack-mine"></div>
        <form id="pack-form" class="inline-form">
          <input name="name" required placeholder="เพิ่มของ เช่น เสื้อกันหนาว">
          <button class="btn primary">เพิ่ม</button>
        </form>
        <div id="pack-sugg"></div>
      </div>
      <div id="pack-others"></div>
    </section>

    <section data-panel="prep">
      <div id="prep-info"></div>
      <div class="card">
        <h3>✅ ความพร้อมของทริป</h3>
        <div id="prep-ready"></div>
      </div>
      <div class="card">
        <h3>🧍 เช็กลิสต์ของฉัน <small class="muted" id="prep-count"></small></h3>
        <div id="prep-mine"></div>
        <h4>ความคืบหน้าของทุกคน</h4>
        <div id="prep-progress"></div>
      </div>
      <div class="card">
        <h3>📋 เช็กลิสต์ทั้งกลุ่ม <small class="muted" id="check-count"></small></h3>
        <div id="check-list"></div>
        <form id="check-form" class="inline-form">
          <input name="text" required placeholder="เพิ่มรายการ">
          <button class="btn primary">เพิ่ม</button>
        </form>
      </div>
    </section>
  </div>
  <div id="print-view" class="print-only"></div>`;

  updateMeChip();
  const d = days[dayIdx];
  if (d) $("#item-form [name=date]").value = d;
  syncMeForms();
  syncBookForm();
  setTab(tab);
}

function setTab(name, fromUser = false) {
  tab = name;
  app.querySelectorAll(".main-tabs button").forEach((b) => {
    const on = b.dataset.tab === name;
    b.classList.toggle("active", on);
    b.setAttribute("aria-current", on ? "page" : "false");
  });
  app.querySelectorAll("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== name));
  // กดเปลี่ยนแท็บแล้วเลื่อนไปต้นหมวด (เฉพาะตอนเลื่อนลงไปไกลแล้ว)
  if (fromUser) {
    const panel = app.querySelector(`[data-panel="${name}"]`);
    const top = panel.getBoundingClientRect().top + scrollY - 120;
    if (scrollY > top) scrollTo({ top: Math.max(top, 0) });
  }
}

function syncMeForms() {
  const me = getMe();
  const packForm = $("#pack-form");
  if (packForm) packForm.hidden = !me;
  const need = $("#pack-need-me");
  if (need) need.hidden = !!me;
  const paidBy = $("#expense-form [name=paidBy]");
  if (paidBy && me) paidBy.value = me;
}

function renderAll() { renderPlan(); renderWishlist(); renderSuggest(); renderBookings(); renderMoney(); renderPacking(); renderChecklist(); renderPrep(); }

function renderSection(s) {
  ({
    items: () => { renderPlan(); renderMoney(); renderBookings(); renderPrep(); renderWishlist(); renderSuggest(); },
    wishlist: () => { renderWishlist(); renderSuggest(); },
    bookings: () => { renderBookings(); renderPlan(); renderPrep(); renderSuggest(); renderWishlist(); },
    expenses: renderMoney,
    packing: renderPacking,
    checklist: renderChecklist,
    prep: renderPrep,
  })[s]();
}

const delBtn = (sub, id) => `<button type="button" class="icon" data-action="del" data-sub="${sub}" data-id="${esc(id)}" title="ลบ">✕</button>`;
const mapLink = (place) =>
  place ? `<a href="${esc(mapUrl(place))}" target="_blank" rel="noopener">📍 ${isLink(place) ? "เปิดแผนที่" : esc(place)}</a>` : "";

/* ---------- แพลนรายวัน ---------- */
function renderPlan() {
  const el = $("#plan-list");
  if (!el) return;
  const days = tripDays();
  $("#day-tabs").innerHTML = days.map((d, i) => {
    const c = data.items.filter((x) => x.date === d).length;
    return `<button type="button" class="day-btn ${i === dayIdx ? "active" : ""}" data-action="day" data-i="${i}">
      <span class="d-num">วันที่ ${i + 1}</span><span class="d-date">${fmtDate(d, "weekday")}</span>${c ? `<span class="d-count">${c}</span>` : ""}</button>`;
  }).join("");
  // เลื่อนแท็บวันที่เลือกให้อยู่ตรงกลาง (ไม่เลื่อนทั้งหน้า)
  const strip = $("#day-tabs"), act = strip.querySelector(".active");
  if (act) strip.scrollLeft = act.offsetLeft - strip.clientWidth / 2 + act.clientWidth / 2;
  const d = days[dayIdx];
  const list = sortItems(data.items.filter((x) => x.date === d));
  const total = list.reduce((s, x) => s + toTHB(x.cost, x.costCurrency), 0);
  const travelTotal = list.reduce((s, x) => s + legsMinutes(x), 0);
  el.innerHTML = `<h3 class="day-title">${fmtDate(d, "long")}</h3>` + dayHotelHtml(d) + (list.length
    ? `<ul class="rows timeline">${list.map((x, i) => connectorHtml(list[i - 1], x) + itemHtml(x)).join("")}</ul>
       <p class="total">รวมวันนี้ ${money(total)}${travelTotal ? ` · เดินทางรวม ${fmtDur(travelTotal)}` : ""}</p>`
    : `<p class="empty">ยังไม่มีแพลนวันนี้ — เพิ่มด้านล่าง หรือดึงจากแท็บ Wishlist</p>`);
}

/* เวลา: "14:30" ↔ นาที */
const toMin = (t) => (/^\d{1,2}:\d{2}$/.test(t || "") ? +t.split(":")[0] * 60 + +t.split(":")[1] : null);
const fromMin = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fmtDur = (m) => (m >= 60 ? `${Math.floor(m / 60)} ชม.${m % 60 ? ` ${m % 60} นาที` : ""}` : `${m} นาที`);
const legsOf = (x) => (Array.isArray(x.legs) ? x.legs : []);
const legsMinutes = (x) => legsOf(x).reduce((s, l) => s + num(l.minutes), 0);
const legText = (l) => `${l.line || "เดินทาง"}${l.from || l.to ? ` (${[l.from, l.to].filter(Boolean).join(" → ")})` : ""}${num(l.minutes) ? ` ${num(l.minutes)} นาที` : ""}`;
const dirUrl = (from, to) =>
  !from || !to || isLink(from) || isLink(to) ? "" :
  `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}&travelmode=transit`;

/* เช็กเวลาเปิดปิด: คืนคำเตือน (ถ้ามี) */
function hoursWarnings(x) {
  const warn = [];
  const closed = Array.isArray(x.closedDays) ? x.closedDays.map(Number) : [];
  if (x.date && closed.includes(new Date(x.date + "T00:00:00").getDay())) warn.push("ปิดวันนี้!");
  const t = toMin(x.time), o = toMin(x.openTime), c = toMin(x.closeTime);
  if (t !== null && o !== null && c !== null) {
    const inside = c > o ? t >= o && t < c : t >= o || t < c; // รองรับร้านเปิดข้ามเที่ยงคืน
    if (!inside) warn.push("นอกเวลาเปิด");
    else if (c > o && num(x.stay) && t + num(x.stay) > c) warn.push(`ปิดก่อนออก (ปิด ${x.closeTime})`);
  }
  return warn;
}

function hoursText(x) {
  const closed = Array.isArray(x.closedDays) ? x.closedDays.map(Number).sort() : [];
  const parts = [];
  if (x.openTime || x.closeTime) parts.push(`${x.openTime || "?"}–${x.closeTime || "?"}`);
  if (closed.length) parts.push(`หยุด ${closed.map((i) => DAY_NAMES[i]).join(", ")}`);
  if (x.hoursNote) parts.push(x.hoursNote);
  return parts.join(" · ");
}

/* เส้นเชื่อมระหว่างกิจกรรม: สายรถไฟ + เวลาเดินทาง + เวลาถึงโดยประมาณ */
function connectorHtml(prev, x) {
  const legs = legsOf(x);
  const mins = legsMinutes(x);
  const route = prev ? dirUrl(prev.place, x.place) : "";
  if (!legs.length && !route && !x.transport) return "";
  let eta = "";
  const pt = toMin(prev?.time);
  if (prev && pt !== null && mins) {
    const arrive = pt + num(prev.stay) + mins;
    const target = toMin(x.time);
    const late = target !== null && arrive > target;
    eta = num(prev.stay)
      ? `<span class="${late ? "warn" : "muted"}">${late ? "⚠️ อาจไม่ทัน — " : ""}ถึงประมาณ ${fromMin(arrive)}</span>`
      : `<span class="muted">(ใส่ “อยู่ที่นี่ประมาณ” ของจุดก่อนหน้า เพื่อคำนวณเวลาถึง)</span>`;
  }
  return `<li class="connector">
    ${legs.length
      ? `<ol class="legs">${legs.map((l) => `<li>🚃 ${esc(legText(l))}</li>`).join("")}</ol>`
      : x.transport ? `<div>🚃 ${esc(x.transport)}</div>` : ""}
    <div class="conn-meta">${mins ? `<b>เดินทางรวม ${fmtDur(mins)}</b>` : ""}${eta}${route ? `<a href="${esc(route)}" target="_blank" rel="noopener">🗺️ ดูเส้นทาง/เวลาใน Google Maps</a>` : ""}</div>
  </li>`;
}

function itemHtml(x) {
  const warns = hoursWarnings(x);
  const hrs = hoursText(x);
  const bk = x.bookingId && data.bookings.find((b) => b.id === x.bookingId);
  return `
    <li class="row" id="item-${esc(x.id)}">
      <div class="time">${esc(x.time) || "—"}${num(x.stay) ? `<small>${fmtDur(num(x.stay))}</small>` : ""}</div>
      <div class="body">
        <div class="title">${esc(x.activity)} ${warns.map((w) => `<span class="badge warn">⚠️ ${esc(w)}</span>`).join(" ")}</div>
        <div class="meta">${mapLink(x.place)}${hrs ? `<span>🕘 ${esc(hrs)}</span>` : ""}${num(x.cost) ? `<span>💰 ${fmtWithTHB(x.cost, x.costCurrency)}</span>` : ""}</div>
        ${bk ? `<button type="button" class="link-btn" data-action="goto-booking" data-id="${esc(bk.id)}">🎫 ${esc(bk.type)}: ${esc(bk.title)}${bk.ref ? ` · ${esc(bk.ref)}` : ""} →</button>` : ""}
        ${x.note ? `<div class="note">${esc(x.note)}</div>` : ""}
      </div>
      <div class="row-actions">
        <button type="button" class="icon" data-action="edit-item" data-id="${esc(x.id)}" title="แก้ไข">✎</button>${delBtn("items", x.id)}
      </div>
    </li>`;
}

/* ช่องกรอกสายรถไฟ (หลายแถว) */
const legRowHtml = (l = {}) => `
  <div class="leg">
    <input data-k="line" placeholder="สาย / ยานพาหนะ เช่น JR Loop Line, เดิน" value="${esc(l.line)}">
    <input data-k="from" placeholder="ขึ้นที่" value="${esc(l.from)}">
    <input data-k="to" placeholder="ลงที่" value="${esc(l.to)}">
    <input data-k="minutes" type="number" min="0" inputmode="numeric" placeholder="นาที" value="${num(l.minutes) || ""}">
    <button type="button" class="icon" data-action="del-leg" title="ลบสายนี้">✕</button>
  </div>`;

function setLegs(legs) { $("#legs").innerHTML = legs.map(legRowHtml).join(""); }

function readLegs() {
  return [...app.querySelectorAll("#legs .leg")].map((row) => {
    const l = {};
    row.querySelectorAll("[data-k]").forEach((inp) => (l[inp.dataset.k] = inp.value.trim()));
    l.minutes = num(l.minutes);
    return l;
  }).filter((l) => l.line || l.from || l.to || l.minutes);
}

function startEdit(id) {
  const x = data.items.find((i) => i.id === id);
  if (!x) return;
  editingItemId = id;
  const f = $("#item-form");
  ["date", "time", "activity", "place", "stay", "cost", "costCurrency", "openTime", "closeTime", "hoursNote", "bookingId", "note"]
    .forEach((k) => (f[k].value = x[k] ?? ""));
  const closed = (x.closedDays || []).map(String);
  f.querySelectorAll("[name=closed]").forEach((cb) => (cb.checked = closed.includes(cb.value)));
  // รายการเก่าที่มีแค่ช่อง "การเดินทาง" → แปลงเป็นสายแรกให้
  setLegs(legsOf(x).length ? legsOf(x) : x.transport ? [{ line: x.transport }] : []);
  $("#item-form-title").textContent = "แก้ไขกิจกรรม";
  $("#item-submit").textContent = "บันทึก";
  $("#item-cancel").hidden = false;
  f.scrollIntoView({ behavior: "smooth", block: "center" });
}

function stopEdit() {
  editingItemId = null;
  const f = $("#item-form");
  f.reset();
  setLegs([]);
  f.date.value = tripDays()[dayIdx] || "";
  $("#item-form-title").textContent = "เพิ่มกิจกรรม";
  $("#item-submit").textContent = "เพิ่ม";
  $("#item-cancel").hidden = true;
}

/* ---------- Wishlist ---------- */
const PRIORITIES = [[1, "อยากไป"], [2, "อยากไปมาก"], [3, "ต้องไปให้ได้"]];
let wishFilter = "all";      // all | todo | planned
let wishCatFilter = "all";
let planOpenId = null;       // รายการที่กำลังเลือกวันใส่แพลน
let editingWishId = null;

// วันที่ในแพลนของรายการนี้ (นับจากกิจกรรมจริง — ลบออกจากแพลนแล้วสถานะจะกลับเป็น "ยังไม่ได้ใส่")
function wishPlanDates(w) {
  const linked = data.items.filter((i) => i.wishId === w.id).map((i) => i.date);
  if (linked.length || w.planLinked) return [...new Set(linked)].sort();
  return w.plannedDate ? [w.plannedDate] : []; // รายการเก่า
}
const linkLabel = (url = "") =>
  /instagram\.com/i.test(url) ? "📷 IG" : /tiktok\.com/i.test(url) ? "🎵 TikTok" : /youtu/i.test(url) ? "▶️ YouTube" :
  /facebook\.com|fb\.watch/i.test(url) ? "📘 Facebook" : /tabelog/i.test(url) ? "🍽️ Tabelog" : "🔗 ลิงก์รีวิว";

function renderWishlist() {
  const el = $("#wish-list");
  if (!el) return;
  const days = tripDays();
  const all = data.wishlist.map((w) => ({ ...w, dates: wishPlanDates(w) }));
  const todo = all.filter((w) => !w.dates.length);
  const cats = [...new Set(all.map((w) => (WISH_CATS.includes(w.category) ? w.category : "อื่นๆ")))];
  if (wishCatFilter !== "all" && !cats.includes(wishCatFilter)) wishCatFilter = "all";
  let list = all.filter((w) => (wishFilter === "all" || (wishFilter === "todo" ? !w.dates.length : w.dates.length)) &&
    (wishCatFilter === "all" || (WISH_CATS.includes(w.category) ? w.category : "อื่นๆ") === wishCatFilter));
  list.sort((a, b) => (+!!a.dates.length - +!!b.dates.length) || (num(b.priority || 2) - num(a.priority || 2)) || byCreated(a, b));

  if (!all.length) {
    el.innerHTML = `<p class="empty">ยังไม่มีที่อยากไป — กด “＋ เพิ่มที่อยากไป” เพื่อลิสต์ร้านหรือที่เที่ยวไว้ก่อน<br>หรือดูไอเดียจาก “สถานที่แนะนำ”</p>`;
    return;
  }
  const dayOpts = days.map((d, i) => `<option value="${d}">วันที่ ${i + 1} · ${fmtDate(d, "weekday")}</option>`).join("");
  el.innerHTML = `
    <div class="wish-summary">
      <div class="chip-row">
        <button type="button" class="fchip ${wishFilter === "all" ? "active" : ""}" data-action="wish-filter" data-v="all">ทั้งหมด ${all.length}</button>
        <button type="button" class="fchip ${wishFilter === "todo" ? "active" : ""}" data-action="wish-filter" data-v="todo">🟠 ยังไม่ใส่แพลน ${todo.length}</button>
        <button type="button" class="fchip ${wishFilter === "planned" ? "active" : ""}" data-action="wish-filter" data-v="planned">✓ ใส่แพลนแล้ว ${all.length - todo.length}</button>
      </div>
      ${cats.length > 1 ? `<div class="chip-row">${["all", ...cats].map((c) => `<button type="button" class="fchip ${wishCatFilter === c ? "active" : ""}" data-action="wish-cat" data-v="${esc(c)}">${c === "all" ? "ทุกหมวด" : esc(c)}</button>`).join("")}</div>` : ""}
      ${originPickerHtml()}
    </div>
    ${list.length ? list.map((w) => {
      const prio = num(w.priority) || 2;
      const status = w.dates.length
        ? `<span class="wstatus done">✓ อยู่ในแพลน ${w.dates.map((d) => `วันที่ ${days.indexOf(d) + 1} (${fmtDate(d)})`).join(", ")}</span>`
        : `<span class="wstatus todo">🟠 ยังไม่ได้ใส่ในแพลน</span>`;
      const picking = planOpenId === w.id;
      return `
      <article class="card wish-card ${w.dates.length ? "is-planned" : ""}" id="wish-${esc(w.id)}">
        <div class="wish-top">
          <div class="wish-title">
            <h3>${esc(w.name)}</h3>
            <div class="prio p${prio}" title="${esc(PRIORITIES[prio - 1][1])}">${"★".repeat(prio)}<span>${"★".repeat(3 - prio)}</span> <small>${esc(PRIORITIES[prio - 1][1])}</small></div>
          </div>
          <div class="row-actions">
            <button type="button" class="icon" data-action="wish-edit" data-id="${esc(w.id)}" title="แก้ไข">✎</button>${delBtn("wishlist", w.id)}
          </div>
        </div>
        ${status}
        <div class="meta wish-meta">
          <span class="badge">${esc(w.category || "อื่นๆ")}</span>
          ${mapLink(w.place || w.name)}
          ${w.link ? `<a href="${esc(w.link)}" target="_blank" rel="noopener">${linkLabel(w.link)}</a>` : ""}
          ${num(w.budget) ? `<span>💰 ~${fmtWithTHB(w.budget, w.budgetCurrency)}/คน</span>` : ""}
        </div>
        ${w.mustTry ? `<div class="wish-line">🍽️ <b>ต้องลอง:</b> ${esc(w.mustTry)}</div>` : ""}
        ${w.source ? `<div class="wish-line muted">👤 ${esc(w.source)}</div>` : ""}
        ${w.timeNeeded ? `<div class="wish-line">${timeHtml(w.timeNeeded)}</div>` : ""}
        ${(() => { const c = wishCoords(w); if (!c) queueWishGeocode(w); return travelBoxHtml({ coords: c, query: w.place || w.name, access: w.access, label: w.name, pending: !c && (geoBusy || geoQueue.some((x) => x.id === w.id)) }); })()}
        ${w.note ? `<div class="note">${esc(w.note)}</div>` : ""}
        ${picking
          ? `<div class="to-plan">
               <select data-role="wish-date" data-id="${esc(w.id)}">${dayOpts}</select>
               <button type="button" class="btn small primary" data-action="to-plan" data-id="${esc(w.id)}">ยืนยัน</button>
               <button type="button" class="btn small" data-action="plan-cancel">ยกเลิก</button>
             </div>`
          : `<button type="button" class="btn small plan-btn" data-action="plan-open" data-id="${esc(w.id)}">${w.dates.length ? "ใส่อีกวัน" : "ใส่ลงแพลน"}</button>`}
      </article>`;
    }).join("") : `<p class="empty">ไม่มีรายการตามตัวกรองนี้</p>`}`;
}

function wishToPlan(id) {
  const w = data.wishlist.find((x) => x.id === id);
  const sel = app.querySelector(`[data-role=wish-date][data-id="${CSS.escape(id)}"]`);
  if (!w || !sel) return;
  const note = [w.access ? `การเดินทาง: ${w.access}` : "", w.mustTry ? `ต้องลอง: ${w.mustTry}` : "", w.note || ""].filter(Boolean).join(" · ");
  store.add(trip.id, "items", {
    date: sel.value, time: "", activity: w.name, place: w.place || w.name,
    transport: "", cost: num(w.budget), costCurrency: w.budgetCurrency || tripCur(), note, wishId: w.id, createdAt: Date.now(),
  });
  store.update(trip.id, "wishlist", id, { plannedDate: sel.value, planLinked: true });
  planOpenId = null;
  toast(`ใส่ “${w.name}” ลงแพลน ${fmtDate(sel.value)} แล้ว`);
}

function openWishForm(w) {
  const form = $("#wish-form");
  const f = form.elements;
  form.reset();
  editingWishId = w ? w.id : null;
  if (w) {
    ["name", "category", "place", "link", "source", "budget", "mustTry", "timeNeeded", "access", "note"].forEach((k) => (f[k].value = w[k] ?? ""));
    f.budgetCurrency.value = w.budgetCurrency || tripCur();
    const pr = String(num(w.priority) || 2);
    form.querySelectorAll("[name=priority]").forEach((r) => (r.checked = r.value === pr));
  }
  $("#wish-form-title").textContent = w ? "แก้ไขที่อยากไป" : "เพิ่มที่อยากไป";
  form.hidden = false;
  $("#wish-new-btn").hidden = true;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  if (!w) setTimeout(() => f.name.focus(), 300);
}

function closeWishForm() {
  const form = $("#wish-form");
  form.reset();
  form.hidden = true;
  editingWishId = null;
  $("#wish-new-btn").hidden = false;
}

/* ---------- การจอง ---------- */
function renderBookings() {
  const el = $("#book-list");
  if (!el) return;
  const list = [...data.bookings].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  // อัปเดตตัวเลือก "ลิงก์กับการจอง" ในฟอร์มแพลน (คงค่าที่เลือกไว้)
  const sel = $("#item-form [name=bookingId]");
  if (sel) {
    const keep = sel.value;
    sel.innerHTML = `<option value="">— ไม่มี —</option>` +
      list.map((b) => `<option value="${esc(b.id)}">${esc(b.type)}: ${esc(b.title)}${b.date ? ` (${fmtDate(b.date)})` : ""}</option>`).join("");
    sel.value = list.some((b) => b.id === keep) ? keep : "";
  }
  const days = tripDays();
  el.innerHTML = hotelSummaryHtml() + (list.length
    ? `<div class="card"><h3>การจองทั้งหมด</h3><ul class="rows">${list.map((b) => {
        const used = sortItems(data.items.filter((i) => i.bookingId === b.id))
          .sort((p, q) => (p.date || "").localeCompare(q.date || ""));
        return `
        <li class="row" id="booking-${esc(b.id)}">
          <div class="body">
            <div class="title"><span class="badge">${esc(b.type)}</span> ${esc(b.title)}</div>
            ${isHotel(b)
              ? `<div class="stay-line">🛬 เช็คอิน <b>${fmtDate(b.date, "weekday")}${b.time ? " " + esc(b.time) : ""}</b> → 🛫 เช็คเอาท์ <b>${fmtDate(b.checkOutDate, "weekday")}${b.checkOutTime ? " " + esc(b.checkOutTime) : ""}</b> · ${nightsOf(b)} คืน</div>
                 ${b.address ? `<div class="note">ที่อยู่: ${esc(b.address)}</div>` : `<div class="note warn-soft">ยังไม่ได้ใส่ที่อยู่โรงแรม — ใช้ในเอกสารโชว์ ตม.</div>`}
                 <div class="meta">${mapLink(b.place || b.address || b.title)}</div>`
              : `<div class="meta"><span>📅 ${fmtDate(b.date, "weekday")}${b.time ? " · " + esc(b.time) : ""}</span>${mapLink(b.place)}</div>`}
            ${b.ref ? `<div class="ref">เลขการจอง: <b>${esc(b.ref)}</b></div>` : ""}
            ${b.note ? `<div class="note">${esc(b.note)}</div>` : ""}
            ${used.map((i) => `<button type="button" class="link-btn" data-action="goto-item" data-id="${esc(i.id)}">← ใช้ในแพลน วันที่ ${days.indexOf(i.date) + 1} · ${esc(i.time || "")} ${esc(i.activity)}</button>`).join("")}
          </div>
          <div class="row-actions">
            <button type="button" class="icon" data-action="edit-booking" data-id="${esc(b.id)}" title="แก้ไข">✎</button>${delBtn("bookings", b.id)}
          </div>
        </li>`;
      }).join("")}</ul></div>`
    : `<p class="empty">ยังไม่มีข้อมูลการจอง</p>`);
}

/* ---------- ที่พัก ---------- */
const isHotel = (b) => b?.type === "ที่พัก";
const hotels = () => data.bookings.filter(isHotel).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
const nightsOf = (b) => Math.max(0, daysBetween(b.date, b.checkOutDate).length - 1);
// คืนที่ต้องมีที่พัก = ทุกคืนตั้งแต่วันไป ถึงก่อนวันกลับ
const tripNights = () => tripDays().slice(0, -1);
// ที่พักของคืนวันที่ d (เช็คอิน <= d < เช็คเอาท์)
const hotelForNight = (d) => hotels().filter((h) => h.date && h.checkOutDate && h.date <= d && d < h.checkOutDate);

function hotelSummaryHtml() {
  const nights = tripNights();
  const hs = hotels();
  if (!nights.length) return "";
  const missing = nights.filter((d) => !hotelForNight(d).length);
  const overlap = nights.filter((d) => hotelForNight(d).length > 1);
  const days = tripDays();
  return `<div class="card hotel-card">
    <h3>🏨 ที่พักตลอดทริป <small class="muted">${nights.length - missing.length}/${nights.length} คืน</small></h3>
    ${hs.length ? `<ul class="hotel-list">${hs.map((h) => `
      <li>
        <button type="button" class="hotel-name" data-action="goto-booking" data-id="${esc(h.id)}">${esc(h.title)}</button>
        <div class="muted">${fmtDate(h.date)} ${esc(h.time || "")} → ${fmtDate(h.checkOutDate)} ${esc(h.checkOutTime || "")} · ${nightsOf(h)} คืน</div>
      </li>`).join("")}</ul>` : ""}
    <div class="night-strip">${nights.map((d) => {
      const h = hotelForNight(d);
      const cls = !h.length ? "none" : h.length > 1 ? "dup" : "ok";
      return `<span class="night ${cls}" title="${esc(h.map((x) => x.title).join(", ") || "ยังไม่มีที่พัก")}">คืน${days.indexOf(d) + 1}<small>${fmtDate(d)}</small></span>`;
    }).join("")}</div>
    ${missing.length ? `<p class="warn">⚠️ ยังไม่มีที่พัก ${missing.length} คืน: ${missing.map((d) => fmtDate(d)).join(", ")}</p>` : `<p class="ok-text">✓ มีที่พักครบทุกคืน</p>`}
    ${overlap.length ? `<p class="warn">⚠️ จองซ้อนกัน: ${overlap.map((d) => fmtDate(d)).join(", ")}</p>` : ""}
  </div>`;
}

// แถบที่พักบนหัวแต่ละวันในแพลน
function dayHotelHtml(d) {
  const out = hotels().filter((h) => h.checkOutDate === d);
  const tonight = hotelForNight(d);
  const isLastDay = d === tripDays().at(-1);
  const parts = [];
  out.forEach((h) => parts.push(`<div>🛫 เช็คเอาท์ <b>${esc(h.title)}</b>${h.checkOutTime ? ` ภายใน ${esc(h.checkOutTime)}` : ""}</div>`));
  tonight.forEach((h) => parts.push(h.date === d
    ? `<div>🛬 เช็คอิน <b>${esc(h.title)}</b>${h.time ? ` ตั้งแต่ ${esc(h.time)}` : ""} ${mapLink(h.place || h.title)}</div>`
    : `<div>🏨 คืนนี้พักที่ <b>${esc(h.title)}</b> ${mapLink(h.place || h.title)}</div>`));
  if (!tonight.length && !isLastDay) parts.push(`<div class="warn">⚠️ คืนนี้ยังไม่มีที่พัก</div>`);
  return parts.length ? `<div class="day-hotel">${parts.join("")}</div>` : "";
}

function syncBookForm() {
  const form = $("#book-form");
  if (!form) return;
  const f = form.elements;
  const hotel = f.type.value === "ที่พัก";
  form.classList.toggle("is-hotel", hotel);
  f.title.placeholder = hotel ? "เช่น Hotel Gracery Namba" : "เช่น Thai AirAsia FD xxx DMK→KIX";
  const n = Math.max(0, daysBetween(f.checkInDate.value, f.checkOutDate.value).length - 1);
  $("#nights-preview").textContent = hotel && f.checkInDate.value && f.checkOutDate.value
    ? (f.checkOutDate.value <= f.checkInDate.value ? "⚠️ วันเช็คเอาท์ต้องหลังวันเช็คอิน" : `${n} คืน`) : "";
}

function startEditBooking(id) {
  const b = data.bookings.find((x) => x.id === id);
  if (!b) return;
  editingBookingId = id;
  const form = $("#book-form");
  const f = form.elements;
  ["type", "date", "time", "title", "ref", "place", "note", "address"].forEach((k) => (f[k].value = b[k] ?? ""));
  if (isHotel(b)) {
    f.checkInDate.value = b.date || "";
    f.checkInTime.value = b.time || "";
    f.checkOutDate.value = b.checkOutDate || "";
    f.checkOutTime.value = b.checkOutTime || "";
  }
  $("#book-form-title").textContent = "แก้ไขการจอง";
  $("#book-submit").textContent = "บันทึก";
  $("#book-cancel").hidden = false;
  syncBookForm();
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function stopEditBooking() {
  editingBookingId = null;
  const f = $("#book-form");
  f.reset();
  $("#book-form-title").textContent = "เพิ่มการจอง";
  $("#book-submit").textContent = "เพิ่ม";
  $("#book-cancel").hidden = true;
  syncBookForm();
}

/* ---------- ค่าใช้จ่าย + หารเงิน ---------- */
function settle() {
  const ms = members();
  const total = data.expenses.reduce((s, e) => s + toTHB(e.amount, e.currency), 0);
  const share = ms.length ? total / ms.length : 0;
  const paid = Object.fromEntries(ms.map((m) => [m, 0]));
  data.expenses.forEach((e) => { if (e.paidBy in paid) paid[e.paidBy] += toTHB(e.amount, e.currency); });
  const cred = ms.map((m) => ({ m, b: paid[m] - share })).filter((x) => x.b > 0.005).sort((a, b) => b.b - a.b);
  const debt = ms.map((m) => ({ m, b: share - paid[m] })).filter((x) => x.b > 0.005).sort((a, b) => b.b - a.b);
  const tx = [];
  let i = 0, j = 0;
  while (i < debt.length && j < cred.length) {
    const amt = Math.min(debt[i].b, cred[j].b);
    tx.push({ from: debt[i].m, to: cred[j].m, amt });
    debt[i].b -= amt;
    cred[j].b -= amt;
    if (debt[i].b < 0.005) i++;
    if (cred[j].b < 0.005) j++;
  }
  return { total, share, paid, tx };
}

const planTotalTHB = () => data.items.reduce((s, x) => s + toTHB(x.cost, x.costCurrency), 0);

function settleHtml() {
  const { total, share, paid, tx } = settle();
  const missingRate = data.expenses.some((e) => e.currency && e.currency !== "THB" && !rateOf(e.currency));
  const planTotal = planTotalTHB();
  const n = members().length || 1;
  return (missingRate ? `<p class="warn">⚠️ มีรายการที่เป็นเงินต่างประเทศแต่ยังไม่มีเรต — ใส่เรตด้านบนก่อน ยอดจึงจะถูกต้อง</p>` : "") +
    (data.expenses.length
      ? `<p>รวมทั้งหมด <b>${money(total)}</b>${thbToTrip(total)} · หาร ${members().length} คน = คนละ <b>${money(share)}</b>${thbToTrip(share)}</p>
         <div class="table-wrap"><table><thead><tr><th>ชื่อ</th><th class="num">จ่ายไปแล้ว</th><th class="num">ส่วนต่าง</th></tr></thead>
         <tbody>${members().map((m) => { const d = paid[m] - share; return `<tr><td>${esc(m)}</td><td class="num">${money(paid[m])}</td><td class="num ${d < -0.005 ? "neg" : "pos"}">${d > 0.005 ? "+" : ""}${money(d)}</td></tr>`; }).join("")}</tbody></table></div>
         <h4>ใครต้องโอนให้ใคร</h4>
         ${tx.length ? `<ul class="transfers">${tx.map((t) => `<li><b>${esc(t.from)}</b> โอนให้ <b>${esc(t.to)}</b> ${money(t.amt)}${thbToTrip(t.amt)}</li>`).join("")}</ul>` : `<p class="muted">ไม่มีใครต้องโอน </p>`}`
      : `<p class="muted">ยังไม่มีรายการค่าใช้จ่าย</p>`) +
    (planTotal ? `<p class="muted">ประมาณการค่าใช้จ่ายตามแพลน: ${money(planTotal)} (ตกคนละ ${money(planTotal / n)})</p>` : "");
}

function rateCardHtml() {
  if (!isForeign()) {
    return `<h3>สกุลเงิน</h3><p class="muted">ทริปนี้ใช้เงินบาท — ถ้าไปต่างประเทศ เปลี่ยนสกุลเงินได้ที่ “แก้ไขข้อมูลทริป” ด้านบน</p>`;
  }
  const cur = tripCur();
  const r = num(trip.rate);
  return `<h3>อัตราแลกเปลี่ยน · ${cur} ${esc(curInfo(cur)[1])}</h3>
    <div class="rate-row">
      <span>1 ${cur} =</span>
      <input type="number" id="rate-input" min="0" step="any" inputmode="decimal" value="${r || ""}" placeholder="เช่น 0.2133">
      <span>บาท</span>
      <div class="rate-btns">
        <button type="button" class="btn small primary" data-action="save-rate">บันทึก</button>
        <button type="button" class="btn small" data-action="fetch-rate">↻ ดึงเรตล่าสุด</button>
      </div>
    </div>
    <p class="muted">${r
      ? `<span class="rate-ref ${trip.rateSource === "BOT" ? "bot" : ""}">${esc(rateRefText())}</span><br>ถ้าแลกเงินมาแล้ว ใส่เรตที่แลกจริงแทนได้`
      : "ยังไม่มีเรต — กด “ดึงเรตล่าสุด” หรือใส่เรตเอง"}</p>
    <div class="converter">
      <span>แปลงเร็ว:</span>
      <input type="number" id="conv-input" min="0" step="any" inputmode="decimal" placeholder="${cur}">
      <span id="conv-out" class="muted">= — บาท</span>
    </div>`;
}

function updateConverter() {
  const inp = $("#conv-input");
  if (!inp) return;
  const v = num(inp.value);
  $("#conv-out").textContent = v && rateOf(tripCur()) ? `= ${money(toTHB(v, tripCur()))}` : "= — บาท";
}

function updateExpensePreview() {
  const f = $("#expense-form");
  const out = $("#expense-preview");
  if (!f || !out) return;
  const cur = f.currency.value;
  const v = num(f.amount.value);
  out.textContent = cur !== "THB" && v ? (rateOf(cur) ? `≈ ${money(toTHB(v, cur))}` : "ยังไม่มีเรต") : "";
}

function renderMoney() {
  const el = $("#settle");
  if (!el) return;
  const card = $("#rate-card");
  // ถ้ากำลังพิมพ์ในการ์ดเรตอยู่ ไม่ต้องวาดใหม่ (กันตัวเลขที่พิมพ์หาย)
  if (!card.contains(document.activeElement)) { card.innerHTML = rateCardHtml(); }
  updateConverter();
  updateExpensePreview();
  el.innerHTML = settleHtml();
  const list = [...data.expenses].sort((a, b) => byCreated(b, a));
  $("#expense-list").innerHTML = list.length
    ? `<ul class="rows">${list.map((e) => `
        <li class="row">
          <div class="body"><div class="title">${esc(e.title)} · <b>${fmtWithTHB(e.amount, e.currency)}</b></div>
            <div class="meta"><span>จ่ายโดย ${esc(e.paidBy)}</span>${e.date ? `<span>${fmtDate(e.date)}</span>` : ""}</div></div>
          <div class="row-actions">${delBtn("expenses", e.id)}</div>
        </li>`).join("")}</ul>`
    : `<p class="muted">—</p>`;
}

/* ---------- ของที่ต้องเตรียม (แยกรายคน) ---------- */
const norm = (s) => String(s || "").trim().toLowerCase();

function packStats(m) {
  const list = data.packing.filter((p) => p.owner === m);
  const done = list.filter((p) => p.done).length;
  return { list: list.sort(byCreated), done, total: list.length };
}

function packStatus({ done, total }) {
  if (!total) return `<span class="muted">ยังไม่เริ่ม</span>`;
  if (done === total) return `<span class="ok-text">เตรียมครบแล้ว ✓</span>`;
  return `${done}/${total}`;
}

function renderPacking() {
  const el = $("#pack-progress");
  if (!el) return;
  const me = getMe();
  el.innerHTML = members().map((m) => {
    const st = packStats(m);
    const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
    return `<div class="progress-row"><div class="pname">${esc(m)}${m === me ? " (ฉัน)" : ""}</div>
      <div class="bar"><div style="width:${pct}%"></div></div><div class="pstat">${packStatus(st)}</div></div>`;
  }).join("");

  const mine = me ? packStats(me).list : [];
  $("#pack-mine").innerHTML = me
    ? (mine.length ? `<ul class="checks">${mine.map((p) => `
        <li><label><input type="checkbox" data-action="toggle" data-sub="packing" data-id="${esc(p.id)}" ${p.done ? "checked" : ""}><span>${esc(p.name)}</span></label>${delBtn("packing", p.id)}</li>`).join("")}</ul>`
      : `<p class="muted">ยังไม่มีรายการ — เพิ่มเอง หรือกดจากคำแนะนำด้านล่าง</p>`)
    : "";

  // คำแนะนำ: ของมาตรฐาน + ของที่เพื่อนเอาไปแต่เรายังไม่มี
  if (me) {
    const have = new Set(mine.map((p) => norm(p.name)));
    const sugg = new Map();
    SUGGESTED_PACKING.forEach((n) => { if (!have.has(norm(n))) sugg.set(norm(n), { name: n, who: [] }); });
    data.packing.filter((p) => p.owner !== me && !have.has(norm(p.name))).forEach((p) => {
      const k = norm(p.name);
      if (!sugg.has(k)) sugg.set(k, { name: p.name, who: [] });
      if (!sugg.get(k).who.includes(p.owner)) sugg.get(k).who.push(p.owner);
    });
    const arr = [...sugg.values()].sort((a, b) => b.who.length - a.who.length).slice(0, 15);
    $("#pack-sugg").innerHTML = arr.length
      ? `<h4>แนะนำให้เอาไปเพิ่ม</h4><div class="sugg">${arr.map((s) => `
          <button type="button" class="chip-btn" data-action="add-sugg" data-name="${esc(s.name)}">+ ${esc(s.name)}${s.who.length ? ` <small>· ${esc(s.who.join(", "))} เอาไป</small>` : ""}</button>`).join("")}</div>`
      : "";
  } else {
    $("#pack-sugg").innerHTML = "";
  }

  $("#pack-others").innerHTML = members().filter((m) => m !== me).map((m) => {
    const st = packStats(m);
    return `<div class="card"><h3>ของของ ${esc(m)} <small class="muted">${packStatus(st)}</small></h3>
      ${st.total ? `<ul class="checks readonly">${st.list.map((p) => `<li class="${p.done ? "done" : ""}">${p.done ? "✓" : "○"} ${esc(p.name)}</li>`).join("")}</ul>` : `<p class="muted">ยังไม่มีรายการ</p>`}</div>`;
  }).join("");
}

/* ---------- เช็กลิสต์ ---------- */
function renderChecklist() {
  const el = $("#check-list");
  if (!el) return;
  const list = [...data.checklist].sort(byCreated);
  $("#check-count").textContent = list.length ? `(${list.filter((c) => c.done).length}/${list.length})` : "";
  el.innerHTML = list.length
    ? `<ul class="checks">${list.map((c) => `
        <li><label><input type="checkbox" data-action="toggle" data-sub="checklist" data-id="${esc(c.id)}" ${c.done ? "checked" : ""}><span>${esc(c.text)}</span></label>${delBtn("checklist", c.id)}</li>`).join("")}</ul>`
    : `<p class="muted">ยังไม่มีรายการ</p>`;
}

/* ============================================================
   ฉันคือใคร?
   ============================================================ */
function updateMeChip() {
  const el = $("#me-name");
  if (el) el.textContent = getMe() || "ยังไม่ได้เลือก";
  const av = $("#me-avatar");
  if (av) av.textContent = getMe() ? [...getMe().replace(/^[เแโใไ]/, "")][0] : "?";
}

function setMe(name) {
  lsSet("me-" + trip.id, name);
  updateMeChip();
  syncMeForms();
  renderMoney();
  renderPacking();
  renderPrep();
}

function showMePicker() {
  if (!trip || document.querySelector(".me-picker")) return;
  const me = getMe();
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop me-picker";
  wrap.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="mp-title">
      <div class="m-icon" aria-hidden="true">👋</div>
      <h3 id="mp-title">ฉันคือใคร?</h3>
      <p class="muted">เลือกชื่อตัวเองในทริป “${esc(trip.name)}” เพื่อจ่ายเงิน จัดของ และติ๊กเช็กลิสต์ในชื่อของคุณ</p>
      <div class="me-options">
        ${members().map((m) => `<button type="button" class="me-option ${m === me ? "active" : ""}" data-m="${esc(m)}">${esc(m)}</button>`).join("")}
      </div>
      <button type="button" class="btn me-skip" data-skip="1">ดูอย่างเดียว ยังไม่เลือก</button>
      <p class="muted small-note">เปลี่ยนทีหลังได้ที่ปุ่ม ด้านบน · เว็บจะจำไว้ในเครื่องนี้</p>
    </div>`;
  document.body.appendChild(wrap);
  const close = () => { document.removeEventListener("keydown", onKey); wrap.remove(); };
  const onKey = (e) => { if (e.key === "Escape") { if (!getMe()) lsSet("me-skip-" + trip.id, "1"); close(); } };
  document.addEventListener("keydown", onKey);
  wrap.addEventListener("click", (e) => {
    const opt = e.target.closest("[data-m]");
    if (opt) { setMe(opt.dataset.m); close(); toast(`สวัสดี ${opt.dataset.m} 👋`); return; }
    if (e.target.closest("[data-skip]")) { lsSet("me-skip-" + trip.id, "1"); close(); }
  });
  wrap.querySelector(".me-option")?.focus();
}

/* ============================================================
   แก้ไขทริป (หน้าแยก)
   ============================================================ */
function openTripEdit(id) {
  app.innerHTML = `<p class="muted">กำลังโหลด…</p>`;
  let rendered = false;
  unsubs.push(store.listenTrip(id, (t) => {
    if (!t) { app.innerHTML = `<p>ไม่พบทริปนี้ <a href="#/">กลับหน้าแรก</a></p>`; return; }
    trip = { members: [], ...t };
    if (rendered) return;
    rendered = true;
    const back = `#/trip/${encodeURIComponent(id)}`;
    app.innerHTML = `
      <p><a href="${back}">← กลับไปที่ทริป</a></p>
      <h1>แก้ไขทริป</h1>
      ${modeBanner()}
      <form id="trip-form" class="card form">${tripFormFields(trip)}
        <div class="actions"><button class="btn primary">บันทึก</button><a class="btn" href="${back}">ยกเลิก</a></div>
      </form>
      <div class="card danger-card">
        <div class="danger-zone">
          <div><b>ลบทริปนี้</b><div class="muted">ลบแพลน การจอง ค่าใช้จ่าย และรายการของทั้งหมด กู้คืนไม่ได้</div></div>
          <button type="button" class="btn danger" data-action="delete-trip">ลบทริป</button>
        </div>
      </div>`;
  }));
}

/* ============================================================
   เตรียมตัว / ตม.
   ============================================================ */
/* ============================================================
   สถานที่แนะนำ (data/places.json) + ระยะทางจากที่พัก
   ============================================================ */
let PLACES = { places: [] };
let wishView = null; // null = เลือกให้อัตโนมัติ (ยังไม่มี Wishlist → เปิดสถานที่แนะนำ)
let sgCity = "all";
let sgCat = "all";
const SG_CATS = [
  ["all", "ทั้งหมด"], ["cafe", "☕ คาเฟ่"], ["photo", "📸 ถ่ายรูป"], ["food", "🍜 ของกิน"], ["shopping", "🛍️ ช้อปปิ้ง"],
  ["kpop", "💚 ตามรอยศิลปิน"], ["nature", "🍁 ธรรมชาติ"], ["sight", "⛩️ วัด/ที่เที่ยว"], ["theme", "🎢 สวนสนุก"],
];
const SG_TO_WISH = { cafe: "คาเฟ่", food: "ร้านอาหาร", shopping: "ช้อปปิ้ง", kpop: "ตามรอยศิลปิน", theme: "ที่เที่ยว", nature: "ที่เที่ยว", sight: "ที่เที่ยว", photo: "ที่เที่ยว" };
const geoTried = new Set();

const toRad = (d) => (d * Math.PI) / 180;
function distKm(a, b) {
  const R = 6371, dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
// ประมาณเวลาเดินทาง: ใกล้ = เดิน, ไกล = รถไฟ (รวมเวลาเดินไปสถานี/เปลี่ยนสาย)
function travelEstimate(km) {
  if (km <= 1.2) return { mode: "เดิน", icon: "🚶", min: Math.max(3, Math.round(km * 13)) };
  // ในเมือง: รถไฟใต้ดิน/รถเมล์ + เดินไปสถานี ; ข้ามเมือง: รถไฟด่วน
  const raw = km <= 15 ? 12 + km * 2.4 : Math.max(48, 25 + km * 1.1);
  return { mode: "รถไฟ/รถเมล์", icon: "🚃", min: Math.round(raw / 5) * 5 };
}

// ตำแหน่งที่พัก: จากพิกัดที่บันทึกไว้ → ลิงก์ Google Maps แบบยาว → ค้นด้วย OpenStreetMap
function coordsFromLink(s = "") {
  const m = String(s).match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || String(s).match(/[?&](?:q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  return m ? { lat: +m[1], lng: +m[2] } : null;
}
function hotelCoords(h) {
  if (h && Number.isFinite(h.lat) && Number.isFinite(h.lng) && h.lat !== null) return { lat: h.lat, lng: h.lng };
  return coordsFromLink(h?.place);
}
async function geocode(q) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, { headers: { "Accept-Language": "en" } });
    const j = await r.json();
    if (j[0]) return { lat: +j[0].lat, lng: +j[0].lon };
  } catch {}
  return null;
}
async function ensureHotelCoords(h) {
  if (!h || hotelCoords(h) || geoTried.has(h.id) || !navigator.onLine) return;
  geoTried.add(h.id);
  const country = destInfo().nameEn || trip.country || "";
  const qs = [h.address || "", h.place && !isLink(h.place) ? h.place : "", `${h.title}, ${country}`, h.title].filter(Boolean);
  for (const q of qs) {
    const c = await geocode(q);
    if (c) { store.update(trip.id, "bookings", h.id, { lat: c.lat, lng: c.lng }); return; }
  }
  renderSuggest(); // หาไม่เจอ → แสดงข้อความแนะนำ
}

// ---------- จุดเริ่มต้นสำหรับวัดระยะ (ใช้ร่วมกันทั้ง "ของเรา" และ "สถานที่แนะนำ") ----------
// เลือกได้: ที่พักในการจอง · ตำแหน่งปัจจุบัน (GPS) · พิมพ์สถานที่เอง · "วัดระยะจากที่นี่" จากการ์ด
// จำไว้ในเครื่องนี้ต่อทริป (แต่ละคนอาจอยู่คนละที่)
let originSel = null;
let originLoaded = false;
let originEditing = false;
let gpsBusy = false;
let itemGeoBusy = false;

// ใช้กิจกรรมในแพลนเป็นจุดเริ่มต้น: พิกัดจาก Wishlist ที่ลิงก์ไว้ → ลิงก์ Google Maps → พิกัดที่เคยหา → ค้นด้วย OpenStreetMap แล้วเก็บไว้
async function setItemOrigin(itemId) {
  const x = data.items.find((i) => i.id === itemId);
  if (!x) return;
  const label = `วันที่ ${tripDays().indexOf(x.date) + 1}${x.time ? " " + x.time : ""} · ${x.activity}`;
  const w = x.wishId && data.wishlist.find((v) => v.id === x.wishId);
  let c = (w && wishCoords(w)) || coordsFromLink(x.place) || (Number.isFinite(x.lat) && Number.isFinite(x.lng) ? { lat: x.lat, lng: x.lng } : null);
  if (!c) {
    if (!navigator.onLine) { toast("ออฟไลน์อยู่ — หาตำแหน่งไม่ได้"); return; }
    itemGeoBusy = true;
    renderSuggest(); renderWishlist();
    const q = x.place && !isLink(x.place) ? x.place : x.activity;
    const country = destInfo().nameEn || trip?.country || "";
    c = (await geocode(`${q}, ${country}`)) || (await geocode(q));
    itemGeoBusy = false;
    if (c) store.update(trip.id, "items", x.id, { lat: c.lat, lng: c.lng });
  }
  if (!c) {
    renderSuggest(); renderWishlist();
    toast("หาตำแหน่งของกิจกรรมนี้ไม่เจอ — แก้ช่อง “สถานที่” ในแพลนเป็นชื่อภาษาอังกฤษหรือลิงก์ Google Maps");
    return;
  }
  saveOrigin({ kind: "item", itemId: x.id, lat: c.lat, lng: c.lng, label });
  toast(`วัดระยะจาก “${x.activity}” แล้ว`);
}
const originKey = () => "origin-" + trip?.id;
function saveOrigin(o) {
  originSel = o;
  lsSet(originKey(), JSON.stringify(o));
  renderSuggest();
  renderWishlist();
}
function currentOrigin() {
  const hs = hotels();
  if (!originLoaded) {
    originLoaded = true;
    try { originSel = JSON.parse(lsGet(originKey())) || null; } catch { originSel = null; }
  }
  let o = originSel;
  if (o?.kind === "hotel" && !hs.some((h) => h.id === o.id)) o = null;
  if (o?.kind === "item" && !data.items?.some((i) => i.id === o.itemId)) o = null;
  if (!o && hs.length) o = { kind: "hotel", id: hs[0].id };
  if (!o) return { none: true, hs };
  if (o.kind === "hotel") {
    const h = hs.find((x) => x.id === o.id);
    const c = hotelCoords(h);
    if (!c) ensureHotelCoords(h);
    return { hs, sel: o, label: h.title, coords: c, query: h.address || (h.place && !isLink(h.place) ? h.place : h.title), hotel: h };
  }
  return { hs, sel: o, label: o.label, coords: { lat: o.lat, lng: o.lng }, query: `${o.lat},${o.lng}` };
}

function originPickerHtml() {
  const o = currentOrigin();
  const val = o.none ? "" : o.sel.kind === "hotel" ? "h:" + o.sel.id : o.sel.kind === "item" ? "i:" + o.sel.itemId : o.sel.kind === "gps" ? "gps" : "saved";
  // ตัวเลือกแบ่งกลุ่ม: ตำแหน่งปัจจุบัน · สถานที่ในแพลน · ที่พัก · อื่นๆ
  const days = tripDays();
  const planItems = [...data.items]
    .filter((x) => x.place || x.activity)
    .sort((a, b) => `${a.date}${a.time || "99:99"}`.localeCompare(`${b.date}${b.time || "99:99"}`));
  const groups = [
    ["📍 ตำแหน่งปัจจุบัน", [["gps", o.sel?.kind === "gps" ? `${o.label} — กดเพื่ออัปเดต` : "ใช้ตำแหน่งที่ฉันอยู่ตอนนี้ (GPS)"]]],
    ["🗓️ สถานที่ในแพลน", planItems.map((x) => [`i:${x.id}`, `วันที่ ${days.indexOf(x.date) + 1}${x.time ? " " + x.time : ""} · ${x.activity}`])],
    ["🏨 ที่พัก", o.hs.map((h) => [`h:${h.id}`, h.title])],
    ["อื่นๆ", [...(!o.none && ["custom", "place"].includes(o.sel.kind) ? [["saved", o.label]] : []), ["custom", "พิมพ์สถานที่เอง…"]]],
  ].filter(([, list]) => list.length);
  let status = "";
  if (gpsBusy) status = "กำลังหาตำแหน่งปัจจุบัน…";
  else if (itemGeoBusy) status = "กำลังหาตำแหน่งของสถานที่ในแพลน…";
  else if (o.hotel && !o.coords) status = geoTried.has(o.hotel.id) ? "⚠️ หาตำแหน่งที่พักไม่เจอ — เพิ่ม “ที่อยู่โรงแรม” ภาษาอังกฤษในการจอง หรือเลือกพิมพ์สถานที่เอง" : "กำลังหาตำแหน่งที่พัก…";
  else if (o.none) status = "เพิ่มที่พักในแท็บการจอง หรือเลือก GPS / พิมพ์สถานที่เอง เพื่อดูระยะทางและเวลาเดินทาง";
  return `<div class="origin-box">
      <label class="sg-hotel">วัดระยะจาก
        <select class="origin-pick">${o.none ? `<option value="" selected>— เลือกจุดเริ่มต้น —</option>` : ""}${groups.map(([g, list]) => `<optgroup label="${esc(g)}">${list.map(([v, l]) => `<option value="${esc(v)}" ${v === val ? "selected" : ""}>${esc(l)}</option>`).join("")}</optgroup>`).join("")}</select></label>
      ${originEditing ? `<div class="inline-form origin-form">
          <input class="origin-input" placeholder="ชื่อสถานที่ / ที่อยู่ภาษาอังกฤษ หรือวางลิงก์ Google Maps">
          <button type="button" class="btn primary" data-action="origin-set">ใช้ที่นี่</button>
          <button type="button" class="btn" data-action="origin-cancel">ยกเลิก</button>
        </div>` : ""}
      ${status ? `<p class="muted small-note">${status}</p>` : ""}
    </div>`;
}

function useGps() {
  if (!navigator.geolocation) { toast("เบราว์เซอร์นี้ใช้ GPS ไม่ได้ — พิมพ์สถานที่เองแทน"); return; }
  gpsBusy = true;
  renderSuggest(); renderWishlist();
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      gpsBusy = false;
      const t = new Date().toTimeString().slice(0, 5);
      saveOrigin({ kind: "gps", lat: pos.coords.latitude, lng: pos.coords.longitude, label: `ตำแหน่งของฉัน (${t})` });
      toast("วัดระยะจากตำแหน่งปัจจุบันแล้ว");
    },
    () => {
      gpsBusy = false;
      renderSuggest(); renderWishlist();
      toast("ใช้ตำแหน่งไม่ได้ — อนุญาตการเข้าถึงตำแหน่งในเบราว์เซอร์ หรือพิมพ์สถานที่เอง");
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
  );
}

async function setCustomOrigin(q) {
  q = (q || "").trim();
  if (!q) return;
  let c = coordsFromLink(q);
  if (!c) {
    if (!navigator.onLine) { toast("ออฟไลน์อยู่ — หาตำแหน่งไม่ได้"); return; }
    toast("กำลังหาตำแหน่ง…");
    const country = destInfo().nameEn || trip?.country || "";
    c = (await geocode(`${q}, ${country}`)) || (await geocode(q));
  }
  if (!c) { toast("หาสถานที่นี้ไม่เจอ — ลองพิมพ์เป็นภาษาอังกฤษ หรือวางลิงก์ Google Maps"); return; }
  originEditing = false;
  saveOrigin({ kind: "custom", lat: c.lat, lng: c.lng, label: isLink(q) ? "ตำแหน่งจากลิงก์" : q });
  toast(`วัดระยะจาก “${isLink(q) ? "ตำแหน่งจากลิงก์" : q}” แล้ว`);
}

// กล่อง "การเดินทาง": วิธีไป/สถานี + ระยะทางและเวลาจากจุดที่เลือก + ลิงก์เส้นทางจริง
function travelBoxHtml({ coords, query, access, pending, label }) {
  const o = currentOrigin();
  let dist = "";
  if (!o.none && o.coords && coords) {
    const km = distKm(o.coords, coords);
    if (km < 0.05) dist = `<div class="sg-dist">คุณใช้ที่นี่เป็นจุดเริ่มต้นวัดระยะอยู่</div>`;
    else {
      const est = travelEstimate(km);
      dist = `<div class="sg-dist">${est.icon} จาก ${esc(o.label)} ~${km < 1 ? Math.round(km * 1000) + " ม." : km.toFixed(1) + " กม."} · ${est.mode} ~${est.min} นาที <small>(ประมาณ)</small></div>`;
    }
  } else if (!o.none && !coords) {
    dist = `<div class="muted small-note">${pending ? "กำลังหาตำแหน่งสถานที่…" : "คำนวณระยะทางไม่ได้ — ใส่ชื่อสถานที่ภาษาอังกฤษในช่อง “สถานที่”"}</div>`;
  }
  const origin = o.none ? "" : o.coords ? `${o.coords.lat},${o.coords.lng}` : o.query;
  const hereBtn = coords && !(o.coords && distKm(o.coords, coords) < 0.05)
    ? `<button type="button" class="link-plain" data-action="origin-here" data-lat="${coords.lat}" data-lng="${coords.lng}" data-label="${esc(label || query || "")}">วัดระยะจากที่นี่แทน</button>` : "";
  const dest = coords ? `${coords.lat},${coords.lng}` : query && !isLink(query) ? query : "";
  const route = origin && dest ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&travelmode=transit` : "";
  if (!access && !dist && !route && !hereBtn) return "";
  return `<div class="travel-box">
      <div class="tb-title">🚉 การเดินทาง</div>
      ${access ? `<div>${esc(access)}</div>` : ""}
      ${dist}
      <div class="tb-links">${route ? `<a href="${esc(route)}" target="_blank" rel="noopener">ดูเส้นทาง/เวลาจริงใน Google Maps</a>` : ""}${hereBtn}</div>
    </div>`;
}
const timeHtml = (t) => (t ? `<span class="time-need">⏱ เวลาเที่ยวที่นี่ ~${esc(t)} <small>(ไม่รวมเดินทาง)</small></span>` : "");

// ตำแหน่งของรายการใน Wishlist: พิกัดที่บันทึกไว้ → ลิงก์ Google Maps แบบยาว → ค้นด้วย OpenStreetMap (ทีละรายการ ไม่เกิน 1 ครั้ง/วินาที)
const wishCoords = (w) => (Number.isFinite(w?.lat) && Number.isFinite(w?.lng) ? { lat: w.lat, lng: w.lng } : coordsFromLink(w?.place));
const geoQueue = [];
let geoBusy = false;
function queueWishGeocode(w) {
  if (!w || wishCoords(w) || geoTried.has(w.id) || !navigator.onLine || isLink(w.place)) return;
  geoTried.add(w.id);
  geoQueue.push(w);
  runGeoQueue();
}
async function runGeoQueue() {
  if (geoBusy) return;
  geoBusy = true;
  while (geoQueue.length) {
    const w = geoQueue.shift();
    const country = destInfo().nameEn || trip?.country || "";
    const q = w.place || w.name;
    const c = (await geocode(`${q}, ${country}`)) || (await geocode(q));
    if (c && trip) store.update(trip.id, "wishlist", w.id, { lat: c.lat, lng: c.lng });
    else renderWishlist();
    await new Promise((r) => setTimeout(r, 1100));
  }
  geoBusy = false;
}

function addSuggestToWishlist(id) {
  const p = (PLACES.places || []).find((x) => x.id === id);
  if (!p || data.wishlist.some((w) => w.suggestId === id)) return;
  const cat = p.cats.find((c) => SG_TO_WISH[c]) || "photo";
  const src = p.sources?.[0];
  store.add(trip.id, "wishlist", {
    name: p.name, category: SG_TO_WISH[cat] || "อื่นๆ", place: p.nameEn, link: src?.url || "",
    note: p.season?.label || "", timeNeeded: p.time || "", access: p.access || "", lat: p.lat, lng: p.lng,
    plannedDate: "", planLinked: true, priority: 2, source: `สถานที่แนะนำ · ${src?.publisher || ""}`, suggestId: id, createdAt: Date.now(),
  });
  toast(`เพิ่ม “${p.name}” ใน Wishlist แล้ว`);
}

function renderSuggest() {
  const box = $("#suggest-view");
  if (!box) return;
  const nMine = data.wishlist.length;
  if (!wishView) wishView = nMine ? "mine" : "suggest";
  $("#seg-mine").innerHTML = `⭐ ของเรา${nMine ? ` <span class="seg-n">${nMine}</span>` : ""}`;
  $("#seg-mine").classList.toggle("active", wishView === "mine");
  $("#seg-suggest").classList.toggle("active", wishView === "suggest");
  $("#wish-mine").hidden = wishView !== "mine";
  box.hidden = wishView !== "suggest";
  if (wishView !== "suggest") return;

  const code = destOf();
  const all = (PLACES.places || []).filter((p) => p.country === code);
  if (!all.length) {
    box.innerHTML = `<div class="card empty">ยังไม่มีสถานที่แนะนำสำหรับ${esc(destInfo().name || "ประเทศนี้")}<br><small>ขอ Claude ให้ค้นและเพิ่มสถานที่ของประเทศนี้ได้</small></div>`;
    return;
  }
  const cities = [...new Set(all.map((p) => p.city.split(" (")[0]))];
  if (sgCity !== "all" && !cities.includes(sgCity)) sgCity = "all";

  // ที่พักที่ใช้วัดระยะ
  const hc = currentOrigin().coords;

  let list = all.filter((p) => (sgCity === "all" || p.city.startsWith(sgCity)) && (sgCat === "all" || p.cats.includes(sgCat)));
  list = list.map((p) => ({ ...p, km: hc ? distKm(hc, p) : null }));
  if (hc) list.sort((a, b) => a.km - b.km);
  const tripMonths = new Set(tripDays().map((d) => +d.slice(5, 7)));
  const catLabel = Object.fromEntries(SG_CATS);

  const hotelBar = originPickerHtml();

  box.innerHTML = `
    <div class="card sg-filters">
      <div class="chip-row">${["all", ...cities].map((c) => `<button type="button" class="fchip ${sgCity === c ? "active" : ""}" data-action="sg-city" data-v="${esc(c)}">${c === "all" ? "ทุกเมือง" : esc(c)}</button>`).join("")}</div>
      <div class="chip-row">${SG_CATS.map(([k, l]) => `<button type="button" class="fchip ${sgCat === k ? "active" : ""}" data-action="sg-cat" data-v="${k}">${l}</button>`).join("")}</div>
      ${hotelBar}
    </div>
    ${list.length ? list.map((p) => {
      const added = data.wishlist.find((w) => w.suggestId === p.id);
      const inSeason = p.season && p.season.months.some((m) => tripMonths.has(m));
      return `
      <article class="card sg-card">
        <div class="sg-top">
          <div>
            <h3>${esc(p.name)}</h3>
            <div class="muted">${esc(p.nameEn)} · ${esc(p.city)}</div>
          </div>
          ${added
            ? `<span class="sg-added">${wishPlanDates(added).length ? `✓ อยู่ในแพลน ${fmtDate(wishPlanDates(added)[0])}` : "✓ เพิ่มแล้ว · ยังไม่ใส่แพลน"}</span>`
            : `<button type="button" class="btn small primary" data-action="sg-add" data-id="${esc(p.id)}">+ Wishlist</button>`}
        </div>
        <div class="sg-tags">${p.cats.map((c) => `<span class="badge">${catLabel[c] || c}</span>`).join("")}${p.season ? `<span class="badge ${inSeason ? "ok" : ""}">${esc(p.season.label)}${inSeason ? " · ตรงช่วงทริป" : ""}</span>` : ""}</div>
        <p>${esc(p.desc)}</p>
        ${p.kpop ? `<p class="sg-kpop">💚 ${esc(p.kpop)}</p>` : ""}
        <div class="sg-meta">${timeHtml(p.time)}<a href="${esc(mapUrl(p.nameEn))}" target="_blank" rel="noopener">📍 แผนที่</a></div>
        ${travelBoxHtml({ coords: { lat: p.lat, lng: p.lng }, query: p.nameEn, access: p.access, label: p.name })}
        <div class="sg-src">อ้างอิง: ${p.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a> — ${esc(s.publisher)}${s.author ? ` (เขียนโดย ${esc(s.author)})` : ""}`).join("<br>")}</div>
      </article>`;
    }).join("") : `<p class="empty">ไม่มีสถานที่ตรงกับตัวกรอง</p>`}
    <p class="muted small-note">คัดโดย Claude จากแหล่งข้อมูลที่ระบุ · อัปเดต ${fmtDate(PLACES.updated, "year")} · ระยะทางและเวลาเป็นค่าประมาณ กด “ดูเส้นทาง/เวลาจริง” เพื่อดูใน Google Maps · ตรวจเวลาเปิดปิดก่อนไป</p>`;
}

let IMMI = { countries: {}, default: null };
const FALLBACK_DEST = { name: "ประเทศอื่น", risk: "unknown", riskReason: "ยังไม่มีข้อมูลเฉพาะประเทศ", entry: [], beforeFlight: [], upcoming: [], docs: [{ key: "passport", text: "พาสปอร์ต (อายุเหลือ ≥ 6 เดือน)" }], tips: [], sources: [] };
const RISK = { low: ["ต่ำ", "low"], medium: ["ปานกลาง", "mid"], high: ["สูง", "high"], unknown: ["ยังไม่มีข้อมูล", "unk"] };

function guessDest(country = "") {
  const c = String(country).toLowerCase();
  for (const [code, info] of Object.entries(IMMI.countries || {})) {
    if ((info.match || []).some((m) => c.includes(String(m).toLowerCase()))) return code;
  }
  return "OTHER";
}
const destOf = (t = trip) => (t?.destCode && t.destCode !== "" ? t.destCode : guessDest(t?.country));
const destInfo = (t = trip) => IMMI.countries?.[destOf(t)] || IMMI.default || FALLBACK_DEST;

function destOptions(t = {}) {
  const cur = t.destCode || guessDest(t.country);
  const opts = Object.entries(IMMI.countries || {}).map(([code, i]) => [code, i.name]);
  opts.push(["OTHER", "ประเทศอื่น / ยังไม่มีข้อมูล"]);
  return opts.map(([c, n]) => `<option value="${c}" ${c === cur ? "selected" : ""}>${esc(n)}</option>`).join("");
}

const prepItems = () => {
  const i = destInfo();
  return [
    ...(i.beforeFlight || []).map((x) => ({ ...x, group: "ต้องทำก่อนบิน" })),
    ...(i.docs || []).map((x) => ({ ...x, group: "เอกสารที่ต้องพก" })),
  ];
};
const prepDone = (owner, key) => data.prep.some((p) => p.owner === owner && p.key === key && p.done);

function togglePrep(key, done) {
  const me = getMe();
  if (!me) return;
  const ex = data.prep.find((p) => p.owner === me && p.key === key);
  if (ex) store.update(trip.id, "prep", ex.id, { done });
  else store.add(trip.id, "prep", { owner: me, key, done, createdAt: Date.now() });
}

const flights = () => data.bookings.filter((b) => b.type === "เที่ยวบิน");

function readinessChecks() {
  const days = tripDays();
  const info = destInfo();
  const missing = tripNights().filter((d) => !hotelForNight(d).length);
  const out = flights().some((b) => b.date === trip.startDate);
  const ret = flights().some((b) => b.date === trip.endDate);
  const checks = [
    [out, "ตั๋วเครื่องบินขาไป", out ? "มีในการจองแล้ว" : `ยังไม่มีการจองประเภทเที่ยวบินวันที่ ${fmtDate(trip.startDate)}`],
    [ret, "ตั๋วเครื่องบินขากลับ", ret ? "มีในการจองแล้ว" : `ยังไม่มีการจองประเภทเที่ยวบินวันที่ ${fmtDate(trip.endDate)} — ตม. มักขอดูตั๋วขากลับ`],
    [!missing.length, "ที่พักครบทุกคืน", missing.length ? `ยังขาด ${missing.length} คืน: ${missing.map((d) => fmtDate(d)).join(", ")}` : `ครบ ${tripNights().length} คืน`],
  ];
  if (info.maxStayDays) {
    const ok = days.length <= info.maxStayDays;
    checks.push([ok, `อยู่ไม่เกินที่ได้รับอนุญาต (${info.maxStayDays} วัน)`, `ทริปนี้ ${days.length} วัน${ok ? "" : " — เกินเงื่อนไขฟรีวีซ่า ต้องขอวีซ่า"}`]);
  }
  return checks;
}

function renderPrep() {
  const el = $("#prep-info");
  if (!el) return;
  const info = destInfo();
  const [riskLabel, riskCls] = RISK[info.risk] || RISK.unknown;
  const list = (arr) => (arr?.length ? `<ul class="immi-list">${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");
  el.innerHTML = `
    <div class="card immi-card">
      <div class="immi-head">
        <div>
          <h3>🛂 เตรียมผ่าน ตม. · ${esc(info.name)}</h3>
          <div class="muted">สำหรับพาสปอร์ตไทย · ท่องเที่ยวระยะสั้น${IMMI.updated ? ` · อัปเดต ${fmtDate(IMMI.updated, "year")}` : ""}</div>
        </div>
        <span class="risk risk-${riskCls}">ความเสี่ยง: ${riskLabel}</span>
      </div>
      <p>${esc(info.riskReason || "")}</p>
      <p class="muted small-note">* ระดับความเสี่ยงประเมินจากข่าวและแหล่งข้อมูลด้านล่าง ไม่ใช่สถิติทางการ${destOf() === "OTHER" ? " · เลือกประเทศได้ที่ “แก้ไขทริป” หรือขอ Claude เพิ่มข้อมูลประเทศนี้" : ""}</p>
      ${info.entry?.length ? `<h4>เงื่อนไขการเข้าประเทศ</h4>${list(info.entry)}` : ""}
      ${info.beforeFlight?.length ? `<h4>ต้องทำก่อนบิน</h4><ul class="immi-list">${info.beforeFlight.map((b) => `
        <li>${esc(b.text)}${b.when ? ` <span class="badge">${esc(b.when)}</span>` : ""}${b.link ? `<br><a href="${esc(b.link)}" target="_blank" rel="noopener">${esc(b.link.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</a>` : ""}</li>`).join("")}</ul>` : ""}
      ${info.upcoming?.length ? `<h4>กำลังจะเปลี่ยน</h4>${list(info.upcoming)}` : ""}
      ${info.tips?.length ? `<h4>เคล็ดลับตอนเจอ ตม.</h4>${list(info.tips)}` : ""}
      ${info.sources?.length ? `<details class="sources"><summary>แหล่งข้อมูล (${info.sources.length})</summary><ul>${info.sources.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a></li>`).join("")}</ul></details>` : ""}
    </div>`;

  // ความพร้อมของทริป (เช็กอัตโนมัติจากข้อมูลในเว็บ)
  $("#prep-ready").innerHTML = `
    <ul class="ready-list">${readinessChecks().map(([ok, title, detail]) => `
      <li class="${ok ? "ok" : "no"}"><span class="r-icon">${ok ? "✓" : "!"}</span><div><b>${esc(title)}</b><div class="muted">${esc(detail)}</div></div></li>`).join("")}</ul>
    <div class="ready-actions">
      <button type="button" class="btn primary" data-action="immi-pdf">🖨️ เอกสารโชว์ ตม. (PDF ภาษาอังกฤษ)</button>
      <button type="button" class="btn" data-action="tab" data-tab="bookings">ไปที่การจอง</button>
    </div>
    <p class="muted small-note">เอกสารรวมตั๋วเครื่องบิน ที่พักทุกคืน และแพลนรายวัน เป็นภาษาอังกฤษ ปริ้นต์หรือเก็บในมือถือไว้ยื่นเวลา ตม. ถาม</p>`;

  // เช็กลิสต์ของฉัน
  const me = getMe();
  const items = prepItems();
  if (!me) {
    $("#prep-mine").innerHTML = `<p class="muted">เลือกก่อนว่าคุณคือใคร เพื่อติ๊กเช็กลิสต์ของตัวเอง</p><button type="button" class="btn" data-action="pick-me">เลือกชื่อ</button>`;
    $("#prep-count").textContent = "";
  } else {
    const groups = [...new Set(items.map((x) => x.group))];
    $("#prep-mine").innerHTML = groups.map((g) => `
      <h4>${esc(g)}</h4>
      <ul class="checks">${items.filter((x) => x.group === g).map((x) => `
        <li><label><input type="checkbox" data-action="prep-toggle" data-key="${esc(x.key)}" ${prepDone(me, x.key) ? "checked" : ""}><span>${esc(x.text)}</span></label></li>`).join("")}</ul>`).join("");
    $("#prep-count").textContent = `(${items.filter((x) => prepDone(me, x.key)).length}/${items.length})`;
  }
  $("#prep-progress").innerHTML = members().map((m) => {
    const done = items.filter((x) => prepDone(m, x.key)).length;
    const pct = items.length ? Math.round((done / items.length) * 100) : 0;
    const st = !done ? `<span class="muted">ยังไม่เริ่ม</span>` : done === items.length ? `<span class="ok-text">พร้อมแล้ว ✓</span>` : `${done}/${items.length}`;
    return `<div class="progress-row"><div class="pname">${esc(m)}${m === me ? " (ฉัน)" : ""}</div><div class="bar"><div style="width:${pct}%"></div></div><div class="pstat">${st}</div></div>`;
  }).join("");
}

/* เอกสารโชว์ ตม. (ภาษาอังกฤษ) */
const enDate = (iso, wd = true) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-GB", wd ? { weekday: "short", day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short", year: "numeric" }) : "");

function buildImmiPrintView() {
  const t = trip;
  const days = tripDays();
  const table = (head, rows) => `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
  const fl = flights().sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const hs = hotels();
  const others = data.bookings.filter((b) => b.type !== "เที่ยวบิน" && !isHotel(b));
  $("#print-view").innerHTML = `
    <h1>Travel Itinerary</h1>
    <table class="kv"><tbody>
      <tr><th>Purpose of visit</th><td>Tourism</td></tr>
      <tr><th>Destination</th><td>${esc(destInfo().nameEn || t.country || "")}</td></tr>
      <tr><th>Travel period</th><td>${enDate(t.startDate)} – ${enDate(t.endDate)} (${days.length} days, ${tripNights().length} nights)</td></tr>
      <tr><th>Travelers</th><td>${members().map(esc).join(", ")} (${members().length} persons)</td></tr>
    </tbody></table>
    <h2>Flights</h2>
    ${fl.length ? table(["Date", "Flight / Route", "Time", "Booking ref."], fl.map((b) => `<tr><td>${enDate(b.date)}</td><td>${esc(b.title)}</td><td>${esc(b.time || "")}</td><td>${esc(b.ref || "")}</td></tr>`)) : "<p>—</p>"}
    <h2>Accommodation</h2>
    ${hs.length ? table(["Hotel", "Address", "Check-in", "Check-out", "Nights", "Booking ref."], hs.map((h) => `<tr><td>${esc(h.title)}</td><td>${esc(h.address || (isLink(h.place) ? "" : h.place || ""))}</td><td>${enDate(h.date, false)} ${esc(h.time || "")}</td><td>${enDate(h.checkOutDate, false)} ${esc(h.checkOutTime || "")}</td><td>${nightsOf(h)}</td><td>${esc(h.ref || "")}</td></tr>`)) : "<p>—</p>"}
    ${others.length ? `<h2>Other reservations</h2>${table(["Date", "Details", "Booking ref."], others.map((b) => `<tr><td>${enDate(b.date)}</td><td>${esc(b.title)}</td><td>${esc(b.ref || "")}</td></tr>`))}` : ""}
    <h2>Daily plan</h2>
    ${table(["Day", "Date", "Stay", "Plan"], days.map((d, i) => {
      const acts = sortItems(data.items.filter((x) => x.date === d)).map((x) => `${x.time ? esc(x.time) + " " : ""}${esc(x.activity)}`);
      const stay = hotelForNight(d).map((h) => esc(h.title)).join(", ");
      return `<tr><td>${i + 1}</td><td>${enDate(d)}</td><td>${stay || (i === days.length - 1 ? "Return home" : "")}</td><td>${acts.join("<br>") || "Sightseeing"}</td></tr>`;
    }))}
    <p class="p-foot">Prepared for immigration inspection · ${enDate(todayISO(), false)}</p>`;
}

/* ---------- Export PDF ---------- */
function buildPrintView() {
  const t = trip;
  const days = tripDays();
  const table = (head, rows) => `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
  const { total, share, tx } = settle();
  $("#print-view").innerHTML = `
    <h1>${esc(t.name)}</h1>
    <p>${esc(t.country)} · ${fmtDate(t.startDate, "year")} – ${fmtDate(t.endDate, "year")} · ผู้ร่วมทริป: ${members().map(esc).join(", ")}</p>
    <h2>แพลนรายวัน</h2>
    ${days.map((d, i) => {
      const list = sortItems(data.items.filter((x) => x.date === d));
      const ph = [
        ...hotels().filter((h) => h.checkOutDate === d).map((h) => `เช็คเอาท์ ${esc(h.title)} ${esc(h.checkOutTime || "")}`),
        ...hotelForNight(d).map((h) => (h.date === d ? `เช็คอิน ${esc(h.title)} ${esc(h.time || "")}` : `พักที่ ${esc(h.title)}`)),
      ];
      return `<div class="p-day"><h3>วันที่ ${i + 1} · ${fmtDate(d, "long")}</h3>${ph.length ? `<p class="p-hotel">${ph.join(" · ")}</p>` : ""}${list.length
        ? table(["เวลา", "กิจกรรม", "สถานที่", "เวลาเปิด–ปิด", "การเดินทางมาที่นี่", "ค่าใช้จ่าย", "หมายเหตุ"],
            list.map((x) => {
              const legs = legsOf(x);
              const travel = legs.length
                ? legs.map((l) => esc(legText(l))).join("<br>→ ") + (legsMinutes(x) ? `<br><b>รวม ${fmtDur(legsMinutes(x))}</b>` : "")
                : esc(x.transport);
              const bk = x.bookingId && data.bookings.find((b) => b.id === x.bookingId);
              const warns = hoursWarnings(x);
              return `<tr><td>${esc(x.time) || "-"}${num(x.stay) ? `<br><small>${fmtDur(num(x.stay))}</small>` : ""}</td>
                <td>${esc(x.activity)}${warns.length ? `<br><b>⚠️ ${warns.map(esc).join(", ")}</b>` : ""}${bk ? `<br>${esc(bk.title)}${bk.ref ? ` (${esc(bk.ref)})` : ""}` : ""}</td>
                <td>${isLink(x.place) ? "ลิงก์ Google Maps" : esc(x.place)}</td><td>${esc(hoursText(x))}</td><td>${travel}</td>
                <td>${num(x.cost) ? fmtWithTHB(x.cost, x.costCurrency) : ""}</td><td>${esc(x.note)}</td></tr>`;
            }))
        : "<p>—</p>"}</div>`;
    }).join("")}
    <h2>การจอง</h2>
    ${data.bookings.length ? table(["ประเภท", "รายละเอียด", "วันที่/เวลา", "เลขการจอง", "สถานที่", "หมายเหตุ"],
      [...data.bookings].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
        .map((b) => `<tr><td>${esc(b.type)}</td><td>${esc(b.title)}</td><td>${isHotel(b) ? `เช็คอิน ${fmtDate(b.date)} ${esc(b.time)}<br>เช็คเอาท์ ${fmtDate(b.checkOutDate)} ${esc(b.checkOutTime)} (${nightsOf(b)} คืน)` : `${fmtDate(b.date)} ${esc(b.time)}`}</td><td>${esc(b.ref)}</td><td>${esc(b.place)}</td><td>${esc(b.note)}</td></tr>`)) : "<p>—</p>"}
    <h2>งบและค่าใช้จ่าย</h2>
    ${isForeign() && rateOf(tripCur()) ? `<p>อัตราแลกเปลี่ยน: 1 ${tripCur()} = ${num(trip.rate).toFixed(4)} บาท — ${esc(rateRefText())}</p>` : ""}
    ${data.expenses.length ? table(["รายการ", "จำนวน", "จ่ายโดย", "วันที่"],
      [...data.expenses].sort(byCreated).map((e) => `<tr><td>${esc(e.title)}</td><td>${fmtWithTHB(e.amount, e.currency)}</td><td>${esc(e.paidBy)}</td><td>${e.date ? fmtDate(e.date) : ""}</td></tr>`)) : ""}
    ${settleHtml()}
    <h2>Wishlist</h2>
    ${data.wishlist.length ? `<ul>${[...data.wishlist].sort((a, b) => num(b.priority || 2) - num(a.priority || 2)).map((w) => { const ds = wishPlanDates(w); return `<li>${"★".repeat(num(w.priority) || 2)} [${esc(w.category)}] ${esc(w.name)}${w.mustTry ? " · ต้องลอง: " + esc(w.mustTry) : ""}${num(w.budget) ? " · ~" + fmtCur(w.budget, w.budgetCurrency) : ""} — ${ds.length ? "อยู่ในแพลน " + ds.map((d) => fmtDate(d)).join(", ") : "ยังไม่ใส่แพลน"}</li>`; }).join("")}</ul>` : "<p>—</p>"}
    <h2>ของที่ต้องเตรียม</h2>
    ${members().map((m) => { const st = packStats(m); return `<h3>${esc(m)} (${st.done}/${st.total})</h3>${st.total ? `<ul>${st.list.map((p) => `<li>${p.done ? "☑" : "☐"} ${esc(p.name)}</li>`).join("")}</ul>` : "<p>—</p>"}`; }).join("")}
    <h2>เช็กลิสต์ก่อนเดินทาง</h2>
    <ul>${[...data.checklist].sort(byCreated).map((c) => `<li>${c.done ? "☑" : "☐"} ${esc(c.text)}</li>`).join("")}</ul>`;
}

function flash(el) {
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("flash");
  void el.offsetWidth; // รีสตาร์ตแอนิเมชัน
  el.classList.add("flash");
}

// หน้าพิมพ์แยก: เปิดหน้าใหม่ที่มีแค่เนื้อหา PDF (ไม่มีแอปทั้งตัว ไม่มีฟอนต์เว็บ ไม่มีอีโมจิ) → มือถือสร้าง PDF ได้เร็วกว่ามาก
const PRINT_CSS = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, "Sukhumvit Set", Thonburi, "Leelawadee UI", "Noto Sans Thai", Tahoma, sans-serif; color: #222; font-size: 11pt; line-height: 1.45; background: #fff; }
  main { padding: 16px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 18pt; margin: 0 0 6px; }
  h2 { font-size: 13.5pt; border-bottom: 2px solid #C5B3D3; padding-bottom: 2px; margin: 18px 0 8px; }
  h3 { font-size: 11.5pt; margin: 10px 0 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 6px; }
  th, td { text-align: left; vertical-align: top; padding: 4px 6px; border: 1px solid #ccc; }
  th { background: #FBEFEF; }
  tr, h3 { break-inside: avoid; page-break-inside: avoid; }
  table.kv th { width: 28%; }
  ul { padding-left: 20px; margin: 4px 0; }
  .num { text-align: right; white-space: nowrap; }
  .muted { color: #777; }
  .p-hotel { margin: 2px 0 6px; font-size: 10pt; }
  .p-foot { margin-top: 18px; font-size: 9pt; color: #777; }
  .bar { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #ddd; padding: 10px 16px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: 10.5pt; }
  .bar button { font: inherit; font-weight: 700; background: #C5B3D3; color: #2E2340; border: 0; border-radius: 10px; padding: 10px 16px; }
  @media print { .bar { display: none; } main { padding: 0; } }
`;

function stripEmoji(html) {
  return html.replace(/☑/g, "✓").replace(/☐/g, "○")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, (ch) => (ch === "✓" || ch === "★" ? ch : ""));
}

function exportPdf(mode) {
  if (mode === "immi") buildImmiPrintView(); else buildPrintView();
  const title = mode === "immi" ? `Travel-Itinerary-${trip.name}` : `แพลน-${trip.name}`;
  const body = stripEmoji($("#print-view").innerHTML);
  const w = window.open("", "_blank");
  if (!w) {
    // บล็อกหน้าต่างใหม่ → พิมพ์ในหน้าเดิมแทน
    const old = document.title;
    document.title = title;
    window.print();
    setTimeout(() => (document.title = old), 1000);
    return;
  }
  w.document.open();
  w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${PRINT_CSS}</style></head>
    <body><div class="bar"><button type="button" onclick="window.print()">พิมพ์ / บันทึกเป็น PDF</button>
    <span class="muted">ถ้าหน้าต่างพิมพ์ไม่ขึ้นเอง กดปุ่มนี้ แล้วเลือก “บันทึกเป็น PDF” (iPhone: แชร์ → บันทึกไปยังไฟล์)</span></div>
    <main>${body}</main>
    <script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 250); });<\/script></body></html>`);
  w.document.close();
}

/* ============================================================
   จัดการปุ่ม / ฟอร์ม (ผูกครั้งเดียวที่ app)
   ============================================================ */
function onClick(e) {
  const b = e.target.closest("[data-action]");
  if (!b || b.tagName === "INPUT") return;
  const { action, id, sub } = b.dataset;
  if (action === "import") importSample();
  else if (action === "tab") setTab(b.dataset.tab, true);
  else if (action === "day") {
    dayIdx = +b.dataset.i;
    renderPlan();
    if (!editingItemId) $("#item-form [name=date]").value = tripDays()[dayIdx];
  }
  else if (action === "edit-item") startEdit(id);
  else if (action === "cancel-edit") stopEdit();
  else if (action === "add-leg") {
    $("#legs").insertAdjacentHTML("beforeend", legRowHtml());
    $("#legs .leg:last-child input").focus();
  }
  else if (action === "del-leg") b.closest(".leg").remove();
  else if (action === "goto-booking") {
    setTab("bookings");
    flash(document.getElementById("booking-" + id));
  }
  else if (action === "goto-item") {
    const it = data.items.find((i) => i.id === id);
    const di = it ? tripDays().indexOf(it.date) : -1;
    if (di >= 0) dayIdx = di;
    setTab("plan");
    renderPlan();
    flash(document.getElementById("item-" + id));
  }
  else if (action === "del") confirmDelete(sub, id);
  else if (action === "edit-booking") startEditBooking(id);
  else if (action === "cancel-book-edit") stopEditBooking();
  else if (action === "to-plan") wishToPlan(id);
  else if (action === "plan-open") { planOpenId = id; renderWishlist(); }
  else if (action === "plan-cancel") { planOpenId = null; renderWishlist(); }
  else if (action === "wish-new") openWishForm(null);
  else if (action === "wish-edit") { openWishForm(data.wishlist.find((w) => w.id === id)); }
  else if (action === "wish-cancel") closeWishForm();
  else if (action === "wish-filter") { wishFilter = b.dataset.v; renderWishlist(); }
  else if (action === "wish-cat") { wishCatFilter = b.dataset.v; renderWishlist(); }
  else if (action === "add-sugg") {
    store.add(trip.id, "packing", { owner: getMe(), name: b.dataset.name, done: false, createdAt: Date.now() });
  }
  else if (action === "save-rate") {
    const v = num($("#rate-input").value);
    if (!v) { toast("ใส่เรตเป็นตัวเลขก่อน"); return; }
    document.activeElement?.blur();
    store.updateTrip(trip.id, { rate: v, rateDate: todayISO(), rateUpdated: todayISO(), rateSource: "manual" });
    toast("บันทึกเรตแล้ว");
  }
  else if (action === "fetch-rate") {
    document.activeElement?.blur();
    updateRate(trip.id, tripCur());
  }
  else if (action === "pdf") exportPdf();
  else if (action === "immi-pdf") exportPdf("immi");
  else if (action === "pick-me") showMePicker();
  else if (action === "wish-view") { wishView = b.dataset.v; renderSuggest(); }
  else if (action === "sg-city") { sgCity = b.dataset.v; renderSuggest(); }
  else if (action === "sg-cat") { sgCat = b.dataset.v; renderSuggest(); }
  else if (action === "sg-add") addSuggestToWishlist(id);
  else if (action === "origin-set") setCustomOrigin(b.closest(".origin-box").querySelector(".origin-input").value);
  else if (action === "origin-cancel") { originEditing = false; renderSuggest(); renderWishlist(); }
  else if (action === "origin-here") {
    saveOrigin({ kind: "place", lat: +b.dataset.lat, lng: +b.dataset.lng, label: b.dataset.label || "สถานที่ที่เลือก" });
    toast(`วัดระยะจาก “${b.dataset.label}” แล้ว`);
    scrollTo({ top: 0, behavior: "smooth" });
  }
  else if (action === "delete-trip") deleteTrip();
}

/* ---------- Pop-up ยืนยัน ---------- */
function confirmDialog({ title, message, okText = "ลบ", requireText = "" }) {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement;
    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop";
    wrap.innerHTML = `
      <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="m-title" aria-describedby="m-msg">
        <div class="m-icon" aria-hidden="true">🗑️</div>
        <h3 id="m-title">${esc(title)}</h3>
        <p id="m-msg">${message}</p>
        ${requireText ? `<label class="m-req">พิมพ์ <b>${esc(requireText)}</b> เพื่อยืนยัน<input id="m-input" autocomplete="off"></label>` : ""}
        <div class="m-actions">
          <button type="button" class="btn" data-m="cancel">ยกเลิก</button>
          <button type="button" class="btn danger-solid" data-m="ok" ${requireText ? "disabled" : ""}>${esc(okText)}</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const ok = wrap.querySelector("[data-m=ok]");
    const inp = wrap.querySelector("#m-input");
    const close = (v) => {
      document.removeEventListener("keydown", onKey);
      wrap.remove();
      prevFocus?.focus?.();
      resolve(v);
    };
    const onKey = (e) => {
      if (e.key === "Escape") close(false);
      else if (e.key === "Enter" && !ok.disabled) { e.preventDefault(); close(true); }
    };
    document.addEventListener("keydown", onKey);
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) return close(false);
      const m = e.target.closest("[data-m]")?.dataset.m;
      if (m === "cancel") close(false);
      else if (m === "ok" && !ok.disabled) close(true);
    });
    if (inp) {
      inp.addEventListener("input", () => (ok.disabled = inp.value.trim() !== requireText));
      inp.focus();
    } else wrap.querySelector("[data-m=cancel]").focus();
  });
}

const SUB_LABEL = { items: "แพลน", wishlist: "Wishlist", bookings: "การจอง", expenses: "ค่าใช้จ่าย", packing: "ของที่ต้องเตรียม", checklist: "เช็กลิสต์" };

async function confirmDelete(sub, id) {
  const x = (data[sub] || []).find((r) => r.id === id);
  if (!x) return;
  const name = x.activity || x.name || x.title || x.text || "รายการนี้";
  let extra = "";
  if (sub === "expenses") extra = ` (${fmtWithTHB(x.amount, x.currency)} จ่ายโดย ${esc(x.paidBy)})`;
  if (sub === "bookings") {
    const n = data.items.filter((i) => i.bookingId === id).length;
    if (n) extra = `<br><small>มีกิจกรรมในแพลน ${n} รายการที่ลิงก์อยู่ — ลิงก์จะหายไป แต่กิจกรรมยังอยู่</small>`;
  }
  const yes = await confirmDialog({
    title: `ลบจาก${SUB_LABEL[sub] || ""}?`,
    message: `จะลบ <b>“${esc(name)}”</b>${extra}<br>ทุกคนในทริปจะไม่เห็นรายการนี้อีก`,
  });
  if (!yes) return;
  store.remove(trip.id, sub, id);
  if (id === editingItemId) stopEdit();
  if (id === editingBookingId) stopEditBooking();
  if (id === editingWishId) closeWishForm();
  toast("ลบแล้ว");
}

async function deleteTrip() {
  const name = trip.name;
  const yes = await confirmDialog({
    title: "ลบทั้งทริป?",
    message: `แพลน การจอง ค่าใช้จ่าย และรายการของทั้งหมดของ <b>“${esc(name)}”</b> จะหายถาวร ทุกคนจะไม่เห็นอีก และกู้คืนไม่ได้`,
    okText: "ลบทริป",
    requireText: name,
  });
  if (!yes) return;
  const id = trip.id;
  location.hash = "#/";
  await store.deleteTrip(id);
  toast(`ลบทริป “${name}” แล้ว`);
}

function onChange(e) {
  const el = e.target;
  if (el.classList.contains("origin-pick")) {
    const v = el.value;
    if (v.startsWith("h:")) { originEditing = false; saveOrigin({ kind: "hotel", id: v.slice(2) }); }
    else if (v.startsWith("i:")) { originEditing = false; setItemOrigin(v.slice(2)); }
    else if (v === "gps") { originEditing = false; useGps(); }
    else if (v === "custom") {
      originEditing = true;
      renderSuggest(); renderWishlist();
      const vis = [...document.querySelectorAll(".origin-input")].find((i) => i.offsetParent);
      vis?.focus();
    }
  } else if (el.dataset.action === "prep-toggle") {
    togglePrep(el.dataset.key, el.checked);
  } else if (el.dataset.action === "toggle") {
    store.update(trip.id, el.dataset.sub, el.dataset.id, { done: el.checked });
  } else if (el.closest("#book-form")) {
    syncBookForm();
  }
}

function onInput(e) {
  const el = e.target;
  if (el.id === "conv-input") updateConverter();
  else if (el.closest("#expense-form")) updateExpensePreview();
}

function onSubmit(e) {
  const form = e.target;
  e.preventDefault();
  const f = formData(form);
  const now = Date.now();
  switch (form.id) {
    case "create-form": {
      const t = readTripForm(form);
      if (!t) return;
      const id = store.createTrip({
        name: t.name, country: t.country, startDate: t.startDate, endDate: t.endDate,
        members: t.members, currency: t.currency, destCode: t.destCode, createdAt: now,
      });
      if (t.useChecklist) DEFAULT_CHECKLIST.forEach((text, i) => store.add(id, "checklist", { text, done: false, createdAt: now + i }));
      if (t.currency !== "THB") updateRate(id, t.currency, true);
      location.hash = "#/trip/" + id;
      return;
    }
    case "trip-form": {
      const t = readTripForm(form);
      if (!t) return;
      delete t.useChecklist;
      const curChanged = t.currency !== tripCur();
      if (curChanged) Object.assign(t, { rate: 0, rateDate: "", rateUpdated: "", rateSource: "" });
      store.updateTrip(trip.id, t);
      if (curChanged) updateRate(trip.id, t.currency, true);
      toast("บันทึกข้อมูลทริปแล้ว");
      location.hash = "#/trip/" + encodeURIComponent(trip.id);
      return;
    }
    case "item-form": {
      const legs = readLegs();
      const rec = {
        date: f.date, time: f.time, activity: f.activity.trim(), place: f.place.trim(),
        stay: num(f.stay), cost: num(f.cost), costCurrency: f.costCurrency || "THB", note: f.note.trim(),
        openTime: f.openTime, closeTime: f.closeTime, hoursNote: f.hoursNote.trim(),
        closedDays: new FormData(form).getAll("closed").map(Number),
        legs, transport: "", bookingId: f.bookingId || "",
      };
      if (!rec.activity) return;
      if (editingItemId) {
        const old = data.items.find((i) => i.id === editingItemId);
        if (old && (old.place || "") !== rec.place) { rec.lat = null; rec.lng = null; }
        store.update(trip.id, "items", editingItemId, rec);
        stopEdit();
      }
      else { store.add(trip.id, "items", { ...rec, createdAt: now }); form.reset(); setLegs([]); form.date.value = rec.date; }
      const i = tripDays().indexOf(rec.date);
      if (i >= 0) { dayIdx = i; renderPlan(); }
      toast("บันทึกแล้ว");
      return;
    }
    case "wish-form": {
      const rec = {
        name: f.name.trim(), category: f.category, place: f.place.trim(), link: f.link.trim(), note: f.note.trim(),
        priority: num(f.priority) || 2, source: f.source.trim(), budget: num(f.budget), budgetCurrency: f.budgetCurrency || "THB",
        mustTry: f.mustTry.trim(), timeNeeded: f.timeNeeded.trim(), access: f.access.trim(),
      };
      if (!rec.name) return;
      const old = editingWishId && data.wishlist.find((w) => w.id === editingWishId);
      if (old && (old.place || "") !== rec.place) { rec.lat = null; rec.lng = null; geoTried.delete(old.id); } // เปลี่ยนสถานที่ → หาพิกัดใหม่
      if (editingWishId) store.update(trip.id, "wishlist", editingWishId, rec);
      else store.add(trip.id, "wishlist", { ...rec, plannedDate: "", planLinked: true, createdAt: now });
      wishFilter = "all";
      closeWishForm();
      toast(editingWishId ? "บันทึกแล้ว" : `เพิ่ม “${rec.name}” แล้ว — ยังไม่ได้ใส่ในแพลน`);
      return;
    }
    case "book-form": {
      const hotel = f.type === "ที่พัก";
      if (hotel && (!f.checkInDate || !f.checkOutDate || f.checkOutDate <= f.checkInDate)) { toast("ใส่วันเช็คอิน–เช็คเอาท์ให้ถูกต้อง"); return; }
      const rec = {
        type: f.type, title: f.title.trim(), ref: f.ref.trim(), place: f.place.trim(), note: f.note.trim(),
        date: hotel ? f.checkInDate : f.date,
        time: hotel ? f.checkInTime : f.time,
        checkOutDate: hotel ? f.checkOutDate : "",
        checkOutTime: hotel ? f.checkOutTime : "",
        address: hotel ? (f.address || "").trim() : "",
        lat: null, lng: null, // ให้หาพิกัดใหม่เมื่อแก้ชื่อ/ที่อยู่
      };
      if (!rec.title) return;
      if (editingBookingId) { geoTried.delete(editingBookingId); store.update(trip.id, "bookings", editingBookingId, rec); stopEditBooking(); }
      else { store.add(trip.id, "bookings", { ...rec, createdAt: now }); form.reset(); syncBookForm(); }
      toast("บันทึกแล้ว");
      return;
    }
    case "expense-form":
      store.add(trip.id, "expenses", { title: f.title.trim(), amount: num(f.amount), currency: f.currency || "THB", paidBy: f.paidBy, date: f.date, createdAt: now });
      form.reset();
      syncMeForms();
      updateExpensePreview();
      toast("บันทึกแล้ว");
      return;
    case "pack-form":
      if (!getMe() || !f.name.trim()) return;
      store.add(trip.id, "packing", { owner: getMe(), name: f.name.trim(), done: false, createdAt: now });
      break;
    case "check-form":
      store.add(trip.id, "checklist", { text: f.text.trim(), done: false, createdAt: now });
      break;
    default:
      return;
  }
  form.reset();
  toast("บันทึกแล้ว");
}

/* ============================================================
   เริ่มทำงาน
   ============================================================ */
function updateNet() { document.getElementById("net-badge").hidden = navigator.onLine; }

async function init() {
  try {
    store = isConfigured(FIREBASE_CONFIG) ? await firebaseStore(FIREBASE_CONFIG) : localStore();
  } catch (e) {
    console.error(e);
    toast("เชื่อม Firebase ไม่ได้ — ใช้โหมดทดลองแทน");
    store = localStore();
  }
  try { IMMI = await (await fetch("data/immigration.json", { cache: "no-cache" })).json(); } catch { /* ใช้ค่าสำรอง */ }
  try { PLACES = await (await fetch("data/places.json", { cache: "no-cache" })).json(); } catch { /* ไม่มีข้อมูลแนะนำ */ }
  app.addEventListener("click", onClick);
  app.addEventListener("change", onChange);
  app.addEventListener("input", onInput);
  app.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList?.contains("origin-input")) { e.preventDefault(); setCustomOrigin(e.target.value); }
  });
  app.addEventListener("submit", onSubmit);
  window.addEventListener("hashchange", route);
  window.addEventListener("online", updateNet);
  window.addEventListener("offline", updateNet);
  updateNet();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
  route();
}

init();
