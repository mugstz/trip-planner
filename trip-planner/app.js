// ===== ตั้งค่า =====
const DATA_URL = "data/trips.json";
const app = document.getElementById("app");
let trips = [];

// ===== ตัวช่วยจัดรูปแบบ =====
const fmtDate = (iso, opts = { day: "numeric", month: "short" }) =>
  new Date(iso + "T00:00:00").toLocaleDateString("th-TH", opts);
const fmtMoney = (n) => (n || 0).toLocaleString("th-TH") + " ฿";
const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ===== โหลดข้อมูล =====
async function load() {
  try {
    const res = await fetch(DATA_URL);
    trips = (await res.json()).trips;
    route();
  } catch (e) {
    app.innerHTML = `<p>โหลดข้อมูลไม่ได้ — ถ้าเปิดไฟล์จากเครื่องตรงๆ ให้ใช้ Live Server หรือขึ้น GitHub Pages ก่อน</p>`;
  }
}

// ===== เปลี่ยนหน้าด้วย # ใน URL =====
function route() {
  const id = location.hash.replace("#/trip/", "");
  const trip = trips.find((t) => t.id === id);
  trip ? renderTrip(trip) : renderList();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);

// ===== หน้า 1: รายการทริป =====
function renderList() {
  app.innerHTML = `
    <h1>ทริปของเรา</h1>
    <div class="trip-grid">
      ${trips.map((t) => `
        <a class="trip-card" href="#/trip/${t.id}">
          <h2>${esc(t.name)}</h2>
          <div class="muted">${esc(t.country)} · ${fmtDate(t.startDate)} – ${fmtDate(t.endDate, { day: "numeric", month: "short", year: "numeric" })}</div>
          <div class="muted">${t.members.length} คน · ${t.days.length} วัน</div>
        </a>`).join("")}
    </div>`;
}

// ===== หน้า 2: รายละเอียดทริป =====
function renderTrip(t, dayIndex = 0) {
  const day = t.days[dayIndex];
  const dayTotal = day.items.reduce((s, i) => s + (i.cost || 0), 0);
  const planTotal = t.days.flatMap((d) => d.items).reduce((s, i) => s + (i.cost || 0), 0);
  const budgetTotal = t.budget.reduce((s, b) => s + (b.amount || 0), 0);

  app.innerHTML = `
    <p><a href="#/">← ทริปทั้งหมด</a></p>
    <h1>${esc(t.name)} <span class="muted">${fmtDate(t.startDate)} – ${fmtDate(t.endDate, { day: "numeric", month: "short", year: "numeric" })}</span></h1>

    <div class="section">
      <h2>ผู้ร่วมทริป</h2>
      <div class="chips">${t.members.map((m) => `<span>${esc(m)}</span>`).join("")}</div>
    </div>

    <div class="section">
      <h2>แพลนรายวัน</h2>
      <div class="tabs">
        ${t.days.map((d, i) => `<button class="${i === dayIndex ? "active" : ""}" data-day="${i}">วันที่ ${i + 1} · ${fmtDate(d.date)}</button>`).join("")}
      </div>
      ${day.title ? `<p><strong>${esc(day.title)}</strong></p>` : ""}
      ${day.items.length ? `
        <div class="table-wrap"><table>
          <thead><tr><th>เวลา</th><th>กิจกรรม</th><th>การเดินทาง</th><th class="num">ค่าใช้จ่าย</th><th>หมายเหตุ</th></tr></thead>
          <tbody>
            ${day.items.map((i) => `<tr><td>${esc(i.time) || "-"}</td><td>${esc(i.activity)}</td><td>${esc(i.transport) || "-"}</td><td class="num">${fmtMoney(i.cost)}</td><td class="muted">${esc(i.note)}</td></tr>`).join("")}
            <tr class="total-row"><td colspan="3">รวมวันนี้</td><td class="num">${fmtMoney(dayTotal)}</td><td></td></tr>
          </tbody>
        </table></div>` : `<p class="muted">ยังไม่มีแพลนวันนี้</p>`}
    </div>

    <div class="section">
      <h2>งบประมาณ</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>หมวด</th><th class="num">งบ</th><th>หมายเหตุ</th></tr></thead>
        <tbody>
          ${t.budget.map((b) => `<tr><td>${esc(b.category)}</td><td class="num">${fmtMoney(b.amount)}</td><td class="muted">${esc(b.note)}</td></tr>`).join("")}
          <tr class="total-row"><td>รวมงบ</td><td class="num">${fmtMoney(budgetTotal)}</td><td></td></tr>
          <tr><td>ค่าใช้จ่ายตามแพลน (ทุกวัน)</td><td class="num">${fmtMoney(planTotal)}</td><td></td></tr>
        </tbody>
      </table></div>
    </div>

    <div class="section checklist">
      <h2>เช็กลิสต์ก่อนเดินทาง</h2>
      ${t.checklist.map((c, i) => `<label><input type="checkbox" data-key="${t.id}-${i}" ${isChecked(t.id, i) ? "checked" : ""}> <span>${esc(c)}</span></label>`).join("")}
    </div>`;

  // คลิกแท็บวัน
  app.querySelectorAll("[data-day]").forEach((b) =>
    b.addEventListener("click", () => renderTrip(t, Number(b.dataset.day))));
  // ติ๊กเช็กลิสต์ (จำไว้ในเบราว์เซอร์นี้)
  app.querySelectorAll("[data-key]").forEach((cb) =>
    cb.addEventListener("change", () => saveCheck(cb.dataset.key, cb.checked)));
}

// ===== เช็กลิสต์: เก็บสถานะติ๊กไว้ใน localStorage =====
function isChecked(id, i) {
  try { return localStorage.getItem(`check-${id}-${i}`) === "1"; } catch { return false; }
}
function saveCheck(key, val) {
  try { localStorage.setItem(`check-${key}`, val ? "1" : "0"); } catch {}
}

load();
