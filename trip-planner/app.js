import { FIREBASE_CONFIG } from "./firebase-config.js";

/* ============================================================
   ค่าตั้งต้น
   ============================================================ */
const SDK = "https://www.gstatic.com/firebasejs/10.12.2";
const SUBS = ["items", "wishlist", "bookings", "expenses", "packing", "checklist", "prep", "shopping"];
// [key, ชื่อเต็ม, ไอคอน, ชื่อสั้น (แถบล่างในมือถือ)]
const TABS = [
  ["plan", "แพลน", "🗓️", "แพลน"], ["wishlist", "Wishlist", "⭐", "Wishlist"], ["bookings", "การจอง", "🎫", "การจอง"],
  ["money", "ค่าใช้จ่าย", "💰", "ค่าใช้จ่าย"], ["packing", "ของเตรียม / ช้อป", "🎒", "ของ/ช้อป"], ["prep", "เตรียมตัว / ตม.", "🛂", "เตรียมตัว"],
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
let toastUndoFn = null;
function toast(msg, undo = null) {
  const el = document.getElementById("toast");
  toastUndoFn = undo;
  el.classList.toggle("has-undo", !!undo);
  if (undo) {
    el.innerHTML = "";
    const s = document.createElement("span");
    s.textContent = msg;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "toast-undo";
    b.textContent = "เลิกทำ";
    b.onclick = () => { const f = toastUndoFn; toastUndoFn = null; el.hidden = true; f?.(); };
    el.append(s, b);
  } else el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; toastUndoFn = null; }, undo ? 5000 : 2500);
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
  const au = await import(`${SDK}/firebase-auth.js`);
  const fbApp = initializeApp(cfg);
  const auth = au.getAuth(fbApp);
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
    toast(e.code === "permission-denied" ? "ไม่มีสิทธิ์เข้าถึง — บัญชีนี้อาจยังไม่ได้รับอนุญาต (เช็ก Rules ใน Firebase)" : "บันทึกไม่สำเร็จ: " + (e.code || e.message));
  };
  const list = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const sub = (t, s) => fs.collection(db, "trips", t, s);
  return {
    mode: "firebase",
    // ---------- ล็อกอิน (บัญชีที่เจ้าของเว็บสร้างให้ใน Firebase Console เท่านั้น) ----------
    onAuth: (cb) => au.onAuthStateChanged(auth, cb),
    signIn: (email, pw) => au.signInWithEmailAndPassword(auth, email, pw),
    resetPassword: (email) => au.sendPasswordResetEmail(auth, email),
    async signOut() {
      await au.signOut(auth);
      // ล้างข้อมูลที่เก็บไว้ในเครื่อง กันคนที่ใช้เครื่องต่อเห็นข้อมูล
      try { await fs.terminate(db); await fs.clearIndexedDbPersistence(db); } catch {}
    },
    uid: () => auth.currentUser?.uid || "",
    // users/{uid}: ข้อมูลของบัญชี เช่น ในแต่ละทริปเป็นใคร
    listenUser: (cb, err) => fs.onSnapshot(fs.doc(db, "users", auth.currentUser.uid), (d) => cb(d.exists() ? d.data() : {}), (e) => { console.error(e); err?.(e); }),
    setUser: (patch) => fs.setDoc(fs.doc(db, "users", auth.currentUser.uid), patch, { merge: true }).catch(onErr),
    // trips/{id}/private/{uid}: ข้อมูลส่วนตัว (เตรียมผ่าน ตม.) — Rules ให้อ่าน/เขียนได้เฉพาะเจ้าของบัญชี
    listenPrivate: (t, cb) => fs.onSnapshot(fs.doc(db, "trips", t, "private", auth.currentUser.uid), (d) => cb(d.exists() ? d.data() : {}), onErr),
    setPrivate: (t, patch) => fs.setDoc(fs.doc(db, "trips", t, "private", auth.currentUser.uid), patch, { merge: true }).catch(onErr),
    // ทริปของฉัน: Rules ใหม่ให้อ่านได้เฉพาะทริปที่มีอีเมลเรา → ใช้ query ตามอีเมล ; ถ้ายังเป็น Rules เก่า (อ่านได้ทุกทริป) ก็ดึงทั้งหมดได้
    listenTrips(cb) {
      const email = (auth.currentUser?.email || "").toLowerCase();
      let un = null;
      const byMember = () => fs.onSnapshot(fs.query(fs.collection(db, "trips"), fs.where("emails", "array-contains", email)), (s) => cb(list(s)), onErr);
      un = fs.onSnapshot(fs.collection(db, "trips"), (s) => cb(list(s)), (e) => {
        if (e.code === "permission-denied") { un = byMember(); } else onErr(e);
      });
      return () => un?.();
    },
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
    set: (t, s, id, data) => fs.setDoc(fs.doc(db, "trips", t, s, id), data).catch(onErr),
    async getAll(t) {
      const out = {};
      for (const s of SUBS) out[s] = (await fs.getDocs(sub(t, s))).docs.map((d) => ({ id: d.id, ...d.data() }));
      return out;
    },
    update: (t, s, id, patch) => fs.updateDoc(fs.doc(db, "trips", t, s, id), patch).catch(onErr),
    remove: (t, s, id) => fs.deleteDoc(fs.doc(db, "trips", t, s, id)).catch(onErr),
    // ลบทริป: ต้องลบข้อมูลย่อยทุกหมวดก่อน แล้วค่อยลบตัวทริป
    async deleteTrip(id) {
      try {
        const refs = [];
        for (const s of SUBS) (await fs.getDocs(sub(id, s))).forEach((d) => refs.push(d.ref));
        refs.push(fs.doc(db, "trips", id, "private", auth.currentUser.uid)); // ของคนอื่นลบไม่ได้ (เป็นข้อมูลส่วนตัว)
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
  const deepMerge = (t, s) => { for (const [k, v] of Object.entries(s)) { if (v && typeof v === "object" && !Array.isArray(v)) deepMerge((t[k] ||= {}), v); else t[k] = v; } return t; };
  db.user ||= {};
  db.priv ||= {};
  return {
    mode: "local",
    listenUser: (cb) => watch(() => cb(clone(db.user))),
    setUser(patch) { deepMerge(db.user, clone(patch)); emit(); },
    listenPrivate: (t, cb) => watch(() => cb(clone(db.priv[t] || {}))),
    setPrivate(t, patch) { deepMerge((db.priv[t] ||= {}), clone(patch)); emit(); },
    listenTrips: (cb) => watch(() => cb(Object.entries(db.trips).map(([id, t]) => ({ id, ...clone(t) })))),
    listenTrip: (id, cb) => watch(() => cb(db.trips[id] ? { id, ...clone(db.trips[id]) } : null)),
    createTrip(data) { const id = uid(); db.trips[id] = clone(data); emit(); return id; },
    updateTrip(id, patch) { Object.assign(db.trips[id], clone(patch)); emit(); },
    listen: (t, s, cb) => watch(() => cb(Object.entries(bucket(t, s)).map(([id, d]) => ({ id, ...clone(d) })))),
    add(t, s, data) { bucket(t, s)[uid()] = clone(data); emit(); },
    set(t, s, id, data) { bucket(t, s)[id] = clone(data); emit(); },
    async getAll(t) { return Object.fromEntries(SUBS.map((s) => [s, Object.entries(bucket(t, s)).map(([id, d]) => ({ id, ...clone(d) }))])); },
    update(t, s, id, patch) { const b = bucket(t, s); if (b[id]) Object.assign(b[id], clone(patch)); emit(); },
    remove(t, s, id) { delete bucket(t, s)[id]; emit(); },
    deleteTrip(id) { delete db.trips[id]; delete db.subs[id]; delete db.priv[id]; emit(); },
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
let currentUser = null;  // บัญชีที่ล็อกอินอยู่ (โหมด Firebase)
let userDoc = {};        // users/{uid}: { me: { tripId: ชื่อในทริป } }
let priv = {};           // ข้อมูลส่วนตัวของฉันในทริปนี้ (เตรียมผ่าน ตม.)

const tripDays = () => daysBetween(trip?.startDate, trip?.endDate);
const members = () => trip?.members || [];
const useAccount = () => store?.mode === "firebase";
const myEmail = () => (currentUser?.email || "").toLowerCase();
// ผู้ดูแล: เห็นทุกทริป (ต้องใส่อีเมลเดียวกันใน firestore.rules ส่วน isAdmin ด้วย)
const ADMIN_EMAILS = ["mugstz@gmail.com"];
const isAdmin = () => useAccount() && ADMIN_EMAILS.includes(myEmail());
const isMemberOf = (t) => Array.isArray(t?.emails) && t.emails.includes(myEmail());
// ชื่อในทริปที่ผูกกับอีเมลบัญชีนี้ (trip.memberEmails = { ชื่อ: อีเมล })
const boundName = (t = trip) => {
  const m = t?.memberEmails, e = myEmail();
  if (!m || !e) return "";
  return Object.keys(m).find((k) => String(m[k] || "").toLowerCase() === e && (t.members || []).includes(k)) || "";
};
const meLocked = () => useAccount() && !!boundName();
// ทริปนี้เราเข้าได้ไหม (ทริปเก่าที่ยังไม่ผูกอีเมล = ทุกคนในรายชื่อ Rules เข้าได้)
const canSeeTrip = (t) => !useAccount() || isAdmin() || !Array.isArray(t?.emails) || !t.emails.length || t.emails.includes(myEmail());
// ผู้ดูแลที่ไม่ได้อยู่ในทริปนั้น → ดูอย่างเดียวในฐานะผู้ดูแล (ไม่มีชื่อในทริป)
const adminGuest = () => isAdmin() && trip && Array.isArray(trip.emails) && trip.emails.length && !isMemberOf(trip);
// ฉันคือใคร: โหมดล็อกอิน → จำไว้ในบัญชี (ใช้ได้ทุกเครื่อง) / โหมดทดลอง → จำในเครื่อง
const getMe = () => {
  if (useAccount() && boundName()) return boundName();
  if (adminGuest()) return "";
  const m = useAccount() ? userDoc?.me?.[trip?.id] : lsGet("me-" + trip?.id);
  return members().includes(m) ? m : "";
};
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
  if (!navigator.onLine) { if (!silent) toast("ออฟไลน์อยู่ — ดึงเรตไม่ได้ ใช้เรตล่าสุดที่มีไปก่อน"); return; }
  const r = await fetchRate(cur);
  if (!r) { if (!silent) toast("ดึงเรตไม่สำเร็จ — ลองใหม่อีกครั้ง"); return; }
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
// เวลาจริงเป็นนาที: กิจกรรมที่ติ๊ก "คืนก่อนหน้า" (เช่น ไปสนามบิน 22:00 ก่อนไฟลท์ตี 1) = ลบ 1 วัน
const effMin = (x) => { const t = /^\d{1,2}:\d{2}$/.test(x?.time || "") ? +x.time.split(":")[0] * 60 + +x.time.split(":")[1] : null; return t === null ? null : x.prevNight ? t - 1440 : t; };
const sortItems = (list) =>
  [...list].sort((a, b) => (effMin(a) ?? 9999) - (effMin(b) ?? 9999) || num(a.order ?? 999) - num(b.order ?? 999) || byCreated(a, b));

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
  priv = {};
  WX = {};
  packView = "pack";
  if (dayMapObj) { try { dayMapObj.remove(); } catch {} dayMapObj = null; }
  wxState = "";
  closeAllSheets();
}

function route() {
  cleanup();
  if (useAccount() && !currentUser) { renderLogin(); return; }
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

/* ---------- หน้า: เข้าสู่ระบบ ---------- */
function renderLogin(msg = "") {
  app.innerHTML = `
    <div class="login-wrap">
      <form id="login-form" class="card form login-card">
        <div class="login-logo" aria-hidden="true">✈︎</div>
        <h1>แพลนเที่ยวของเรา</h1>
        <p class="muted">เข้าสู่ระบบด้วยบัญชีที่เจ้าของทริปสร้างให้</p>
        ${msg ? `<p class="warn">${msg}</p>` : ""}
        <label>อีเมล<input type="email" name="email" autocomplete="username" required inputmode="email"></label>
        <label>รหัสผ่าน<input type="password" name="password" autocomplete="current-password" required></label>
        <div class="actions"><button class="btn primary" id="login-btn">เข้าสู่ระบบ</button></div>
        <button type="button" class="link-plain forgot" data-action="forgot">ลืมรหัสผ่าน?</button>
        <p class="muted small-note">ยังไม่มีบัญชี — ให้เจ้าของทริปเพิ่มให้ (สมัครเองไม่ได้)</p>
      </form>
    </div>`;
}

const AUTH_ERR = {
  "auth/invalid-credential": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  "auth/wrong-password": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  "auth/user-not-found": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  "auth/invalid-email": "รูปแบบอีเมลไม่ถูกต้อง",
  "auth/user-disabled": "บัญชีนี้ถูกปิดใช้งาน",
  "auth/too-many-requests": "ลองผิดหลายครั้งเกินไป รอสักครู่แล้วลองใหม่",
  "auth/network-request-failed": "ไม่มีอินเทอร์เน็ต — ต่อเน็ตแล้วลองใหม่",
};

async function doLogin(form) {
  const f = formData(form);
  const btn = $("#login-btn");
  btn.disabled = true;
  btn.textContent = "กำลังเข้าสู่ระบบ…";
  try {
    await store.signIn(f.email.trim(), f.password);
  } catch (e) {
    renderLogin(AUTH_ERR[e.code] || "เข้าสู่ระบบไม่สำเร็จ: " + (e.code || e.message));
    $("#login-form [name=email]").value = f.email;
  }
}

async function forgotPassword() {
  const email = $("#login-form [name=email]")?.value.trim();
  if (!email) { toast("ใส่อีเมลก่อน แล้วกด “ลืมรหัสผ่าน?” อีกครั้ง"); return; }
  try { await store.resetPassword(email); toast("ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว (ดูในจดหมายขยะด้วย)"); }
  catch (e) { toast(AUTH_ERR[e.code] || "ส่งไม่สำเร็จ: " + (e.code || e.message)); }
}

function renderUserBox() {
  const el = document.getElementById("user-box");
  if (!el) return;
  el.innerHTML = currentUser
    ? `${isAdmin() ? `<span class="admin-tag" title="ผู้ดูแล เห็นทุกทริป">👑 ผู้ดูแล</span>` : ""}<span class="user-email" title="${esc(currentUser.email || "")}">${esc(currentUser.email || "")}</span>
       <button type="button" class="btn small" id="logout-btn">ออกจากระบบ</button>`
    : "";
}

async function logout() {
  const yes = await confirmDialog({ title: "ออกจากระบบ?", message: "ข้อมูลที่เก็บไว้ในเครื่องนี้จะถูกล้าง เข้าใหม่ได้ด้วยอีเมลและรหัสผ่าน", okText: "ออกจากระบบ", icon: "👋" });
  if (!yes) return;
  await store.signOut();
  location.hash = "#/";
  location.reload();
}

// ข้อมูลบัญชีเปลี่ยน (เช่น เลือก "ฉันคือใคร" จากอีกเครื่อง) → อัปเดตส่วนที่เกี่ยวข้อง
function onUserDocChange() {
  if (!trip || !skeletonSig) return;
  updateMeChip(); syncMeForms(); renderMoney(); renderPacking(); renderPrep(); renderBookings();
}

/* ---------- ติดตั้งเป็นแอปบนหน้าจอ ---------- */
let installEvt = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; if (location.hash === "" || location.hash === "#/") document.getElementById("install-box")?.replaceWith(htmlEl(installHintHtml())); });
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const htmlEl = (h) => { const t = document.createElement("template"); t.innerHTML = h.trim() || "<span></span>"; return t.content.firstChild; };
function installHintHtml() {
  if (isStandalone() || hintSeen("install")) return `<span id="install-box"></span>`;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (installEvt) return `<p class="hint install-hint" id="install-box"><span>📲 ติดตั้งเป็นแอปบนหน้าจอ เปิดได้เร็ว เต็มจอ</span><button type="button" class="btn small primary" data-action="install">ติดตั้ง</button><button type="button" class="hint-x" data-action="hint-x" data-k="install" aria-label="ปิด">✕</button></p>`;
  if (ios) return `<p class="hint install-hint" id="install-box" data-hint="install"><span>📲 ติดตั้งเป็นแอป: แตะปุ่ม <b>แชร์</b> ⬆️ ใน Safari แล้วเลือก <b>“เพิ่มไปยังหน้าจอโฮม”</b></span><button type="button" class="hint-x" data-action="hint-x" data-k="install" aria-label="ปิด">✕</button></p>`;
  return `<span id="install-box"></span>`;
}

/* ---------- กรอบเทาระหว่างโหลด (skeleton) ---------- */
const skelCards = (n) => Array.from({ length: n }, () => `<div class="trip-card skel-card"><div class="sk sk-band"></div><div class="tc-body"><div class="sk sk-h"></div><div class="sk sk-l"></div><div class="sk sk-s"></div></div></div>`).join("");
const skelTrip = () => `<div class="skel" aria-label="กำลังโหลด" role="status">
  <div class="card"><div class="sk sk-h"></div><div class="sk sk-l"></div><div class="sk sk-s"></div></div>
  <div class="sk-row">${'<div class="sk sk-pill"></div>'.repeat(4)}</div>
  ${'<div class="card sk-item"><div class="sk sk-dot"></div><div style="flex:1"><div class="sk sk-l"></div><div class="sk sk-s"></div></div></div>'.repeat(3)}
</div>`;

/* ---------- หน้า: รายการทริป ---------- */
function renderList() {
  app.innerHTML = `
    <div class="list-head"><h1>ทริปของเรา</h1>
      <div class="panel-btns">
        <label class="btn" title="กู้คืนทริปจากไฟล์สำรอง (.json)">กู้คืนจากไฟล์<input type="file" id="restore-file" accept="application/json,.json" hidden></label>
        <a class="btn primary" href="#/new">+ Create plan</a>
      </div></div>
    ${modeBanner()}
    ${installHintHtml()}
    <div id="trip-grid" class="trip-grid">${skelCards(2)}</div>`;
  unsubs.push(store.listenTrips((list) => {
    const grid = $("#trip-grid");
    if (!grid) return;
    list = list.filter(canSeeTrip).sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
    grid.innerHTML = list.length
      ? list.map((t, i) => {
          const cd = countdown(t);
          return `
          <a class="trip-card tc-${i % 4} ${cd.cls}" href="#/trip/${encodeURIComponent(t.id)}">
            <div class="tc-band"><span class="tc-flag">${FLAG[destOf(t)] || "✈️"}</span><span class="tc-cd">${cd.text}</span></div>
            <div class="tc-body">
              <h2>${esc(t.name)}</h2>
              <div class="muted">${esc(t.country)}${t.country ? " · " : ""}${fmtDate(t.startDate)} – ${fmtDate(t.endDate, "year")}</div>
              <div class="tc-meta"><span>👥 ${(t.members || []).length} คน</span><span>🗓️ ${daysBetween(t.startDate, t.endDate).length} วัน</span>${boundName(t) ? `<span>🙋 ${esc(boundName(t))}</span>` : isAdmin() && (t.emails || []).length ? `<span class="tc-admin">👑 ดูในฐานะผู้ดูแล</span>` : ""}</div>
              ${useAccount() && !(t.emails || []).length ? `<div class="tc-warn">⚠️ ยังไม่ได้ผูกอีเมลสมาชิก — เข้า “แก้ไขทริป” เพื่อตั้งค่า</div>` : ""}
            </div>
          </a>`;
        }).join("")
      : `<div class="empty">ยังไม่มีทริป — กด <b>+ Create plan</b> เพื่อสร้าง<br><br>
           <button class="btn" type="button" data-action="import">นำเข้าทริปโอซาก้าจากไฟล์เดิม</button></div>`;
  }));
}

const FLAG = { JP: "🇯🇵", KR: "🇰🇷" };
// นับถอยหลังวันเดินทาง (ใช้วันที่ของเครื่อง)
function countdown(t) {
  const today = localToday();
  const diff = Math.round((new Date(t.startDate + "T00:00:00") - new Date(today + "T00:00:00")) / 864e5);
  const days = daysBetween(t.startDate, t.endDate);
  if (diff > 1) return { text: `อีก ${diff} วัน ✈️`, cls: "is-soon" };
  if (diff === 1) return { text: "พรุ่งนี้แล้ว! ✈️", cls: "is-soon" };
  if (today <= t.endDate && today >= t.startDate) return { text: `กำลังเที่ยว · วันที่ ${days.indexOf(today) + 1}`, cls: "is-now" };
  return { text: "จบทริปแล้ว", cls: "is-past" };
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
      ${useAccount() ? `<fieldset class="sub email-set">
        <legend>อีเมลที่ใช้ login ของแต่ละคน</legend>
        <small class="muted">เข้าทริปได้เฉพาะอีเมลที่ใส่ไว้ และ “ฉันคือใคร” จะล็อกเป็นชื่อตามอีเมลนี้ ; ต้องตรงกับบัญชีใน Firebase Authentication</small>
        <div id="email-fields" data-map="${esc(JSON.stringify(t.memberEmails || defaultEmailMap(t)))}"></div>
      </fieldset>` : ""}
    </div>`;
}
// ค่าเริ่มต้น: ทริปใหม่ → อีเมลเราที่ชื่อแรก ; ทริปเก่า → อีเมลเราที่ชื่อที่เคยเลือก "ฉันคือใคร"
function defaultEmailMap(t) {
  if (!t.members) return { __me: myEmail() };
  const prev = userDoc?.me?.[t.id];
  return prev && t.members.includes(prev) ? { [prev]: myEmail() } : {};
}
// ช่องอีเมลตามรายชื่อผู้ร่วมทริป (อัปเดตทันทีที่พิมพ์ชื่อ)
function renderEmailFields(form) {
  const box = form?.querySelector("#email-fields");
  if (!box) return;
  let map = {};
  try { map = JSON.parse(box.dataset.map || "{}"); } catch {}
  box.querySelectorAll("[data-em]").forEach((i) => (map[i.dataset.em] = i.value));
  box.dataset.map = JSON.stringify(map);
  const names = [...new Set(form.elements.members.value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))];
  // ทริปใหม่: ใส่อีเมลเราให้ชื่อแรกไว้ก่อน (แก้ได้)
  const noneYet = !Object.keys(map).some((k) => k !== "__me" && map[k]);
  box.innerHTML = names.length ? names.map((n, i) => `<label class="em-row"><span>${esc(n)}</span><input type="email" data-em="${esc(n)}" value="${esc(map[n] ?? (i === 0 && noneYet ? map.__me || "" : ""))}" placeholder="อีเมลของ ${esc(n)}" autocomplete="off" inputmode="email"></label>`).join("")
    : `<p class="muted small-note">ใส่รายชื่อผู้ร่วมทริปก่อน</p>`;
}

function readTripForm(form) {
  const f = formData(form);
  const memberList = [...new Set(f.members.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))];
  if (!f.name.trim() || !f.startDate || !f.endDate || !memberList.length) { toast("กรอกช่องที่มี * ให้ครบ"); return null; }
  if (f.endDate < f.startDate) { toast("วันกลับต้องไม่ก่อนวันไป"); return null; }
  const out = { name: f.name.trim(), country: f.country.trim(), startDate: f.startDate, endDate: f.endDate, currency: f.currency || "THB", destCode: f.destCode || "OTHER", members: memberList, useChecklist: f.useChecklist };
  if (useAccount() && form.querySelector("#email-fields")) {
    const memberEmails = {};
    form.querySelectorAll("[data-em]").forEach((i) => { const v = i.value.trim().toLowerCase(); if (v && memberList.includes(i.dataset.em)) memberEmails[i.dataset.em] = v; });
    const bad = Object.values(memberEmails).find((v) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
    if (bad) { toast(`อีเมลไม่ถูกต้อง: ${bad}`); return null; }
    const emails = [...new Set(Object.values(memberEmails))];
    if (!emails.includes(myEmail()) && !isAdmin()) { toast(`ต้องใส่อีเมลของคุณ (${myEmail()}) ให้กับชื่อของคุณด้วย ไม่งั้นจะเข้าทริปนี้ไม่ได้`); return null; }
    Object.assign(out, { memberEmails, emails });
  }
  return out;
}

function renderCreate() {
  setTimeout(() => renderEmailFields($("#create-form")), 0);
  app.innerHTML = `
    <a class="back-btn" href="#/"><span aria-hidden="true">‹</span> ทริปทั้งหมด</a>
    <h1>Create plan</h1>
    ${modeBanner()}
    <form id="create-form" class="card form">
      ${tripFormFields()}
      <label class="check"><input type="checkbox" name="useChecklist" checked> ใส่เช็กลิสต์ก่อนเดินทางมาตรฐานให้ด้วย</label>
      <div class="actions"><button class="btn primary">สร้างทริป</button></div>
    </form>`;
}

/* ---------- หน้า: รายละเอียดทริป ---------- */
const noAccessHtml = () => `<div class="login-wrap"><div class="card login-card"><div class="login-logo" aria-hidden="true">🔒</div>
  <h1>คุณไม่ได้อยู่ในทริปนี้</h1><p class="muted">ทริปนี้เปิดได้เฉพาะสมาชิกที่ผูกอีเมลไว้ — ให้เจ้าของทริปเพิ่มอีเมล ${esc(myEmail())} ใน “แก้ไขทริป”</p>
  <a class="btn primary" href="#/">กลับไปทริปของฉัน</a></div></div>`;

function openTrip(id) {
  app.innerHTML = skelTrip();
  SUBS.forEach((s) => (data[s] = []));
  unsubs.push(store.listenTrip(id, (t) => {
    if (!t) { app.innerHTML = `<p>ไม่พบทริปนี้ <a href="#/">กลับหน้าแรก</a></p>`; return; }
    if (!canSeeTrip(t)) { app.innerHTML = noAccessHtml(); return; }
    trip = { members: [], ...t };
    if (firstTripLoad) {
      firstTripLoad = false;
      const today = new Date().toISOString().slice(0, 10);
      const i = tripDays().indexOf(today);
      if (i >= 0) dayIdx = i;
      // เรตอัตโนมัติ (ไม่ใช่ใส่เอง) → อัปเดตให้วันละครั้งตอนเปิดทริป
      if (t.currency && t.currency !== "THB" && (t.rateUpdated !== todayISO() || t.rateSource === "manual")) {
        updateRate(t.id, t.currency, true);
      }
    }
    const sig = JSON.stringify([t.name, t.country, t.startDate, t.endDate, t.members, t.currency, t.destCode]);
    const first = !skeletonSig;
    if (sig !== skeletonSig) { skeletonSig = sig; renderTripSkeleton(); }
    renderAll();
    // ยังไม่ได้เลือกว่าเป็นใคร → ถามก่อนเข้าทริป
    if (first && !getMe() && !adminGuest() && !lsGet("me-skip-" + t.id)) showMePicker();
  }));
  SUBS.forEach((s) => unsubs.push(store.listen(id, s, (list) => {
    data[s] = list;
    if (skeletonSig) renderSection(s);
  })));
  // การ์ด "ถัดไป": อัปเดตทุกนาที (เฉพาะช่วงที่อยู่ในทริป)
  const tick = setInterval(() => { if (trip && tripDays().includes(localToday())) refreshNextCard(); }, 60000);
  unsubs.push(() => clearInterval(tick));
  unsubs.push(store.listenPrivate(id, (p) => {
    priv = p || {};
    if (skeletonSig) { renderPrep(); syncBookForm(); renderMyBudget(); renderShopping(); }
  }));
}

function renderTripSkeleton() {
  const t = trip;
  const days = tripDays();
  if (dayIdx >= days.length) dayIdx = 0;
  const dayOpts = days.map((d, i) => `<option value="${d}">วันที่ ${i + 1} · ${fmtDate(d, "weekday")}</option>`).join("");
  const memberOpts = members().map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join("");
  app.innerHTML = `
  <div class="screen">
    ${modeBanner()}
    <div class="trip-head card">
      <div class="th-main">
        <a class="th-back" href="#/" title="ทริปทั้งหมด" aria-label="กลับไปหน้าทริปทั้งหมด"><span aria-hidden="true">‹</span></a>
        <div class="th-info">
          <h1>${esc(t.name)}</h1>
          <div class="th-meta">${t.country ? `${esc(t.country)} · ` : ""}${fmtDate(t.startDate)} – ${fmtDate(t.endDate, "year")} · ${days.length} วัน</div>
          <div class="chips">${members().map((m) => `<span>${esc(m)}</span>`).join("")}</div>
        </div>
      </div>
      <div class="head-actions">
        <button type="button" class="me-chip head-btn" data-action="pick-me" title="เปลี่ยนว่าฉันคือใคร">
          <span class="me-avatar" aria-hidden="true" id="me-avatar"></span>
          <span class="me-text"><small>ฉันคือ</small><b id="me-name">—</b></span>
          <span class="me-caret" aria-hidden="true">▾</span>
        </button>
        <a class="btn head-btn edit-btn" href="#/trip/${encodeURIComponent(t.id)}/edit">แก้ไขทริป</a>
      </div>
    </div>

    <nav class="tabs main-tabs">
      ${TABS.map(([k, label, icon, short]) => `<button type="button" data-action="tab" data-tab="${k}"><span class="t-icon" aria-hidden="true">${icon}</span><span class="t-full">${label}</span><span class="t-short">${short}</span></button>`).join("")}
    </nav>

    <section data-panel="plan">
      <div class="panel-head">
        <h2>แพลนรายวัน</h2>
        <div class="panel-btns">
          <button class="btn add-btn" type="button" data-action="item-new">＋ เพิ่มกิจกรรม</button>
          <button class="btn pdf-btn" type="button" data-action="pdf">Export PDF</button>
        </div>
      </div>
      <div class="tabs" id="day-tabs"></div>
      <div id="plan-list"></div>
      ${sheetHtml("sheet-item", "item-form-title", "เพิ่มกิจกรรม", `
      <form id="item-form" class="form">
        <div class="grid">
          <label>วันที่<select name="date">${dayOpts}</select></label>
          <label>เวลาถึง<input type="time" name="time"></label>
          <label class="check wide prev-night"><input type="checkbox" name="prevNight"> เวลานี้เป็นของ <b>คืนก่อนหน้า</b> <small class="muted">(เช่น ไปสนามบิน 22:00 ก่อนไฟลท์ตี 1)</small></label>
          <label class="wide">กิจกรรม*<input name="activity" required placeholder="เช่น ปราสาทโอซาก้า"></label>
          <div class="wide kind-field"><span class="field-label">ประเภท</span>
            <div class="kind-opts">${KINDS.map(([k, ic, l]) => `<label class="kind-opt"><input type="radio" name="kind" value="${k}"><span><i>${ic}</i>${l}</span></label>`).join("")}</div></div>
          <label class="wide">สถานที่ (พิมพ์ชื่อ หรือวางลิงก์ Google Maps)<input name="place" placeholder="เช่น Osaka Castle"></label>
          <div class="wide stay-field"><span class="field-label">อยู่ที่นี่ประมาณ</span>
            <div class="hm"><input type="number" name="stayH" min="0" max="23" inputmode="numeric" placeholder="0"><span>ชม.</span><input type="number" name="stayM" min="0" max="59" step="5" inputmode="numeric" placeholder="0"><span>นาที</span></div></div>
          <label class="wide">ค่าใช้จ่าย
            <div class="amount-cur"><input type="number" name="cost" min="0" step="any" inputmode="decimal">${curSelect("costCurrency", tripCur())}</div></label>
          <fieldset class="sub">
            <legend>การเดินทางมาที่นี่ <small class="muted">(ต่อได้หลายสาย)</small></legend>
            <div id="leg-suggest" class="leg-suggest" hidden></div>
            <div id="legs"></div>
            <button type="button" class="btn small" data-action="add-leg">+ เพิ่มสาย / ต่อรถ</button>
          </fieldset>
          <fieldset class="sub">
            <legend>เวลาเปิด–ปิด</legend>
            <div class="hours"><input type="time" name="openTime" aria-label="เปิด"><span>–</span><input type="time" name="closeTime" aria-label="ปิด"></div>
            <div class="days"><span class="muted">วันหยุด:</span>${DAY_NAMES.map((n, i) => `<label class="day"><input type="checkbox" name="closed" value="${i}"><span>${n}</span></label>`).join("")}</div>
            <input name="hoursNote" placeholder="หมายเหตุ เช่น เข้าครั้งสุดท้าย 16:30 / หยุดวันนักขัตฤกษ์">
          </fieldset>
          <label class="wide">ลิงก์กับการจอง<select name="bookingId"><option value="">— ไม่มี —</option></select></label>
          <label class="wide">หมายเหตุ<input name="note"></label>
        </div>
        <div class="actions">
          <button class="btn primary" id="item-submit">เพิ่ม</button>
          <button class="btn" type="button" data-action="sheet-close" data-sheet="sheet-item">ปิด</button>
          <button class="btn danger" type="button" data-action="item-cancel-sheet" id="item-cancel-btn" hidden>ยกเลิก ไม่ไปแล้ว</button>
        </div>
      </form>`)}
    </section>

    <section data-panel="wishlist">
      <div class="seg" role="tablist">
        <button type="button" data-action="wish-view" data-v="mine" id="seg-mine">⭐ ของเรา</button>
        <button type="button" data-action="wish-view" data-v="suggest" id="seg-suggest">✨ สถานที่แนะนำ</button>
      </div>
      <div id="suggest-view"></div>
      <div id="wish-mine">
      <button type="button" class="btn add-btn add-wish-btn" data-action="wish-new" id="wish-new-btn">＋ เพิ่มที่อยากไป</button>
      <div id="wish-list"></div>
      </div>
      ${sheetHtml("sheet-wish", "wish-form-title", "เพิ่มที่อยากไป", `
      <form id="wish-form" class="form">
        <div class="grid">
          <label class="wide">ชื่อร้าน / สถานที่*<input name="name" required placeholder="เช่น Ichiran Ramen Dotonbori"></label>
          <label class="wide">หมวด<select name="category">${WISH_CATS.map((c) => `<option>${c}</option>`).join("")}</select></label>
          <div class="wide prio-field"><span class="prio-label">ความอยากไป</span>
            <div class="prio-opts">${PRIORITIES.map(([v, l]) => `<label class="prio-opt"><input type="radio" name="priority" value="${v}" ${v === 2 ? "checked" : ""}><span>${"★".repeat(v)}<small>${l}</small></span></label>`).join("")}</div>
          </div>
          <label class="wide">สถานที่ (พิมพ์ชื่อ หรือวางลิงก์ Google Maps)<input name="place" placeholder="ใช้เปิดแผนที่"></label>
          <label class="wide">ลิงก์รีวิว / IG / TikTok<input type="url" name="link" placeholder="https://"></label>
          <label class="wide">ใครแนะนำ / เจอจากไหน<input name="source" placeholder="เช่น เอิงแนะนำ, เพจ xxx, TikTok @xxx"></label>
          <label class="wide">เมนูเด็ด / ต้องลอง<input name="mustTry" placeholder="เช่น ราเมนต้นตำรับ + ไข่ต้ม"></label>
          <label class="wide">ใช้เวลาเที่ยวที่นี่ประมาณ <small class="muted">(ไม่รวมเดินทาง)</small><input name="timeNeeded" placeholder="เช่น 1 ชม., 2–3 ชม., ครึ่งวัน"></label>
          <label class="wide">การเดินทาง / สถานีใกล้สุด<input name="access" placeholder="เช่น สถานีนัมบะ (สาย Midosuji) เดิน 5 นาที"></label>
          <label class="wide">หมายเหตุ<input name="note"></label>
        </div>
        <div class="actions">
          <button class="btn primary" id="wish-submit">บันทึก</button>
          <button class="btn" type="button" data-action="sheet-close" data-sheet="sheet-wish">ปิด</button>
          <button class="btn danger" type="button" data-action="wish-drop-sheet" id="wish-drop-btn" hidden>ยกเลิก ไม่ไปแล้ว</button>
        </div>
      </form>`)}
    </section>

    <section data-panel="bookings">
      <div class="panel-head">
        <h2>การจอง</h2>
        <div class="panel-btns"><button class="btn add-btn" type="button" data-action="book-new">＋ เพิ่มการจอง</button></div>
      </div>
      <div id="book-list"></div>
      ${sheetHtml("sheet-book", "book-form-title", "เพิ่มการจอง", `
      <form id="book-form" class="form">
        <div class="grid">
          <label>ประเภท<select name="type">${BOOK_TYPES.map((c) => `<option>${c}</option>`).join("")}</select></label>
          <label class="not-hotel">วันที่<input type="date" name="date" value="${esc(t.startDate)}"></label>
          <label class="wide"><span class="hotel-only">ชื่อที่พัก*</span><span class="not-hotel">รายละเอียด*</span><input name="title" required placeholder="เช่น Thai AirAsia FD xxx DMK→KIX"></label>
          <fieldset class="sub flight-only">
            <legend>ใครอยู่ในไฟลท์นี้</legend>
            <div class="pax" id="pax-box">${members().map((m) => `<label class="pax-opt"><input type="checkbox" name="pax" value="${esc(m)}"><span>${esc(m)}</span></label>`).join("")}</div>
            <div class="pax-refs" id="pax-refs"></div>
            <small class="muted">เอกสารโชว์ ตม. ของแต่ละคนจะมีเฉพาะไฟลท์ที่ติ๊กชื่อไว้</small>
          </fieldset>
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
          <label class="not-flight">เลขการจอง<input name="ref"></label>
          <label class="wide hotel-only">ที่อยู่โรงแรม <small class="muted">(ภาษาอังกฤษ — ใช้ในเอกสารโชว์ ตม. และหาตำแหน่งที่พัก)</small>
            <textarea name="address" rows="2" placeholder="เช่น 8-9 Namba-sennichimae, Chuo-ku, Osaka 542-0075"></textarea></label>
          <label class="wide hotel-only">ที่อยู่ภาษาท้องถิ่น <small class="muted">(เช่น ภาษาญี่ปุ่น — ก๊อปจาก Google Maps / อีเมลยืนยันการจอง ไว้ยื่นให้คนขับแท็กซี่)</small>
            <textarea name="addressLocal" rows="2" placeholder="例: 大阪府大阪市中央区難波千日前8-9"></textarea></label>
          <label class="wide hotel-only">เบอร์โทรโรงแรม<input name="phone" inputmode="tel" placeholder="เช่น +81 6-xxxx-xxxx"></label>
          <label class="wide"><span class="hotel-only">ลิงก์ Google Maps / ชื่อบนแผนที่ (ไม่บังคับ)</span><span class="not-hotel">สถานที่ (พิมพ์ชื่อ หรือวางลิงก์ Google Maps)</span><input name="place"></label>
          <label class="wide">หมายเหตุ<input name="note"></label>
        </div>
        <div class="actions">
          <button class="btn primary" id="book-submit">เพิ่ม</button>
          <button class="btn" type="button" data-action="sheet-close" data-sheet="sheet-book">ยกเลิก</button>
        </div>
      </form>`)}
    </section>

    <section data-panel="money">
      <div class="panel-head">
        <h2>ค่าใช้จ่าย</h2>
        <div class="panel-btns"><button class="btn add-btn" type="button" data-action="expense-new">＋ เพิ่มค่าใช้จ่าย</button></div>
      </div>
      <div class="card my-budget" id="my-budget"></div>
      <div class="card" id="rate-card"></div>
      <div class="card"><h3>💸 สรุปใครต้องโอนให้ใคร <small class="muted">(คิดเป็นเงินบาท)</small></h3><div id="settle"></div></div>
      <div class="card"><h3>🧾 รายการที่จ่ายไปแล้ว</h3><p class="muted small-note">ติ๊กชื่อคนที่โอนคืนคนจ่ายแล้ว ยอดค้างด้านบนจะลดลงเอง</p><div id="expense-list"></div></div>
      ${sheetHtml("sheet-expense", "expense-form-title", "เพิ่มค่าใช้จ่าย", `
      <form id="expense-form" class="form">
        <div class="grid">
          <label class="wide">รายการ*<input name="title" required placeholder="เช่น ค่าอาหารเย็น"></label>
          <label class="wide">จำนวนเงิน*
            <div class="amount-cur"><input type="number" name="amount" min="0" step="any" required inputmode="decimal">${curSelect("currency", tripCur())}</div>
            <small class="muted" id="expense-preview"></small></label>
          <label>ใครจ่าย<select name="paidBy">${memberOpts}</select></label>
          <label>วันที่<select name="date"><option value="">—</option>${dayOpts}</select></label>
          <fieldset class="sub">
            <legend>หารกับใครบ้าง</legend>
            <div class="pax" id="split-box">${members().map((m) => `<label class="pax-opt"><input type="checkbox" name="splitWith" value="${esc(m)}" checked><span>${esc(m)}</span></label>`).join("")}</div>
            <div class="split-quick"><button type="button" class="link-plain" data-action="split-all">เลือกทุกคน</button></div>
            <small class="muted">ค่าใช้จ่ายของตัวเองคนเดียว (เช่น ช้อปของตัวเอง) ใส่ใน “งบของฉัน” แทน คนอื่นจะไม่เห็น</small>
          </fieldset>
        </div>
        <div class="actions">
          <button class="btn primary" id="expense-submit">เพิ่ม</button>
          <button class="btn" type="button" data-action="sheet-close" data-sheet="sheet-expense">ยกเลิก</button>
        </div>
      </form>`)}
    </section>

    <section data-panel="packing">
      <div class="seg" role="tablist">
        <button type="button" data-action="pack-view" data-v="pack" id="seg-pack">🎒 ของที่ต้องเตรียม</button>
        <button type="button" data-action="pack-view" data-v="shop" id="seg-shop">🛍️ ของที่อยากซื้อ</button>
      </div>
      <div id="shop-view"></div>
      <div id="pack-view">
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
      </div>
      ${sheetHtml("sheet-shop", "shop-form-title", "เพิ่มของที่อยากซื้อ", `
      <form id="shop-form" class="form">
        <div class="grid">
          <label class="wide">ของที่อยากซื้อ*<input name="name" required placeholder="เช่น อัลบั้ม aespa, KitKat มัทฉะ"></label>
          <label class="wide">ร้าน / ที่ไหน<input name="shop" list="shop-names" placeholder="เช่น Don Quijote Dotonbori"><datalist id="shop-names"></datalist></label>
          <label>ราคาต่อชิ้น (รวมภาษี)<div class="amount-cur"><input type="number" name="price" min="0" step="any" inputmode="decimal">${curSelect("currency", tripCur())}</div></label>
          <label>จำนวน<input type="number" name="qty" min="1" step="1" value="1" inputmode="numeric"></label>
          <label class="wide">หมายเหตุ<input name="note" placeholder="เช่น ฝากซื้อให้แม่, สีชมพู"></label>
        </div>
        <div class="actions">
          <button class="btn primary">บันทึก</button>
          <button class="btn" type="button" data-action="sheet-close" data-sheet="sheet-shop">ยกเลิก</button>
        </div>
      </form>`)}
    </section>

    <section data-panel="prep">
      <div class="card sos-card ck" data-ck="sos" id="sos-card"></div>
      <div id="prep-info"></div>
      <div class="card private-card ck" data-ck="private">
        <h3>🔒 ข้อมูลของฉัน <small class="muted" id="prep-who"></small></h3>
        <div id="prep-private"></div>
      </div>
      <div class="card ck" data-ck="ready">
        <h3>✅ ความพร้อมของฉัน</h3>
        <div id="prep-ready"></div>
      </div>
      <div class="card ck" data-ck="docs">
        <h3>📄 เอกสารที่ต้องเตรียม <small class="muted" id="prep-count"></small></h3>
        <div id="prep-mine"></div>
      </div>
      <div class="card ck" data-ck="group">
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
  makeSortable($("#plan-list"), ".item-row", reorderDay);
  setupSwipe($("#plan-list"));
  makeSortable($("#wish-list"), ".wish-card", reorderWish);
  const d = days[dayIdx];
  if (d) $("#item-form [name=date]").value = d;
  syncMeForms();
  syncBookForm();
  setTab(tab);
}

/* ---------- ฟอร์มแบบ pop-up (ปุ่ม "＋ เพิ่ม…" อยู่บนสุดของแต่ละหน้า) ---------- */
const sheetHtml = (id, titleId, title, inner) => `
  <div class="sheet-backdrop" id="${id}" hidden>
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
      <div class="sheet-head"><h3 id="${titleId}">${title}</h3>
        <button type="button" class="icon sheet-x" data-action="sheet-close" data-sheet="${id}" aria-label="ปิด" title="ปิด">✕</button></div>
      <div class="sheet-body">${inner}</div>
    </div>
  </div>`;
const coarse = () => matchMedia("(pointer: coarse)").matches;
function openSheet(id, focusSel) {
  const s = document.getElementById(id);
  if (!s) return;
  s.hidden = false;
  s.querySelector(".sheet-body").scrollTop = 0;
  document.body.classList.add("sheet-open");
  // คอมพิวเตอร์: โฟกัสช่องแรกให้พิมพ์ได้เลย / มือถือ: ไม่เด้งคีย์บอร์ดเอง
  if (focusSel && !coarse()) setTimeout(() => s.querySelector(focusSel)?.focus(), 30);
}
function closeSheet(id) {
  const s = document.getElementById(id);
  if (s) s.hidden = true;
  if (!document.querySelector(".sheet-backdrop:not([hidden])")) document.body.classList.remove("sheet-open");
}
function closeAllSheets() {
  document.querySelectorAll(".sheet-backdrop").forEach((s) => (s.hidden = true));
  document.body.classList.remove("sheet-open");
}
// ปิด pop-up = ยกเลิกการแก้ไข
const SHEET_CANCEL = { "sheet-shop": () => closeShopForm(), "sheet-item": () => stopEdit(), "sheet-book": () => stopEditBooking(), "sheet-wish": () => closeWishForm(), "sheet-expense": () => stopEditExpense() };

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
  if (paidBy && me && !editingExpenseId) paidBy.value = me;
}

function renderAll() { renderPlan(); renderWishlist(); renderSuggest(); renderBookings(); renderMoney(); renderPacking(); renderShopping(); renderChecklist(); renderPrep(); }

function renderSection(s) {
  ({
    items: () => { renderPlan(); renderMoney(); renderBookings(); renderPrep(); renderWishlist(); renderSuggest(); },
    wishlist: () => { renderWishlist(); renderSuggest(); },
    bookings: () => { if (wxState === "done") { wxState = ""; } renderBookings(); renderPlan(); renderPrep(); renderSuggest(); renderWishlist(); },
    expenses: renderMoney,
    packing: renderPacking,
    shopping: () => { renderShopping(); renderMyBudget(); },
    checklist: renderChecklist,
    prep: renderPrep,
  })[s]();
}

const delBtn = (sub, id) => `<button type="button" class="icon" data-action="del" data-sub="${sub}" data-id="${esc(id)}" title="ลบ">✕</button>`;
const mapLink = (place, fallback = "") =>
  place ? `<a href="${esc(mapUrl(place))}" target="_blank" rel="noopener">📍 ${esc(placeLabel(place, fallback))}</a>` : "";
// เที่ยวบิน: ใครอยู่ในไฟลท์นี้ (รายการเก่าที่ยังไม่ระบุ = ทุกคน)
const isFlight = (b) => b?.type === "เที่ยวบิน";
const paxOf = (b) => (Array.isArray(b.passengers) ? b.passengers.filter((m) => members().includes(m)) : members());
// เลขการจอง (Booking ref.) ของเที่ยวบินแยกรายคน — รายการเก่าที่มีเลขเดียวใช้กับทุกคน
const refOf = (b, m) => (b ? (isFlight(b) && m && b.refs?.[m]) || b.ref || "" : "");
const refsText = (b) => {
  if (!isFlight(b)) return b.ref || "";
  const list = paxOf(b).map((m) => [m, refOf(b, m)]).filter(([, r]) => r);
  return [...new Set(list.map(([, r]) => r))].length === 1 && list.length === paxOf(b).length ? list[0][1] : list.map(([m, r]) => `${m}: ${r}`).join(" · ");
};
// ช่องกรอกเลขการจองของแต่ละคนที่ติ๊กไว้ (คงค่าที่พิมพ์ไว้)
function renderPaxRefs(values) {
  const box = document.getElementById("pax-refs");
  if (!box) return;
  const keep = values || Object.fromEntries([...box.querySelectorAll("[data-ref-m]")].map((i) => [i.dataset.refM, i.value]));
  const pax = [...document.querySelectorAll("#book-form [name=pax]:checked")].map((c) => c.value);
  box.innerHTML = pax.length ? `<div class="field-label">เลขการจอง (Booking ref.) ของแต่ละคน</div>` + pax.map((m) => `
    <label class="pax-ref"><span>${esc(m)}</span><input data-ref-m="${esc(m)}" value="${esc(keep[m] || "")}" placeholder="เช่น ABC123" autocomplete="off"></label>`).join("") : "";
}
const readPaxRefs = () => Object.fromEntries([...document.querySelectorAll("#pax-refs [data-ref-m]")].map((i) => [i.dataset.refM, i.value.trim().toUpperCase()]).filter(([, v]) => v));

/* ---------- แพลนรายวัน ---------- */
let dragging = false; // กำลังลากจัดลำดับ → ยังไม่วาดรายการใหม่

function renderPlan() {
  const el = $("#plan-list");
  if (!el || dragging) return;
  const days = tripDays();
  $("#day-tabs").innerHTML = days.map((d, i) => {
    const c = data.items.filter((x) => x.date === d).length;
    return `<button type="button" class="day-btn ${i === dayIdx ? "active" : ""}" data-action="day" data-i="${i}">
      <span class="d-num">วันที่ ${i + 1}</span><span class="d-date">${fmtDate(d, "weekday")}</span>${(() => { const w = dayWx(d); return w?.fc ? `<span class="d-wx">${w.fc.icon} ${Math.round(w.fc.max)}°</span>` : ""; })()}${c ? `<span class="d-count">${c}</span>` : ""}</button>`;
  }).join("");
  // เลื่อนแท็บวันที่เลือกให้อยู่ตรงกลาง (ไม่เลื่อนทั้งหน้า)
  const strip = $("#day-tabs"), act = strip.querySelector(".active");
  if (act) strip.scrollLeft = act.offsetLeft - strip.clientWidth / 2 + act.clientWidth / 2;
  const d = days[dayIdx];
  const list = sortItems(data.items.filter((x) => x.date === d));
  const active = list.filter((x) => x.status !== "cancel");
  const total = active.reduce((s, x) => s + toTHB(x.cost, x.costCurrency), 0);
  let travelTotal = 0;
  let prev = null;
  const rows = list.map((x) => {
    if (x.status === "cancel") return itemHtml(x);
    const conn = prev ? connectorHtml(prev, x) : "";
    travelTotal += prev ? travelMinutes(prev, x).min : 0;
    prev = x;
    return conn + itemHtml(x);
  });
  const nDone = list.filter((x) => x.status === "done").length;
  loadWeather();
  const withPins = active.filter((x) => itemCoords(x)).length;
  el.innerHTML = nextCardHtml(d, active) + `<div class="day-head"><h3 class="day-title">${fmtDate(d, "long")}</h3>${withPins ? `<button type="button" class="chip-toggle ${mapOpen ? "on" : ""}" data-action="day-map">🗺️ ${mapOpen ? "ซ่อนแผนที่" : "ดูแผนที่วันนี้"}</button>` : ""}</div>` +
    (mapOpen && withPins ? `<div id="day-map" class="day-map"></div>` : "") + dayWxHtml(d) + dayHotelHtml(d) + (list.length
    ? `${coarse() && days.length > 1 ? hintHtml("swipe", "ปัดซ้าย–ขวาที่รายการเพื่อเปลี่ยนวัน") : ""}${list.length > 1 ? hintHtml("drag", "ลาก ⋮⋮ เพื่อสลับลำดับ — เวลาจะเรียงให้ใหม่อัตโนมัติ") : ""}
       <ul class="rows timeline" id="plan-rows">${rows.join("")}</ul>
       <p class="total">${nDone ? `ไปแล้ว ${nDone}/${active.length} · ` : ""}รวมวันนี้ ${money(total)}${travelTotal ? ` · เดินทางรวม ~${fmtDur(travelTotal)}` : ""}</p>`
    : `<p class="empty">ยังไม่มีแพลนวันนี้ — กด “＋ เพิ่มกิจกรรม” ด้านบน หรือดึงจากแท็บ Wishlist</p>`);
  if (mapOpen && withPins) drawDayMap(d, active);
}

/* ---------- ประเภทกิจกรรม (ไอคอน + สี) ---------- */
const KINDS = [
  ["sight", "📸", "เที่ยว/ถ่ายรูป"], ["food", "🍜", "กิน"], ["cafe", "☕", "คาเฟ่"], ["shop", "🛍️", "ช้อป"],
  ["kpop", "💚", "K-pop"], ["hotel", "🏨", "ที่พัก"], ["move", "✈️", "เดินทาง"], ["other", "📌", "อื่นๆ"],
];
const KIND_OF_WISH = { "คาเฟ่": "cafe", "ร้านอาหาร": "food", "ช้อปปิ้ง": "shop", "ตามรอยศิลปิน": "kpop", "ที่เที่ยว": "sight" };
function kindOf(x) {
  if (x.kind && KINDS.some((k) => k[0] === x.kind)) return x.kind;
  const w = x.wishId && data.wishlist?.find((v) => v.id === x.wishId);
  if (w && KIND_OF_WISH[w.category]) return KIND_OF_WISH[w.category];
  const t = `${x.activity} ${x.place || ""}`.toLowerCase();
  if (/บิน|สนามบิน|airport|flight|แลนด์|รถไฟ|shinkansen|ชินคันเซ็น|station|สถานี/.test(t)) return "move";
  if (/เช็คอิน|เช็คเอาท์|check.?in|check.?out|โรงแรม|hotel|ryokan/.test(t)) return "hotel";
  if (/คาเฟ่|cafe|café|coffee|กาแฟ|ขนม|dessert/.test(t)) return "cafe";
  if (/ราเมน|ซูชิ|กิน|ข้าว|อาหาร|ramen|sushi|yakiniku|ยากินิกุ|ทาโกะ|takoyaki|ตลาด|market|izakaya|food/.test(t)) return "food";
  if (/ช้อป|shop|mall|ห้าง|don quijote|ดองกี้|uniqlo|outlet|loft|parco/.test(t)) return "shop";
  if (/nct|aespa|k-?pop|เคป๊อป|โคเรียทาวน์|korea ?town|dome|โดม/.test(t)) return "kpop";
  return "sight";
}
const kindIcon = (k) => (KINDS.find((x) => x[0] === k) || KINDS.at(-1))[1];

/* ---------- ข้อความแนะนำ: ขึ้นจนกว่าจะปิด / ใช้ครั้งแรก ---------- */
const hintSeen = (k) => !!lsGet("hint-" + k);
const hideHint = (k) => { lsSet("hint-" + k, "1"); document.querySelectorAll(`[data-hint="${k}"]`).forEach((e) => e.remove()); };
const hintHtml = (k, text) => (hintSeen(k) ? "" : `<p class="hint" data-hint="${k}"><span>💡 ${text}</span><button type="button" class="hint-x" data-action="hint-x" data-k="${k}" aria-label="ปิด">✕</button></p>`);

/* ---------- การ์ด "ถัดไป" (เฉพาะวันที่อยู่ในทริปจริง) ---------- */
const nowMin = () => { const d = new Date(Date.now() + 7 * 3600e3); return d.getUTCHours() * 60 + d.getUTCMinutes(); }; // เวลาไทย
// ญี่ปุ่น/เกาหลีเร็วกว่าไทย 2 ชม. — ใช้เวลาท้องถิ่นของเครื่อง (มือถือเปลี่ยนโซนเวลาให้เองเมื่ออยู่ต่างประเทศ)
const localNowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
function nextCardHtml(d, active) {
  if (d !== localToday()) return "";
  const now = localNowMin();
  const timed = active.filter((x) => effMin(x) !== null && x.status !== "done");
  const cur = timed.find((x) => effMin(x) <= now && now < effMin(x) + (num(x.stay) || 60));
  const next = timed.find((x) => effMin(x) > now);
  if (!cur && !next) return active.length ? `<div class="next-card done-day">🌙 วันนี้ครบทุกแพลนแล้ว พักผ่อนเยอะๆ</div>` : "";
  const nav = (x) => { const c = itemCoords(x); const dest = c ? `${c.lat},${c.lng}` : placeQuery(x.place) || x.activity; return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=transit`; };
  const mins = next ? effMin(next) - now : 0;
  return `<div class="next-card">
    ${cur ? `<div class="nc-now"><span class="nc-tag now">ตอนนี้</span> ${kindIcon(kindOf(cur))} <b>${esc(cur.activity)}</b></div>` : ""}
    ${next ? `<div class="nc-next"><span class="nc-tag">ถัดไป · ${esc(next.time)} (อีก ${fmtDur(mins)})</span>
      <div class="nc-title">${kindIcon(kindOf(next))} ${esc(next.activity)}</div>
      <div class="nc-btns"><a class="btn small primary" href="${esc(nav(next))}" target="_blank" rel="noopener">🧭 นำทางไปที่นี่</a><button type="button" class="btn small" data-action="goto-item" data-id="${esc(next.id)}">ดูในแพลน</button></div></div>` : ""}
  </div>`;
}

function refreshNextCard() {
  const el = $("#plan-list");
  if (!el || dragging) return;
  const d = tripDays()[dayIdx];
  const html = nextCardHtml(d, sortItems(data.items.filter((x) => x.date === d && x.status !== "cancel")));
  const old = el.querySelector(".next-card");
  if (old) { if (html) old.outerHTML = html; else old.remove(); }
  else if (html) el.insertAdjacentHTML("afterbegin", html);
}

/* ---------- แผนที่รายวัน (Leaflet + OpenStreetMap ฟรี — โหลดเมื่อกดดูเท่านั้น) ---------- */
let mapOpen = false;
let leafletP = null;
let dayMapObj = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletP) return leafletP;
  leafletP = new Promise((res, rej) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    s.onload = () => res(window.L);
    s.onerror = () => { leafletP = null; rej(new Error("leaflet")); };
    document.head.appendChild(s);
  });
  return leafletP;
}
async function drawDayMap(d, active) {
  const box = document.getElementById("day-map");
  if (!box) return;
  let L;
  try { L = await loadLeaflet(); } catch { box.innerHTML = `<p class="muted small-note">โหลดแผนที่ไม่ได้ — ต้องต่ออินเทอร์เน็ต</p>`; return; }
  if (!document.body.contains(box)) return;
  if (dayMapObj) { try { dayMapObj.remove(); } catch {} dayMapObj = null; }
  const pts = active.map((x) => ({ x, c: itemCoords(x) })).filter((p) => p.c);
  const map = L.map(box, { scrollWheelZoom: false, attributionControl: true, zoomControl: true });
  dayMapObj = map;
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
  const ll = pts.map((p) => [p.c.lat, p.c.lng]);
  pts.forEach((p, i) => {
    const icon = L.divIcon({ className: "pin-wrap", html: `<div class="pin k-${kindOf(p.x)} ${p.x.status === "done" ? "is-done" : ""}">${i + 1}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] });
    L.marker([p.c.lat, p.c.lng], { icon }).addTo(map).bindPopup(`<b>${i + 1}. ${esc(p.x.activity)}</b>${p.x.time ? `<br>${esc(p.x.time)}` : ""}`);
  });
  const h = hotelForNight(d)[0];
  const hc = h && hotelCoords(h);
  if (hc) { L.marker([hc.lat, hc.lng], { icon: L.divIcon({ className: "pin-wrap", html: `<div class="pin pin-hotel">🏨</div>`, iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(map).bindPopup(esc(h.title)); ll.push([hc.lat, hc.lng]); }
  // เส้นเชื่อมตามลำดับ (ไม่ลากข้ามประเทศ — ตัดช่วงที่ห่างเกิน 80 กม.)
  for (let i = 1; i < pts.length; i++) {
    if (distKm(pts[i - 1].c, pts[i].c) > 80) continue;
    L.polyline([[pts[i - 1].c.lat, pts[i - 1].c.lng], [pts[i].c.lat, pts[i].c.lng]], { color: "#B0505C", weight: 3, opacity: .7, dashArray: "6 6" }).addTo(map);
  }
  const near = ll.filter((p) => !pts.length || distKm({ lat: p[0], lng: p[1] }, pts.at(-1).c) < 80);
  if (near.length > 1) map.fitBounds(near, { padding: [30, 30], maxZoom: 15 });
  else map.setView(near[0] || ll[0], 14);
}

/* ---------- ปัดซ้าย/ขวาเปลี่ยนวัน (มือถือ) ---------- */
function setupSwipe(el) {
  let sx = 0, sy = 0, st = 0, ok = false;
  el.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    ok = e.touches.length === 1 && !e.target.closest(".drag-handle, .day-map, input, select, textarea, .tabs");
    sx = t.clientX; sy = t.clientY; st = Date.now();
  }, { passive: true });
  el.addEventListener("touchend", (e) => {
    if (!ok || dragging) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6 || Date.now() - st > 700) return;
    const n = tripDays().length;
    const ni = dayIdx + (dx < 0 ? 1 : -1);
    if (ni < 0 || ni >= n) return;
    dayIdx = ni;
    renderPlan();
    hideHint("swipe");
    el.classList.remove("swipe-l", "swipe-r");
    void el.offsetWidth;
    el.classList.add(dx < 0 ? "swipe-l" : "swipe-r");
    if (!editingItemId) $("#item-form [name=date]").value = tripDays()[dayIdx];
  }, { passive: true });
}

/* ---------- พยากรณ์อากาศ (Open-Meteo ฟรี ไม่ต้องใช้คีย์) ----------
   ล่วงหน้าได้ 16 วัน · ถ้ายังไกลเกิน แสดงอากาศจริงช่วงเดียวกันของปีที่แล้วไว้เป็นแนวทาง */
const WMO = [[0, "☀️", "แดดจัด"], [2, "🌤️", "มีเมฆบางส่วน"], [3, "☁️", "เมฆมาก"], [48, "🌫️", "หมอก"], [57, "🌦️", "ฝนปรอย"], [67, "🌧️", "ฝนตก"], [77, "🌨️", "หิมะ"], [82, "🌧️", "ฝนเป็นช่วงๆ"], [86, "🌨️", "หิมะเป็นช่วงๆ"], [99, "⛈️", "พายุฝนฟ้าคะนอง"]];
const wmo = (c) => { const r = WMO.find(([max]) => num(c) <= max) || WMO.at(-1); return { icon: r[1], text: r[2] }; };
let WX = {};          // date → { fc?, ly?, place }
let wxState = "";     // "" | loading | done
const shiftYear = (iso, n) => `${+iso.slice(0, 4) + n}${iso.slice(4, 10) === "-02-29" ? "-02-28" : iso.slice(4, 10)}`;
async function wxBase() {
  const h = hotels().map(hotelCoords).find(Boolean);
  if (h) return h;
  const it = data.items.map(itemCoords).find(Boolean);
  if (it) return it;
  const key = "wx-geo-" + trip.id;
  try { const c = JSON.parse(lsGet(key)); if (c) return c; } catch {}
  const c = (await geocode(trip.name)) || (await geocode(`${trip.name}, ${destInfo().nameEn || ""}`)) || (await geocode(trip.country));
  if (c) lsSet(key, JSON.stringify(c));
  return c;
}
async function loadWeather(force = false) {
  if (!trip || wxState === "loading" || (wxState === "done" && !force)) return;
  wxState = "loading";
  try {
    const days = tripDays();
    const base = await wxBase();
    if (!base) { wxState = "done"; return; }
    // จุดของแต่ละวัน = ที่พักคืนนั้น (ปัดทศนิยม 1 ตำแหน่ง ≈ 10 กม. รวมเป็นกลุ่มเดียวกัน)
    const locOf = (d) => { const h = hotelForNight(d)[0] || hotels().find((x) => x.checkOutDate === d); const c = (h && hotelCoords(h)) || base; return { lat: +c.lat.toFixed(1), lng: +c.lng.toFixed(1), place: h?.title || trip.name }; };
    const groups = new Map();
    days.forEach((d) => { const l = locOf(d); const k = `${l.lat},${l.lng}`; if (!groups.has(k)) groups.set(k, { ...l, days: [] }); groups.get(k).days.push(d); });
    const sig = JSON.stringify([...groups.keys(), days[0], days.at(-1)]);
    const cacheKey = "wx-" + trip.id;
    let cache = null;
    try { cache = JSON.parse(lsGet(cacheKey)); } catch {}
    const fresh = cache && cache.sig === sig && Date.now() - cache.at < 3 * 3600e3;
    if (fresh) { WX = cache.data; wxState = "done"; renderPlan(); return; }
    if (!navigator.onLine) { if (cache?.data) WX = cache.data; wxState = "done"; renderPlan(); return; }
    const out = {};
    const today = todayISO();
    const lastFc = shiftDays(today, 15);
    for (const g of groups.values()) {
      const inFc = g.days.filter((d) => d >= today && d <= lastFc);
      if (inFc.length) {
        try {
          const r = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${g.lat}&longitude=${g.lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&start_date=${inFc[0]}&end_date=${inFc.at(-1)}`)).json();
          (r.daily?.time || []).forEach((d, i) => { (out[d] ||= { place: g.place }).fc = { code: r.daily.weather_code[i], ...wmo(r.daily.weather_code[i]), max: r.daily.temperature_2m_max[i], min: r.daily.temperature_2m_min[i], rain: r.daily.precipitation_probability_max?.[i] }; });
        } catch {}
      }
      try {
        const s = shiftYear(g.days[0], -1), e = shiftYear(g.days.at(-1), -1);
        const r = await (await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${g.lat}&longitude=${g.lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&start_date=${s}&end_date=${e}`)).json();
        (r.daily?.time || []).forEach((d, i) => { const td = shiftYear(d, 1); (out[td] ||= { place: g.place }).ly = { date: d, ...wmo(r.daily.weather_code[i]), max: r.daily.temperature_2m_max[i], min: r.daily.temperature_2m_min[i], mm: r.daily.precipitation_sum[i] }; });
      } catch {}
    }
    WX = out;
    lsSet(cacheKey, JSON.stringify({ at: Date.now(), sig, data: out }));
  } catch (e) { console.warn(e); }
  wxState = "done";
  renderPlan();
}
const shiftDays = (iso, n) => new Date(new Date(iso + "T00:00:00Z").getTime() + n * 864e5).toISOString().slice(0, 10);
const dayWx = (d) => WX[d] || null;
function dayWxHtml(d) {
  const w = dayWx(d);
  if (!w) return wxState === "loading" ? `<div class="wx-line muted">กำลังโหลดพยากรณ์อากาศ…</div>` : "";
  if (w.fc) {
    const f = w.fc;
    return `<div class="wx-line"><span class="wx-ic">${f.icon}</span><b>${esc(f.text)}</b> · ${Math.round(f.min)}–${Math.round(f.max)}°C${f.rain != null ? ` · โอกาสฝน ${f.rain}%` : ""}${f.rain >= 50 ? ` <span class="badge">☔ พกร่ม</span>` : ""}${f.max <= 12 ? ` <span class="badge">🧥 หนาว</span>` : ""}<small class="muted"> · พยากรณ์ ${esc(w.place || "")}</small></div>`;
  }
  const l = w.ly;
  return l ? `<div class="wx-line ly"><span class="wx-ic">${l.icon}</span><span>ปีที่แล้ววันเดียวกัน: <b>${Math.round(l.min)}–${Math.round(l.max)}°C</b>${l.mm > 0.5 ? ` · ฝน ${Math.round(l.mm)} มม.` : " · ไม่มีฝน"}</span><small class="muted">พยากรณ์จริงจะขึ้นประมาณ 16 วันก่อนวันนั้น</small></div>` : "";
}

/* เวลา: "14:30" ↔ นาที */
const toMin = (t) => (/^\d{1,2}:\d{2}$/.test(t || "") ? +t.split(":")[0] * 60 + +t.split(":")[1] : null);
const fromMin = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fmtDur = (m) => (m >= 60 ? `${Math.floor(m / 60)} ชม.${m % 60 ? ` ${m % 60} นาที` : ""}` : `${m} นาที`);
const fmtKm = (km) => (km < 1 ? Math.round(km * 1000) + " ม." : km.toFixed(1) + " กม.");
const legsOf = (x) => (Array.isArray(x.legs) ? x.legs : []);
const legsMinutes = (x) => legsOf(x).reduce((s, l) => s + num(l.minutes), 0);
const legText = (l) => `${l.line || "เดินทาง"}${l.from || l.to ? ` (${[l.from, l.to].filter(Boolean).join(" → ")})` : ""}${num(l.minutes) ? ` ${num(l.minutes)} นาที` : ""}`;

// ชื่อสถานที่จากลิงก์ Google Maps แบบยาว (…/maps/place/ชื่อ/… หรือ ?q=ชื่อ) — ลิงก์สั้น maps.app.goo.gl อ่านชื่อไม่ได้
const decodePart = (x) => { try { return decodeURIComponent(x.replace(/\+/g, " ")).trim(); } catch { return x; } };
function placeNameFromLink(s = "") {
  const u = String(s).trim();
  if (!isLink(u)) return "";
  const m = u.match(/\/maps\/place\/([^/@?]+)/);
  if (m) return decodePart(m[1]);
  try {
    const p = new URL(u).searchParams;
    const q = p.get("q") || p.get("query") || p.get("destination");
    if (q && !/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(q)) return q.trim();
  } catch {}
  return "";
}
// ข้อความแสดงสถานที่: ชื่อปกติ / ชื่อจากลิงก์ / ชื่อสำรอง (เช่น ชื่อกิจกรรม)
const placeLabel = (place, fallback = "") => (isLink(place) ? placeNameFromLink(place) || fallback || "เปิดแผนที่" : place || fallback);
const placeQuery = (place) => (isLink(place) ? placeNameFromLink(place) : String(place || "").trim());

// ตำแหน่งของกิจกรรมในแพลน
function itemCoords(x) {
  if (!x) return null;
  if (Number.isFinite(x.lat) && Number.isFinite(x.lng)) return { lat: x.lat, lng: x.lng };
  const w = x.wishId && data.wishlist.find((v) => v.id === x.wishId);
  return (w && wishCoords(w)) || coordsFromLink(x.place);
}
const routeEnd = (x) => { const c = itemCoords(x); return c ? `${c.lat},${c.lng}` : placeQuery(x.place) || ""; };
const dirUrlItems = (a, b) => {
  const o = routeEnd(a), d = routeEnd(b);
  return o && d ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}&travelmode=transit` : "";
};

// เวลาเดินทางระหว่าง 2 กิจกรรม: ที่กรอกเอง (สายรถไฟ) ก่อน → ไม่มีก็ประมาณจากระยะทาง
function travelMinutes(prev, x) {
  const m = legsMinutes(x);
  if (m) return { min: m, est: null };
  if (isFlightHop(prev, x)) return { min: 0, est: null };
  const a = itemCoords(prev), b = itemCoords(x);
  if (!a || !b) { queueItemGeocode(prev); queueItemGeocode(x); return { min: 0, est: null }; }
  const km = distKm(a, b);
  if (km < 0.05) return { min: 0, est: null };
  if (km > 80) return { min: 0, est: null, far: km }; // ไกลเกิน (ข้ามเมือง/ข้ามประเทศ) — ประมาณแบบรถไฟในเมืองไม่ได้
  const est = { km, ...travelEstimate(km) };
  return { min: est.min, est };
}

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

/* ช่วงนี้เป็นการบินไหม (ดูจากสายที่กรอก / การจองเที่ยวบินที่ลิงก์ไว้) — เวลาเครื่องลงยึดตามไฟลท์ + เวลาท้องถิ่นต่างกัน จึงไม่คำนวณเวลาถึงเอง */
const FLIGHT_RE = /เครื่องบิน|บิน|flight|✈|airline|airways|air asia|airasia/i;
const isFlightLeg = (l) => FLIGHT_RE.test(`${l.line || ""}`);
const isFlightHop = (prev, x) => {
  const bk = (i) => i?.bookingId && data.bookings.find((b) => b.id === i.bookingId);
  const airport = (i) => /airport|สนามบิน|\((DMK|BKK|KIX|NRT|HND|ICN|GMP|CJU|PUS|TPE|HKG|SIN)\)/i.test(`${i?.activity || ""} ${i?.place || ""}`);
  return legsOf(x).some(isFlightLeg) || FLIGHT_RE.test(x.transport || "") || isFlight(bk(x)) || isFlight(bk(prev)) ||
    (airport(prev) && airport(x) && placeQuery(prev.place) !== placeQuery(x.place)) || /บิน|flight|แลนด์|landing/i.test(`${prev?.activity || ""} ${x.activity || ""}`) && airport(prev) && airport(x);
};

/* ลูกศรเชื่อมระหว่างกิจกรรม: สายรถไฟ / เวลาเดินทางประมาณจากระยะทาง + เวลาถึงโดยประมาณ */
function connectorHtml(prev, x) {
  const legs = legsOf(x);
  const { min, est, far } = travelMinutes(prev, x);
  const route = dirUrlItems(prev, x);
  const flight = isFlightHop(prev, x);
  let eta = "";
  const pt = effMin(prev);
  if (flight) {
    eta = `<span class="muted">✈️ เวลาถึงยึดตามไฟลท์ (เวลาท้องถิ่นปลายทาง)</span>`;
  } else if (pt !== null && min) {
    const arrive = pt + num(prev.stay) + min;
    const target = effMin(x);
    const late = target !== null && arrive > target;
    eta = num(prev.stay)
      ? `<span class="${late ? "warn" : "muted"}">${late ? "⚠️ อาจไม่ทัน — " : ""}ถึงประมาณ ${fromMin((arrive + 1440) % 1440)}</span>`
      : `<span class="muted">(ใส่ “อยู่ที่นี่ประมาณ” ของจุดก่อนหน้า เพื่อคำนวณเวลาถึง)</span>`;
  }
  const empty = !legs.length && !x.transport && !est && !route && !far;
  const late = !flight && pt !== null && min && num(prev.stay) && effMin(x) !== null && pt + num(prev.stay) + min > effMin(x);
  const arriveT = !flight && pt !== null && min && num(prev.stay) ? fromMin((pt + num(prev.stay) + min + 1440) % 1440) : "";
  const icon = flight ? "✈️" : legs.length ? (legs.some(isFlightLeg) ? "✈️" : "🚃") : est ? est.icon : "🚃";
  const sum = flight ? "บิน · เวลาถึงตามไฟลท์"
    : min ? `~${fmtDur(min)}${legs.length ? "" : " (ประมาณ)"}${arriveT ? ` · ถึง ~${arriveT}` : ""}`
    : far ? "ไกลเกินจะประมาณ — ใส่วิธีเดินทางเอง"
    : legs.length || x.transport ? "ดูวิธีเดินทาง" : "ดูเส้นทาง";
  return `<li class="connector ${empty ? "is-empty" : ""} ${late ? "is-late" : ""}" aria-hidden="${empty}">
    <details class="conn-d"><summary class="conn-sum">${icon} ${late ? "⚠️ อาจไม่ทัน · " : ""}${esc(sum)}</summary>
    <div class="conn-body">
    ${legs.length
      ? `<ol class="legs">${legs.map((l) => `<li>${isFlightLeg(l) ? "✈️" : "🚃"} ${esc(legText(l))}</li>`).join("")}</ol>`
      : x.transport ? `<div>🚃 ${esc(x.transport)}</div>` : ""}
    ${far && !flight && !legs.length ? `<div class="muted">ห่างกัน ~${Math.round(far).toLocaleString()} กม. — ไกลเกินจะประมาณให้ ใส่วิธีเดินทางเองในกิจกรรมนี้</div>` : ""}
    ${est ? `<div class="conn-est">${est.icon} ห่างกัน ~${fmtKm(est.km)} · ${est.mode} ~${est.min} นาที <small class="muted">(ประมาณจากระยะทาง)</small></div>` : ""}
    ${legs.length || eta || route ? `<div class="conn-meta">${legs.length && legsMinutes(x) ? `<b>เดินทางรวม ${fmtDur(legsMinutes(x))}</b>` : ""}${eta}${route && !flight ? `<a href="${esc(route)}" target="_blank" rel="noopener">🗺️ ดูเส้นทางจริง</a>` : ""}</div>` : ""}
    </div></details>
  </li>`;
}

const mapLinkItem = (x) => (x.place ? `<a href="${esc(mapUrl(x.place))}" target="_blank" rel="noopener">📍 ${esc(placeLabel(x.place, "เปิดแผนที่"))}</a>` : "");

function itemHtml(x) {
  const st = x.status || "";
  const warns = st ? [] : hoursWarnings(x);
  const hrs = hoursText(x);
  const bk = x.bookingId && data.bookings.find((b) => b.id === x.bookingId);
  return `
    <li class="row item-row st-${st || "none"}" id="item-${esc(x.id)}" data-id="${esc(x.id)}">
      <button type="button" class="drag-handle" aria-label="ลากเพื่อสลับลำดับ" title="ลากเพื่อสลับลำดับ">⋮⋮</button>
      <div class="time">${esc(x.time) || "—"}${x.prevNight && x.time ? `<small class="prev-tag">คืนก่อน</small>` : ""}${num(x.stay) ? `<small>${fmtDur(num(x.stay))}</small>` : ""}
        ${st === "cancel" ? "" : `<label class="done-tick" title="ไปแล้ว"><input type="checkbox" data-action="item-done" data-id="${esc(x.id)}" ${st === "done" ? "checked" : ""} aria-label="ไปแล้ว"><span></span></label>`}</div>
      <div class="kind-ic k-${kindOf(x)}" aria-hidden="true">${kindIcon(kindOf(x))}</div>
      <div class="body">
        <div class="title">${st === "cancel" ? `<span class="st-badge cancel">ยกเลิก</span> ` : ""}<span class="t-text">${esc(x.activity)}</span> ${warns.map((w) => `<span class="badge warn">⚠️ ${esc(w)}</span>`).join(" ")}</div>
        <div class="meta">${mapLinkItem(x)}${hrs ? `<span>🕘 ${esc(hrs)}</span>` : ""}${num(x.cost) ? `<span>💰 ${fmtWithTHB(x.cost, x.costCurrency)}</span>` : ""}</div>
        ${bk ? `<button type="button" class="link-btn" data-action="goto-booking" data-id="${esc(bk.id)}">🎫 ${esc(bk.type)}: ${esc(bk.title)}${refOf(bk, getMe()) ? ` · ${esc(refOf(bk, getMe()))}` : ""} →</button>` : ""}
        ${x.note ? `<div class="note">${esc(x.note)}</div>` : ""}
        ${st === "cancel" ? `<button type="button" class="link-plain" data-action="item-cancel" data-id="${esc(x.id)}">เอากลับมา</button>` : ""}
      </div>
      <div class="row-actions">
        <button type="button" class="icon" data-action="edit-item" data-id="${esc(x.id)}" title="แก้ไข">✎</button>${delBtn("items", x.id)}
      </div>
    </li>`;
}

function setItemStatus(id, status) {
  const x = data.items.find((i) => i.id === id);
  if (!x) return;
  store.update(trip.id, "items", id, { status });
  // กิจกรรมที่มาจาก Wishlist → อัปเดตสถานะใน Wishlist ด้วย
  if (x.wishId && data.wishlist.some((w) => w.id === x.wishId)) {
    if (status === "done") store.update(trip.id, "wishlist", x.wishId, { visit: "done" });
    else if (status === "" && data.wishlist.find((w) => w.id === x.wishId)?.visit === "done") store.update(trip.id, "wishlist", x.wishId, { visit: "" });
  }
  toast(status === "done" ? `✓ ไป “${x.activity}” แล้ว` : status === "cancel" ? `ยกเลิก “${x.activity}”` : "อัปเดตแล้ว");
}

// ลากสลับลำดับในวันเดียวกัน → เอาเวลาเดิมของวันนั้นมาเรียงใหม่ตามลำดับที่ลาก
function reorderDay(ids) {
  const items = ids.map((id) => data.items.find((i) => i.id === id)).filter(Boolean);
  const times = items.map(effMin).filter((m) => m !== null).sort((p, q) => p - q);
  items.forEach((x, i) => {
    const m = times[i];
    const time = m === undefined ? "" : fromMin((m + 1440) % 1440);
    const prevNight = m !== undefined && m < 0;
    const patch = {};
    if ((x.time || "") !== time) patch.time = time;
    if (!!x.prevNight !== prevNight) patch.prevNight = prevNight;
    if (x.order !== i) patch.order = i;
    if (Object.keys(patch).length) store.update(trip.id, "items", x.id, patch);
  });
  toast("สลับลำดับแล้ว — เรียงเวลาให้ใหม่");
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

// ในฟอร์ม: ประมาณเวลาเดินทางจากกิจกรรมก่อนหน้าในวันเดียวกัน
const formGeo = new Map();
async function updateLegSuggest() {
  const box = $("#leg-suggest"), f = $("#item-form");
  if (!box || !f) return;
  const date = f.elements.date.value, time = f.elements.time.value;
  const dayList = sortItems(data.items.filter((x) => x.date === date && x.id !== editingItemId && x.status !== "cancel"));
  const prev = time ? [...dayList].reverse().find((x) => x.time && x.time <= time) : dayList.at(-1);
  if (!prev) { box.hidden = true; return; }
  box.hidden = false;
  const place = f.elements.place.value.trim();
  const q = placeQuery(place) || f.elements.activity.value.trim();
  if (!q && !coordsFromLink(place)) { box.innerHTML = `📍 จุดก่อนหน้า: <b>${esc(prev.activity)}</b> — ใส่ชื่อสถานที่ แล้วจะประมาณเวลาเดินทางจากจุดนั้นให้`; return; }
  const a = itemCoords(prev);
  let b = coordsFromLink(place) || formGeo.get(q);
  if (!a) {
    queueItemGeocode(prev);
    box.innerHTML = `📍 จุดก่อนหน้า: <b>${esc(prev.activity)}</b> — ${prev.geoFail ? "หาตำแหน่งจุดก่อนหน้าไม่เจอ (ใส่ชื่อสถานที่ภาษาอังกฤษหรือลิงก์ Maps ในกิจกรรมนั้น)" : "กำลังหาตำแหน่ง…"}`;
    return;
  }
  if (b === undefined) {
    if (!navigator.onLine) { box.innerHTML = `ออฟไลน์อยู่ — ประมาณเวลาเดินทางไม่ได้`; return; }
    box.innerHTML = `📍 กำลังประมาณเวลาเดินทางจาก <b>${esc(prev.activity)}</b>…`;
    formGeo.set(q, null);
    const country = destInfo().nameEn || trip?.country || "";
    const c = (await geocode(`${q}, ${country}`)) || (await geocode(q));
    formGeo.set(q, c);
    return updateLegSuggest();
  }
  if (!b) { box.innerHTML = `📍 จุดก่อนหน้า: <b>${esc(prev.activity)}</b> — หาตำแหน่งสถานที่นี้ไม่เจอ ลองพิมพ์ภาษาอังกฤษหรือวางลิงก์ Google Maps`; return; }
  const km = distKm(a, b);
  const est = travelEstimate(km);
  const route = `https://www.google.com/maps/dir/?api=1&origin=${a.lat},${a.lng}&destination=${b.lat},${b.lng}&travelmode=transit`;
  box.innerHTML = `<div>${est.icon} จาก <b>${esc(prev.activity)}</b>${prev.time ? ` (${esc(prev.time)})` : ""} ~${fmtKm(km)} · ${est.mode} ~<b>${est.min} นาที</b> <small class="muted">(ประมาณ)</small></div>
    <div class="ls-btns"><button type="button" class="btn small" data-action="use-est" data-min="${est.min}" data-mode="${esc(est.mode)}">ใช้ค่านี้</button><a href="${esc(route)}" target="_blank" rel="noopener">ดูสาย/เวลาจริงใน Google Maps</a></div>`;
}

function fillStay(f, m) {
  m = num(m);
  f.elements.stayH.value = m >= 60 ? Math.floor(m / 60) : "";
  f.elements.stayM.value = m % 60 || "";
}

function startEdit(id) {
  const x = data.items.find((i) => i.id === id);
  if (!x) return;
  editingItemId = id;
  const form = $("#item-form");
  const f = form.elements;
  ["date", "time", "activity", "place", "cost", "costCurrency", "openTime", "closeTime", "hoursNote", "bookingId", "note"]
    .forEach((k) => (f[k].value = x[k] ?? ""));
  fillStay(form, x.stay);
  form.querySelectorAll("[name=kind]").forEach((r) => (r.checked = r.value === kindOf(x)));
  const cb = $("#item-cancel-btn");
  cb.hidden = false;
  cb.textContent = x.status === "cancel" ? "เอากลับมาในแพลน" : "ยกเลิก ไม่ไปแล้ว";
  f.prevNight.checked = !!x.prevNight;
  const closed = (x.closedDays || []).map(String);
  form.querySelectorAll("[name=closed]").forEach((cb) => (cb.checked = closed.includes(cb.value)));
  // รายการเก่าที่มีแค่ช่อง "การเดินทาง" → แปลงเป็นสายแรกให้
  setLegs(legsOf(x).length ? legsOf(x) : x.transport ? [{ line: x.transport }] : []);
  $("#item-form-title").textContent = "แก้ไขกิจกรรม";
  $("#item-submit").textContent = "บันทึก";
  openSheet("sheet-item");
  updateLegSuggest();
}

function newItem() {
  stopEdit();
  openSheet("sheet-item", "[name=activity]");
  updateLegSuggest();
}

function stopEdit() {
  editingItemId = null;
  const f = $("#item-form");
  if (!f) return;
  f.reset();
  setLegs([]);
  f.elements.date.value = tripDays()[dayIdx] || "";
  $("#item-form-title").textContent = "เพิ่มกิจกรรม";
  $("#item-submit").textContent = "เพิ่ม";
  $("#item-cancel-btn").hidden = true;
  $("#leg-suggest").hidden = true;
  closeSheet("sheet-item");
}

/* ---------- ลากจัดลำดับ (ใช้ได้ทั้งเมาส์และนิ้ว — จับที่ ⋮⋮) ---------- */
function makeSortable(container, itemSel, onDrop) {
  container.addEventListener("pointerdown", (e) => {
    const h = e.target.closest(".drag-handle");
    if (!h || !container.contains(h) || (e.pointerType === "mouse" && e.button !== 0)) return;
    const el = h.closest(itemSel);
    const list = el?.parentElement;
    if (!el || list.querySelectorAll(itemSel).length < 2) return;
    e.preventDefault();
    dragging = true;
    const before = [...list.querySelectorAll(itemSel)].map((s) => s.dataset.id);
    list.classList.add("is-dragging");
    const rect = el.getBoundingClientRect();
    const ph = document.createElement(el.tagName);
    ph.className = "drag-ph";
    ph.style.height = rect.height + "px";
    el.after(ph);
    el.classList.add("dragging");
    Object.assign(el.style, { position: "fixed", left: rect.left + "px", top: rect.top + "px", width: rect.width + "px", zIndex: 80, pointerEvents: "none" });
    const offY = e.clientY - rect.top;
    let y = e.clientY, speed = 0;
    const place = () => {
      el.style.top = y - offY + "px";
      const sibs = [...list.querySelectorAll(itemSel)].filter((s) => s !== el);
      const target = sibs.find((s) => { const r = s.getBoundingClientRect(); return y < r.top + r.height / 2; });
      if (target) target.before(ph); else sibs.at(-1)?.after(ph);
    };
    const move = (ev) => { y = ev.clientY; speed = y < 90 ? -10 : y > innerHeight - 110 ? 10 : 0; place(); };
    const timer = setInterval(() => { if (speed) { scrollBy(0, speed); place(); } }, 16);
    const end = () => {
      clearInterval(timer);
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", end);
      removeEventListener("pointercancel", end);
      el.removeAttribute("style");
      el.classList.remove("dragging");
      ph.replaceWith(el);
      list.classList.remove("is-dragging");
      dragging = false;
      const after = [...list.querySelectorAll(itemSel)].map((s) => s.dataset.id);
      if (after.join() !== before.join()) { onDrop(after); hideHint("drag"); hideHint("wdrag"); }
      renderPlan();
      renderWishlist();
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", end);
    addEventListener("pointercancel", end);
  });
}

/* ---------- Wishlist ---------- */
const PRIORITIES = [[1, "อยากไป"], [2, "อยากไปมาก"], [3, "ต้องไปให้ได้"]];
let wishFilter = "all";      // all | todo | planned | done | cancel
let wishCatFilter = "all";
let planOpenId = null;       // รายการที่กำลังเลือกวันใส่แพลน
let editingWishId = null;

// วันที่ในแพลนของรายการนี้ (นับจากกิจกรรมจริง — ลบออกจากแพลนแล้วสถานะจะกลับเป็น "ยังไม่ได้ใส่")
function wishPlanDates(w) {
  const linked = data.items.filter((i) => i.wishId === w.id && i.status !== "cancel").map((i) => i.date);
  if (linked.length || w.planLinked) return [...new Set(linked)].sort();
  return w.plannedDate ? [w.plannedDate] : []; // รายการเก่า
}
// ไปแล้ว / ยกเลิก (ไปแล้วนับจากกิจกรรมในแพลนที่ติ๊ก "ไปแล้ว" ด้วย)
const wishVisit = (w) => (w.visit === "cancel" ? "cancel" : w.visit === "done" || data.items.some((i) => i.wishId === w.id && i.status === "done") ? "done" : "");
const wishState = (w) => wishVisit(w) || (w.dates.length ? "planned" : "todo");
const linkLabel = (url = "") =>
  /instagram\.com/i.test(url) ? "📷 IG" : /tiktok\.com/i.test(url) ? "🎵 TikTok" : /youtu/i.test(url) ? "▶️ YouTube" :
  /facebook\.com|fb\.watch/i.test(url) ? "📘 Facebook" : /tabelog/i.test(url) ? "🍽️ Tabelog" : "🔗 ลิงก์รีวิว";

// ลำดับ: จัดเองได้ (ลาก) → ถ้ายังไม่เคยจัด เรียงตาม ยังไม่ใส่แพลน → ใส่แล้ว → ไปแล้ว → ยกเลิก, ความอยากไป, เวลาที่เพิ่ม
const STATE_RANK = { todo: 0, planned: 1, done: 2, cancel: 3 };
function wishSorted() {
  const all = data.wishlist.map((w) => ({ ...w, dates: wishPlanDates(w) })).map((w) => ({ ...w, state: wishState(w) }));
  all.sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || num(b.priority || 2) - num(a.priority || 2) || byCreated(a, b));
  const key = new Map(all.map((w, i) => [w.id, Number.isFinite(w.order) ? w.order : i]));
  return all.sort((a, b) => key.get(a.id) - key.get(b.id));
}

function reorderWish(ids) {
  const full = wishSorted().map((w) => w.id);
  const moved = new Set(ids);
  const slots = full.map((id, i) => (moved.has(id) ? i : -1)).filter((i) => i >= 0);
  const out = [...full];
  slots.forEach((slot, k) => (out[slot] = ids[k]));
  out.forEach((id, i) => { const w = data.wishlist.find((x) => x.id === id); if (w && w.order !== i) store.update(trip.id, "wishlist", id, { order: i }); });
  toast("จัดลำดับแล้ว");
}

function setWishVisit(id, visit) {
  const w = data.wishlist.find((x) => x.id === id);
  if (!w) return;
  store.update(trip.id, "wishlist", id, { visit });
  // ยกเลิกติ๊ก "ไปแล้ว" → ยกเลิกในแพลนด้วย
  if (visit !== "done") data.items.filter((i) => i.wishId === id && i.status === "done").forEach((i) => store.update(trip.id, "items", i.id, { status: "" }));
  toast(visit === "done" ? `✓ ไป “${w.name}” แล้ว` : visit === "cancel" ? `ยกเลิก “${w.name}”` : "อัปเดตแล้ว");
}

function renderWishlist() {
  const el = $("#wish-list");
  if (!el || dragging) return;
  const days = tripDays();
  const all = wishSorted();
  const count = (s) => all.filter((w) => w.state === s).length;
  const cats = [...new Set(all.map((w) => (WISH_CATS.includes(w.category) ? w.category : "อื่นๆ")))];
  if (wishCatFilter !== "all" && !cats.includes(wishCatFilter)) wishCatFilter = "all";
  const list = all.filter((w) => (wishFilter === "all" || w.state === wishFilter) &&
    (wishCatFilter === "all" || (WISH_CATS.includes(w.category) ? w.category : "อื่นๆ") === wishCatFilter));

  if (!all.length) {
    el.innerHTML = `<p class="empty">ยังไม่มีที่อยากไป — กด “＋ เพิ่มที่อยากไป” เพื่อลิสต์ร้านหรือที่เที่ยวไว้ก่อน<br>หรือดูไอเดียจาก “สถานที่แนะนำ”</p>`;
    return;
  }
  const dayOpts = days.map((d, i) => `<option value="${d}">วันที่ ${i + 1} · ${fmtDate(d, "weekday")}</option>`).join("");
  const fchip = (v, label, n) => `<button type="button" class="fchip ${wishFilter === v ? "active" : ""}" data-action="wish-filter" data-v="${v}">${label} ${n}</button>`;
  el.innerHTML = `
    <div class="wish-summary">
      <div class="chip-row">
        ${fchip("all", "ทั้งหมด", all.length)}${fchip("todo", "🟠 ยังไม่ใส่แพลน", count("todo"))}${fchip("planned", "🗓️ ใส่แพลนแล้ว", count("planned"))}${count("done") ? fchip("done", "✅ ไปแล้ว", count("done")) : ""}${count("cancel") ? fchip("cancel", "✕ ยกเลิก", count("cancel")) : ""}
      </div>
      ${cats.length > 1 ? `<div class="chip-row">${["all", ...cats].map((c) => `<button type="button" class="fchip ${wishCatFilter === c ? "active" : ""}" data-action="wish-cat" data-v="${esc(c)}">${c === "all" ? "ทุกหมวด" : esc(c)}</button>`).join("")}</div>` : ""}
      ${originPickerHtml()}
      ${list.length > 1 ? hintHtml("wdrag", "ลาก ⋮⋮ เพื่อจัดลำดับ") : ""}
    </div>
    <div id="wish-cards">
    ${list.length ? list.map((w) => {
      const prio = num(w.priority) || 2;
      const status = {
        done: `<span class="wstatus visited">✅ ไปแล้ว</span>`,
        cancel: `<span class="wstatus cancel">✕ ยกเลิก ไม่ไปแล้ว</span>`,
        planned: `<span class="wstatus done">✓ อยู่ในแพลน ${w.dates.map((d) => `วันที่ ${days.indexOf(d) + 1} (${fmtDate(d)})`).join(", ")}</span>`,
        todo: `<span class="wstatus todo">🟠 ยังไม่ได้ใส่ในแพลน</span>`,
      }[w.state];
      const picking = planOpenId === w.id;
      return `
      <article class="card wish-card st-${w.state}" id="wish-${esc(w.id)}" data-id="${esc(w.id)}">
        <div class="wish-top">
          <button type="button" class="drag-handle" aria-label="ลากเพื่อจัดลำดับ" title="ลากเพื่อจัดลำดับ">⋮⋮</button>
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
          <span class="badge">${kindIcon(KIND_OF_WISH[w.category] || "other")} ${esc(w.category || "อื่นๆ")}</span>
          ${w.place || w.name ? `<a href="${esc(mapUrl(w.place || w.name))}" target="_blank" rel="noopener">📍 ${esc(placeLabel(w.place, w.name))}</a>` : ""}
          ${w.link ? `<a href="${esc(w.link)}" target="_blank" rel="noopener">${linkLabel(w.link)}</a>` : ""}
        </div>
        ${w.mustTry ? `<div class="wish-line">🍽️ <b>ต้องลอง:</b> ${esc(w.mustTry)}</div>` : ""}
        ${w.source ? `<div class="wish-line muted">👤 ${esc(w.source)}</div>` : ""}
        ${w.timeNeeded ? `<div class="wish-line">${timeHtml(w.timeNeeded)}</div>` : ""}
        ${w.state === "cancel" ? "" : (() => { const c = wishCoords(w); if (!c) queueWishGeocode(w); return travelBoxHtml({ coords: c, query: placeQuery(w.place) || w.name, access: w.access, label: w.name, pending: !c && (geoBusy || geoQueue.some((x) => x.rec.id === w.id)) }); })()}
        ${w.note ? `<div class="note">${esc(w.note)}</div>` : ""}
        <div class="wish-actions">
        ${w.state === "done" || w.state === "cancel" ? "" : picking
          ? `<div class="to-plan">
               <select data-role="wish-date" data-id="${esc(w.id)}">${dayOpts}</select>
               <button type="button" class="btn small primary" data-action="to-plan" data-id="${esc(w.id)}">ยืนยัน</button>
               <button type="button" class="btn small" data-action="plan-cancel">ยกเลิก</button>
             </div>`
          : `<button type="button" class="btn small plan-btn" data-action="plan-open" data-id="${esc(w.id)}">${w.dates.length ? "ใส่อีกวัน" : "ใส่ลงแพลน"}</button>`}
          <div class="status-btns">
            ${w.state === "cancel" ? "" : `<label class="st-check"><input type="checkbox" data-action="wish-done" data-id="${esc(w.id)}" ${w.state === "done" ? "checked" : ""}><span>ไปแล้ว</span></label>`}
            ${w.state === "cancel" ? `<button type="button" class="link-plain" data-action="wish-drop" data-id="${esc(w.id)}">เอากลับมา</button>` : ""}
          </div>
        </div>
      </article>`;
    }).join("") : `<p class="empty">ไม่มีรายการตามตัวกรองนี้</p>`}
    </div>`;
}

function wishToPlan(id) {
  const w = data.wishlist.find((x) => x.id === id);
  const sel = app.querySelector(`[data-role=wish-date][data-id="${CSS.escape(id)}"]`);
  if (!w || !sel) return;
  const note = [w.access ? `การเดินทาง: ${w.access}` : "", w.mustTry ? `ต้องลอง: ${w.mustTry}` : "", w.note || ""].filter(Boolean).join(" · ");
  const c = wishCoords(w);
  store.add(trip.id, "items", {
    date: sel.value, time: "", activity: w.name, place: w.place || w.name,
    transport: "", cost: 0, costCurrency: tripCur(), note, wishId: w.id, createdAt: Date.now(),
    ...(c ? { lat: c.lat, lng: c.lng } : {}),
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
    ["name", "category", "place", "link", "source", "mustTry", "timeNeeded", "access", "note"].forEach((k) => (f[k].value = w[k] ?? ""));
    const pr = String(num(w.priority) || 2);
    form.querySelectorAll("[name=priority]").forEach((r) => (r.checked = r.value === pr));
  }
  $("#wish-form-title").textContent = w ? "แก้ไขที่อยากไป" : "เพิ่มที่อยากไป";
  const db = $("#wish-drop-btn");
  db.hidden = !w;
  if (w) db.textContent = w.visit === "cancel" ? "เอากลับมา" : "ยกเลิก ไม่ไปแล้ว";
  openSheet("sheet-wish", w ? null : "[name=name]");
}

function closeWishForm() {
  const form = $("#wish-form");
  if (form) form.reset();
  editingWishId = null;
  closeSheet("sheet-wish");
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
                 ${b.addressLocal ? `<div class="note">${esc(b.addressLocal)}</div>` : ""}${b.phone ? `<div class="note">📞 <a href="tel:${esc(b.phone.replace(/[^\d+]/g, ""))}">${esc(b.phone)}</a></div>` : ""}
                 <div class="meta">${mapLink(b.place || b.address || b.title, b.title)}</div>`
              : `<div class="meta"><span>📅 ${fmtDate(b.date, "weekday")}${b.time ? " · " + esc(b.time) : ""}</span>${mapLink(b.place, b.title)}</div>`}
            ${isFlight(b) ? `<div class="pax-line">👤 ${paxOf(b).map((m) => `<span class="pax-chip ${m === getMe() ? "is-me" : ""}">${esc(m)}</span>`).join("")}${Array.isArray(b.passengers) ? "" : ` <small class="muted">(ยังไม่ได้ระบุ — นับเป็นทุกคน)</small>`}</div>` : ""}
            ${refsText(b) ? `<div class="ref">เลขการจอง: <b>${esc(refsText(b))}</b></div>` : ""}
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
    ? `<div>🛬 เช็คอิน <b>${esc(h.title)}</b>${h.time ? ` ตั้งแต่ ${esc(h.time)}` : ""} ${mapLink(h.place || h.title, h.title)}</div>`
    : `<div>🏨 คืนนี้พักที่ <b>${esc(h.title)}</b> ${mapLink(h.place || h.title, h.title)}</div>`));
  if (!tonight.length && !isLastDay) parts.push(`<div class="warn">⚠️ คืนนี้ยังไม่มีที่พัก</div>`);
  return parts.length ? `<div class="day-hotel">${parts.join("")}</div>` : "";
}

function syncBookForm() {
  const form = $("#book-form");
  if (!form) return;
  const f = form.elements;
  const hotel = f.type.value === "ที่พัก";
  form.classList.toggle("is-hotel", hotel);
  form.classList.toggle("is-flight", f.type.value === "เที่ยวบิน");
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
  ["type", "date", "time", "title", "ref", "place", "note", "address", "addressLocal", "phone"].forEach((k) => (f[k].value = b[k] ?? ""));
  const pax = paxOf(b);
  form.querySelectorAll("[name=pax]").forEach((cb) => (cb.checked = pax.includes(cb.value)));
  renderPaxRefs(Object.fromEntries(members().map((m) => [m, refOf(b, m)])));
  if (isHotel(b)) {
    f.checkInDate.value = b.date || "";
    f.checkInTime.value = b.time || "";
    f.checkOutDate.value = b.checkOutDate || "";
    f.checkOutTime.value = b.checkOutTime || "";
  }
  $("#book-form-title").textContent = "แก้ไขการจอง";
  $("#book-submit").textContent = "บันทึก";
  syncBookForm();
  openSheet("sheet-book");
}

// ฟอร์มใหม่: ติ๊กชื่อตัวเองในไฟลท์ให้ก่อน
function defaultPax() {
  const me = getMe();
  document.querySelectorAll("#book-form [name=pax]").forEach((cb) => (cb.checked = me ? cb.value === me : true));
  renderPaxRefs({});
}

function newBooking() {
  stopEditBooking();
  defaultPax();
  openSheet("sheet-book", "[name=title]");
}

function stopEditBooking() {
  editingBookingId = null;
  const f = $("#book-form");
  if (!f) return;
  f.reset();
  $("#book-form-title").textContent = "เพิ่มการจอง";
  $("#book-submit").textContent = "เพิ่ม";
  syncBookForm();
  closeSheet("sheet-book");
}

/* ---------- ค่าใช้จ่าย + หารเงิน (แยกรายรายการ + ติ๊กว่าใครโอนคืนแล้ว) ---------- */
let editingExpenseId = null;
// หารกับใคร: รายการเก่าที่ไม่ได้ระบุ = ทุกคน
const splitOf = (e) => { const s = Array.isArray(e.splitWith) ? e.splitWith.filter((m) => members().includes(m)) : []; return s.length ? s : members(); };
const expShare = (e) => toTHB(e.amount, e.currency) / (splitOf(e).length || 1);
const isSettled = (e, m) => !!e.settled?.[m];
// ส่วนแบ่งต่อคน: เงินต่างประเทศ + บาท (ถ้ารายการเป็นเงินบาท แสดงเงินปลายทางคู่ด้วย)
function shareText(e) {
  const n = splitOf(e).length || 1;
  const cur = e.currency || "THB";
  if (cur !== "THB") return `${fmtCur(num(e.amount) / n, cur)}${rateOf(cur) ? ` ≈ ${money(expShare(e))}` : ""}`;
  return `${money(expShare(e))}${isForeign() && rateOf(tripCur()) ? ` ≈ ${fmtCur(expShare(e) / rateOf(tripCur()), tripCur())}` : ""}`;
}

function settle() {
  const ms = members();
  const total = data.expenses.reduce((s, e) => s + toTHB(e.amount, e.currency), 0);
  const share = ms.length ? total / ms.length : 0;
  const paid = Object.fromEntries(ms.map((m) => [m, 0]));
  const owe = Object.fromEntries(ms.map((m) => [m, 0])); // ส่วนที่แต่ละคนต้องจ่ายจริง
  data.expenses.forEach((e) => {
    if (e.paidBy in paid) paid[e.paidBy] += toTHB(e.amount, e.currency);
    splitOf(e).forEach((m) => (owe[m] += expShare(e)));
  });
  // ยอดค้างทีละรายการ: คนที่ไม่ได้จ่าย × ส่วนแบ่ง → โอนให้คนจ่าย (ยกเว้นติ๊กว่าโอนแล้ว)
  const pair = new Map(); // "ก→ข" → { from, to, amt, items[] }
  const add = (from, to, amt, e) => {
    const k = `${from}\u0000${to}`;
    if (!pair.has(k)) pair.set(k, { from, to, amt: 0, items: [] });
    const p = pair.get(k);
    p.amt += amt;
    p.items.push({ e, amt });
  };
  [...data.expenses].sort((a, b) => `${a.date || ""}${a.createdAt}`.localeCompare(`${b.date || ""}${b.createdAt}`)).forEach((e) => {
    if (!ms.includes(e.paidBy)) return;
    const sh = expShare(e);
    splitOf(e).filter((m) => m !== e.paidBy && !isSettled(e, m)).forEach((m) => add(m, e.paidBy, sh, e));
  });
  // หักลบกันระหว่าง 2 คน (ก ค้าง ข 300, ข ค้าง ก 100 → ก โอนให้ ข 200)
  const tx = [];
  const seen = new Set();
  for (const [k, p] of pair) {
    if (seen.has(k)) continue;
    const back = pair.get(`${p.to}\u0000${p.from}`);
    seen.add(k);
    if (back) seen.add(`${p.to}\u0000${p.from}`);
    const net = p.amt - (back?.amt || 0);
    if (Math.abs(net) < 0.005) continue;
    tx.push(net > 0 ? { from: p.from, to: p.to, amt: net, items: p.items, minus: back?.items || [] }
      : { from: p.to, to: p.from, amt: -net, items: back.items, minus: p.items });
  }
  tx.sort((a, b) => a.from.localeCompare(b.from) || b.amt - a.amt);
  const outstanding = tx.reduce((s, t) => s + t.amt, 0);
  return { total, share, paid, owe, tx, outstanding };
}

const planTotalTHB = () => data.items.filter((x) => x.status !== "cancel").reduce((s, x) => s + toTHB(x.cost, x.costCurrency), 0);

function settleHtml(forPrint = false) {
  const { total, paid, owe, tx } = settle();
  const me = getMe();
  const missingRate = data.expenses.some((e) => e.currency && e.currency !== "THB" && !rateOf(e.currency));
  const planTotal = planTotalTHB();
  const n = members().length || 1;
  const itemLine = (x, sign = "") => `<li>${sign}${esc(x.e.title)}${x.e.date ? ` <span class="muted">(${fmtDate(x.e.date)})</span>` : ""} — ${money(x.amt)}</li>`;
  return (missingRate ? `<p class="warn">⚠️ มีรายการที่เป็นเงินต่างประเทศแต่ยังไม่มีเรต — กด “อัปเดตเรตล่าสุด” ก่อน ยอดจึงจะถูกต้อง</p>` : "") +
    (data.expenses.length
      ? `<p>รวมค่าใช้จ่ายกลุ่ม <b>${money(total)}</b>${thbToTrip(total)}${me ? ` · ส่วนของฉัน <b>${money(owe[me] || 0)}</b>${thbToTrip(owe[me] || 0)}` : ""}</p>
         <h4>ยังค้างโอน</h4>
         ${tx.length ? `<ul class="tx-list">${tx.map((t) => `
           <li class="tx ${t.from === me ? "me-owe" : t.to === me ? "me-get" : ""}">
             ${forPrint ? `<div><b>${esc(t.from)}</b> → <b>${esc(t.to)}</b> ${money(t.amt)}</div>` : `<details>
               <summary><span class="tx-who"><b>${esc(t.from)}</b> <span class="tx-arrow">→</span> <b>${esc(t.to)}</b></span><span class="tx-amt">${money(t.amt)}${thbToTrip(t.amt)}</span>${t.from === me ? `<span class="tx-tag">ฉันต้องโอน</span>` : t.to === me ? `<span class="tx-tag get">ฉันได้คืน</span>` : ""}</summary>`}
               <ul class="tx-items">${t.items.map((x) => itemLine(x)).join("")}${t.minus.map((x) => itemLine(x, "หัก ")).join("")}</ul>
             ${forPrint ? "" : `</details>`}
           </li>`).join("")}</ul>`
          : `<p class="ok-text">✓ ไม่มียอดค้าง ทุกคนเคลียร์กันครบแล้ว</p>`}
         <details class="paid-table"><summary>ดูยอดที่แต่ละคนออกไปก่อน</summary>
         <div class="table-wrap"><table><thead><tr><th>ชื่อ</th><th class="num">ออกไปก่อน</th><th class="num">ส่วนที่ต้องจ่าย</th></tr></thead>
         <tbody>${members().map((m) => `<tr><td>${esc(m)}${m === me ? " (ฉัน)" : ""}</td><td class="num">${money(paid[m])}</td><td class="num">${money(owe[m])}</td></tr>`).join("")}</tbody></table></div></details>`
      : `<p class="muted">ยังไม่มีรายการค่าใช้จ่าย</p>`) +
    (planTotal ? `<p class="muted">ประมาณการค่าใช้จ่ายตามแพลน: ${money(planTotal)} (ตกคนละ ${money(planTotal / n)})</p>` : "");
}

// เรตแลกเปลี่ยน: ดึงอัตโนมัติจาก ธปท. เท่านั้น (ไม่ให้แก้เอง กันตัวเลขไม่ตรงกันตอนหารเงิน)
function rateCardHtml() {
  if (!isForeign()) {
    return `<h3>สกุลเงิน</h3><p class="muted">ทริปนี้ใช้เงินบาท — ถ้าไปต่างประเทศ เปลี่ยนสกุลเงินได้ที่ “แก้ไขทริป”</p>`;
  }
  const cur = tripCur();
  const r = num(trip.rate);
  return `<h3>💱 อัตราแลกเปลี่ยน · ${cur} ${esc(curInfo(cur)[1])}</h3>
    ${r ? `<div class="rate-big">1 ${cur} = <b>${r.toFixed(4)}</b> บาท</div>
      <p class="muted small-note"><span class="rate-ref ${trip.rateSource === "BOT" ? "bot" : ""}">${esc(rateRefText())}</span> · ใช้เรตนี้หารเงินทั้งทริป อัปเดตอัตโนมัติวันละครั้ง</p>`
      : `<p class="muted">ยังไม่มีเรต</p>`}
    <div class="converter">
      <span>แปลงเร็ว:</span>
      <input type="number" id="conv-input" min="0" step="any" inputmode="decimal" placeholder="${cur}">
      <span id="conv-out" class="muted">= — บาท</span>
      <button type="button" class="btn small" data-action="fetch-rate">↻ อัปเดตเรตล่าสุด</button>
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
  const cur = f.elements.currency.value;
  const v = num(f.elements.amount.value);
  const n = [...document.querySelectorAll("#expense-form [name=splitWith]:checked")].length || 1;
  out.textContent = v ? `${cur !== "THB" ? (rateOf(cur) ? `≈ ${money(toTHB(v, cur))} · ` : "ยังไม่มีเรต · ") : ""}หาร ${n} คน = คนละ ${shareText({ amount: v, currency: cur })}` : "";
}

function renderMoney() {
  const el = $("#settle");
  if (!el) return;
  const card = $("#rate-card");
  if (!card.contains(document.activeElement)) { card.innerHTML = rateCardHtml(); }
  updateConverter();
  updateExpensePreview();
  renderMyBudget();
  el.innerHTML = settleHtml();
  const me = getMe();
  const list = [...data.expenses].sort((a, b) => `${b.date || ""}${b.createdAt}`.localeCompare(`${a.date || ""}${a.createdAt}`));
  $("#expense-list").innerHTML = list.length
    ? `<ul class="rows exp-rows">${list.map((e) => {
        const split = splitOf(e);
        const others = split.filter((m) => m !== e.paidBy);
        const sh = expShare(e);
        const done = others.filter((m) => isSettled(e, m)).length;
        return `
        <li class="row exp-row ${others.length && done === others.length ? "all-settled" : ""}">
          <div class="body">
            <div class="title">${esc(e.title)} · <b>${fmtWithTHB(e.amount, e.currency)}</b></div>
            <div class="meta"><span>💳 ${esc(e.paidBy)} จ่ายไปก่อน</span>${e.date ? `<span>📅 ${fmtDate(e.date)}</span>` : ""}</div>
            <div class="exp-share">👥 ${split.length === members().length ? `หารทุกคน (${split.length})` : `หาร ${split.length} คน: ${split.map(esc).join(", ")}`} · คนละ <b>${shareText(e)}</b></div>
            ${others.length ? `<div class="settle-label muted">โอนคืน ${esc(e.paidBy)} แล้ว (${done}/${others.length})</div><div class="settle-row">
              ${others.map((m) => `<label class="settle-chip ${m === me ? "is-me" : ""}"><input type="checkbox" data-action="settle" data-id="${esc(e.id)}" data-m="${esc(m)}" ${isSettled(e, m) ? "checked" : ""}><span>${esc(m)}</span></label>`).join("")}</div>` : ""}
          </div>
          <div class="row-actions">
            <button type="button" class="icon" data-action="edit-expense" data-id="${esc(e.id)}" title="แก้ไข">✎</button>${delBtn("expenses", e.id)}
          </div>
        </li>`;
      }).join("")}</ul>`
    : `<p class="muted">ยังไม่มีรายการ — กด “＋ เพิ่มค่าใช้จ่าย” ด้านบน</p>`;
}

/* ---------- งบของฉัน (เห็นเฉพาะตัวเอง — เก็บใน private/{uid}) ---------- */
const myExpList = () => (Array.isArray(priv.myExp) ? priv.myExp : []);
function myBudgetStats() {
  const me = getMe();
  const shared = data.expenses.filter((e) => splitOf(e).includes(me)).reduce((s, e) => s + expShare(e), 0);
  const own = myExpList().reduce((s, x) => s + toTHB(x.amount, x.currency), 0);
  const shop = shopList().filter((x) => x.bought).reduce((s, x) => s + toTHB(num(x.price) * (num(x.qty) || 1), x.currency), 0);
  return { shared, own, shop, total: shared + own + shop };
}
function renderMyBudget() {
  const box = $("#my-budget");
  if (!box) return;
  const me = getMe();
  if (!me) { box.innerHTML = `<h3>💰 งบของฉัน</h3><p class="muted">เลือก “ฉันคือใคร?” ก่อน เพื่อดูงบของตัวเอง</p>`; return; }
  if (box.contains(document.activeElement) && document.activeElement.id === "budget-input") return;
  const st = myBudgetStats();
  const budget = num(priv.budget);
  const pct = budget ? Math.min(100, Math.round((st.total / budget) * 100)) : 0;
  const left = budget - st.total;
  const days = tripDays();
  const today = todayISO();
  const daysLeft = days.filter((d) => d >= today).length || days.length;
  const lvl = !budget ? "" : st.total > budget ? "over" : pct >= 80 ? "near" : "";
  const list = [...myExpList()].sort((x, y) => `${y.date || ""}${y.id}`.localeCompare(`${x.date || ""}${x.id}`));
  box.innerHTML = `
    <div class="mb-head"><h3>💰 งบของฉัน</h3><span class="lock-note">🔒 เห็นเฉพาะคุณ</span></div>
    <label class="mb-set">งบทั้งทริป (บาท)<input type="number" id="budget-input" min="0" step="500" inputmode="numeric" value="${budget || ""}" placeholder="เช่น 30000"></label>
    ${budget ? `
      <div class="mb-bar ${lvl}"><div style="width:${pct}%"></div></div>
      <div class="mb-nums"><span>ใช้ไป <b>${money(st.total)}</b>${thbToTrip(st.total)}</span><span class="${left < 0 ? "neg" : "pos"}">${left < 0 ? `เกินงบ ${money(-left)}` : `เหลือ ${money(left)}`}</span></div>
      ${left > 0 ? `<p class="muted small-note">ใช้ได้อีกวันละประมาณ ${money(left / daysLeft)}${thbToTrip(left / daysLeft)} (${daysLeft} วัน)</p>` : ""}
      ${lvl === "near" ? `<p class="warn-soft small-note">⚠️ ใช้ไปแล้ว ${pct}% ของงบ</p>` : lvl === "over" ? `<p class="warn small-note">⚠️ เกินงบแล้ว</p>` : ""}`
    : `<p class="muted small-note">ตั้งงบเพื่อดูว่าใช้ไปเท่าไรแล้ว (ยังนับยอดให้: ${money(st.total)})</p>`}
    <ul class="mb-break">
      <li><span>ส่วนของฉันในค่าใช้จ่ายกลุ่ม</span><b>${money(st.shared)}</b></li>
      <li><span>ค่าใช้จ่ายส่วนตัว</span><b>${money(st.own)}</b></li>
      <li><span>ของที่ซื้อแล้ว (ลิสต์ช้อป)</span><b>${money(st.shop)}</b></li>
    </ul>
    <details class="mb-own" ${list.length ? "" : ""}>
      <summary>ค่าใช้จ่ายส่วนตัว (${list.length}) — เพิ่ม/ดูรายการ</summary>
      <form id="myexp-form" class="inline-form mb-form">
        <input name="title" required placeholder="เช่น ขนม, ค่ารถส่วนตัว">
        <div class="amount-cur"><input type="number" name="amount" min="0" step="any" required inputmode="decimal" placeholder="จำนวน">${curSelect("currency", tripCur())}</div>
        <button class="btn primary">เพิ่ม</button>
      </form>
      ${list.length ? `<ul class="rows">${list.map((x) => `<li class="row"><div class="body"><div class="title">${esc(x.title)} · <b>${fmtWithTHB(x.amount, x.currency)}</b></div>${x.date ? `<div class="meta"><span>📅 ${fmtDate(x.date)}</span></div>` : ""}</div>
        <div class="row-actions"><button type="button" class="icon" data-action="budget-del" data-id="${esc(x.id)}" title="ลบ">✕</button></div></li>`).join("")}</ul>` : `<p class="muted small-note">ยังไม่มี</p>`}
    </details>`;
}
function addMyExp(f) {
  const rec = { id: Date.now().toString(36), title: f.title.trim(), amount: num(f.amount), currency: f.currency || "THB", date: tripDays().includes(todayISO()) ? todayISO() : "" };
  if (!rec.title || !rec.amount) { toast("ใส่รายการและจำนวนเงิน"); return; }
  store.setPrivate(trip.id, { myExp: [...myExpList(), rec] });
  toast("บันทึกแล้ว — เห็นเฉพาะคุณ");
}
async function delMyExp(id) {
  const x = myExpList().find((v) => v.id === id);
  if (!x) return;
  const before = myExpList();
  store.setPrivate(trip.id, { myExp: before.filter((v) => v.id !== id) });
  toast(`ลบ “${x.title}” แล้ว`, () => store.setPrivate(trip.id, { myExp: before }));
}

function newExpense() {
  stopEditExpense();
  openSheet("sheet-expense", "[name=title]");
}

function startEditExpense(id) {
  const e = data.expenses.find((x) => x.id === id);
  if (!e) return;
  editingExpenseId = id;
  const f = $("#expense-form").elements;
  ["title", "amount", "currency", "paidBy", "date"].forEach((k) => (f[k].value = e[k] ?? ""));
  const sp = splitOf(e);
  document.querySelectorAll("#expense-form [name=splitWith]").forEach((c) => (c.checked = sp.includes(c.value)));
  $("#expense-form-title").textContent = "แก้ไขค่าใช้จ่าย";
  $("#expense-submit").textContent = "บันทึก";
  updateExpensePreview();
  openSheet("sheet-expense");
}

function stopEditExpense() {
  editingExpenseId = null;
  const form = $("#expense-form");
  if (!form) return;
  form.reset();
  syncMeForms();
  $("#expense-form-title").textContent = "เพิ่มค่าใช้จ่าย";
  $("#expense-submit").textContent = "เพิ่ม";
  updateExpensePreview();
  closeSheet("sheet-expense");
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

/* ---------- ลิสต์ของที่อยากซื้อ (รายคน) + Tax-free ---------- */
let packView = "pack";
const SHOP_DONE_KEY = "shop-open-";
function renderShopping() {
  const box = $("#shop-view");
  if (!box) return;
  $("#seg-pack").classList.toggle("active", packView === "pack");
  $("#seg-shop").classList.toggle("active", packView === "shop");
  $("#pack-view").hidden = packView !== "pack";
  box.hidden = packView !== "shop";
  migrateShop();
  const nMine = getMe() ? shopList().length : 0;
  $("#seg-shop").innerHTML = `🛍️ ของที่อยากซื้อ${nMine ? ` <span class="seg-n">${nMine}</span>` : ""}`;
  if (packView !== "shop") return;
  const me = getMe();
  const info = destInfo();
  const tf = info.taxFree;
  const cur = tripCur();
  const lineTotal = (x) => num(x.price) * (num(x.qty) || 1);
  const mine = me ? [...shopList()].sort(byCreated) : [];
  const shops = [...new Set(mine.map((x) => (x.shop || "").trim() || "ไม่ระบุร้าน"))];
  const totalTHB = mine.reduce((s, x) => s + toTHB(lineTotal(x), x.currency), 0);
  const boughtTHB = mine.filter((x) => x.bought).reduce((s, x) => s + toTHB(lineTotal(x), x.currency), 0);
  const tfLine = (list) => {
    if (!tf) return "";
    const yen = list.filter((x) => (x.currency || cur) === "JPY").reduce((s, x) => s + lineTotal(x), 0);
    if (!yen) return "";
    const need = Math.ceil(tf.min * 1.1);
    return yen >= need ? `<span class="tf ok">✓ ถึงเกณฑ์ Tax-free (ซื้อวันเดียวกัน)</span>` : `<span class="tf">อีก ¥${(need - yen).toLocaleString()} ถึง Tax-free</span>`;
  };
  box.innerHTML = `
    ${!me ? `<div class="card"><p class="muted">เลือก “ฉันคือใคร?” ก่อน เพื่อจดของที่อยากซื้อของตัวเอง</p><button type="button" class="btn" data-action="pick-me">เลือกชื่อ</button></div>` : `
    <p class="private-note">🔒 ลิสต์นี้เห็นเฉพาะคุณ — เพื่อนในทริปมองไม่เห็น</p>
    <button type="button" class="btn add-btn add-wish-btn" data-action="shop-new">＋ เพิ่มของที่อยากซื้อ</button>
    ${mine.length ? `<div class="card shop-sum">
        <div><span class="muted">รวมทั้งหมด</span><b>${money(totalTHB)}</b>${thbToTrip(totalTHB)}</div>
        <div><span class="muted">ซื้อแล้ว ${mine.filter((x) => x.bought).length}/${mine.length}</span><b>${money(boughtTHB)}</b></div>
        <p class="muted small-note">ของที่ติ๊ก “ซื้อแล้ว” นับเข้า “งบของฉัน” ในแท็บค่าใช้จ่ายให้อัตโนมัติ</p>
      </div>` : `<p class="empty">ยังไม่มีรายการ — จดของฝาก เครื่องสำอาง ของสะสม ไว้ก่อนได้เลย</p>`}
    ${shops.map((shop) => {
      const list = mine.filter((x) => ((x.shop || "").trim() || "ไม่ระบุร้าน") === shop);
      const sub = list.reduce((s, x) => s + toTHB(lineTotal(x), x.currency), 0);
      return `<div class="card shop-card">
        <div class="shop-head"><h3>🏬 ${esc(shop)}</h3><div class="shop-sub">${money(sub)} ${tfLine(list)}</div></div>
        <ul class="checks shop-list">${list.map((x) => `
          <li class="${x.bought ? "is-bought" : ""}"><label><input type="checkbox" data-action="shop-bought" data-id="${esc(x.id)}" ${x.bought ? "checked" : ""}>
            <span class="doc-text"><span class="doc-main">${esc(x.name)}${num(x.qty) > 1 ? ` ×${num(x.qty)}` : ""}</span>
            ${num(x.price) ? `<small class="doc-why">${fmtWithTHB(lineTotal(x), x.currency || cur)}</small>` : ""}
            ${x.note ? `<small class="doc-why">${esc(x.note)}</small>` : ""}</span></label>
            <span class="row-actions"><button type="button" class="icon" data-action="shop-edit" data-id="${esc(x.id)}" title="แก้ไข">✎</button><button type="button" class="icon" data-action="shop-del" data-id="${esc(x.id)}" title="ลบ">✕</button></span></li>`).join("")}</ul>
      </div>`;
    }).join("")}`}
    ${tf ? `<details class="card tf-card" ${mine.length ? "" : "open"}><summary>🧾 Tax-free ญี่ปุ่น (ระบบใหม่ตั้งแต่ ${fmtDate(tf.from, "year")})</summary>
      <ul class="immi-list">${tf.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
      <p class="muted small-note">ที่มา: <a href="${esc(tf.source)}" target="_blank" rel="noopener">${esc(tf.source.replace(/^https?:\/\//, "").split("/")[0])}</a> — เกณฑ์ “ถึง Tax-free” ในหน้านี้คิดจากราคารวมภาษี ¥${Math.ceil(tf.min * 1.1).toLocaleString()} ต่อร้าน</p>
    </details>` : ""}
    `;
}

// เก็บใน private/{uid}.shop[] — เห็นเฉพาะเจ้าของบัญชี
const shopList = () => (Array.isArray(priv.shop) ? priv.shop : []);
const saveShop = (list) => store.setPrivate(trip.id, { shop: list });
async function delShop(id) {
  const x = shopList().find((v) => v.id === id);
  if (!x) return;
  const before = shopList();
  saveShop(before.filter((v) => v.id !== id));
  if (id === editingShopId) closeShopForm();
  toast(`ลบ “${x.name}” แล้ว`, () => saveShop(before));
}
// ย้ายรายการเก่าที่เคยเก็บแบบแชร์ (shopping) มาเป็นส่วนตัว
let shopMigrating = false;
function migrateShop() {
  const me = getMe();
  if (!me || shopMigrating) return;
  const old = (data.shopping || []).filter((x) => x.owner === me);
  if (!old.length) return;
  shopMigrating = true;
  const ids = new Set(shopList().map((x) => x.id));
  const add = old.filter((x) => !ids.has(x.id)).map(({ owner, ...x }) => x);
  saveShop([...shopList(), ...add]);
  old.forEach((x) => store.remove(trip.id, "shopping", x.id));
  setTimeout(() => (shopMigrating = false), 1500);
}
let editingShopId = null;
function openShopForm(x) {
  const form = $("#shop-form");
  form.reset();
  editingShopId = x?.id || null;
  const f = form.elements;
  if (x) ["name", "shop", "price", "qty", "note"].forEach((k) => (f[k].value = x[k] ?? ""));
  f.currency.value = x?.currency || tripCur();
  const dl = $("#shop-names");
  dl.innerHTML = [...new Set(shopList().map((s) => s.shop).filter(Boolean))].map((s) => `<option value="${esc(s)}">`).join("");
  $("#shop-form-title").textContent = x ? "แก้ไขของที่อยากซื้อ" : "เพิ่มของที่อยากซื้อ";
  openSheet("sheet-shop", x ? null : "[name=name]");
}
function closeShopForm() { editingShopId = null; $("#shop-form")?.reset(); closeSheet("sheet-shop"); }

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
  document.querySelector(".me-chip")?.classList.toggle("locked", meLocked() || !!adminGuest());
  const el = $("#me-name");
  if (el) el.textContent = getMe() || (adminGuest() ? "👑 ผู้ดูแล" : "ยังไม่ได้เลือก");
  const av = $("#me-avatar");
  if (av) av.textContent = getMe() ? [...getMe().replace(/^[เแโใไ]/, "")][0] : "?";
}

function setMe(name) {
  if (!name) { closeSheet("sheet-expense"); }
  if (useAccount()) {
    userDoc = { ...userDoc, me: { ...(userDoc.me || {}), [trip.id]: name } };
    store.setUser({ me: { [trip.id]: name } });
  } else lsSet("me-" + trip.id, name);
  updateMeChip();
  syncMeForms();
  renderMoney();
  renderPacking();
  renderShopping();
  renderPrep();
}

function showMePicker() {
  if (!trip || document.querySelector(".me-picker")) return;
  if (meLocked()) { toast(`คุณคือ ${getMe()} — ผูกกับบัญชี ${myEmail()}`); return; }
  if (adminGuest()) { toast("👑 ดูในฐานะผู้ดูแล — คุณไม่ได้อยู่ในรายชื่อทริปนี้"); return; }
  const me = getMe();
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop me-picker";
  wrap.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="mp-title">
      <button type="button" class="m-close" data-close="1" aria-label="ปิด" title="ปิด">✕</button>
      <div class="m-icon" aria-hidden="true">👋</div>
      <h3 id="mp-title">ฉันคือใคร?</h3>
      <p class="muted">เลือกชื่อตัวเองในทริป “${esc(trip.name)}” เพื่อจ่ายเงิน จัดของ และติ๊กเช็กลิสต์ในชื่อของคุณ</p>
      <div class="me-options">
        ${members().map((m) => `<button type="button" class="me-option ${m === me ? "active" : ""}" data-m="${esc(m)}">${esc(m)}</button>`).join("")}
      </div>
      <button type="button" class="btn me-skip" data-skip="1">ดูอย่างเดียว ยังไม่เลือก</button>
      <p class="muted small-note">เปลี่ยนทีหลังได้ที่ปุ่ม “ฉันคือ” ด้านบน · ${useAccount() ? "จำไว้ในบัญชีของคุณ ใช้ได้ทุกเครื่อง" : "เว็บจะจำไว้ในเครื่องนี้"}</p>
    </div>`;
  document.body.appendChild(wrap);
  const close = () => { document.removeEventListener("keydown", onKey); wrap.remove(); };
  const onKey = (e) => { if (e.key === "Escape") { if (!getMe()) lsSet("me-skip-" + trip.id, "1"); close(); } };
  document.addEventListener("keydown", onKey);
  wrap.addEventListener("click", (e) => {
    const opt = e.target.closest("[data-m]");
    if (opt) { setMe(opt.dataset.m); close(); toast(`สวัสดี ${opt.dataset.m} 👋`); return; }
    // ✕ = ปิดเฉยๆ (คงชื่อเดิม) / "ดูอย่างเดียว" = ล้างชื่อที่เลือกไว้
    if (e.target.closest("[data-close]")) { if (!getMe()) lsSet("me-skip-" + trip.id, "1"); close(); return; }
    if (e.target.closest("[data-skip]")) {
      lsSet("me-skip-" + trip.id, "1");
      const had = getMe();
      if (had) { setMe(""); toast("ดูอย่างเดียว — ยังไม่ได้เลือกว่าเป็นใคร"); }
      close();
    }
  });
  wrap.querySelector(".me-option")?.focus();
}

/* ============================================================
   แก้ไขทริป (หน้าแยก)
   ============================================================ */
function openTripEdit(id) {
  app.innerHTML = skelTrip();
  let rendered = false;
  unsubs.push(store.listenTrip(id, (t) => {
    if (!t) { app.innerHTML = `<p>ไม่พบทริปนี้ <a href="#/">กลับหน้าแรก</a></p>`; return; }
    if (!canSeeTrip(t)) { app.innerHTML = noAccessHtml(); return; }
    trip = { members: [], ...t };
    if (rendered) return;
    rendered = true;
    const back = `#/trip/${encodeURIComponent(id)}`;
    setTimeout(() => renderEmailFields($("#trip-form")), 0);
    app.innerHTML = `
      <a class="back-btn" href="${back}"><span aria-hidden="true">‹</span> กลับไปที่ทริป</a>
      <h1>แก้ไขทริป</h1>
      ${modeBanner()}
      <form id="trip-form" class="card form">${tripFormFields(trip)}
        <div class="actions"><button class="btn primary">บันทึก</button><a class="btn" href="${back}">ยกเลิก</a></div>
      </form>
      <div class="card backup-card">
        <div class="danger-zone">
          <div><b>💾 สำรองข้อมูลทริป</b><div class="muted">ดาวน์โหลดแพลน การจอง ค่าใช้จ่าย Wishlist ลิสต์ของ ทั้งหมดเป็นไฟล์ .json เก็บไว้ (รวมข้อมูลส่วนตัวของคุณเท่านั้น ไม่รวมของคนอื่น) — กู้คืนได้ที่หน้า “ทริปของเรา”</div></div>
          <button type="button" class="btn" data-action="backup">ดาวน์โหลดไฟล์สำรอง</button>
        </div>
      </div>
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
  if (!w || wishCoords(w) || geoTried.has(w.id) || !navigator.onLine) return;
  if (isLink(w.place) && !placeNameFromLink(w.place)) return; // ลิงก์สั้นอ่านชื่อไม่ได้
  geoTried.add(w.id);
  geoQueue.push({ sub: "wishlist", rec: w, q: placeQuery(w.place) || w.name });
  runGeoQueue();
}
// กิจกรรมในแพลน: หาตำแหน่งเพื่อประมาณเวลาเดินทางระหว่างจุด (หาไม่เจอจะจำไว้ ไม่ค้นซ้ำ)
function queueItemGeocode(x) {
  if (!x || !trip || itemCoords(x) || x.geoFail || geoTried.has(x.id) || !navigator.onLine) return;
  const q = placeQuery(x.place) || (isLink(x.place) ? "" : x.activity);
  if (!q) return;
  geoTried.add(x.id);
  geoQueue.push({ sub: "items", rec: x, q });
  runGeoQueue();
}
async function runGeoQueue() {
  if (geoBusy) return;
  geoBusy = true;
  while (geoQueue.length) {
    const { sub, rec, q } = geoQueue.shift();
    const country = destInfo().nameEn || trip?.country || "";
    const c = (await geocode(`${q}, ${country}`)) || (await geocode(q));
    if (c && trip) store.update(trip.id, sub, rec.id, { lat: c.lat, lng: c.lng });
    else if (trip && sub === "items") store.update(trip.id, "items", rec.id, { geoFail: true });
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
  if (!wishView) wishView = "mine"; // เปิดแท็บ "ของเรา" ก่อนเสมอ
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

/* ---------- เตรียมผ่าน ตม. แบบรายคน (ข้อมูลส่วนตัวเห็นเฉพาะเจ้าของบัญชี) ---------- */
const STATUSES = () => IMMI.statuses || [["employee", "พนักงานบริษัท / รับราชการ"], ["business", "เจ้าของกิจการ"], ["freelance", "ฟรีแลนซ์ / อาชีพอิสระ"], ["student", "นักเรียน / นักศึกษา"], ["none", "ไม่ได้ทำงาน / เกษียณ / แม่บ้าน"]];
const LEVELS = () => IMMI.levels || { required: "ต้องมี", recommended: "แนะนำ", optional: "มีไว้อุ่นใจ" };

const prepItems = () => {
  const i = destInfo();
  return [
    ...(i.beforeFlight || []).map((x) => ({ ...x, group: "ต้องทำก่อนบิน" })),
    ...(i.docs || []).map((x) => ({ ...x, group: "เอกสารที่ต้องพก" })),
    ...((i.docsByStatus || {})[priv.status] || []).map((x) => ({ ...x, group: "เอกสารตามอาชีพของฉัน" })),
  ];
};
const prepDone = (owner, key) => data.prep.some((p) => p.owner === owner && p.key === key && p.done); // ข้อมูลรุ่นเก่า
const myCheck = (key) => (priv.checks && key in priv.checks ? !!priv.checks[key] : prepDone(getMe(), key));

function togglePrep(key, done) {
  if (!getMe()) return;
  store.setPrivate(trip.id, { checks: { [key]: done } });
}

function savePrivateField(el) {
  if (!el.name || !trip) return;
  store.setPrivate(trip.id, { [el.name]: el.value.trim() });
  if (el.name === "status") toast("อัปเดตเอกสารที่ต้องใช้ตามอาชีพแล้ว");
}

const flights = () => data.bookings.filter(isFlight);
const myFlights = (me = getMe()) => flights().filter((b) => paxOf(b).includes(me)).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
const addMonths = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };

// [สถานะ ok|no|unk, หัวข้อ, รายละเอียด]
function readinessChecks() {
  const me = getMe();
  const days = tripDays();
  const info = destInfo();
  const missing = tripNights().filter((d) => !hotelForNight(d).length);
  const mine = myFlights(me);
  const out = mine.some((b) => b.date === trip.startDate);
  const ret = mine.some((b) => b.date === trip.endDate);
  const checks = [
    [out ? "ok" : "no", "ตั๋วเครื่องบินขาไปของฉัน", out ? mine.filter((b) => b.date === trip.startDate).map((b) => b.title).join(", ") : `ยังไม่มีเที่ยวบินวันที่ ${fmtDate(trip.startDate)} ที่ติ๊กชื่อ ${me}`],
    [ret ? "ok" : "no", "ตั๋วเครื่องบินขากลับของฉัน", ret ? mine.filter((b) => b.date === trip.endDate).map((b) => b.title).join(", ") : `ยังไม่มีเที่ยวบินวันที่ ${fmtDate(trip.endDate)} ที่ติ๊กชื่อ ${me} — ตม. มักขอดูตั๋วขากลับ`],
    [missing.length ? "no" : "ok", "ที่พักครบทุกคืน", missing.length ? `ยังขาด ${missing.length} คืน: ${missing.map((d) => fmtDate(d)).join(", ")}` : `ครบ ${tripNights().length} คืน`],
  ];
  if (info.maxStayDays) {
    const ok = days.length <= info.maxStayDays;
    checks.push([ok ? "ok" : "no", `อยู่ไม่เกินที่ได้รับอนุญาต (${info.maxStayDays} วัน)`, `ทริปนี้ ${days.length} วัน${ok ? "" : " — เกินเงื่อนไขฟรีวีซ่า ต้องขอวีซ่า"}`]);
  }
  if (priv.passportExpiry) {
    const need = addMonths(trip.endDate, 6);
    const ok = priv.passportExpiry >= need;
    checks.push([ok ? "ok" : "no", "พาสปอร์ตอายุเหลือ ≥ 6 เดือน", ok ? `หมดอายุ ${fmtDate(priv.passportExpiry, "year")}` : `หมดอายุ ${fmtDate(priv.passportExpiry, "year")} — ควรเหลือถึง ${fmtDate(need, "year")} ต่ออายุก่อนเดินทาง`]);
  } else checks.push(["unk", "พาสปอร์ตอายุเหลือ ≥ 6 เดือน", "ยังไม่ได้กรอกวันหมดอายุในข้อมูลของฉัน"]);
  const req = prepItems().filter((x) => x.level === "required");
  if (req.length) {
    const left = req.filter((x) => !myCheck(x.key));
    checks.push([left.length ? "no" : "ok", "เอกสารที่ “ต้องมี” ครบ", left.length ? `ยังไม่ได้ติ๊ก: ${left.map((x) => x.text.split(" (")[0]).join(", ")}` : `ครบ ${req.length} รายการ`]);
  }
  if (!priv.status) checks.push(["unk", "เลือกอาชีพ/สถานะ", "เลือกในข้อมูลของฉัน เพื่อดูว่าต้องใช้หนังสือรับรองการทำงานหรือเอกสารอื่นไหม"]);
  return checks;
}

function privateFormHtml() {
  const p = priv;
  return `<form id="private-form" class="form" onsubmit="return false">
    <div class="grid">
      <label class="wide">อาชีพ / สถานะ
        <select name="status"><option value="">— เลือก —</option>${STATUSES().map(([v, l]) => `<option value="${v}" ${p.status === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
      <label class="wide">ชื่อ–นามสกุล ตามพาสปอร์ต (อังกฤษ)<input name="fullName" value="${esc(p.fullName || "")}" placeholder="เช่น PHACHARAPORN S." autocomplete="off"></label>
      <label>อาชีพ (อังกฤษ)<input name="occupation" value="${esc(p.occupation || "")}" placeholder="เช่น Medical Technologist"></label>
      <label>ที่ทำงาน / สถานศึกษา (อังกฤษ)<input name="employer" value="${esc(p.employer || "")}" placeholder="เช่น ABC Hospital"></label>
      <label class="wide">วันหมดอายุพาสปอร์ต<input type="date" name="passportExpiry" value="${esc(p.passportExpiry || "")}"></label>
      <label>บริษัทประกันเดินทาง<input name="insurer" value="${esc(p.insurer || "")}" placeholder="เช่น ชื่อบริษัทประกัน"></label>
      <label>เลขกรมธรรม์<input name="policyNo" value="${esc(p.policyNo || "")}" autocomplete="off"></label>
      <label class="wide">เบอร์ฉุกเฉินของประกัน (24 ชม.)<input name="insurerPhone" inputmode="tel" value="${esc(p.insurerPhone || "")}" placeholder="เช่น +66 2 xxx xxxx"></label>
      <label class="wide">ผู้ติดต่อฉุกเฉินที่ไทย (ชื่อ + เบอร์)<input name="emergencyContact" value="${esc(p.emergencyContact || "")}" placeholder="เช่น แม่ 08x-xxx-xxxx"></label>
    </div>
    <p class="muted small-note">${useAccount() ? "🔒 บันทึกอัตโนมัติ — เก็บในบัญชีของคุณ คนอื่นในทริปมองไม่เห็น" : "โหมดทดลอง: เก็บในเครื่องนี้"} · ชื่อ อาชีพ และที่ทำงาน จะใส่ในเอกสารโชว์ ตม. ของคุณ</p>
  </form>`;
}

const telHref = (n) => "tel:" + String(n || "").replace(/[^\d+]/g, "");
// ที่พักคืนนี้ (ก่อน/หลังทริป → คืนแรก)
function hotelNow() {
  const t = todayISO();
  const d = tripDays().includes(t) ? t : trip.startDate;
  return hotelForNight(d)[0] || hotels().find((h) => h.checkOutDate === d) || hotels()[0] || null;
}
function consulateFor() {
  const list = destInfo().consulates || [];
  const hay = `${trip.name} ${trip.country} ${hotels().map((h) => h.address).join(" ")}`.toLowerCase();
  return list.find((c) => (c.match || []).some((m) => hay.includes(m.toLowerCase()))) || list[0] || null;
}
function renderSos() {
  const box = $("#sos-card");
  if (!box) return;
  const info = destInfo();
  const h = hotelNow();
  const c = consulateFor();
  const th = IMMI.thaiHotline;
  const me = getMe();
  const row = (label, num, note = "") => `<li><div><b>${esc(label)}</b>${note ? `<small>${esc(note)}</small>` : ""}</div><a class="tel-btn" href="${telHref(num)}">📞 ${esc(num)}</a></li>`;
  box.innerHTML = `
    <h3>🆘 ฉุกเฉิน & ที่พัก</h3>
    <p class="muted small-note sos-sub">ใช้ได้ตอนออฟไลน์ (ถ้าเคยเปิดหน้านี้ตอนมีเน็ต)</p>
    ${h ? `<div class="sos-hotel">
        <div class="sh-label">🏨 ที่พัก${tripDays().includes(todayISO()) ? "คืนนี้" : "คืนแรก"}</div>
        <div class="sh-name">${esc(h.title)}</div>
        ${h.addressLocal ? `<div class="sh-local">${esc(h.addressLocal)}</div>` : ""}
        ${h.address ? `<div class="sh-en">${esc(h.address)}</div>` : `<div class="warn-soft small-note">ยังไม่มีที่อยู่ — เพิ่มในแท็บการจอง</div>`}
        <div class="sh-btns">
          <button type="button" class="btn small primary" data-action="taxi-card" data-id="${esc(h.id)}">🚕 แสดงให้คนขับแท็กซี่</button>
          ${h.phone ? `<a class="btn small" href="${telHref(h.phone)}">📞 โทรหาโรงแรม</a>` : ""}
          <a class="btn small" href="${esc(mapUrl(h.address || h.place || h.title))}" target="_blank" rel="noopener">📍 แผนที่</a>
        </div>
        ${!h.addressLocal && destOf() !== "OTHER" ? `<p class="muted small-note">เพิ่ม “ที่อยู่ภาษาท้องถิ่น” ในการจองที่พัก คนขับแท็กซี่จะอ่านง่ายกว่าภาษาอังกฤษ</p>` : ""}
      </div>` : `<p class="muted">ยังไม่มีที่พัก — เพิ่มในแท็บการจอง</p>`}
    ${info.emergency?.length ? `<h4>เบอร์ฉุกเฉิน${esc(info.name ? " · " + info.name : "")}</h4><ul class="tel-list">${info.emergency.map((x) => row(x.label, x.number, x.note)).join("")}</ul>` : ""}
    ${c || th ? `<h4>สถานทูต / กงสุลไทย</h4><ul class="tel-list">
      ${c ? row(c.name, c.phone, `${c.address} · ${c.hours || ""}`) : ""}
      ${th ? row(th.label, th.number, th.note) : ""}</ul>` : ""}
    <h4>ประกันและผู้ติดต่อของฉัน <span class="lock-note">🔒 เห็นเฉพาะคุณ</span></h4>
    ${!me ? `<p class="muted small-note">เลือก “ฉันคือใคร?” ก่อน</p>` : priv.insurer || priv.insurerPhone || priv.emergencyContact ? `<ul class="tel-list">
      ${priv.insurer || priv.insurerPhone ? `<li><div><b>${esc(priv.insurer || "ประกันเดินทาง")}</b>${priv.policyNo ? `<small>เลขกรมธรรม์ ${esc(priv.policyNo)}</small>` : ""}</div>${priv.insurerPhone ? `<a class="tel-btn" href="${telHref(priv.insurerPhone)}">📞 ${esc(priv.insurerPhone)}</a>` : ""}</li>` : ""}
      ${priv.emergencyContact ? `<li><div><b>ผู้ติดต่อที่ไทย</b><small>${esc(priv.emergencyContact)}</small></div></li>` : ""}</ul>`
      : `<p class="muted small-note">ใส่ข้อมูลประกันใน “ข้อมูลของฉัน” ด้านล่าง</p>`}`;
}
function showTaxiCard(id) {
  const h = data.bookings.find((b) => b.id === id);
  if (!h) return;
  const wrap = document.createElement("div");
  wrap.className = "taxi-full";
  wrap.innerHTML = `<button type="button" class="m-close" aria-label="ปิด">✕</button>
    <div class="tx-in">
      <div class="tx-hint">${destOf() === "JP" ? "このホテルまでお願いします" : "Please take me to this hotel"}</div>
      <div class="tx-name">${esc(h.title)}</div>
      ${h.addressLocal ? `<div class="tx-local">${esc(h.addressLocal)}</div>` : ""}
      ${h.address ? `<div class="tx-en">${esc(h.address)}</div>` : ""}
      ${h.phone ? `<div class="tx-en">TEL ${esc(h.phone)}</div>` : ""}
    </div>`;
  document.body.appendChild(wrap);
  const close = () => { wrap.remove(); removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  addEventListener("keydown", onKey);
  wrap.addEventListener("click", close);
}

/* การ์ดในแท็บเตรียมตัว/ตม. หุบ–กางได้ (จำไว้ในเครื่อง) */
const CK_KEY = "prep-collapsed";
const ckGet = () => { try { return new Set(JSON.parse(lsGet(CK_KEY)) || []); } catch { return new Set(); } };
function applyCollapse() {
  const set = ckGet();
  app.querySelectorAll('[data-panel="prep"] .ck').forEach((c) => {
    const on = set.has(c.dataset.ck);
    c.classList.toggle("collapsed", on);
    const h = c.firstElementChild;
    if (h) { h.setAttribute("role", "button"); h.tabIndex = 0; h.setAttribute("aria-expanded", String(!on)); }
  });
}
function toggleCollapse(card) {
  const set = ckGet();
  const k = card.dataset.ck;
  set.has(k) ? set.delete(k) : set.add(k);
  lsSet(CK_KEY, JSON.stringify([...set]));
  applyCollapse();
}

function renderPrep() {
  renderPrepInner();
  applyCollapse();
}
function renderPrepInner() {
  renderSos();
  const el = $("#prep-info");
  if (!el) return;
  const info = destInfo();
  const [riskLabel, riskCls] = RISK[info.risk] || RISK.unknown;
  const list = (arr) => (arr?.length ? `<ul class="immi-list">${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");
  el.innerHTML = `
    <div class="card immi-card ck" data-ck="immi">
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
      ${info.upcoming?.length ? `<h4>กำลังจะเปลี่ยน</h4>${list(info.upcoming)}` : ""}
      ${info.tips?.length ? `<h4>เคล็ดลับตอนเจอ ตม.</h4>${list(info.tips)}` : ""}
      ${info.sources?.length ? `<details class="sources"><summary>แหล่งข้อมูล (${info.sources.length})</summary><ul>${info.sources.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a></li>`).join("")}</ul></details>` : ""}
    </div>`;

  const me = getMe();
  const need = `<p class="muted">ข้อมูลส่วนนี้แยกรายคน — เลือกก่อนว่าคุณคือใคร</p><button type="button" class="btn" data-action="pick-me">เลือกชื่อ</button>`;
  const pv = $("#prep-private");
  if (!me) { pv.innerHTML = need; $("#prep-ready").innerHTML = ""; $("#prep-mine").innerHTML = ""; $("#prep-count").textContent = ""; return; }
  // ไม่วาดฟอร์มใหม่ตอนกำลังพิมพ์
  if (!pv.contains(document.activeElement) || !pv.querySelector("#private-form")) pv.innerHTML = privateFormHtml();
  $("#prep-who").textContent = `· ${me}`;

  const icon = { ok: "✓", no: "!", unk: "?" };
  $("#prep-ready").innerHTML = `
    <ul class="ready-list">${readinessChecks().map(([st, title, detail]) => `
      <li class="${st}"><span class="r-icon">${icon[st]}</span><div><b>${esc(title)}</b><div class="muted">${esc(detail)}</div></div></li>`).join("")}</ul>
    <div class="ready-actions">
      <button type="button" class="btn primary" data-action="immi-pdf">🖨️ เอกสารโชว์ ตม. ของ ${esc(me)} (PDF อังกฤษ)</button>
      <button type="button" class="btn" data-action="tab" data-tab="bookings">ไปที่การจอง</button>
    </div>
    <p class="muted small-note">เอกสารมีชื่อ อาชีพ ไฟลท์ของคุณ ที่พักทุกคืน และแพลนรายวัน เป็นภาษาอังกฤษ ปริ้นต์หรือเก็บในมือถือไว้ยื่นเวลา ตม. ถาม</p>`;

  const items = prepItems();
  const lv = LEVELS();
  const groups = [...new Set(items.map((x) => x.group))];
  $("#prep-mine").innerHTML = (priv.status ? "" : `<p class="warn-soft small-note">เลือก “อาชีพ / สถานะ” ด้านบน เพื่อดูว่าต้องใช้หนังสือรับรองการทำงานหรือเอกสารอื่นเพิ่มไหม</p>`) +
    groups.map((g) => `
      <h4>${esc(g)}</h4>
      <ul class="checks doc-checks">${items.filter((x) => x.group === g).map((x) => `
        <li><label><input type="checkbox" data-action="prep-toggle" data-key="${esc(x.key)}" ${myCheck(x.key) ? "checked" : ""}>
          <span class="doc-text"><span class="doc-main">${x.level ? `<span class="lvl lvl-${x.level}">${esc(lv[x.level] || x.level)}</span> ` : ""}${esc(x.text)}${x.when ? ` <span class="badge">${esc(x.when)}</span>` : ""}</span>
            ${x.why ? `<small class="doc-why">${esc(x.why)}</small>` : ""}
            ${x.link ? `<a class="doc-link" href="${esc(x.link)}" target="_blank" rel="noopener">${esc(x.link.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</a>` : ""}</span></label></li>`).join("")}</ul>`).join("") +
    `<p class="muted small-note">ระดับ: <b>ต้องมี</b> = ไม่มีอาจเข้าประเทศไม่ได้ · <b>แนะนำ</b> = ควรเตรียม · <b>มีไว้อุ่นใจ</b> = ไม่บังคับ ใช้ตอนถูกเรียกสอบถาม</p>`;
  $("#prep-count").textContent = `(${items.filter((x) => myCheck(x.key)).length}/${items.length})`;
}

/* เอกสารโชว์ ตม. (ภาษาอังกฤษ) — ของคนที่เลือก "ฉันคือใคร" */
const enDate = (iso, wd = true) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-GB", wd ? { weekday: "short", day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short", year: "numeric" }) : "");

function buildImmiPrintView() {
  const t = trip;
  const me = getMe();
  const days = tripDays();
  const table = (head, rows, cls = "") => `<table class="${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
  const fl = myFlights(me);
  const hs = hotels();
  const others = data.bookings.filter((b) => !isFlight(b) && !isHotel(b));
  const comp = members().filter((m) => m !== me);
  $("#print-view").innerHTML = `
    <h1>Travel Itinerary</h1>
    <table class="kv"><tbody>
      <tr><th>Traveler</th><td>${esc(priv.fullName || me)}</td></tr>
      <tr><th>Nationality</th><td>Thai</td></tr>
      ${priv.occupation || priv.employer ? `<tr><th>Occupation</th><td>${esc([priv.occupation, priv.employer].filter(Boolean).join(", "))}</td></tr>` : ""}
      <tr><th>Purpose of visit</th><td>Tourism</td></tr>
      <tr><th>Destination</th><td>${esc(destInfo().nameEn || t.country || "")}</td></tr>
      <tr><th>Travel period</th><td>${enDate(t.startDate)} – ${enDate(t.endDate)} (${days.length} days, ${tripNights().length} nights)</td></tr>
      ${comp.length ? `<tr><th>Travelling with</th><td>${comp.length} friend${comp.length > 1 ? "s" : ""}</td></tr>` : ""}
    </tbody></table>
    <h2>Flights</h2>
    ${fl.length ? table(["Date", "Flight / Route", "Time", "Booking ref."], fl.map((b) => `<tr><td>${enDate(b.date)}</td><td>${esc(b.title)}</td><td>${esc(b.time || "")}</td><td>${esc(refOf(b, me))}</td></tr>`), "c-flight") : "<p>—</p>"}
    <h2>Accommodation</h2>
    ${hs.length ? table(["Hotel", "Address", "Check-in", "Check-out", "Nights", "Booking ref."], hs.map((h) => `<tr><td>${esc(h.title)}</td><td>${esc(h.address || placeQuery(h.place) || "")}</td><td>${enDate(h.date, false)} ${esc(h.time || "")}</td><td>${enDate(h.checkOutDate, false)} ${esc(h.checkOutTime || "")}</td><td>${nightsOf(h)}</td><td>${esc(h.ref || "")}</td></tr>`), "c-hotel") : "<p>—</p>"}
    ${others.length ? `<h2>Other reservations</h2>${table(["Date", "Details", "Booking ref."], others.map((b) => `<tr><td>${enDate(b.date)}</td><td>${esc(b.title)}</td><td>${esc(b.ref || "")}</td></tr>`), "c-other")}` : ""}
    <h2>Daily plan</h2>
    ${table(["Day", "Date", "Stay", "Plan"], days.map((d, i) => {
      const acts = sortItems(data.items.filter((x) => x.date === d && x.status !== "cancel")).map((x) => `${x.time ? esc(x.time) + " " : ""}${esc(x.activity)}`);
      const stay = hotelForNight(d).map((h) => esc(h.title)).join(", ");
      return `<tr><td>${i + 1}</td><td>${enDate(d)}</td><td>${stay || (i === days.length - 1 ? "Return home" : "")}</td><td>${acts.join("<br>") || "Sightseeing"}</td></tr>`;
    }), "c-days")}
    <p class="p-foot">Prepared for immigration inspection · ${enDate(todayISO(), false)}</p>`;
}

/* ---------- Export PDF ---------- */
function buildPrintView() {
  const t = trip;
  const days = tripDays();
  const table = (head, rows, cls = "") => `<table class="${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
  $("#print-view").innerHTML = `
    <h1>${esc(t.name)}</h1>
    <p>${esc(t.country)} · ${fmtDate(t.startDate, "year")} – ${fmtDate(t.endDate, "year")} · ผู้ร่วมทริป: ${members().map(esc).join(", ")}</p>
    <h2>แพลนรายวัน</h2>
    ${days.map((d, i) => {
      const list = sortItems(data.items.filter((x) => x.date === d && x.status !== "cancel"));
      const ph = [
        ...hotels().filter((h) => h.checkOutDate === d).map((h) => `เช็คเอาท์ ${esc(h.title)} ${esc(h.checkOutTime || "")}`),
        ...hotelForNight(d).map((h) => (h.date === d ? `เช็คอิน ${esc(h.title)} ${esc(h.time || "")}` : `พักที่ ${esc(h.title)}`)),
      ];
      return `<div class="p-day"><h3>วันที่ ${i + 1} · ${fmtDate(d, "long")}</h3>${ph.length ? `<p class="p-hotel">${ph.join(" · ")}</p>` : ""}${list.length
        ? table(["เวลา", "กิจกรรม", "สถานที่", "เวลาเปิด–ปิด", "การเดินทางมาที่นี่", "หมายเหตุ"],
            list.map((x) => {
              const legs = legsOf(x);
              const travel = legs.length
                ? legs.map((l) => esc(legText(l))).join("<br>→ ") + (legsMinutes(x) ? `<br><b>รวม ${fmtDur(legsMinutes(x))}</b>` : "")
                : esc(x.transport);
              const bk = x.bookingId && data.bookings.find((b) => b.id === x.bookingId);
              const warns = hoursWarnings(x);
              return `<tr><td>${esc(x.time) || "-"}${x.prevNight && x.time ? "<br><small>(คืนก่อน)</small>" : ""}${num(x.stay) ? `<br><small>${fmtDur(num(x.stay))}</small>` : ""}</td>
                <td>${esc(x.activity)}${warns.length ? `<br><b>⚠️ ${warns.map(esc).join(", ")}</b>` : ""}${bk ? `<br>${esc(bk.title)}${refsText(bk) ? ` (${esc(refsText(bk))})` : ""}` : ""}</td>
                <td>${esc(placeLabel(x.place, x.activity))}</td><td>${esc(hoursText(x))}</td><td>${travel}</td>
                <td>${esc(x.note)}</td></tr>`;
            }), "c-plan")
        : "<p>—</p>"}</div>`;
    }).join("")}
    <h2>การจอง</h2>
    ${data.bookings.length ? table(["ประเภท", "รายละเอียด", "วันที่/เวลา", "เลขการจอง", "สถานที่", "หมายเหตุ"],
      [...data.bookings].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
        .map((b) => `<tr><td>${esc(b.type)}</td><td>${esc(b.title)}${isFlight(b) ? `<br><small>ผู้โดยสาร: ${paxOf(b).map(esc).join(", ")}</small>` : ""}</td><td>${isHotel(b) ? `เช็คอิน ${fmtDate(b.date)} ${esc(b.time)}<br>เช็คเอาท์ ${fmtDate(b.checkOutDate)} ${esc(b.checkOutTime)} (${nightsOf(b)} คืน)` : `${fmtDate(b.date)} ${esc(b.time)}`}</td><td>${esc(refsText(b))}</td><td>${esc(isHotel(b) ? b.address || placeLabel(b.place, b.title) : placeLabel(b.place, ""))}</td><td>${esc(b.note)}</td></tr>`), "c-book") : "<p>—</p>"}
    <h2>งบและค่าใช้จ่าย</h2>
    ${isForeign() && rateOf(tripCur()) ? `<p>อัตราแลกเปลี่ยน: 1 ${tripCur()} = ${num(trip.rate).toFixed(4)} บาท — ${esc(rateRefText())}</p>` : ""}
    ${data.expenses.length ? table(["รายการ", "จำนวน", "จ่ายโดย", "วันที่", "โอนคืนแล้ว"],
      [...data.expenses].sort(byCreated).map((e) => `<tr><td>${esc(e.title)}</td><td>${fmtWithTHB(e.amount, e.currency)}</td><td>${esc(e.paidBy)}</td><td>${e.date ? fmtDate(e.date) : ""}</td><td>${members().filter((m) => m !== e.paidBy && isSettled(e, m)).map(esc).join(", ") || "-"}</td></tr>`), "c-exp") : ""}
    ${settleHtml(true)}
    <h2>Wishlist</h2>
    ${data.wishlist.length ? `<ul>${[...data.wishlist].sort((a, b) => num(b.priority || 2) - num(a.priority || 2)).map((w) => { const ds = wishPlanDates(w); return `<li>${"★".repeat(num(w.priority) || 2)} [${esc(w.category)}] ${esc(w.name)}${w.mustTry ? " · ต้องลอง: " + esc(w.mustTry) : ""} — ${{ done: "ไปแล้ว", cancel: "ยกเลิก" }[wishVisit(w)] || (ds.length ? "อยู่ในแพลน " + ds.map((d) => fmtDate(d)).join(", ") : "ยังไม่ใส่แพลน")}</li>`; }).join("")}</ul>` : "<p>—</p>"}
    <h2>ของที่ต้องเตรียม</h2>
    ${members().map((m) => { const st = packStats(m); return `<h3>${esc(m)} (${st.done}/${st.total})</h3>${st.total ? `<ul>${st.list.map((p) => `<li>${p.done ? "☑" : "☐"} ${esc(p.name)}</li>`).join("")}</ul>` : "<p>—</p>"}`; }).join("")}
    <h2>เช็กลิสต์ก่อนเดินทาง</h2>
    <ul>${[...data.checklist].sort(byCreated).map((c) => `<li>${c.done ? "☑" : "☐"} ${esc(c.text)}</li>`).join("")}</ul>`;
}

/* ปุ่มเลื่อนขึ้นบนสุด: โผล่เมื่อเลื่อนลงไปไกล เล็กๆ มุมขวาล่าง */
function setupToTop() {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "to-top";
  b.setAttribute("aria-label", "เลื่อนขึ้นบนสุด");
  b.title = "ขึ้นบนสุด";
  b.textContent = "↑";
  b.hidden = true;
  b.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
  document.body.appendChild(b);
  const upd = () => { b.hidden = scrollY < 600; };
  addEventListener("scroll", upd, { passive: true });
  addEventListener("hashchange", () => setTimeout(upd, 50));
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
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, "Sukhumvit Set", Thonburi, "Leelawadee UI", "Noto Sans Thai", Tahoma, sans-serif; color: #222; font-size: 11pt; line-height: 1.45; background: #fff; }
  main { padding: 16px; width: 100%; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 18pt; margin: 0 0 6px; }
  h2 { font-size: 13.5pt; border-bottom: 2px solid #F5AFAF; padding-bottom: 2px; margin: 18px 0 8px; }
  h3 { font-size: 11.5pt; margin: 10px 0 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 6px; table-layout: fixed; }
  th, td { text-align: left; vertical-align: top; padding: 4px 6px; border: 1px solid #ccc; overflow-wrap: anywhere; word-break: break-word; }
  th { background: #FBEFEF; }
  /* ความกว้างคอลัมน์คงที่ → ตารางไม่เพี้ยนบนมือถือ */
  .c-plan th:nth-child(1) { width: 9%; } .c-plan th:nth-child(2) { width: 21%; } .c-plan th:nth-child(3) { width: 18%; }
  .c-plan th:nth-child(4) { width: 14%; } .c-plan th:nth-child(5) { width: 22%; } .c-plan th:nth-child(6) { width: 16%; }
  .c-book th:nth-child(1) { width: 11%; } .c-book th:nth-child(2) { width: 25%; } .c-book th:nth-child(3) { width: 20%; }
  .c-book th:nth-child(4) { width: 12%; } .c-book th:nth-child(5) { width: 18%; } .c-book th:nth-child(6) { width: 14%; }
  .c-exp th:nth-child(1) { width: 30%; } .c-exp th:nth-child(2) { width: 22%; } .c-exp th:nth-child(3) { width: 13%; } .c-exp th:nth-child(4) { width: 13%; }
  .c-flight th:nth-child(1) { width: 24%; } .c-flight th:nth-child(2) { width: 40%; } .c-flight th:nth-child(3) { width: 12%; }
  .c-hotel th:nth-child(1) { width: 20%; } .c-hotel th:nth-child(2) { width: 28%; } .c-hotel th:nth-child(3), .c-hotel th:nth-child(4) { width: 15%; } .c-hotel th:nth-child(5) { width: 8%; }
  .c-days th:nth-child(1) { width: 7%; } .c-days th:nth-child(2) { width: 20%; } .c-days th:nth-child(3) { width: 25%; }
  table.kv { table-layout: auto; }
  .tx-list, .tx-items { padding-left: 18px; margin: 4px 0; } .tx-items { font-size: 9.5pt; color: #555; }
  details > summary { list-style: none; } .ok-text { color: #2e8b57; } .warn { color: #c0392b; }
  tr, h3 { break-inside: avoid; page-break-inside: avoid; }
  table.kv th { width: 28%; }
  ul { padding-left: 20px; margin: 4px 0; }
  .num { text-align: right; white-space: nowrap; }
  .muted { color: #777; }
  .p-hotel { margin: 2px 0 6px; font-size: 10pt; }
  .p-foot { margin-top: 18px; font-size: 9pt; color: #777; }
  .bar { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #ddd; padding: 10px 16px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: 10.5pt; }
  .bar button { font: inherit; font-weight: 700; background: #F5AFAF; color: #3D1F24; border: 0; border-radius: 10px; padding: 10px 16px; }
  @media print { .bar { display: none; } main { padding: 0; } }
`;

function stripEmoji(html) {
  return html.replace(/☑/g, "✓").replace(/☐/g, "○")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, (ch) => (ch === "✓" || ch === "★" ? ch : ""));
}

// แปลง CSS ของหน้าพิมพ์ให้ใช้เฉพาะในกล่อง .pdf-doc (ไม่กระทบหน้าแอป)
function scopeCss(css, scope) {
  let out = "", i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open < 0) break;
    const sel = css.slice(i, open).trim();
    if (sel.startsWith("@media")) {
      let depth = 1, j = open + 1;
      while (j < css.length && depth) { if (css[j] === "{") depth++; else if (css[j] === "}") depth--; j++; }
      out += `${sel} { ${scopeCss(css.slice(open + 1, j - 1), scope)} }\n`;
      i = j;
      continue;
    }
    const close = css.indexOf("}", open);
    const body = css.slice(open + 1, close);
    if (sel.startsWith("@")) out += `${sel} {${body}}\n`;
    else out += sel.split(",").map((s) => { s = s.trim(); return s === "body" || s === "main" || s === "*" ? scope : `${scope} ${s}`; }).join(", ") + ` {${body}}\n`;
    i = close + 1;
  }
  return out;
}
function showPdfOverlay(title, body) {
  document.getElementById("pdf-overlay")?.remove();
  const ov = document.createElement("div");
  ov.id = "pdf-overlay";
  ov.innerHTML = `<style>${scopeCss(PRINT_CSS.replace(/@page[^}]*}/, ""), ".pdf-doc")}</style>
    <div class="pdf-bar">
      <button type="button" class="btn small" data-pdf="back">‹ กลับ</button>
      <b class="pdf-title">${esc(title)}</b>
      <button type="button" class="btn small primary" data-pdf="print">บันทึก PDF</button>
    </div>
    <p class="pdf-tip">กด “บันทึก PDF” แล้วเลือก “บันทึกไปยังไฟล์” หรือส่งต่อทาง LINE / อีเมลได้เลย</p>
    <div class="pdf-doc">${body}</div>`;
  document.body.appendChild(ov);
  document.body.classList.add("pdf-mode");
  const oldTitle = document.title;
  document.title = title;
  history.pushState({ pdf: 1 }, "");
  const close = (fromPop) => {
    ov.remove();
    document.body.classList.remove("pdf-mode");
    document.title = oldTitle;
    removeEventListener("popstate", onPop);
    if (!fromPop && history.state?.pdf) history.back();
  };
  const onPop = () => close(true);
  addEventListener("popstate", onPop);
  ov.addEventListener("click", (e) => {
    const a = e.target.closest("[data-pdf]")?.dataset.pdf;
    if (a === "back") close(false);
    else if (a === "print") savePdfFile(title, ov.querySelector(".pdf-doc"), e.target.closest("[data-pdf]"));
  });
}

/* ---------- สร้างไฟล์ PDF ในเครื่อง (ใช้ในแอปที่ติดตั้ง — iPhone สั่งพิมพ์จากแอปไม่ได้) ----------
   html2canvas วาดทีละส่วน → jsPDF จัดหน้า A4 → แชร์/บันทึกไฟล์ (ตัวหนังสือในไฟล์เป็นภาพ อ่านได้ปกติ) */
const loadScript = (src) => new Promise((res, rej) => {
  if (document.querySelector(`script[src="${src}"]`)?.dataset.ok) return res();
  const s = document.createElement("script");
  s.src = src;
  s.onload = () => { s.dataset.ok = "1"; res(); };
  s.onerror = () => { s.remove(); rej(new Error("load " + src)); };
  document.head.appendChild(s);
});
async function savePdfFile(title, doc, btn) {
  if (!doc) return;
  const label = btn?.textContent;
  const busy = (t) => { if (btn) { btn.disabled = !!t; btn.textContent = t || label; } };
  try {
    busy("กำลังสร้าง PDF…");
    await Promise.all([
      window.html2canvas ? 0 : loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"),
      window.jspdf ? 0 : loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"),
    ]);
    // วาดบนกระดาษกว้าง 794px (= A4 ที่ 96 dpi) นอกจอ
    const W = 794;
    const host = document.createElement("div");
    host.className = "pdf-doc pdf-render";
    host.style.cssText = `position:fixed;left:-10000px;top:0;width:${W}px;padding:0;background:#fff`;
    host.innerHTML = doc.innerHTML;
    document.body.appendChild(host);
    await document.fonts?.ready;
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    const M = 10, PW = 210 - M * 2, PH = 297 - M * 2;
    const mmPerPx = PW / W;
    let y = M;
    const blocks = [...host.children];
    for (let i = 0; i < blocks.length; i++) {
      const el = blocks[i];
      const cs = getComputedStyle(el);
      const gapTop = parseFloat(cs.marginTop) || 0, gapBot = parseFloat(cs.marginBottom) || 0;
      const canvas = await window.html2canvas(el, { scale: 2, backgroundColor: "#ffffff", logging: false, windowWidth: W });
      const hPx = canvas.height / 2;
      let hMm = hPx * mmPerPx;
      y += gapTop * mmPerPx;
      // หัวข้อไม่ค้างท้ายหน้า: ถ้าเป็นหัวข้อแล้วที่เหลือน้อย ขึ้นหน้าใหม่
      const isHead = /^H[1-3]$/.test(el.tagName);
      if (y + hMm > M + PH || (isHead && y + hMm + 25 > M + PH)) { if (y > M + 1) { pdf.addPage(); y = M; } }
      if (hMm <= PH) {
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", M, y, PW, hMm);
        y += hMm + gapBot * mmPerPx;
      } else {
        // ส่วนที่ยาวเกิน 1 หน้า (ตารางยาว) → ตัดเป็นช่วงๆ
        const slicePx = Math.floor((PH / mmPerPx) * 2);
        for (let off = 0; off < canvas.height; off += slicePx) {
          const h = Math.min(slicePx, canvas.height - off);
          const c = document.createElement("canvas");
          c.width = canvas.width; c.height = h;
          c.getContext("2d").drawImage(canvas, 0, off, canvas.width, h, 0, 0, canvas.width, h);
          if (off > 0 || y > M + 1) { pdf.addPage(); y = M; }
          const hh = (h / 2) * mmPerPx;
          pdf.addImage(c.toDataURL("image/jpeg", 0.92), "JPEG", M, y, PW, hh);
          y += hh;
        }
        y += gapBot * mmPerPx;
      }
    }
    host.remove();
    // ชื่อไฟล์เป็นภาษาอังกฤษ (บางเครื่องไม่รับชื่อไฟล์ภาษาไทย แล้วตั้งเป็น "download")
    const name = `${title.startsWith("Travel-Itinerary") ? "Travel-Itinerary" : "Trip-Plan"}-${trip?.startDate || todayISO()}.pdf`;
    const blob = pdf.output("blob");
    const file = new File([blob], name, { type: "application/pdf" });
    busy("");
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title }); return; }
      catch (e) { if (e.name === "AbortError") return; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    toast("บันทึก PDF แล้ว");
  } catch (e) {
    console.error(e);
    document.querySelector(".pdf-render")?.remove();
    busy("");
    toast(navigator.onLine ? "สร้าง PDF ไม่สำเร็จ ลองใหม่อีกครั้ง" : "ต้องต่ออินเทอร์เน็ตครั้งแรกเพื่อโหลดตัวสร้าง PDF");
  }
}

function exportPdf(mode) {
  if (mode === "immi") buildImmiPrintView(); else buildPrintView();
  const title = mode === "immi" ? `Travel-Itinerary-${getMe()}-${trip.name}` : `แพลน-${trip.name}`;
  const body = stripEmoji($("#print-view").innerHTML);
  // แอปที่ติดตั้งบนหน้าจอ: เปิดหน้าต่างใหม่แล้วย้อนกลับไม่ได้ → แสดงในแอปแทน มีปุ่มกลับ
  if (isStandalone()) { showPdfOverlay(title, body); return; }
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
    <meta name="viewport" content="width=820"><title>${esc(title)}</title><style>${PRINT_CSS}</style></head>
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
  const ckHead = e.target.closest('[data-panel="prep"] .ck > :first-child');
  if (ckHead && !e.target.closest("a, button, input, select, label, textarea")) { toggleCollapse(ckHead.parentElement); return; }
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
  else if (action === "item-new") newItem();
  else if (action === "hint-x") { hideHint(b.dataset.k); if (b.dataset.k === "install") document.getElementById("install-box")?.remove(); }
  else if (action === "install") { installEvt?.prompt(); installEvt?.userChoice.finally(() => { installEvt = null; document.getElementById("install-box")?.remove(); }); }
  else if (action === "wish-drop-sheet") {
    const w = data.wishlist.find((v) => v.id === editingWishId);
    if (w) { setWishVisit(w.id, w.visit === "cancel" ? "" : "cancel"); closeWishForm(); }
  }
  else if (action === "day-map") { mapOpen = !mapOpen; renderPlan(); }
  else if (action === "item-cancel-sheet") {
    const x = data.items.find((i) => i.id === editingItemId);
    if (x) { setItemStatus(x.id, x.status === "cancel" ? "" : "cancel"); stopEdit(); }
  }
  else if (action === "pack-view") { packView = b.dataset.v; renderShopping(); }
  else if (action === "shop-new") openShopForm(null);
  else if (action === "shop-edit") openShopForm(shopList().find((x) => x.id === id));
  else if (action === "shop-del") delShop(id);
  else if (action === "taxi-card") showTaxiCard(id);
  else if (action === "split-all") { document.querySelectorAll("#expense-form [name=splitWith]").forEach((c) => (c.checked = true)); updateExpensePreview(); }
  else if (action === "budget-del") delMyExp(b.dataset.id);
  else if (action === "book-new") newBooking();
  else if (action === "expense-new") newExpense();
  else if (action === "edit-expense") startEditExpense(id);
  else if (action === "sheet-close") (SHEET_CANCEL[b.dataset.sheet] || (() => closeSheet(b.dataset.sheet)))();
  else if (action === "item-cancel") {
    const x = data.items.find((i) => i.id === id);
    if (x) setItemStatus(id, x.status === "cancel" ? "" : "cancel");
  }
  else if (action === "wish-drop") {
    const w = data.wishlist.find((i) => i.id === id);
    if (w) setWishVisit(id, w.visit === "cancel" ? "" : "cancel");
  }
  else if (action === "use-est") {
    const min = num(b.dataset.min);
    if (readLegs().length) { toast("มีข้อมูลการเดินทางอยู่แล้ว — เพิ่มเป็นอีกแถวให้"); }
    $("#legs").insertAdjacentHTML("beforeend", legRowHtml({ line: b.dataset.mode === "เดิน" ? "เดิน" : "รถไฟ/รถเมล์ (เช็กสายใน Google Maps)", minutes: min }));
  }
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
  else if (action === "to-plan") wishToPlan(id);
  else if (action === "plan-open") { planOpenId = id; renderWishlist(); }
  else if (action === "plan-cancel") { planOpenId = null; renderWishlist(); }
  else if (action === "wish-new") openWishForm(null);
  else if (action === "wish-edit") { openWishForm(data.wishlist.find((w) => w.id === id)); }
  else if (action === "wish-filter") { wishFilter = b.dataset.v; renderWishlist(); }
  else if (action === "wish-cat") { wishCatFilter = b.dataset.v; renderWishlist(); }
  else if (action === "add-sugg") {
    store.add(trip.id, "packing", { owner: getMe(), name: b.dataset.name, done: false, createdAt: Date.now() });
  }
  else if (action === "fetch-rate") {
    document.activeElement?.blur();
    updateRate(trip.id, tripCur());
  }
  else if (action === "pdf") exportPdf();
  else if (action === "immi-pdf") { if (!getMe()) { showMePicker(); return; } exportPdf("immi"); }
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
  else if (action === "backup") downloadBackup();
  else if (action === "forgot") forgotPassword();
}

/* ---------- Pop-up ยืนยัน ---------- */
function confirmDialog({ title, message, okText = "ลบ", requireText = "", icon = "🗑️" }) {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement;
    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop";
    wrap.innerHTML = `
      <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="m-title" aria-describedby="m-msg">
        <div class="m-icon" aria-hidden="true">${icon}</div>
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

const SUB_LABEL = { items: "แพลน", wishlist: "Wishlist", bookings: "การจอง", expenses: "ค่าใช้จ่าย", packing: "ของที่ต้องเตรียม", checklist: "เช็กลิสต์", shopping: "ลิสต์ช้อป" };

// ลบทันที + ปุ่ม "เลิกทำ" 5 วินาที (แทน pop-up ยืนยัน) — การลบทริปยังต้องยืนยันเหมือนเดิม
async function confirmDelete(sub, id) {
  const x = (data[sub] || []).find((r) => r.id === id);
  if (!x) return;
  const name = x.activity || x.name || x.title || x.text || "รายการนี้";
  const { id: _id, ...copy } = x;
  const tripId = trip.id;
  store.remove(tripId, sub, id);
  if (id === editingItemId) stopEdit();
  if (id === editingBookingId) stopEditBooking();
  if (id === editingWishId) closeWishForm();
  if (id === editingExpenseId) stopEditExpense();
  toast(`ลบ “${name}” แล้ว`, () => { store.set(tripId, sub, id, copy); toast("กู้คืนแล้ว"); });
}

/* ---------- สำรอง / กู้คืนข้อมูล ---------- */
async function downloadBackup() {
  try {
    toast("กำลังเตรียมไฟล์…");
    const subs = await store.getAll(trip.id);
    const { id, ...tripData } = trip;
    // ข้อมูลส่วนตัวของฉัน (อ่านครั้งเดียว)
    const mine = await new Promise((res) => { let un = null; let done = false; un = store.listenPrivate(id, (p) => { if (done) return; done = true; res(p || {}); setTimeout(() => un?.(), 0); }); setTimeout(() => { if (!done) { done = true; res({}); } }, 4000); });
    const payload = { app: "trip-planner", version: 1, exportedAt: new Date().toISOString(), tripId: id, trip: tripData, subs, private: Object.keys(mine).length ? mine : undefined };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `backup-${trip.name}-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast("ดาวน์โหลดไฟล์สำรองแล้ว");
  } catch (e) { console.error(e); toast("สำรองไม่สำเร็จ: " + (e.code || e.message)); }
}

async function restoreBackup(file) {
  let j;
  try { j = JSON.parse(await file.text()); } catch { toast("ไฟล์นี้ไม่ใช่ไฟล์สำรองของเว็บ"); return; }
  if (j?.app !== "trip-planner" || !j.trip?.name) { toast("ไฟล์นี้ไม่ใช่ไฟล์สำรองของเว็บ"); return; }
  const n = Object.values(j.subs || {}).reduce((s, l) => s + (l?.length || 0), 0);
  const yes = await confirmDialog({
    title: "กู้คืนทริปจากไฟล์?",
    message: `จะสร้างทริปใหม่ <b>“${esc(j.trip.name)} (กู้คืน)”</b> พร้อมข้อมูล ${n} รายการ<br><small>ทริปเดิม (ถ้ายังอยู่) จะไม่ถูกแก้ไข · สำรองเมื่อ ${esc(new Date(j.exportedAt).toLocaleString("th-TH"))}</small>`,
    okText: "กู้คืน", icon: "💾",
  });
  if (!yes) return;
  const id = store.createTrip({ ...j.trip, name: `${j.trip.name} (กู้คืน)`, createdAt: Date.now() });
  for (const s of SUBS) for (const { id: did, ...d } of j.subs?.[s] || []) store.set(id, s, did, d); // ใช้ id เดิม → ลิงก์ระหว่างแพลน/การจอง/Wishlist ยังอยู่ครบ
  if (j.private && store.setPrivate) store.setPrivate(id, j.private);
  toast("กู้คืนแล้ว");
  location.hash = "#/trip/" + id;
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
  } else if (el.dataset.action === "item-done") {
    setItemStatus(el.dataset.id, el.checked ? "done" : "");
  } else if (el.dataset.action === "wish-done") {
    setWishVisit(el.dataset.id, el.checked ? "done" : "");
  } else if (el.dataset.action === "settle") {
    const e = data.expenses.find((x) => x.id === el.dataset.id);
    if (e) {
      store.update(trip.id, "expenses", e.id, { settled: { ...(e.settled || {}), [el.dataset.m]: el.checked } });
      toast(el.checked ? `✓ ${el.dataset.m} โอนคืน ${e.paidBy} แล้ว (${e.title})` : "ยกเลิกติ๊กแล้ว");
    }
  } else if (el.dataset.action === "shop-bought") {
    saveShop(shopList().map((x) => (x.id === el.dataset.id ? { ...x, bought: el.checked } : x)));
  } else if (el.name === "splitWith") {
    updateExpensePreview();
  } else if (el.id === "budget-input") {
    store.setPrivate(trip.id, { budget: num(el.value) });
    toast(num(el.value) ? `ตั้งงบ ${money(num(el.value))} แล้ว` : "ลบงบแล้ว");
  } else if (el.closest("#item-form") && ["date", "time", "place", "activity"].includes(el.name)) {
    updateLegSuggest();
  } else if (el.closest("#private-form")) {
    savePrivateField(el);
  } else if (el.dataset.action === "prep-toggle") {
    togglePrep(el.dataset.key, el.checked);
  } else if (el.dataset.action === "toggle") {
    store.update(trip.id, el.dataset.sub, el.dataset.id, { done: el.checked });
  } else if (el.id === "restore-file") {
    if (el.files?.[0]) restoreBackup(el.files[0]);
    el.value = "";
  } else if (el.closest("#book-form")) {
    if (el.name === "pax") renderPaxRefs();
    syncBookForm();
  }
}

function onInput(e) {
  const el = e.target;
  if (el.name === "members" && el.form) { renderEmailFields(el.form); return; }
  if (el.id === "conv-input") updateConverter();
  else if (el.closest("#expense-form")) updateExpensePreview();
}

function onSubmit(e) {
  const form = e.target;
  e.preventDefault();
  const f = formData(form);
  const now = Date.now();
  switch (form.id) {
    case "login-form": doLogin(form); return;
    case "create-form": {
      const t = readTripForm(form);
      if (!t) return;
      const id = store.createTrip({
        name: t.name, country: t.country, startDate: t.startDate, endDate: t.endDate,
        members: t.members, currency: t.currency, destCode: t.destCode, createdAt: now,
        ...(t.emails ? { memberEmails: t.memberEmails, emails: t.emails } : {}),
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
        prevNight: !!f.prevNight && !!f.time,
        kind: f.kind || "",
        stay: Math.min(num(f.stayH), 23) * 60 + Math.min(num(f.stayM), 59), cost: num(f.cost), costCurrency: f.costCurrency || "THB", note: f.note.trim(),
        openTime: f.openTime, closeTime: f.closeTime, hoursNote: f.hoursNote.trim(),
        closedDays: new FormData(form).getAll("closed").map(Number),
        legs, transport: "", bookingId: f.bookingId || "",
      };
      if (!rec.activity) return;
      const c = coordsFromLink(rec.place);
      if (editingItemId) {
        const old = data.items.find((i) => i.id === editingItemId);
        if (old && (old.place || "") !== rec.place) { Object.assign(rec, { lat: c?.lat ?? null, lng: c?.lng ?? null, geoFail: false }); geoTried.delete(old.id); }
        store.update(trip.id, "items", editingItemId, rec);
      }
      else store.add(trip.id, "items", { ...rec, ...(c ? { lat: c.lat, lng: c.lng } : {}), createdAt: now });
      stopEdit();
      const i = tripDays().indexOf(rec.date);
      if (i >= 0) { dayIdx = i; renderPlan(); }
      toast("บันทึกแล้ว");
      return;
    }
    case "wish-form": {
      const rec = {
        name: f.name.trim(), category: f.category, place: f.place.trim(), link: f.link.trim(), note: f.note.trim(),
        priority: num(f.priority) || 2, source: f.source.trim(),
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
        addressLocal: hotel ? (f.addressLocal || "").trim() : "",
        phone: hotel ? (f.phone || "").trim() : "",
        lat: null, lng: null, // ให้หาพิกัดใหม่เมื่อแก้ชื่อ/ที่อยู่
      };
      if (f.type === "เที่ยวบิน") {
        rec.passengers = new FormData(form).getAll("pax");
        rec.refs = readPaxRefs();
        rec.ref = "";
        if (!rec.passengers.length) { toast("ติ๊กอย่างน้อย 1 คนที่อยู่ในไฟลท์นี้"); return; }
      }
      if (!rec.title) return;
      if (editingBookingId) { geoTried.delete(editingBookingId); store.update(trip.id, "bookings", editingBookingId, rec); }
      else store.add(trip.id, "bookings", { ...rec, createdAt: now });
      stopEditBooking();
      toast("บันทึกแล้ว");
      return;
    }
    case "expense-form": {
      const rec = { title: f.title.trim(), amount: num(f.amount), currency: f.currency || "THB", paidBy: f.paidBy, date: f.date };
      if (!rec.title || !rec.amount) { toast("ใส่รายการและจำนวนเงิน"); return; }
      rec.splitWith = new FormData(form).getAll("splitWith");
      if (!rec.splitWith.length) { toast("ติ๊กอย่างน้อย 1 คนที่หารรายการนี้"); return; }
      if (rec.splitWith.length === 1 && rec.splitWith[0] === rec.paidBy) { toast("จ่ายเองคนเดียว ไม่ต้องหาร — ใส่ใน “งบของฉัน” แทน"); return; }
      if (editingExpenseId) store.update(trip.id, "expenses", editingExpenseId, rec);
      else store.add(trip.id, "expenses", { ...rec, settled: {}, createdAt: now });
      stopEditExpense();
      toast("บันทึกแล้ว");
      return;
    }
    case "myexp-form": addMyExp(f); return;
    case "shop-form": {
      const rec = { name: f.name.trim(), shop: f.shop.trim(), price: num(f.price), currency: f.currency || tripCur(), qty: Math.max(1, num(f.qty) || 1), note: f.note.trim() };
      if (!rec.name || !getMe()) return;
      if (editingShopId) saveShop(shopList().map((x) => (x.id === editingShopId ? { ...x, ...rec } : x)));
      else saveShop([...shopList(), { ...rec, id: now.toString(36), bought: false, createdAt: now }]);
      closeShopForm();
      toast("บันทึกแล้ว");
      return;
    }
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
    if ((e.key === "Enter" || e.key === " ") && e.target.matches?.('[data-panel="prep"] .ck > :first-child')) { e.preventDefault(); toggleCollapse(e.target.parentElement); return; }
    if (e.key === "Enter" && e.target.classList?.contains("origin-input")) { e.preventDefault(); setCustomOrigin(e.target.value); }
  });
  app.addEventListener("submit", onSubmit);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || document.querySelector(".modal-backdrop")) return;
    const open = [...document.querySelectorAll(".sheet-backdrop:not([hidden])")].at(-1);
    if (open) (SHEET_CANCEL[open.id] || (() => closeSheet(open.id)))();
  });
  window.addEventListener("hashchange", route);
  window.addEventListener("online", updateNet);
  window.addEventListener("offline", updateNet);
  updateNet();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
  document.querySelector(".topbar").addEventListener("click", (e) => { if (e.target.closest("#logout-btn")) logout(); });
  setupToTop();
  if (!useAccount()) { route(); return; }
  // โหมด Firebase: ต้องล็อกอินก่อน
  app.innerHTML = skelTrip();
  let userUnsub = null;
  store.onAuth((u) => {
    currentUser = u;
    userUnsub?.();
    userUnsub = null;
    userDoc = {};
    renderUserBox();
    if (!u) { cleanup(); renderLogin(); return; }
    let first = true;
    userUnsub = store.listenUser(
      (d) => { userDoc = d || {}; if (first) { first = false; route(); } else onUserDocChange(); },
      (e) => {
        if (!first) return;
        first = false;
        cleanup();
        app.innerHTML = `<div class="login-wrap"><div class="card login-card">
          <div class="login-logo" aria-hidden="true">🔒</div><h1>บัญชีนี้ยังไม่ได้รับอนุญาต</h1>
          <p class="muted">${esc(u.email || "")} เข้าสู่ระบบได้ แต่ยังไม่อยู่ในรายชื่อที่ดูทริปได้ — บอกเจ้าของทริปให้เพิ่มอีเมลนี้ใน Rules ของ Firebase</p>
          <p class="muted small-note">(${esc(e.code || e.message)})</p></div></div>`;
      },
    );
  });
}

init();
