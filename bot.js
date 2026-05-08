const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

// ================== TELEGRAM ==================
const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

// ================== OFFICIAL API ==================
const API_URL = "https://adhahi.dz/api/v1/public/wilaya-quotas";

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
    fs.writeFileSync(dataFile, JSON.stringify({ users: {}, last: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(dataFile));
}

function saveData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

// ================== TELEGRAM SEND ==================
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
        [{ text: "📋 كل الولايات", callback_data: "all" }]
      ]
    }
  };
}

// ================== FETCH API ==================
async function getWilayaStatus() {
  try {
    const res = await axios.get(API_URL, {
      timeout: 10000,
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0"
      }
    });

    return Array.isArray(res.data) ? res.data : [];
  } catch (e) {
    console.log("API error:", e.message);
    return [];
  }
}

// ================== REAL-TIME CHECK ==================
async function check() {
  const data = loadData();

  const apiData = await getWilayaStatus();
  if (!apiData.length) return;

  console.log("⚡ checking...");

  for (let id in data.users) {
    const user = data.users[id];
    if (!user || !user.wilaya) continue;

    const w = apiData.find(x => x.wilayaNameAr === user.wilaya);
    if (!w) continue;

    const key = `${id}_${user.wilaya}`;
    const available = w.available === true;

    if (!data.last[key]) {
      data.last[key] = "closed";
    }

    // 🚨 فتح التسجيل
    if (available && data.last[key] === "closed") {
      data.last[key] = "open";

      await send(id,
        `🚨 فتح التسجيل الآن في ولايتك: ${user.wilaya}`
      );
    }

    // 🔒 إغلاق
    if (!available) {
      data.last[key] = "closed";
    }
  }

  saveData(data);
}

// ================== REAL-TIME LOOP (8s) ==================
async function startWatcher() {
  while (true) {
    try {
      await check();
    } catch (e) {
      console.log("watch error:", e.message);
    }

    // ⚡ 5–8 ثواني (real-time feeling)
    await new Promise(r => setTimeout(r, 8000));
  }
}

startWatcher();

// ================== WEBHOOK ==================
app.post("/webhook", async (req, res) => {
  const data = loadData();

  try {
    const update = req.body;

    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = msg.text || "";
      const name = msg.from.first_name || "User";

      if (!data.users[chatId]) {
        data.users[chatId] = { wilaya: null };
      }

      if (text === "/start") {
        await send(chatId,
          `👋 مرحبا ${name}\nاختر ولايتك`,
          mainMenu()
        );
      }

      else if (text === "/wilayas") {
        await send(chatId, wilayas.join(" • "));
      }

      else {
        await send(chatId, "اكتب /start");
      }

      saveData(data);
    }

    if (update.callback_query) {
      const chatId = update.callback_query.message.chat.id;
      const dataCB = update.callback_query.data;

      await axios.post(`${API}/answerCallbackQuery`, {
        callback_query_id: update.callback_query.id
      });

      if (dataCB === "choose") {
        const buttons = wilayas.map(w => [{
          text: w,
          callback_data: `wilaya_${w}`
        }]);

        await send(chatId, "📍 اختر ولايتك:", {
          reply_markup: { inline_keyboard: buttons }
        });
      }

      if (dataCB === "all") {
        await send(chatId, wilayas.join(" • "));
      }

      if (dataCB.startsWith("wilaya_")) {
        const w = dataCB.replace("wilaya_", "");

        if (!data.users[chatId]) {
          data.users[chatId] = { wilaya: null };
        }

        data.users[chatId].wilaya = w;
        saveData(data);

        await send(chatId, `✅ تم اختيار: ${w}`);
      }
    }

    res.sendStatus(200);

  } catch (e) {
    console.log("webhook error:", e.message);
    res.sendStatus(200);
  }
});

// ================== SERVER ==================
app.get("/", (req, res) => res.send("Bot running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Running on", PORT));
