const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

// ================== TELEGRAM ==================
const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

// ================== API ==================
const API_URL = "https://adhahi.dz/api/v1/public/wilaya-quotas";

// ================== CONFIG ==================
const CHECK_INTERVAL = 30000; // 30s
const HEARTBEAT_INTERVAL = 300000; // 5 min

// ================== STORAGE ==================
const dataFile = "./data.json";

function loadData() {
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ users: {}, last: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(dataFile));
}

function saveData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

// ================== SEND ==================
async function send(chatId, text, options = {}) {
  try {
    await axios.post(`${API}/sendMessage`, {
      chat_id: chatId,
      text,
      ...options
    });
  } catch (e) {
    console.log("SEND ERROR:", e?.response?.data || e.message);
  }
}

// ================== GET API ==================
async function getWilayaStatus() {
  try {
    const res = await axios.get(API_URL, {
      timeout: 20000
    });

    // API sometimes returns object → normalize
    const data = res.data;

    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;

    return [];
  } catch (e) {
    console.log("API ERROR:", e.message);
    return [];
  }
}

// ================== NORMALIZE NAME ==================
function normalize(str = "") {
  return String(str).trim().replace(/\s+/g, " ");
}

// ================== IS OPEN ==================
function isOpen(w) {
  return (
    w?.available === true ||
    w?.open === true ||
    String(w?.status || "").toLowerCase() === "open" ||
    Number(w?.remainingQuota) > 0 ||
    Number(w?.quota) > 0
  );
}

// ================== CHECK LOOP ==================
async function check() {
  const data = loadData();
  const apiData = await getWilayaStatus();

  if (!apiData.length) return;

  for (const userId in data.users) {
    const user = data.users[userId];
    const selected = user?.wilayas || [];

    for (const wName of selected) {
      const w = apiData.find(x =>
        normalize(x.wilayaNameAr) === normalize(wName)
      );

      if (!w) continue;

      const open = isOpen(w);

      if (!data.last[userId]) data.last[userId] = {};
      if (!data.last[userId][wName]) data.last[userId][wName] = false;

      // ================= OPEN EVENT =================
      if (open && data.last[userId][wName] === false) {
        data.last[userId][wName] = true;

        console.log("OPEN:", wName);

        await send(userId, `🚨 فتح التسجيل:\n${wName}`);
      }

      // ================= CLOSE RESET =================
      if (!open) {
        data.last[userId][wName] = false;
      }
    }
  }

  saveData(data);
}

// ================== HEARTBEAT (EVERY 5 MIN) ==================
async function heartbeat() {
  const data = loadData();

  for (const userId in data.users) {
    const last = data.users[userId].lastHeartbeat || 0;
    const now = Date.now();

    // ⛔ يمنع التكرار
    if (now - last < HEARTBEAT_INTERVAL) continue;

    try {
      await send(userId, `✅ البوت يعمل بشكل طبيعي`);
      data.users[userId].lastHeartbeat = now;
    } catch (e) {}
  }

  saveData(data);
}

// ================== WEBHOOK ==================
app.post("/webhook", async (req, res) => {
  const data = loadData();

  try {
    const update = req.body;

    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text || "";

      if (!data.users[chatId]) {
        data.users[chatId] = { wilayas: [], lastHeartbeat: 0 };
      }

      if (text === "/start") {
        await send(chatId, "👋 مرحبا بك في البوت");
      }

      if (text.startsWith("/add ")) {
        const w = text.replace("/add ", "");
        if (!data.users[chatId].wilayas.includes(w)) {
          data.users[chatId].wilayas.push(w);
        }
        await send(chatId, `✅ تمت إضافة: ${w}`);
      }

      saveData(data);
    }

    res.sendStatus(200);
  } catch (e) {
    console.log("WEBHOOK ERROR:", e.message);
    res.sendStatus(200);
  }
});

// ================== SERVER ==================
app.get("/", (req, res) => res.send("Bot running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("RUNNING:", PORT));

// ================== LOOPS ==================
setInterval(() => check().catch(console.error), CHECK_INTERVAL);
setInterval(() => heartbeat().catch(console.error), HEARTBEAT_INTERVAL);

// ================== SAFETY ==================
process.on("uncaughtException", console.log);
process.on("unhandledRejection", console.log);
