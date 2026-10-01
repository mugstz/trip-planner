import { FIREBASE_CONFIG } from "./firebase-config.js";

/* ============================================================
   ค่าตั้งต้น
   ============================================================ */
const SDK = "https://www.gstatic.com/firebasejs/10.12.2";
const SUBS = ["items", "wishlist", "bookings", "expenses", "packing", "checklist"];
const TABS = [
  ["plan", "แพลน"], ["wishlist", "Wishlist"], ["bookings", "การจอง"],
  ["money", "ค่าใช้จ่าย"], ["packing", "ของที่ต้องเตรียม"], ["checklist", "เช็กลิสต์"],
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
    setBudget: (id, member, amount) =>
      fs.updateDoc(fs.doc(db, "trips", id), new fs.FieldPath("budgets", member), amount).catch(onErr),
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
    setBudget(id, member, amount) { (db.trips[id].budgets ||= {})[member] = amount; emit(); },
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
let skeletonSig = "";
let firstTripLoad = true;

const tripDays = () => daysBetween(trip?.startDate, trip?.endDate);
const members = () => trip?.members || [];
const getMe = () => { const m = lsGet("me-" + trip?.id); return members().includes(m) ? m : ""; };
const byCreated = (a, b) => num(a.createdAt) - num(b.createdAt);
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
}

function route() {
  cleanup();
  const h = location.hash;
  if (h === "#/new") renderCreate();
  else if (h.startsWith("#/trip/")) openTrip(decodeURIComponent(h.slice(7)));
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
      members: t.members, budgets: {}, createdAt: Date.now(),
    });
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
      <label class="wide">ผู้ร่วมทริป* <small class="muted">(คั่นด้วยจุลภาค หรือขึ้นบรรทัดใหม่)</small>
        <textarea name="members" rows="3" required placeholder="เอิง, มิว, พาย, เบ้น">${esc((t.members || []).join(", "))}</textarea></label>
    </div>`;
}

function readTripForm(form) {
  const f = formData(form);
  const memberList = [...new Set(f.members.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))];
  if (!f.name.trim() || !f.startDate || !f.endDate || !memberList.length) { toast("กรอกช่องที่มี * ให้ครบ"); return null; }
  if (f.endDate < f.startDate) { toast("วันกลับต้องไม่ก่อนวันไป"); return null; }
  return { name: f.name.trim(), country: f.country.trim(), startDate: f.startDate, endDate: f.endDate, members: memberList, useChecklist: f.useChecklist };
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
    trip = { budgets: {}, members: [], ...t };
    if (firstTripLoad) {
      firstTripLoad = false;
      const today = new Date().toISOString().slice(0, 10);
      const i = tripDays().indexOf(today);
      if (i >= 0) dayIdx = i;
    }
    const sig = JSON.stringify([t.name, t.country, t.startDate, t.endDate, t.members]);
    if (sig !== skeletonSig) { skeletonSig = sig; renderTripSkeleton(); }
    renderAll();
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
        <label class="me">ฉันคือ
          <select id="me-select"><option value="">— เลือกชื่อ —</option>${memberOpts}</select>
        </label>
        <button class="btn" type="button" data-action="pdf">⬇︎ Export PDF</button>
      </div>
    </div>

    <details class="card edit-trip">
      <summary>แก้ไขข้อมูลทริป</summary>
      <form id="trip-form" class="form">${tripFormFields(t)}
        <div class="actions"><button class="btn primary">บันทึก</button></div>
      </form>
      <div class="danger-zone">
        <div><b>ลบทริปนี้</b><div class="muted">ลบแพลน การจอง ค่าใช้จ่าย และรายการของทั้งหมด กู้คืนไม่ได้</div></div>
        <button type="button" class="btn danger" data-action="delete-trip">ลบทริป</button>
      </div>
    </details>

    <nav class="tabs main-tabs">
      ${TABS.map(([k, label]) => `<button type="button" data-action="tab" data-tab="${k}">${label}</button>`).join("")}
    </nav>

    <section data-panel="plan">
      <div class="tabs" id="day-tabs"></div>
      <div id="plan-list"></div>
      <form id="item-form" class="card form">
        <h3 id="item-form-title">เพิ่มกิจกรรม</h3>
        <div class="grid">
          <label>วันที่<select name="date">${dayOpts}</select></label>
          <label>เวลา<input type="time" name="time"></label>
          <label class="wide">กิจกรรม*<input name="activity" required placeholder="เช่น ปราสาทโอซาก้า"></label>
          <label class="wide">สถานที่ (พิมพ์ชื่อ หรือวางลิงก์ Google Maps)<input name="place" placeholder="เช่น Osaka Castle"></label>
          <label>การเดินทาง<input name="transport" placeholder="เช่น JR Loop Line"></label>
          <label>ค่าใช้จ่าย (บาท)<input type="number" name="cost" min="0" step="any" inputmode="decimal"></label>
          <label class="wide">หมายเหตุ<input name="note"></label>
        </div>
        <div class="actions">
          <button class="btn primary" id="item-submit">เพิ่ม</button>
          <button class="btn" type="button" data-action="cancel-edit" id="item-cancel" hidden>ยกเลิก</button>
        </div>
      </form>
    </section>

    <section data-panel="wishlist">
      <div id="wish-list"></div>
      <form id="wish-form" class="card form">
        <h3>เพิ่มที่อยากไป</h3>
        <div class="grid">
          <label class="wide">ชื่อ*<input name="name" required placeholder="เช่น ร้านคาเฟ่ที่ศิลปินเคยมา"></label>
          <label>หมวด<select name="category">${WISH_CATS.map((c) => `<option>${c}</option>`).join("")}</select></label>
          <label>สถานที่ (พิมพ์ชื่อ หรือวางลิงก์ Google Maps)<input name="place"></label>
          <label class="wide">ลิงก์ (IG / รีวิว)<input type="url" name="link" placeholder="https://"></label>
          <label class="wide">หมายเหตุ<input name="note"></label>
        </div>
        <div class="actions"><button class="btn primary">เพิ่ม</button></div>
      </form>
    </section>

    <section data-panel="bookings">
      <div id="book-list"></div>
      <form id="book-form" class="card form">
        <h3>เพิ่มการจอง</h3>
        <div class="grid">
          <label>ประเภท<select name="type">${BOOK_TYPES.map((c) => `<option>${c}</option>`).join("")}</select></label>
          <label>วันที่<input type="date" name="date" value="${esc(t.startDate)}"></label>
          <label class="wide">รายละเอียด*<input name="title" required placeholder="เช่น Thai AirAsia FD xxx DMK→KIX"></label>
          <label>เวลา<input type="time" name="time"></label>
          <label>เลขการจอง<input name="ref"></label>
          <label class="wide">สถานที่ (พิมพ์ชื่อ หรือวางลิงก์ Google Maps)<input name="place"></label>
          <label class="wide">หมายเหตุ<input name="note"></label>
        </div>
        <div class="actions"><button class="btn primary">เพิ่ม</button></div>
      </form>
    </section>

    <section data-panel="money">
      <div class="card"><h3>งบของแต่ละคน</h3><div id="budget-list"></div></div>
      <div class="card"><h3>สรุปหารค่าใช้จ่าย <small class="muted">(หารเท่ากันทุกคน)</small></h3><div id="settle"></div></div>
      <div class="card"><h3>รายการที่จ่ายไปแล้ว</h3><div id="expense-list"></div></div>
      <form id="expense-form" class="card form">
        <h3>เพิ่มค่าใช้จ่าย</h3>
        <div class="grid">
          <label class="wide">รายการ*<input name="title" required placeholder="เช่น ค่าอาหารเย็น"></label>
          <label>จำนวนเงิน (บาท)*<input type="number" name="amount" min="0" step="any" required inputmode="decimal"></label>
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
        <p id="pack-need-me" class="muted">เลือก “ฉันคือ” ด้านบนก่อน เพื่อจัดรายการของตัวเอง</p>
        <div id="pack-mine"></div>
        <form id="pack-form" class="inline-form">
          <input name="name" required placeholder="เพิ่มของ เช่น เสื้อกันหนาว">
          <button class="btn primary">เพิ่ม</button>
        </form>
        <div id="pack-sugg"></div>
      </div>
      <div id="pack-others"></div>
    </section>

    <section data-panel="checklist">
      <div class="card">
        <h3>เช็กลิสต์ก่อนเดินทาง <small class="muted" id="check-count"></small></h3>
        <div id="check-list"></div>
        <form id="check-form" class="inline-form">
          <input name="text" required placeholder="เพิ่มรายการ">
          <button class="btn primary">เพิ่ม</button>
        </form>
      </div>
    </section>
  </div>
  <div id="print-view" class="print-only"></div>`;

  $("#me-select").value = getMe();
  const d = days[dayIdx];
  if (d) $("#item-form [name=date]").value = d;
  syncMeForms();
  setTab(tab);
}

function setTab(name) {
  tab = name;
  app.querySelectorAll(".main-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  app.querySelectorAll("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== name));
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

function renderAll() { renderPlan(); renderWishlist(); renderBookings(); renderMoney(); renderPacking(); renderChecklist(); }

function renderSection(s) {
  ({
    items: () => { renderPlan(); renderMoney(); },
    wishlist: renderWishlist,
    bookings: renderBookings,
    expenses: renderMoney,
    packing: renderPacking,
    checklist: renderChecklist,
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
    return `<button type="button" class="${i === dayIdx ? "active" : ""}" data-action="day" data-i="${i}">วันที่ ${i + 1} · ${fmtDate(d)}${c ? ` (${c})` : ""}</button>`;
  }).join("");
  const d = days[dayIdx];
  const list = sortItems(data.items.filter((x) => x.date === d));
  const total = list.reduce((s, x) => s + num(x.cost), 0);
  el.innerHTML = `<h3 class="day-title">${fmtDate(d, "long")}</h3>` + (list.length
    ? `<ul class="rows">${list.map((x) => `
        <li class="row">
          <div class="time">${esc(x.time) || "—"}</div>
          <div class="body">
            <div class="title">${esc(x.activity)}</div>
            <div class="meta">${mapLink(x.place)}${x.transport ? `<span>🚃 ${esc(x.transport)}</span>` : ""}${num(x.cost) ? `<span>💰 ${money(x.cost)}</span>` : ""}</div>
            ${x.note ? `<div class="note">${esc(x.note)}</div>` : ""}
          </div>
          <div class="row-actions">
            <button type="button" class="icon" data-action="edit-item" data-id="${esc(x.id)}" title="แก้ไข">✎</button>${delBtn("items", x.id)}
          </div>
        </li>`).join("")}</ul><p class="total">รวมวันนี้ ${money(total)}</p>`
    : `<p class="empty">ยังไม่มีแพลนวันนี้ — เพิ่มด้านล่าง หรือดึงจากแท็บ Wishlist</p>`);
}

function startEdit(id) {
  const x = data.items.find((i) => i.id === id);
  if (!x) return;
  editingItemId = id;
  const f = $("#item-form");
  ["date", "time", "activity", "place", "transport", "cost", "note"].forEach((k) => (f[k].value = x[k] ?? ""));
  $("#item-form-title").textContent = "แก้ไขกิจกรรม";
  $("#item-submit").textContent = "บันทึก";
  $("#item-cancel").hidden = false;
  f.scrollIntoView({ behavior: "smooth", block: "center" });
}

function stopEdit() {
  editingItemId = null;
  const f = $("#item-form");
  f.reset();
  f.date.value = tripDays()[dayIdx] || "";
  $("#item-form-title").textContent = "เพิ่มกิจกรรม";
  $("#item-submit").textContent = "เพิ่ม";
  $("#item-cancel").hidden = true;
}

/* ---------- Wishlist ---------- */
function renderWishlist() {
  const el = $("#wish-list");
  if (!el) return;
  const days = tripDays();
  const dayOpts = days.map((d, i) => `<option value="${d}">วันที่ ${i + 1} · ${fmtDate(d)}</option>`).join("");
  const catOf = (w) => (WISH_CATS.includes(w.category) ? w.category : "อื่นๆ");
  const groups = WISH_CATS.map((c) => [c, data.wishlist.filter((w) => catOf(w) === c).sort(byCreated)]).filter((g) => g[1].length);
  el.innerHTML = groups.length
    ? groups.map(([c, list]) => `
        <div class="card"><h3>${c} <small class="muted">(${list.length})</small></h3>
          <ul class="rows">${list.map((w) => `
            <li class="row">
              <div class="body">
                <div class="title">${esc(w.name)} ${w.plannedDate ? `<span class="badge ok">อยู่ในแพลน · ${fmtDate(w.plannedDate)}</span>` : ""}</div>
                <div class="meta">${mapLink(w.place || w.name)}${w.link ? `<a href="${esc(w.link)}" target="_blank" rel="noopener">🔗 ลิงก์</a>` : ""}</div>
                ${w.note ? `<div class="note">${esc(w.note)}</div>` : ""}
                <div class="to-plan">
                  <select data-role="wish-date" data-id="${esc(w.id)}">${dayOpts}</select>
                  <button type="button" class="btn small" data-action="to-plan" data-id="${esc(w.id)}">ใส่ลงแพลน</button>
                </div>
              </div>
              <div class="row-actions">${delBtn("wishlist", w.id)}</div>
            </li>`).join("")}</ul>
        </div>`).join("")
    : `<p class="empty">ยังไม่มีที่อยากไป — เพิ่มคาเฟ่ ร้านอาหาร หรือที่ตามรอยศิลปินไว้ก่อน แล้วค่อยใส่ลงแพลน</p>`;
}

function wishToPlan(id) {
  const w = data.wishlist.find((x) => x.id === id);
  const sel = app.querySelector(`[data-role=wish-date][data-id="${CSS.escape(id)}"]`);
  if (!w || !sel) return;
  store.add(trip.id, "items", {
    date: sel.value, time: "", activity: w.name, place: w.place || w.name,
    transport: "", cost: 0, note: w.note || "", createdAt: Date.now(),
  });
  store.update(trip.id, "wishlist", id, { plannedDate: sel.value });
  toast(`ใส่ “${w.name}” ลงแพลน ${fmtDate(sel.value)} แล้ว`);
}

/* ---------- การจอง ---------- */
function renderBookings() {
  const el = $("#book-list");
  if (!el) return;
  const list = [...data.bookings].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  el.innerHTML = list.length
    ? `<div class="card"><ul class="rows">${list.map((b) => `
        <li class="row">
          <div class="body">
            <div class="title"><span class="badge">${esc(b.type)}</span> ${esc(b.title)}</div>
            <div class="meta"><span>📅 ${fmtDate(b.date, "weekday")}${b.time ? " · " + esc(b.time) : ""}</span>${mapLink(b.place)}</div>
            ${b.ref ? `<div class="ref">เลขการจอง: <b>${esc(b.ref)}</b></div>` : ""}
            ${b.note ? `<div class="note">${esc(b.note)}</div>` : ""}
          </div>
          <div class="row-actions">${delBtn("bookings", b.id)}</div>
        </li>`).join("")}</ul></div>`
    : `<p class="empty">ยังไม่มีข้อมูลการจอง</p>`;
}

/* ---------- ค่าใช้จ่าย + หารเงิน ---------- */
function settle() {
  const ms = members();
  const total = data.expenses.reduce((s, e) => s + num(e.amount), 0);
  const share = ms.length ? total / ms.length : 0;
  const paid = Object.fromEntries(ms.map((m) => [m, 0]));
  data.expenses.forEach((e) => { if (e.paidBy in paid) paid[e.paidBy] += num(e.amount); });
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

function budgetTable(editable) {
  const me = getMe();
  const { share } = settle();
  const planTotal = data.items.reduce((s, x) => s + num(x.cost), 0);
  const perPlan = members().length ? planTotal / members().length : 0;
  return `
    <div class="table-wrap"><table>
      <thead><tr><th>ชื่อ</th><th class="num">งบ</th><th class="num">ใช้ไป (ส่วนของตัวเอง)</th><th class="num">คงเหลือ</th></tr></thead>
      <tbody>${members().map((m) => {
        const b = num(trip.budgets?.[m]);
        const cell = editable && m === me
          ? `<div class="budget-edit"><input type="number" min="0" step="any" inputmode="decimal" id="my-budget" value="${b || ""}" placeholder="กรอกงบ"><button type="button" class="btn small primary" data-action="save-budget">บันทึก</button></div>`
          : b ? money(b) : `<span class="muted">ยังไม่กรอก</span>`;
        const left = b - share;
        return `<tr><td>${esc(m)}${editable && m === me ? " (ฉัน)" : ""}</td><td class="num">${cell}</td><td class="num">${money(share)}</td>
          <td class="num ${b && left < 0 ? "neg" : ""}">${b ? money(left) : "—"}</td></tr>`;
      }).join("")}</tbody>
    </table></div>
    <p class="muted">ประมาณการตามแพลน: ${money(planTotal)} (ตกคนละ ${money(perPlan)})</p>`;
}

function renderMoney() {
  const el = $("#budget-list");
  if (!el) return;
  // ถ้ากำลังพิมพ์งบอยู่ ไม่ต้องวาดตารางงบใหม่ (กันตัวเลขที่พิมพ์หาย)
  if (!el.contains(document.activeElement)) {
    el.innerHTML = budgetTable(true) + (getMe() ? "" : `<p class="muted">เลือก “ฉันคือ” ด้านบน เพื่อกรอกงบของตัวเอง</p>`);
  }
  const { total, share, paid, tx } = settle();
  $("#settle").innerHTML = data.expenses.length
    ? `<p>รวมทั้งหมด <b>${money(total)}</b> · หาร ${members().length} คน = คนละ <b>${money(share)}</b></p>
       <div class="table-wrap"><table><thead><tr><th>ชื่อ</th><th class="num">จ่ายไปแล้ว</th><th class="num">ส่วนต่าง</th></tr></thead>
       <tbody>${members().map((m) => { const d = paid[m] - share; return `<tr><td>${esc(m)}</td><td class="num">${money(paid[m])}</td><td class="num ${d < -0.005 ? "neg" : "pos"}">${d > 0.005 ? "+" : ""}${money(d)}</td></tr>`; }).join("")}</tbody></table></div>
       <h4>ใครต้องโอนให้ใคร</h4>
       ${tx.length ? `<ul class="transfers">${tx.map((t) => `<li><b>${esc(t.from)}</b> โอนให้ <b>${esc(t.to)}</b> ${money(t.amt)}</li>`).join("")}</ul>` : `<p class="muted">ไม่มีใครต้องโอน 🎉</p>`}`
    : `<p class="muted">ยังไม่มีรายการค่าใช้จ่าย</p>`;
  const list = [...data.expenses].sort((a, b) => byCreated(b, a));
  $("#expense-list").innerHTML = list.length
    ? `<ul class="rows">${list.map((e) => `
        <li class="row">
          <div class="body"><div class="title">${esc(e.title)} · <b>${money(e.amount)}</b></div>
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
      return `<div class="p-day"><h3>วันที่ ${i + 1} · ${fmtDate(d, "long")}</h3>${list.length
        ? table(["เวลา", "กิจกรรม", "สถานที่", "การเดินทาง", "ค่าใช้จ่าย", "หมายเหตุ"],
            list.map((x) => `<tr><td>${esc(x.time) || "-"}</td><td>${esc(x.activity)}</td><td>${esc(x.place)}</td><td>${esc(x.transport)}</td><td>${num(x.cost) ? money(x.cost) : ""}</td><td>${esc(x.note)}</td></tr>`))
        : "<p>—</p>"}</div>`;
    }).join("")}
    <h2>การจอง</h2>
    ${data.bookings.length ? table(["ประเภท", "รายละเอียด", "วันที่/เวลา", "เลขการจอง", "สถานที่", "หมายเหตุ"],
      [...data.bookings].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
        .map((b) => `<tr><td>${esc(b.type)}</td><td>${esc(b.title)}</td><td>${fmtDate(b.date)} ${esc(b.time)}</td><td>${esc(b.ref)}</td><td>${esc(b.place)}</td><td>${esc(b.note)}</td></tr>`)) : "<p>—</p>"}
    <h2>งบและค่าใช้จ่าย</h2>
    ${budgetTable(false)}
    <p>จ่ายไปแล้วรวม ${money(total)} · คนละ ${money(share)}</p>
    ${tx.length ? `<ul>${tx.map((x) => `<li>${esc(x.from)} โอนให้ ${esc(x.to)} ${money(x.amt)}</li>`).join("")}</ul>` : ""}
    <h2>Wishlist</h2>
    ${data.wishlist.length ? `<ul>${[...data.wishlist].sort(byCreated).map((w) => `<li>[${esc(w.category)}] ${esc(w.name)}${w.place ? " — " + esc(w.place) : ""}${w.note ? " · " + esc(w.note) : ""}</li>`).join("")}</ul>` : "<p>—</p>"}
    <h2>ของที่ต้องเตรียม</h2>
    ${members().map((m) => { const st = packStats(m); return `<h3>${esc(m)} (${st.done}/${st.total})</h3>${st.total ? `<ul>${st.list.map((p) => `<li>${p.done ? "☑" : "☐"} ${esc(p.name)}</li>`).join("")}</ul>` : "<p>—</p>"}`; }).join("")}
    <h2>เช็กลิสต์ก่อนเดินทาง</h2>
    <ul>${[...data.checklist].sort(byCreated).map((c) => `<li>${c.done ? "☑" : "☐"} ${esc(c.text)}</li>`).join("")}</ul>`;
}

function exportPdf() {
  buildPrintView();
  const old = document.title;
  document.title = `แพลน-${trip.name}`;
  window.print();
  setTimeout(() => (document.title = old), 1000);
}

/* ============================================================
   จัดการปุ่ม / ฟอร์ม (ผูกครั้งเดียวที่ app)
   ============================================================ */
function onClick(e) {
  const b = e.target.closest("[data-action]");
  if (!b || b.tagName === "INPUT") return;
  const { action, id, sub } = b.dataset;
  if (action === "import") importSample();
  else if (action === "tab") setTab(b.dataset.tab);
  else if (action === "day") {
    dayIdx = +b.dataset.i;
    renderPlan();
    if (!editingItemId) $("#item-form [name=date]").value = tripDays()[dayIdx];
  }
  else if (action === "edit-item") startEdit(id);
  else if (action === "cancel-edit") stopEdit();
  else if (action === "del") {
    if (confirm("ลบรายการนี้?")) { store.remove(trip.id, sub, id); if (id === editingItemId) stopEdit(); }
  }
  else if (action === "to-plan") wishToPlan(id);
  else if (action === "add-sugg") {
    store.add(trip.id, "packing", { owner: getMe(), name: b.dataset.name, done: false, createdAt: Date.now() });
  }
  else if (action === "save-budget") {
    const v = num($("#my-budget").value);
    store.setBudget(trip.id, getMe(), v);
    document.activeElement?.blur();
    toast("บันทึกงบแล้ว");
  }
  else if (action === "pdf") exportPdf();
  else if (action === "delete-trip") deleteTrip();
}

async function deleteTrip() {
  const name = trip.name;
  const typed = prompt(`พิมพ์ชื่อทริป “${name}” เพื่อยืนยันการลบ\n(ข้อมูลทั้งหมดของทริปนี้จะหายถาวร ทุกคนจะไม่เห็นอีก)`);
  if (typed === null) return;
  if (typed.trim() !== name) { toast("ชื่อไม่ตรง — ยังไม่ได้ลบ"); return; }
  const id = trip.id;
  location.hash = "#/";
  await store.deleteTrip(id);
  toast(`ลบทริป “${name}” แล้ว`);
}

function onChange(e) {
  const el = e.target;
  if (el.id === "me-select") {
    lsSet("me-" + trip.id, el.value);
    syncMeForms();
    renderMoney();
    renderPacking();
  } else if (el.dataset.action === "toggle") {
    store.update(trip.id, el.dataset.sub, el.dataset.id, { done: el.checked });
  }
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
        members: t.members, budgets: {}, createdAt: now,
      });
      if (t.useChecklist) DEFAULT_CHECKLIST.forEach((text, i) => store.add(id, "checklist", { text, done: false, createdAt: now + i }));
      location.hash = "#/trip/" + id;
      return;
    }
    case "trip-form": {
      const t = readTripForm(form);
      if (!t) return;
      delete t.useChecklist;
      store.updateTrip(trip.id, t);
      toast("บันทึกข้อมูลทริปแล้ว");
      return;
    }
    case "item-form": {
      const rec = {
        date: f.date, time: f.time, activity: f.activity.trim(), place: f.place.trim(),
        transport: f.transport.trim(), cost: num(f.cost), note: f.note.trim(),
      };
      if (!rec.activity) return;
      if (editingItemId) { store.update(trip.id, "items", editingItemId, rec); stopEdit(); }
      else { store.add(trip.id, "items", { ...rec, createdAt: now }); form.reset(); form.date.value = rec.date; }
      const i = tripDays().indexOf(rec.date);
      if (i >= 0) { dayIdx = i; renderPlan(); }
      toast("บันทึกแล้ว");
      return;
    }
    case "wish-form":
      store.add(trip.id, "wishlist", { name: f.name.trim(), category: f.category, place: f.place.trim(), link: f.link.trim(), note: f.note.trim(), plannedDate: "", createdAt: now });
      break;
    case "book-form":
      store.add(trip.id, "bookings", { type: f.type, title: f.title.trim(), date: f.date, time: f.time, ref: f.ref.trim(), place: f.place.trim(), note: f.note.trim(), createdAt: now });
      break;
    case "expense-form":
      store.add(trip.id, "expenses", { title: f.title.trim(), amount: num(f.amount), paidBy: f.paidBy, date: f.date, createdAt: now });
      form.reset();
      syncMeForms();
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
  app.addEventListener("click", onClick);
  app.addEventListener("change", onChange);
  app.addEventListener("submit", onSubmit);
  window.addEventListener("hashchange", route);
  window.addEventListener("online", updateNet);
  window.addEventListener("offline", updateNet);
  updateNet();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
  route();
}

init();
