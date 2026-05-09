const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

// 🔥 رابط API تاعنا
const TIK_API = "https://YOUR-RENDER-URL.onrender.com/download";

// ================== SEND ==================
async function send(chatId, text) {
  try {
    await axios.post(`${API}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "HTML"
    });
  } catch {}
}

// ================== GET TIKTOK ==================
async function getTik(url) {
  try {
    const res = await axios.get(TIK_API, {
      params: { url }
    });

    return res.data;
  } catch {
    return null;
  }
}

// ================== WEBHOOK ==================
app.post("/webhook", async (req, res) => {
  try {
    const u = req.body;

    if (u.message) {
      const chatId = u.message.chat.id;
      const text = u.message.text || "";

      // ================== START ==================
      if (text === "/start") {
        return send(chatId,
`👋 مرحبا بك في TikTok Bot PRO

📌 أرسل أي رابط TikTok وسأقوم بـ:
• تحميل الفيديو بدون علامة مائية
• عرض معلومات الحساب
• عدد المشاهدات والإعجابات`);
      }

      // ================== TIKTOK ==================
      if (text.includes("tiktok.com")) {
        await send(chatId, "⏳ جاري التحميل...");

        const data = await getTik(text);

        if (!data || data.error) {
          return send(chatId, "❌ فشل التحميل");
        }

        return send(chatId,
`🎬 TikTok جاهز:

👤 الحساب: ${data.author}
📛 الاسم: ${data.nickname}
❤️ إعجابات: ${data.likes}
👁 مشاهدات: ${data.views}

🔗 تحميل الفيديو:
${data.download}`);
      }

      // ================== DEFAULT ==================
      return send(chatId,
`🤖 أرسل رابط TikTok فقط`);
    }

    res.sendStatus(200);

  } catch (e) {
    res.sendStatus(200);
  }
});

// ================== SERVER ==================
app.get("/", (req, res) => res.send("BOT OK"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("BOT RUNNING"));
