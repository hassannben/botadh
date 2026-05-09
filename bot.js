const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ================= CONFIG =================
const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

// ================= SEND TEXT =================
async function send(chatId, text, options = {}) {
  try {
    await axios.post(`${API}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...options
    });
  } catch (e) {
    console.log("SEND ERROR:", e.response?.data || e.message);
  }
}

// ================= SEND VIDEO =================
async function sendVideo(chatId, video, caption = "") {

  try {

    if (!video) {
      return send(chatId, "❌ رابط الفيديو غير موجود");
    }

    // 🔥 إصلاح http
    video = video.replace("http://", "https://");

    console.log("VIDEO URL:", video);

    await axios.post(
      `${API}/sendVideo`,
      {
        chat_id: chatId,
        video: video,
        caption,
        parse_mode: "HTML"
      },
      {
        timeout: 120000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      }
    );

  } catch (e) {

    console.log(
      "VIDEO ERROR:",
      e.response?.data || e.message
    );

    await send(
      chatId,
      "❌ فشل إرسال الفيديو"
    );
  }
}

// ================= CALLBACK =================
async function answerCallback(id) {
  try {
    await axios.post(`${API}/answerCallbackQuery`, {
      callback_query_id: id
    });
  } catch {}
}

// ================= MENU =================
function menu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🎬 TikTok",
            callback_data: "tik"
          },
          {
            text: "📸 Instagram",
            callback_data: "ig"
          }
        ],
        [
          {
            text: "▶ YouTube",
            callback_data: "yt"
          },
          {
            text: "📘 Facebook",
            callback_data: "fb"
          }
        ],
        [
          {
            text: "📌 تعليمات",
            callback_data: "help"
          }
        ]
      ]
    }
  };
}

// ================= DETECT =================
function detectPlatform(url) {

  if (
    /tiktok\.com|vm\.tiktok\.com/i.test(url)
  ) {
    return "tiktok";
  }

  if (/instagram\.com/i.test(url)) {
    return "instagram";
  }

  if (/youtube\.com|youtu\.be/i.test(url)) {
    return "youtube";
  }

  if (/facebook\.com|fb\.watch/i.test(url)) {
    return "facebook";
  }

  return null;
}

// ================= TIKTOK =================
async function getTikTok(url) {

  try {

    const res = await axios.get(
      `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`,
      {
        timeout: 30000
      }
    );

    const d = res.data?.data;

    if (!d) return null;

    return {
      type: "TikTok",
      author: d.author?.unique_id || "Unknown",
      nickname: d.author?.nickname || "Unknown",
      country: d.region || "Unknown",
      likes: d.digg_count || 0,
      views: d.play_count || 0,
      video: d.play?.replace("http://", "https://")
    };

  } catch (e) {

    console.log(
      "TIKTOK ERROR:",
      e.response?.data || e.message
    );

    return null;
  }
}

// ================= INSTAGRAM =================
async function getInstagram(url) {

  try {

    // 🔥 ضع API حقيقي هنا لاحقاً

    return {
      type: "Instagram",
      author: "Instagram User",
      views: 0,
      likes: 0,
      video: null
    };

  } catch {
    return null;
  }
}

// ================= YOUTUBE =================
async function getYouTube(url) {

  try {

    return {
      type: "YouTube",
      author: "YouTube",
      views: 0,
      likes: 0,
      video: null
    };

  } catch {
    return null;
  }
}

// ================= FACEBOOK =================
async function getFacebook(url) {

  try {

    return {
      type: "Facebook",
      author: "Facebook",
      views: 0,
      likes: 0,
      video: null
    };

  } catch {
    return null;
  }
}

// ================= WEBHOOK =================
app.post("/webhook", async (req, res) => {

  res.sendStatus(200);

  try {

    const u = req.body;

    const message = u.message;
    const callback = u.callback_query;

    const chatId =
      message?.chat?.id ||
      callback?.message?.chat?.id;

    if (!chatId) return;

    const text = message?.text || "";

    // ================= START =================
    if (
      message &&
      text === "/start"
    ) {

      return send(
        chatId,
`🎬 <b>MEDIA DOWNLOADER PRO MAX</b>

📥 يدعم:
• TikTok
• Instagram
• Facebook
• YouTube

📌 أرسل رابط فيديو للتحميل مباشرة`,
        menu()
      );
    }

    // ================= CALLBACK =================
    if (callback) {

      await answerCallback(callback.id);

      if (callback.data === "help") {

        return send(
          chatId,
`📌 التعليمات:

1️⃣ أرسل رابط فيديو
2️⃣ انتظر المعالجة
3️⃣ سيصلك الفيديو مباشرة`
        );
      }

      return send(
        chatId,
        "📌 أرسل رابط فيديو"
      );
    }

    // ================= CHECK URL =================
    if (
      message &&
      /^https?:\/\//i.test(text)
    ) {

      await send(
        chatId,
        "⏳ جاري المعالجة..."
      );

      const platform =
        detectPlatform(text);

      let data = null;

      // ================= TIKTOK =================
      if (platform === "tiktok") {
        data = await getTikTok(text);
      }

      // ================= INSTAGRAM =================
      else if (platform === "instagram") {
        data = await getInstagram(text);
      }

      // ================= YOUTUBE =================
      else if (platform === "youtube") {
        data = await getYouTube(text);
      }

      // ================= FACEBOOK =================
      else if (platform === "facebook") {
        data = await getFacebook(text);
      }

      // ================= FAIL =================
      if (!data) {

        return send(
          chatId,
          "❌ فشل التحميل"
        );
      }

      // ================= NO VIDEO =================
      if (!data.video) {

        return send(
          chatId,
          `⚠ ${data.type} غير مدعوم حالياً`
        );
      }

      // ================= SEND VIDEO =================
      return sendVideo(
        chatId,
        data.video,
`🎬 <b>${data.type}</b>

👤 <b>الحساب:</b> ${data.author}
📛 <b>الاسم:</b> ${data.nickname || "Unknown"}
🌍 <b>البلد:</b> ${data.country || "Unknown"}
❤️ <b>الإعجابات:</b> ${data.likes}
👁 <b>المشاهدات:</b> ${data.views}`
      );
    }

    // ================= DEFAULT =================
    if (message) {

      return send(
        chatId,
        "🤖 أرسل رابط فيديو صحيح أو اكتب /start"
      );
    }

  } catch (e) {

    console.log(
      "GLOBAL ERROR:",
      e.response?.data || e.message
    );
  }
});

// ================= HOME =================
app.get("/", (req, res) => {
  res.send("🚀 MEDIA DOWNLOADER PRO MAX");
});

// ================= SERVER =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () =>
  console.log("🚀 RUNNING ON", PORT)
);
