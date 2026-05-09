const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

const TIK_API = "https://botadh.onrender.com/download";

// ================== SEND ==================
async function send(chatId, text) {
  try {
    await axios.post(`${API}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "HTML"
    });
  } catch (e) {
    console.log("send error:", e.message);
  }
}

// ================== TIKTOK API ==================
async function getTik(url) {
  try {
    const res = await axios.get(TIK_API, {
      params: { url }
    });

    return res.data;
  } catch (e) {
    return null;
  }
}

// ================== WEBHOOK ==================
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // 🔥 مهم جدًا (لازم دائمًا يرجع 200)

  try {
    const u = req.body;

    if (!u.message) return;

    const chatId = u.message.chat.id;
    const text = u.message.text || "";

    // ================== START ==================
    if (text === "/start") {
      return send(chatId,
`👋 مرحبا بك في TikTok Bot PRO

📌 أرسل رابط TikTok وسأعطيك:
• تحميل الفيديو
• معلومات الحساب
• المشاهدات والإعجابات`
      );
    }

    // ================== TIKTOK ==================
    if (text.includes("tiktok.com")) {
      await send(chatId, "⏳ جاري التحميل...");

      const data = await getTik(text);

      if (!data || data.error) {
        return send(chatId, "❌ فشل التحميل، حاول لاحقًا");
      }

      return send(chatId,
`🎬 TikTok جاهز:

👤 الحساب: ${data.author || "?"}
📛 الاسم: ${data.nickname || "?"}
❤️ إعجابات: ${data.likes || "?"}
👁 مشاهدات: ${data.views || "?"}

🔗 تحميل:
${data.download || "غير متوفر"}`
      );
    }

    // ================== DEFAULT ==================
    return send(chatId, "🤖 أرسل رابط TikTok فقط");

  } catch (e) {
    console.log("ERROR:", e.message);
  }
});

// ================== HOME ==================
app.get("/", (req, res) => res.send("BOT RUNNING 🚀"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("RUNNING:", PORT));
