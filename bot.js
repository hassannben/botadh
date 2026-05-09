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
const CHECK_INTERVAL = 30000;
const HEARTBEAT_INTERVAL = 300000;

// ================== WILAYAS ==================
const wilayas = [
  "أدرار","الشلف","الأغواط","أم البواقي","باتنة",
  "بجاية","بسكرة","بشار","البليدة","البويرة",
  "تمنراست","تبسة","تلمسان","تيارت","تيزي وزو",
  "الجزائر","الجلفة","جيجل","سطيف","سعيدة",
  "سكيكدة","سيدي بلعباس","عنابة","قالمة","قسنطينة",
  "المدية","مستغانم","المسيلة","معسكر","ورقلة",
  "وهران","البيض","إليزي","برج بوعريريج","بومرداس",
  "الطارف","تندوف","تيسمسيلت","الوادي","خنشلة",
  "سوق أهراس","تيبازة","ميلة","عين الدفلى","النعامة",
  "عين تموشنت","غرداية","غليزان","المغير","المنيعة",
  "أولاد جلال","بني عباس","إن صالح","إن قزام","توقرت","جانت"
];

// ================== STORAGE ==================
const file = "./data.json";

function load() {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({ users: {}, last: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(file));
}

function save(d) {
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
  } catch (e) {
    console.log("send error:", e.message);
  }
}

// ================== MENU (نفس السابق) ==================
function menu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📍 اختيار ولاية", callback_data: "choose" }],
        [{ text: "🌍 كل الولايات", callback_data: "all" }]
      ]
    }
  };
}

// ================== API ==================
async function getData() {
  try {
    const res = await axios.get(API_URL);
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
}

// ================== CHECK OPEN ==================
function isOpen(w) {
  return w?.available === true || Number(w?.remainingQuota) > 0;
}

// ================== CHECK LOOP ==================
async function check() {
  const db = load();
  const api = await getData();

  for (const userId in db.users) {
    const user = db.users[userId];
    const selected = user.wilayas || [];

    for (const name of selected) {
      const w = api.find(x => x.wilayaNameAr?.trim() === name?.trim());
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

  save(db);
}

// ================== HEARTBEAT ==================
async function heartbeat() {
  const db = load();

  for (const id in db.users) {
    if (!db.users[id].lastHB) db.users[id].lastHB = 0;

    const now = Date.now();
    if (now - db.users[id].lastHB < HEARTBEAT_INTERVAL) continue;

    await send(id, "✅ البوت يعمل بشكل طبيعي");
    db.users[id].lastHB = now;
  }

  save(db);
}

// ================== WEBHOOK ==================
app.post("/webhook", async (req, res) => {
  const db = load();

  try {
    const u = req.body;

    if (u.message) {
      const chatId = u.message.chat.id;
      const text = u.message.text || "";

      if (!db.users[chatId]) {
        db.users[chatId] = { wilayas: [], lastHB: 0 };
      }

      // ===== START =====
      if (text === "/start") {
        await send(chatId, "👋 مرحبا", menu());
      }

      // ===== CALLBACK =====
      if (u.callback_query) {
        const cb = u.callback_query.data;

        await axios.post(`${API}/answerCallbackQuery`, {
          callback_query_id: u.callback_query.id
        });

        // ALL
        if (cb === "all") {
          db.users[chatId].wilayas = [...wilayas];
          await send(chatId, "✅ كل الولايات مفعلة");
        }

        // CHOOSE
        if (cb === "choose") {
          const buttons = wilayas.map(w => ([{
            text: w,
            callback_data: `w_${w}`
          }]));

          await send(chatId, "📍 اختر ولاية:", {
            reply_markup: { inline_keyboard: buttons }
          });
        }

        // SELECT WILAYA
        if (cb.startsWith("w_")) {
          const w = cb.replace("w_", "");

          if (!db.users[chatId].wilayas.includes(w)) {
            db.users[chatId].wilayas.push(w);
          }

          await send(chatId, `✅ تم اختيار: ${w}`);
        }
      }

      save(db);
    }

    res.sendStatus(200);
  } catch (e) {
    console.log(e.message);
    res.sendStatus(200);
  }
});

// ================== SERVER ==================
app.get("/", (req, res) => res.send("Bot OK"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("RUN:", PORT));

// ================== LOOPS ==================
setInterval(() => check().catch(console.error), CHECK_INTERVAL);
setInterval(() => heartbeat().catch(console.error), HEARTBEAT_INTERVAL);
