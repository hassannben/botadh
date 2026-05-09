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
function loadData() {
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ users: {}, state: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(dataFile));
}

function saveData(d) {
  fs.writeFileSync(dataFile, JSON.stringify(d, null, 2));
}

// ================== SEND ==================
async function send(chatId, text) {
  try {
    await axios.post(`${API}/sendMessage`, {
      chat_id: chatId,
      text
    });
  } catch (e) {}
}

// ================== NORMALIZE ==================
function norm(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// ================== OPEN CHECK ==================
function isOpen(w) {
  return (
    w?.available === true ||
    Number(w?.remainingQuota) > 0 ||
    Number(w?.remaining) > 0
  );
}

// ================== FETCH API ==================
async function fetchData() {
  try {
    const res = await axios.get(API_URL, { timeout: 15000 });
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
}

// ================== CORE CHECK ==================
async function check() {
  const db = loadData();
  const api = await fetchData();

  if (!api.length) return;

  for (const userId in db.users) {
    const user = db.users[userId];
    const list = user.wilayas || [];

    for (const selected of list) {

      const match = api.find(x =>
        norm(x.wilayaNameAr) === norm(selected) ||
        norm(x.wilayaNameFr) === norm(selected)
      );

      if (!match) continue;

      const open = isOpen(match);

      if (!db.state[userId]) db.state[userId] = {};

      const last = db.state[userId][selected];

      // ================== OPEN EVENT ==================
      if (open && last !== "open") {
        db.state[userId][selected] = "open";

        await send(userId, `🚨 فتح التسجيل:\n${selected}`);
      }

      // ================== CLOSE EVENT ==================
      if (!open && last === "open") {
        db.state[userId][selected] = "closed";

        await send(userId, `⛔ تم غلق التسجيل:\n${selected}`);
      }

      // أول مرة
      if (!last) {
        db.state[userId][selected] = open ? "open" : "closed";
      }
    }
  }

  saveData(db);
}

// ================== HEARTBEAT ==================
async function heartbeat() {
  const db = loadData();

  for (const id in db.users) {
    await send(id, "🟢 البوت يعمل بشكل طبيعي");
  }
}

// ================== LOOP (FAST + SAFE) ==================
setInterval(() => {
  check().catch(console.error);
}, 12000); // 🔥 12 ثانية (أفضل استقرار)

setInterval(() => {
  heartbeat().catch(() => {});
}, 300000);

// ================== SERVER ==================
app.get("/", (req, res) => res.send("BOT RUNNING"));

app.listen(process.env.PORT || 3000, () =>
  console.log("🚀 Bot started")
);
