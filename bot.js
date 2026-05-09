const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ================== CONFIG ==================
const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

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

// ================== TIKTOK API (FIXED) ==================
async function getTikTok(url) {
  try {
    const res = await axios.get(
      `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`
    );

    const data = res.data?.data;

    if (!data) return null;

    return {
      author: data.author?.unique_id || "Unknown",
      nickname: data.author?.nickname || "Unknown",
      likes: data.digg_count || 0,
      views: data.play_count || 0,
      download: data.play || null
    };

  } catch (e) {
    console.log("TIK ERROR:", e.message);
    return null;
  }
}

// ================== MENU ==================
function menu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📌 تعليمات", callback_data: "help" }],
        [{ text: "🎬 تجربة", callback_data: "test" }]
      ]
    }
  };
}

// ================== WEBHOOK ==================
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // مهم جدًا

  try {
    const u = req.body;

    const message = u.message;
    const callback = u.callback_query;

    const chatId =
      message?.chat?.id ||
      callback?.message?.chat?.id;

    if (!chatId) return;

    const text = message?.text || "";

    // ================== START ==================
    if (message && text === "/start") {
      return send(chatId,
`👋 مرحبا بك في TikTok Bot PRO

📌 أرسل أي رابط TikTok وسأقوم بـ:
• تحميل الفيديو بدون علامة مائية
• عرض معلومات الحساب`
      , menu());
    }

    // ================== CALLBACK ==================
    if (callback) {
      await answerCallback(callback.id);

      if (callback.data === "help") {
        return send(chatId, "📌 فقط أرسل رابط TikTok");
      }

      if (callback.data === "test") {
        return send(chatId, "✅ الأزرار تعمل بشكل صحيح");
      }
    }

    // ================== TIKTOK LINK ==================
    if (message && text.includes("tiktok.com")) {
      await send(chatId, "⏳ جاري التحميل...");

      const data = await getTikTok(text);

      if (!data || !data.download) {
        return send(chatId, "❌ فشل التحميل - جرب رابط آخر");
      }

      return send(chatId,
`🎬 TikTok جاهز:

👤 الحساب: ${data.author}
📛 الاسم: ${data.nickname}
❤️ إعجابات: ${data.likes}
👁 مشاهدات: ${data.views}

🔗 تحميل الفيديو:
${data.download}`
      );
    }

    // ================== DEFAULT ==================
    if (message) {
      return send(chatId, "🤖 أرسل رابط TikTok أو /start");
    }

  } catch (e) {
    console.log("ERROR:", e.message);
  }
});

// ================== HOME ==================
app.get("/", (req, res) => {
  res.send("🚀 BOT RUNNING PRO FIXED");
});

// ================== SERVER ==================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("RUNNING ON", PORT));
