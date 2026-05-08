const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;

// ================== 58 WILAYAS ==================
const wilayas = [
  "أدرار", "الشلف", "الأغواط", "أم البواقي", "باتنة",
  "بجاية", "بسكرة", "بشار", "البليدة", "البويرة",
  "تمنراست", "تبسة", "تلمسان", "تيارت", "تيزي وزو",
  "الجزائر", "الجلفة", "جيجل", "سطيف", "سعيدة",
  "سكيكدة", "سيدي بلعباس", "عنابة", "قالمة", "قسنطينة",
  "المدية", "مستغانم", "المسيلة", "معسكر", "ورقلة",
  "وهران", "البيض", "إليزي", "برج بوعريريج", "بومرداس",
  "الطارف", "تندوف", "تيسمسيلت", "الوادي", "خنشلة",
  "سوق أهراس", "تيبازة", "ميلة", "عين الدفلى", "النعامة",
  "عين تموشنت", "غرداية", "غليزان", "المغير", "المنيعة",
  "أولاد جلال", "بني عباس", "إن صالح", "إن قزام", "توقرت",
  "جانت"
];

// ================== SUBSCRIBERS ==================
let subscribers = [];

// ================== ROOT ==================
app.get("/", (req, res) => {
  res.send("Bot running ✅");
});

// ================== SEND MESSAGE ==================
async function send(chatId, text) {
  try {
    await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      chat_id: chatId,
      text
    });
  } catch (e) {
    console.log("send error:", e.response?.data || e.message);
  }
}

// ================== SCRAPER STATE ==================
let lastState = {};

// ================== SCRAPER ==================
async function checkWilayas() {
  try {
    const res = await axios.get("https://adhahi.dz", {
      timeout: 15000
    });

    const html = res.data;
    const $ = cheerio.load(html);

    const normalizedHtml = $.text().replace(/\s+/g, " ");

    for (let w of wilayas) {

      const isAvailable =
        !normalizedHtml.includes(`${w} — حجز غير متوفر`);

      if (!lastState[w]) lastState[w] = "closed";

      if (isAvailable && lastState[w] === "closed") {
        lastState[w] = "open";

        console.log(`🚨 ${w} OPEN`);

        for (let id of subscribers) {
          await send(id, `🚨 فتح التسجيل في: ${w}`);
        }
      }

      if (!isAvailable) {
        lastState[w] = "closed";
      }
    }

  } catch (e) {
    console.log("scraper error:", e.message);
  }
}

// ================== WEBHOOK ==================
app.post("/webhook", async (req, res) => {
  try {
    const message = req.body.message;
    if (!message) return res.sendStatus(200);

    const text = (message.text || "").toLowerCase();
    const chatId = message.chat.id;
    const name = message.from.first_name || "User";

    console.log(`📩 ${name}: ${text}`);

    // ================= START =================
    if (text === "/start") {
      if (!subscribers.includes(chatId)) {
        subscribers.push(chatId);
      }

      await send(chatId,
        `👋 مرحبا ${name}\n🤖 تم تشغيل البوت\n🔔 سأخبرك عند فتح التسجيل`
      );
    }

    // ================= WILAYAS =================
    else if (text === "/wilayas") {
      await send(chatId, `📍 الولايات:\n${wilayas.join(" • ")}`);
    }

    // ================= GREETING =================
    else if (["مرحبا", "سلام", "hi", "hello"].some(w => text.includes(w))) {
      await send(chatId, `👋 أهلا ${name}`);
    }

    // ================= THANKS =================
    else if (["شكرا", "merci", "thanks"].some(w => text.includes(w))) {
      await send(chatId, `😊 العفو ${name}`);
    }

    // ================= REGISTER INFO =================
    else if (text.includes("تسجيل")) {
      await send(chatId, `🔔 تم تفعيل التنبيهات، سأخبرك عند الفتح`);
    }

    // ================= DEFAULT =================
    else {
      await send(chatId, `🤖 الأوامر:\n/start\n/wilayas`);
    }

    res.sendStatus(200);

  } catch (e) {
    console.log("webhook error:", e.message);
    res.sendStatus(200);
  }
});

// ================== SERVER ==================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Bot running on port", PORT);
});

// ================== LOOP SCRAPER ==================
setInterval(checkWilayas, 60000);
