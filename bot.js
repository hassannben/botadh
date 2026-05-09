const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;
const API_URL = "https://adhahi.dz/api/v1/public/wilaya-quotas";

const DATA_FILE = "./data.json";

// ================== SAFE STORAGE ==================
function loadDB() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify({ users: {}, state: {} }, null, 2));
    }
    return JSON.parse(fs.readFileSync(DATA_FILE));
  } catch {
    return { users: {}, state: {} };
  }
}

function saveDB(db) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  } catch (e) {
    console.log("SAVE ERROR:", e.message);
  }
}

// ================== TELEGRAM ==================
async function send(chatId, text) {
  try {
    await axios.post(`${API}/sendMessage`, {
      chat_id: chatId,
      text
    });
  } catch (e) {
    console.log("Telegram error:", e.message);
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

// ================== RETRY API ==================
async function fetchAPI(retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await axios.get(API_URL, {
        timeout: 12000,
        headers: { Accept: "application/json" }
      });

      if (Array.isArray(res.data)) return res.data;
      return [];
    } catch (e) {
      if (i === retries) {
        console.log("API FAILED");
        return [];
      }
    }
  }
}

// ================== OPEN CHECK ==================
function isOpen(w) {
  return (
    w?.available === true ||
    Number(w?.remainingQuota ?? 0) > 0 ||
    Number(w?.remaining ?? 0) > 0
  );
}

// ================== MATCH ENGINE ==================
function match(apiItem, selected) {
  return (
    norm(apiItem?.wilayaNameAr) === norm(selected) ||
    norm(apiItem?.wilayaNameFr) === norm(selected) ||
    norm(apiItem?.wilayaNameAr).includes(norm(selected)) ||
    norm(selected).includes(norm(apiItem?.wilayaNameAr))
  );
}

// ================== CORE ENGINE ==================
let memoryCache = {}; // يمنع التكرار في runtime

async function check() {
  const db = loadDB();
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

      const prev = db.state[userId][wilaya];

      const cacheKey = `${userId}:${wilaya}`;

      // ================== ANTI DUPLICATE ==================
      if (memoryCache[cacheKey] === open) continue;
      memoryCache[cacheKey] = open;

      // ================== FIRST INIT ==================
      if (!prev) {
        db.state[userId][wilaya] = open ? "open" : "closed";
        continue;
      }

      // ================== OPEN EVENT ==================
      if (open && prev !== "open") {
        db.state[userId][wilaya] = "open";

        await send(
          userId,
          `🚨 فتح التسجيل:\n📍 ${wilaya}`
        );
      }

      // ================== CLOSE EVENT ==================
      if (!open && prev === "open") {
        db.state[userId][wilaya] = "closed";

        await send(
          userId,
          `⛔ تم غلق التسجيل:\n📍 ${wilaya}`
        );
      }
    }
  }

  saveDB(db);
}

// ================== HEARTBEAT ==================
async function heartbeat() {
  const db = loadDB();

  for (const id in db.users) {
    await send(id, "🟢 البوت يعمل بشكل طبيعي");
  }
}

// ================== AUTO RECOVERY LOOP ==================
setInterval(() => {
  check().catch(err => console.log("CHECK ERROR:", err.message));
}, 10000);

// ================== KEEP ALIVE (Render fix) ==================
setInterval(async () => {
  try {
    await axios.get("https://botadh.onrender.com");
  } catch {}
}, 60000);

// ================== SERVER ==================
app.get("/", (req, res) => {
  res.send("🚀 PRO BOT ONLINE");
});

app.listen(process.env.PORT || 3000, () =>
  console.log("🚀 BOT STARTED")
);

// ================== SAFE CRASH HANDLERS ==================
process.on("uncaughtException", err => {
  console.log("CRASH:", err.message);
});

process.on("unhandledRejection", err => {
  console.log("PROMISE ERROR:", err?.message);
});
