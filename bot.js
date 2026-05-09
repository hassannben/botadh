const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ================== CONFIG ==================
const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

// API تاع تحميل TikTok (تقدر تبدلو)
const TIK_API = "https://botadh.onrender.com/download";

// ================== SEND MESSAGE ==================
async function send(chatId, text, options = {}) {
  try {
    await axios.post(`${API}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...options
    });
  } catch (e) {
    console.log("SEND ERROR:", e.message);
  }
}

// ================== ANSWER CALLBACK ==================
async function answerCallback(id) {
  try {
    await axios.post(`${API}/answerCallbackQuery`, {
      callback_query_id: id
    });
  } catch {}
}

// ================== GET TIKTOK ==================
async function getTikTok(url) {
  try {
    const res = await axios.get(TIK_API, {
      params: { url }
    });
    return res.data;
  } catch {
    return null;
  }
}

// ================== MENU ==================
function menu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎬 تجربة", callback_data: "test" }],
        [{ text: "📥 تعليمات", callback_data: "help" }]
      ]
    }
  };
}

// ================== WEBHOOK ==================
app.post("/webhook", async (req, res) => {
  try {
    const update = req.body;

    const message = update.message;
    const callback = update.callback_query;

    const chatId =
      message?.chat?.id ||
      callback?.message?.chat?.id;

    if (!chatId) return res.sendStatus(200);

    const text = message?.text || "";

    // ================== START ==================
    if (message && text === "/start") {
      return send(
        chatId,
`👋 مرحبا بك في البوت PRO

📌 أرسل أي رابط TikTok وسأقوم بـ:
• تحميل الفيديو
• عرض معلومات الحساب`
        ,
        menu()
      );
    }

    // ================== CALLBACK ==================
    if (callback) {
      await answerCallback(callback.id);

      if (callback.data === "test") {
        return send(chatId, "✅ الأزرار تعمل بشكل صحيح");
      }

      if (callback.data === "help") {
        return send(chatId, "📌 فقط أرسل رابط TikTok");
      }
    }

    // ================== TIKTOK LINK ==================
    if (message && text.includes("tiktok.com")) {
      await send(chatId, "⏳ جاري التحميل...");

      const data = await getTikTok(text);

      if (!data) {
        return send(chatId, "❌ فشل في تحميل الفيديو");
      }

      return send(chatId,
`🎬 TikTok Info:

👤 الحساب: ${data.author || "Unknown"}
📛 الاسم: ${data.nickname || "Unknown"}
❤️ إعجابات: ${data.likes || 0}
👁 مشاهدات: ${data.views || 0}

🔗 تحميل:
${data.download || "غير متوفر"}`);
    }

    // ================== DEFAULT ==================
    if (message) {
      return send(chatId, "🤖 أرسل رابط TikTok فقط أو /start");
    }

    res.sendStatus(200);

  } catch (e) {
    console.log("WEBHOOK ERROR:", e.message);
    res.sendStatus(200);
  }
});

// ================== HOME ==================
app.get("/", (req, res) => {
  res.send("🚀 BOT RUNNING PRO");
});

// ================== START SERVER ==================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 RUNNING ON", PORT);
});
