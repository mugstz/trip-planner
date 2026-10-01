// ดึงอัตราแลกเปลี่ยนถัวเฉลี่ยจากธนาคารแห่งประเทศไทย (BOT API)
// รันบน GitHub Actions (เก็บ token เป็น Secret → ไม่หลุดไปบนหน้าเว็บ)
// ผลลัพธ์: trip-planner/data/bot-rates.json  (ค่าเป็น "บาทต่อ 1 หน่วยเงินต่างประเทศ")
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const TOKEN = process.env.BOT_API_TOKEN;
const BASE = process.env.BOT_API_URL || "https://gateway.api.bot.or.th/Stat-ExchangeRate/v2/DAILY_AVG_EXG_RATE/";
const OUT = process.env.OUT_FILE || "trip-planner/data/bot-rates.json";
const CURRENCIES = ["JPY", "KRW", "CNY", "TWD", "HKD", "SGD", "MYR", "VND", "LAK", "USD", "EUR", "GBP", "AUD"];

if (!TOKEN) {
  console.error("ไม่พบ BOT_API_TOKEN — ตั้งค่าใน Settings → Secrets and variables → Actions");
  process.exit(1);
}

// ช่วงวันที่: ย้อนหลัง 14 วัน (ธปท. ประกาศเฉพาะวันทำการ)
const bkk = (d) => new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10);
const end = bkk(new Date());
const start = bkk(new Date(Date.now() - 14 * 864e5));

const toNum = (v) => (v === null || v === undefined || v === "" ? NaN : parseFloat(String(v).replace(/,/g, "")));

// ธปท. บางสกุลประกาศต่อ 100 หรือ 1000 หน่วย เช่น "ญี่ปุ่น : เยน (100 เยน)"
function unitOf(row) {
  const m = `${row.currency_name_eng || ""} ${row.currency_name_th || ""}`.match(/\((\d[\d,]*)\s*[^\d)]*\)/);
  return m ? parseFloat(m[1].replace(/,/g, "")) || 1 : 1;
}

async function fetchCurrency(cur) {
  const url = `${BASE}?start_period=${start}&end_period=${end}&currency=${cur}`;
  const res = await fetch(url, { headers: { Authorization: TOKEN, accept: "application/json" } });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text);
  const rows = json?.result?.data?.data_detail || [];
  const valid = rows.filter((r) => Number.isFinite(toNum(r.mid_rate)) && r.period)
    .sort((a, b) => String(b.period).localeCompare(String(a.period)));
  if (!valid.length) throw new Error(`ไม่มีข้อมูลในช่วง ${start} ถึง ${end}: ${text.slice(0, 300)}`);
  const r = valid[0];
  const unit = unitOf(r);
  const per1 = (v) => (Number.isFinite(toNum(v)) ? +(toNum(v) / unit).toFixed(8) : null);
  return {
    period: r.period,
    mid: per1(r.mid_rate),
    selling: per1(r.selling),
    buying_transfer: per1(r.buying_transfer),
    unit_in_source: unit,
    name_th: r.currency_name_th || "",
  };
}

const rates = {};
const errors = {};
for (const cur of CURRENCIES) {
  try {
    rates[cur] = await fetchCurrency(cur);
    console.log(`✓ ${cur} ${rates[cur].period} mid=${rates[cur].mid}`);
  } catch (e) {
    errors[cur] = String(e.message || e);
    console.warn(`✗ ${cur}: ${errors[cur]}`);
  }
}

if (!Object.keys(rates).length) {
  console.error("ดึงข้อมูลไม่ได้เลยสักสกุล — เช็ก token และ URL ของ API");
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({
  source: "ธนาคารแห่งประเทศไทย",
  dataset: "อัตราแลกเปลี่ยนถัวเฉลี่ยของธนาคารพาณิชย์ในกรุงเทพมหานคร",
  note: "ค่าเป็นบาทต่อ 1 หน่วยเงินต่างประเทศ (แปลงจากหน่วยที่ ธปท. ประกาศแล้ว)",
  fetchedAt: new Date().toISOString(),
  rates,
  errors,
}, null, 2) + "\n");
console.log(`บันทึก ${Object.keys(rates).length} สกุลเงินลง ${OUT}`);
