const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;
const API_URL = "https://adhahi.dz/api/v1/public/wilaya-quotas";
const FILE = "./data.json";

// ================== DB ==================
function load() {
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify({ users: {}, last: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(FILE));
}

function save(d) {
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
}

// ================== TELEGRAM SEND ==================
async function send(chatId, text, options = {}) {
  return axios.post(`${API}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...options
  });
}

// ================== UI MENU (PRO UX) ==================
function mainMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📍 اختيار ولاية", callback_data: "choose" }],
        [{ text: "🌍 تفعيل كل الولايات", callback_data: "all" }],
        [{ text: "📊 حالة البوت", callback_data: "status" }]
      ]
    }
  };
}

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

// ================== API ==================
async function getAPI() {
  try {
    const res = await axios.get(API_URL, { timeout: 10000 });
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
}

// ================== OPEN CHECK ==================
function isOpen(w) {
  return w?.available === true || Number(w?.remainingQuota || 0) > 0;
}

// ================== START HANDLER ==================
async function handleStart(chatId) {
  await send(
    chatId,
    "👋 <b>مرحبا بك في بوت تتبع التسجيل</b>\nاختر ما تريد:",
    mainMenu()
  );
}

// ================== CALLBACK UI ==================
async function handleCallback(query) {
  const db = load();
  const chatId = query.message.chat.id;
  const data = query.data;

  await axios.post(`${API}/answerCallbackQuery`, {
    callback_query_id: query.id
  });

  if (!db.users[chatId]) db.users[chatId] = { wilayas: [] };

  // ALL
  if (data === "all") {
    db.users[chatId].wilayas = [...wilayas];
    save(db);

    return send(chatId, "✅ تم تفعيل جميع الولايات");
  }

  // CHOOSE UI
  if (data === "choose") {
    const buttons = wilayas.map(w => ([{
      text: w,
      callback_data: `w_${w}`
    }]));

    return send(chatId, "📍 اختر ولاية:", {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  // STATUS
  if (data === "status") {
    return send(chatId, "🟢 البوت يعمل بشكل طبيعي");
  }

  // SELECT WILAYA
  if (data.startsWith("w_")) {
    const w = data.replace("w_", "");

    if (!db.users[chatId].wilayas.includes(w)) {
      db.users[chatId].wilayas.push(w);
      save(db);
    }

    return send(chatId, `✅ تم اختيار: ${w}`);
  }
}

// ================== CHECK LOOP ==================
async function check() {
  const db = load();
  const api = await getAPI();

  for (const userId in db.users) {
    const list = db.users[userId].wilayas || [];

    for (const wName of list) {
      const found = api.find(x => x.wilayaNameAr?.trim() === wName.trim());
      if (!found) continue;

      const open = isOpen(found);

      if (!db.last[userId]) db.last[userId] = {};

      if (open && !db.last[userId][wName]) {
        db.last[userId][wName] = true;

        await send(userId, `🚨 <b>فتح التسجيل</b>\n📍 ${wName}`);
      }

      if (!open) {
        db.last[userId][wName] = false;
      }
    }
  }

  save(db);
}

// ================== WEBHOOK ==================
app.post("/webhook", async (req, res) => {
  try {
    const update = req.body;

    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text;

      if (text === "/start") {
        await handleStart(chatId);
      }
    }

    if (update.callback_query) {
      await handleCallback(update.callback_query);
    }

    res.sendStatus(200);
  } catch (e) {
    console.log(e.message);
    res.sendStatus(200);
  }
});

// ================== WEB ==================
app.get("/", (req, res) => res.send("BOT OK"));

// ================== RUN ==================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("RUN:", PORT));

// ================== LOOP ==================
setInterval(() => check().catch(console.error), 20000);
