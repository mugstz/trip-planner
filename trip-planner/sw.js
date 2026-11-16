// เก็บไฟล์เว็บไว้ในเครื่อง เพื่อให้เปิดได้ตอนไม่มีเน็ต
const CACHE = "trip-planner-v26";
const SHELL = ["./", "./index.html", "./style.css", "./app.js", "./firebase-config.js", "./data/trips.json", "./data/immigration.json", "./data/places.json", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/apple-touch-icon.png"];
// ตัวเชื่อม Firebase (โหลดเก็บไว้ด้วย เผื่อเปิดแอปครั้งแรกตอนไม่มีเน็ต) — ต้องตรงกับ SDK ใน app.js
const SDK_FILES = ["firebase-app.js", "firebase-firestore.js", "firebase-auth.js"].map((f) => `https://www.gstatic.com/firebasejs/10.12.2/${f}`);
const ALLOWED_HOSTS = ["www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com", "cdnjs.cloudflare.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).then(() => Promise.all(SDK_FILES.map((u) => c.add(u).catch(() => {}))))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// มีเน็ต → โหลดใหม่และเก็บสำรอง / ไม่มีเน็ต → ใช้ของที่เก็บไว้
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin && !ALLOWED_HOSTS.includes(url.hostname)) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        // เก็บเฉพาะที่โหลดสำเร็จ (ไม่เอาหน้า error มาทับไฟล์ดีที่เก็บไว้)
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("./index.html")))
  );
});
