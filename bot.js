const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

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
let dataFile = "./data.json";

function loadData() {
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ users: {}, last: {} }));
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

// ================== START BUTTONS ==================
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

// ================== CALLBACK ==================
app.post("/webhook", async (req, res) => {
  const data = loadData();

  try {
    const update = req.body;

    // ===== messages =====
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = (msg.text || "").toLowerCase();
      const name = msg.from.first_name || "User";

      // register user
      if (!data.users[chatId]) {
        data.users[chatId] = { wilaya: null };
        saveData(data);
      }

      if (text === "/start") {
        await send(chatId,
          `👋 مرحبا ${name}\n🤖 اختر ما تريد`,
          mainMenu()
        );
      }

      else if (text === "/wilayas") {
        await send(chatId, wilayas.join(" • "));
      }

      else {
        await send(chatId, "🤖 اختر /start");
      }
    }

    // ===== callback buttons =====
    if (update.callback_query) {
      const chatId = update.callback_query.message.chat.id;
      const dataCB = update.callback_query.data;

      // choose wilaya menu
      if (dataCB === "choose") {
        const buttons = wilayas.map(w => [{
          text: w,
          callback_data: `wilaya_${w}`
        }]);

        await send(chatId, "📍 اختر ولايتك:", {
          reply_markup: { inline_keyboard: buttons }
        });
      }

      // all wilayas
      if (dataCB === "all") {
        await send(chatId, wilayas.join(" • "));
      }

      // select wilaya
      if (dataCB.startsWith("wilaya_")) {
        const w = dataCB.replace("wilaya_", "");

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

// ================== SCRAPER ==================
async function check() {
  const data = loadData();

  try {
    const res = await axios.get("https://adhahi.dz", { timeout: 15000 });
    const html = cheerio.load(res.data).text().replace(/\s+/g, " ");

    for (let id in data.users) {
      const w = data.users[id].wilaya;
      if (!w) continue;

      const available = !html.includes(`${w} — حجز غير متوفر`);

      if (!data.last[w]) data.last[w] = "closed";

      if (available && data.last[w] === "closed") {
        data.last[w] = "open";
        await send(id, `🚨 فتح التسجيل في ولايتك: ${w}`);
      }

      if (!available) data.last[w] = "closed";
    }

    saveData(data);

  } catch (e) {
    console.log("scraper error:", e.message);
  }
}

// ================== SERVER ==================
app.get("/", (req, res) => res.send("Bot running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Running on", PORT));

// ================== LOOP ==================
setInterval(check, 60000);
