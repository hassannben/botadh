const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

// ================== TELEGRAM ==================
const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

// ================== API ==================
const API_URL = "https://adhahi.dz/api/v1/public/wilaya-quotas";

// ================== DOMAIN ==================
const DOMAIN = "https://botadh.onrender.com";

// ================== WILAYAS ==================
const wilayas = [/* نفس قائمتك */];

// ================== STORAGE ==================
const file = "./data.json";

function loadData() {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({ users: {}, last: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(file));
}

function saveData(d) {
  fs.writeFileSync(file, JSON.stringify(d, null, 2));
}

// ================== SEND ==================
async function send(chatId, text, options = {}) {
  try {
    await axios.post(`${API}/sendMessage`, {
      chat_id: chatId,
      text,
      ...options
    });
  } catch (e) {}
}

// ================== MENU ==================
function mainMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📍 اختيار ولاية", callback_data: "choose" }],
        [{ text: "🌍 كل الولايات", callback_data: "all" }],
        [{ text: "📺 البث", callback_data: "tv" }]
      ]
    }
  };
}

// ================== API ==================
async function getWilayaStatus() {
  try {
    const res = await axios.get(API_URL);
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
}

// ================== NORMALIZE (IMPORTANT FIX) ==================
function norm(s = "") {
  return String(s).replace(/\s+/g, " ").trim();
}

// ================== OPEN CHECK ==================
function isOpen(w) {
  return w?.available === true || Number(w?.remainingQuota) > 0;
}

// ================== CHECK LOOP ==================
async function check() {
  const db = loadData();
  const api = await getWilayaStatus();

  for (const userId in db.users) {
    const selected = db.users[userId].wilayas || [];

    for (const name of selected) {

      const w = api.find(x =>
        norm(x.wilayaNameAr) === norm(name)
      );

      if (!w) continue;

      const open = isOpen(w);

      if (!db.last[userId]) db.last[userId] = {};
      if (db.last[userId][name] === undefined) db.last[userId][name] = false;

      if (open && !db.last[userId][name]) {
        db.last[userId][name] = true;
        await send(userId, `🚨 فتح التسجيل:\n${name}`);
      }

      if (!open) {
        db.last[userId][name] = false;
      }
    }
  }

  saveData(db);
}

// ================== HEARTBEAT ==================
async function heartbeat() {
  const db = loadData();

  for (const id in db.users) {
    if (!db.users[id].lastHB) db.users[id].lastHB = 0;

    const now = Date.now();
    if (now - db.users[id].lastHB < 300000) continue;

    await send(id, "✅ البوت يعمل");
    db.users[id].lastHB = now;
  }

  saveData(db);
}

// ================== WEBHOOK (FIXED) ==================
app.post("/webhook", async (req, res) => {
  const db = loadData();
  const u = req.body;

  try {

    // ================= MESSAGE =================
    if (u.message) {
      const chatId = u.message.chat.id;
      const text = u.message.text || "";

      if (!db.users[chatId]) {
        db.users[chatId] = { wilayas: [], lastHB: 0 };
      }

      if (text === "/start") {
        await send(chatId, "👋 مرحبا", mainMenu());
      }

      if (text === "/tv") {
        await send(chatId, "📺 البث", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "▶ تشغيل", url: `${DOMAIN}/player` }]
            ]
          }
        });
      }
    }

    // ================= CALLBACK (FIX IMPORTANT) =================
    if (u.callback_query) {
      const chatId = u.callback_query.message.chat.id;
      const cb = u.callback_query.data;

      await axios.post(`${API}/answerCallbackQuery`, {
        callback_query_id: u.callback_query.id
      });

      if (!db.users[chatId]) db.users[chatId] = { wilayas: [] };

      if (cb === "all") {
        db.users[chatId].wilayas = [...wilayas];
        await send(chatId, "✅ كل الولايات مفعلة");
      }

      if (cb === "choose") {
        const buttons = wilayas.map(w => ([{
          text: w,
          callback_data: `w_${w}`
        }]));

        await send(chatId, "📍 اختر:", {
          reply_markup: { inline_keyboard: buttons }
        });
      }

      if (cb.startsWith("w_")) {
        const w = cb.replace("w_", "");

        if (!db.users[chatId].wilayas.includes(w)) {
          db.users[chatId].wilayas.push(w);
        }

        await send(chatId, `✅ تم اختيار: ${w}`);
      }
    }

    saveData(db);
    res.sendStatus(200);

  } catch (e) {
    console.log(e.message);
    res.sendStatus(200);
  }
});

// ================== SERVER ==================
app.get("/", (req, res) => res.send("Bot running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT);

// ================== LOOPS ==================
setInterval(() => check().catch(console.error), 30000);
setInterval(() => heartbeat().catch(console.error), 300000);
