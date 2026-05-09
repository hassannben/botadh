const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;
const API_URL = "https://adhahi.dz/api/v1/public/wilaya-quotas";

const dataFile = "./data.json";

// ================== STORAGE ==================
function load() {
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ users: {}, state: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(dataFile));
}

function save(d) {
  fs.writeFileSync(dataFile, JSON.stringify(d, null, 2));
}

// ================== TELEGRAM ==================
async function send(chatId, text) {
  try {
    await axios.post(`${API}/sendMessage`, {
      chat_id: chatId,
      text
    });
  } catch {}
}

// ================== NORMALIZE (PRO MAX) ==================
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ================== SMART MATCH ==================
function matchWilaya(apiItem, selected) {
  const a = norm(apiItem?.wilayaNameAr);
  const b = norm(apiItem?.wilayaNameFr);
  const s = norm(selected);

  return a === s || b === s || a.includes(s) || s.includes(a);
}

// ================== OPEN DETECTOR ==================
function isOpen(w) {
  return (
    w?.available === true ||
    Number(w?.remainingQuota || 0) > 0 ||
    Number(w?.remaining || 0) > 0
  );
}

// ================== FETCH ==================
async function fetchAPI() {
  try {
    const res = await axios.get(API_URL, { timeout: 12000 });
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
}

// ================== CORE ENGINE (PRO MAX) ==================
let lastSnapshot = {};

async function check() {
  const db = load();
  const api = await fetchAPI();

  if (!api.length) return;

  for (const userId in db.users) {
    const user = db.users[userId];
    const selected = user?.wilayas || [];

    for (const wilaya of selected) {

      const found = api.find(x => matchWilaya(x, wilaya));
      if (!found) continue;

      const open = isOpen(found);

      if (!db.state[userId]) db.state[userId] = {};

      const prev = db.state[userId][wilaya];

      // ================== CHANGE DETECTION ==================
      const key = `${userId}:${wilaya}`;
      const last = lastSnapshot[key];

      if (last === open) continue; // 🔥 يمنع التكرار 100%

      lastSnapshot[key] = open;

      // ================== OPEN ==================
      if (open && prev !== "open") {
        db.state[userId][wilaya] = "open";

        await send(
          userId,
          `🚨 فتح التسجيل الآن:\n📍 ${wilaya}`
        );
      }

      // ================== CLOSE ==================
      if (!open && prev === "open") {
        db.state[userId][wilaya] = "closed";

        await send(
          userId,
          `⛔ تم إغلاق التسجيل:\n📍 ${wilaya}`
        );
      }

      // init state
      if (!prev) {
        db.state[userId][wilaya] = open ? "open" : "closed";
      }
    }
  }

  save(db);
}

// ================== HEART ==================
async function heartbeat() {
  const db = load();

  for (const id in db.users) {
    await send(id, "🟢 البوت شغال (PRO MAX)");
  }
}

// ================== LOOP (FAST + SAFE + STABLE) ==================
setInterval(() => {
  check().catch(console.error);
}, 10000); // 🔥 كل 10 ثواني (سريع جداً)

setInterval(() => {
  heartbeat().catch(() => {});
}, 300000);

// ================== SERVER ==================
app.get("/", (req, res) => res.send("PRO MAX BOT RUNNING"));

app.listen(process.env.PORT || 3000, () =>
  console.log("🚀 PRO MAX ACTIVE")
);
