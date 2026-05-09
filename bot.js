const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;
const API_URL = "https://adhahi.dz/api/v1/public/wilaya-quotas";

const FILE = "./data.json";

// ================== HEARTBEAT CONTROL ==================
const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 min
const lastHeartbeat = {};

// ================== DB ==================
function load() {
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify({ users: {}, state: {}, snapshot: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(FILE));
}

function save(d) {
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
}

// ================== TELEGRAM ==================
async function send(chatId, text) {
  try {
    await axios.post(`${API}/sendMessage`, {
      chat_id: chatId,
      text
    });
  } catch (e) {
    console.log("send error:", e.message);
  }
}

// ================== NORMALIZE ==================
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ================== API ==================
async function fetchAPI() {
  try {
    const res = await axios.get(API_URL, { timeout: 12000 });
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
}

// ================== CHECK OPEN ==================
function isOpen(w) {
  return (
    w?.available === true ||
    Number(w?.remainingQuota ?? 0) > 0 ||
    Number(w?.remaining ?? 0) > 0
  );
}

// ================== MATCH ==================
function match(apiItem, selected) {
  const a = norm(apiItem?.wilayaNameAr);
  const b = norm(apiItem?.wilayaNameFr);
  const s = norm(selected);

  return a === s || b === s || a.includes(s) || s.includes(a);
}

// ================== MAIN CHECK ==================
async function check() {
  const db = load();
  const api = await fetchAPI();

  if (!api.length) return;

  for (const userId in db.users) {
    const user = db.users[userId];
    const list = user?.wilayas || [];

    for (const wilaya of list) {
      const found = api.find(x => match(x, wilaya));
      if (!found) continue;

      const open = isOpen(found);

      if (!db.state[userId]) db.state[userId] = {};
      if (!db.snapshot[userId]) db.snapshot[userId] = {};

      const prev = db.state[userId][wilaya];
      const snap = db.snapshot[userId][wilaya];

      // skip if no change
      if (snap === open) continue;
      db.snapshot[userId][wilaya] = open;

      // first time
      if (!prev) {
        db.state[userId][wilaya] = open ? "open" : "closed";
        continue;
      }

      // OPEN EVENT
      if (open && prev !== "open") {
        db.state[userId][wilaya] = "open";

        await send(userId, `🚨 فتح التسجيل:\n📍 ${wilaya}`);
      }

      // CLOSE EVENT
      if (!open && prev === "open") {
        db.state[userId][wilaya] = "closed";

        await send(userId, `⛔ إغلاق التسجيل:\n📍 ${wilaya}`);
      }
    }
  }

  save(db);
}

// ================== SAFE HEARTBEAT (NO SPAM) ==================
async function safeHeartbeat() {
  const db = load();
  const now = Date.now();

  for (const userId in db.users) {

    if (
      lastHeartbeat[userId] &&
      now - lastHeartbeat[userId] < HEARTBEAT_INTERVAL
    ) continue;

    try {
      await send(
        userId,
        `🟢 البوت يعمل بشكل طبيعي\n⏰ ${new Date().toLocaleTimeString()}`
      );

      lastHeartbeat[userId] = now;
    } catch (e) {
      console.log("heartbeat error:", e.message);
    }
  }
}

// ================== WATCHDOG ==================
async function watchdog() {
  try {
    await check();
  } catch (e) {
    console.log("WATCHDOG ERROR:", e.message);
  }
}

// ================== LOOP ==================
setInterval(watchdog, 8000);       // فحص سريع
setInterval(safeHeartbeat, 60000); // تشغيل كل دقيقة (لكن الإرسال كل 5 دق)


// ================== KEEP ALIVE ==================
setInterval(async () => {
  try {
    await axios.get("https://botadh.onrender.com");
  } catch {}
}, 60000);

// ================== SERVER ==================
app.get("/", (req, res) => {
  res.send("🚀 ULTRA BOT ACTIVE");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 RUNNING");
});

// ================== SAFETY ==================
process.on("uncaughtException", e => console.log("CRASH:", e.message));
process.on("unhandledRejection", e => console.log("PROMISE:", e?.message));
