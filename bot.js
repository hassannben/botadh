const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

// ================== TELEGRAM ==================
const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

// ================== OFFICIAL API ==================
const API_URL =
  "https://adhahi.dz/api/v1/public/wilaya-quotas";

// ================== IPTV ==================
const TV_STREAM =
  "https://sr1.oz-tv.xyz/s1/b_1_HD/index.m3u8";

// ================== DOMAIN ==================
const DOMAIN =
  "https://botadh.onrender.com";

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
const dataFile = "./data.json";

function loadData() {
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(
      dataFile,
      JSON.stringify({ users: {}, last: {} }, null, 2)
    );
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
    console.log("send error:", e.message);
  }
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
    const res = await axios.get(API_URL, {
      timeout: 20000,
      headers: { Accept: "application/json" }
    });
    return res.data || [];
  } catch (e) {
    console.log("API error:", e.message);
    return [];
  }
}

// ================== STRONG CHECK ==================
function isOpen(w) {
  return (
    w.available === true ||
    w.open === true ||
    w.status === "OPEN" ||
    (w.remaining && w.remaining > 0) ||
    (w.quota && w.quota > 0)
  );
}

// ================== CHECK LOOP ==================
async function check() {

  const data = loadData();
  const apiData = await getWilayaStatus();

  if (!Array.isArray(apiData)) return;

  for (let userId in data.users) {

    const user = data.users[userId];
    if (!user) continue;

    const selected = user.wilayas || [];

    for (let wName of selected) {

      const w = apiData.find(
        x => x.wilayaNameAr === wName
      );

      if (!w) continue;

      const open = isOpen(w);

      if (!data.last[userId]) {
        data.last[userId] = {};
      }

      if (!data.last[userId][wName]) {
        data.last[userId][wName] = "closed";
      }

      // ===== OPEN ALERT =====
      if (
        open &&
        data.last[userId][wName] === "closed"
      ) {
        data.last[userId][wName] = "open";

        console.log("OPEN:", wName);

        await send(
          userId,
          `🚨 فتح التسجيل:\n${wName}`
        );
      }

      // ===== RESET =====
      if (!open) {
        data.last[userId][wName] = "closed";
      }
    }
  }

  saveData(data);
}

// ================== HEARTBEAT (مرة كل 5 دقائق فقط) ==================
async function heartbeat() {
  const data = loadData();

  for (let userId in data.users) {
    try {
      await send(
        userId,
        `✅ البوت يعمل\n⏰ ${new Date().toLocaleTimeString()}`
      );
    } catch (e) {
      console.log("heartbeat error:", e.message);
    }
  }
}

// ================== WEBHOOK ==================
app.post("/webhook", async (req, res) => {

  const data = loadData();

  try {

    const update = req.body;

    if (update.message) {

      const chatId = update.message.chat.id;
      const text = update.message.text || "";
      const name = update.message.from.first_name || "User";

      if (!data.users[chatId]) {
        data.users[chatId] = { wilayas: [] };
      }

      if (text === "/start") {
        await send(chatId, `👋 مرحبا ${name}`, mainMenu());
      }

      else if (text === "/wilayas") {
        await send(chatId, wilayas.join(" • "));
      }

      else if (text === "/tv") {
        await send(chatId, "📺 البث", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "▶ تشغيل", url: `${DOMAIN}/player` }]
            ]
          }
        });
      }

      saveData(data);
    }

    if (update.callback_query) {

      const chatId = update.callback_query.message.chat.id;
      const cb = update.callback_query.data;

      await axios.post(`${API}/answerCallbackQuery`, {
        callback_query_id: update.callback_query.id
      });

      if (cb === "all") {
        data.users[chatId] = { wilayas: [...wilayas] };
        await send(chatId, "✅ كل الولايات مفعلة");
      }

      if (cb === "choose") {
        const buttons = wilayas.map(w => ([{
          text: w,
          callback_data: `wilaya_${w}`
        }]));

        await send(chatId, "📍 اختر:", {
          reply_markup: { inline_keyboard: buttons }
        });
      }

      if (cb === "tv") {
        await send(chatId, "📺 تشغيل", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "▶ فتح", url: `${DOMAIN}/player` }]
            ]
          }
        });
      }

      if (cb.startsWith("wilaya_")) {

        const w = cb.replace("wilaya_", "");

        if (!data.users[chatId]) {
          data.users[chatId] = { wilayas: [] };
        }

        if (!data.users[chatId].wilayas.includes(w)) {
          data.users[chatId].wilayas.push(w);
        }

        await send(chatId, `✅ تم اختيار: ${w}`);
      }

      saveData(data);
    }

    res.sendStatus(200);

  } catch (e) {
    console.log("error:", e.message);
    res.sendStatus(200);
  }
});

// ================== PLAYER ==================
app.get("/player", (req, res) => {
  res.sendFile(path.join(__dirname, "player.html"));
});

// ================== SERVER ==================
app.get("/", (req, res) => res.send("Bot running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Running on", PORT));

// ================== LOOPS ==================
setInterval(() => check().catch(console.error), 30000);

// ⚠️ إشعار طمأنة كل 5 دقائق (اختياري)
setInterval(() => heartbeat().catch(console.error), 300000);

// ================== CRASH SAFE ==================
process.on("uncaughtException", e => console.log(e));
process.on("unhandledRejection", e => console.log(e));
