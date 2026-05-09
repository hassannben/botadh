const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

const API_URL = "https://adhahi.dz/api/v1/public/wilaya-quotas";

const dataFile = "./data.json";

// ================== LOAD ==================
function loadData() {
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ users: {}, last: {} }, null, 2));
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
  } catch (e) {
    console.log("send error:", e.message);
  }
}

// ================== STRONG NORMALIZER ==================
function normalizeName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// ================== OPEN CHECK (FIXED) ==================
function isOpen(w) {
  if (!w) return false;

  if (typeof w.available === "boolean") return w.available;

  if (typeof w.remainingQuota === "number")
    return w.remainingQuota > 0;

  if (typeof w.remaining === "number")
    return w.remaining > 0;

  return false;
}

// ================== FETCH API ==================
async function getAPI() {
  try {
    const res = await axios.get(API_URL, { timeout: 15000 });
    return res.data || [];
  } catch (e) {
    console.log("API error:", e.message);
    return [];
  }
}

// ================== CHECK LOOP (FIXED STRONG) ==================
async function check() {
  const data = loadData();
  const apiData = await getAPI();

  if (!Array.isArray(apiData)) return;

  for (const userId in data.users) {
    const user = data.users[userId];
    const selected = user?.wilayas || [];

    for (const wName of selected) {

      const w = apiData.find(x =>
        normalizeName(x.wilayaNameAr) === normalizeName(wName) ||
        normalizeName(x.wilayaNameFr) === normalizeName(wName)
      );

      if (!w) continue;

      const open = isOpen(w);

      if (!data.last[userId]) data.last[userId] = {};

      if (!data.last[userId][wName]) {
        data.last[userId][wName] = "closed";
      }

      // ================== OPEN EVENT ==================
      if (open && data.last[userId][wName] === "closed") {
        data.last[userId][wName] = "open";

        console.log("OPEN:", wName);

        await send(userId, `🚨 تم فتح التسجيل:\n${wName}`);
      }

      // ================== RESET ==================
      if (!open) {
        data.last[userId][wName] = "closed";
      }
    }
  }

  saveData(data);
}

// ================== HEART ==================
async function heartbeat() {
  const data = loadData();

  for (const userId in data.users) {
    await send(userId, "✅ البوت شغال الآن");
  }
}

// ================== WEBHOOK ==================
app.post("/webhook", async (req, res) => {
  const data = loadData();

  try {
    const update = req.body;

    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text;

      if (!data.users[chatId]) {
        data.users[chatId] = { wilayas: [] };
      }

      if (text === "/start") {
        await send(chatId, "👋 مرحبا بك");
      }

      saveData(data);
    }

    res.sendStatus(200);
  } catch (e) {
    console.log(e.message);
    res.sendStatus(200);
  }
});

// ================== START ==================
app.listen(process.env.PORT || 3000, () =>
  console.log("Bot running")
);

// ================== LOOPS (IMPORTANT FIX) ==================
setInterval(() => {
  check().catch(console.error);
}, 15000); // 🔥 كل 15 ثانية (أفضل)

setInterval(() => {
  heartbeat().catch(() => {});
}, 300000);
