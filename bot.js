const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ================= CONFIG =================
const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

// ================= SEND =================
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

// ================= SEND VIDEO =================
async function sendVideo(chatId, video, caption = "") {
  try {
    await axios.post(`${API}/sendVideo`, {
      chat_id: chatId,
      video: { url: video },
      caption,
      parse_mode: "HTML"
    });
  } catch (e) {
    console.log("VIDEO ERROR:", e.message);
    await send(chatId, "❌ فشل إرسال الفيديو");
  }
}

// ================= MENU =================
function menu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🎬 TikTok", callback_data: "tik" },
          { text: "📸 Instagram", callback_data: "ig" }
        ],
        [
          { text: "▶ YouTube", callback_data: "yt" },
          { text: "📘 Facebook", callback_data: "fb" }
        ]
      ]
    }
  };
}

// ================= TIKTOK =================
async function getTikTok(url) {
  try {
    const res = await axios.get(
      `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`
    );

    const d = res.data?.data;

    if (!d) return null;

    return {
      type: "TikTok",
      author: d.author?.unique_id || "Unknown",
      nickname: d.author?.nickname || "Unknown",
      likes: d.digg_count || 0,
      views: d.play_count || 0,
      video: d.play
    };
  } catch {
    return null;
  }
}

// ================= INSTAGRAM =================
async function getInstagram(url) {
  try {
    // API placeholder
    return {
      type: "Instagram",
      video: url
    };
  } catch {
    return null;
  }
}

// ================= YOUTUBE =================
async function getYouTube(url) {
  try {
    // API placeholder
    return {
      type: "YouTube",
      video: url
    };
  } catch {
    return null;
  }
}

// ================= FACEBOOK =================
async function getFacebook(url) {
  try {
    // API placeholder
    return {
      type: "Facebook",
      video: url
    };
  } catch {
    return null;
  }
}

// ================= DETECT PLATFORM =================
function detectPlatform(url) {
  if (/tiktok\.com|vm\.tiktok\.com/i.test(url)) {
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
    if (message && text === "/start") {
      return send(
        chatId,
`🎬 <b>Media Downloader PRO</b>

📥 يدعم:
• TikTok
• Instagram
• Facebook
• YouTube

📌 أرسل أي رابط للتحميل مباشرة`,
        menu()
      );
    }

    // ================= CALLBACK =================
    if (callback) {
      await axios.post(`${API}/answerCallbackQuery`, {
        callback_query_id: callback.id
      });

      return send(chatId, "📌 أرسل رابط الفيديو");
    }

    // ================= URL =================
    if (message && /^https?:\/\//i.test(text)) {

      await send(chatId, "⏳ جاري المعالجة...");

      const platform = detectPlatform(text);

      let data = null;

      if (platform === "tiktok") {
        data = await getTikTok(text);
      }

      else if (platform === "instagram") {
        data = await getInstagram(text);
      }

      else if (platform === "youtube") {
        data = await getYouTube(text);
      }

      else if (platform === "facebook") {
        data = await getFacebook(text);
      }

      if (!data || !data.video) {
        return send(chatId, "❌ فشل التحميل");
      }

      return sendVideo(
        chatId,
        data.video,
`🎬 <b>${data.type}</b>

👤 ${data.author || "Unknown"}
👁 ${data.views || 0}
❤️ ${data.likes || 0}`
      );
    }

    return send(chatId, "🤖 أرسل رابط فيديو صحيح");
  }

  catch (e) {
    console.log("ERROR:", e.message);
  }
});

// ================= HOME =================
app.get("/", (req, res) => {
  res.send("🚀 MEDIA DOWNLOADER RUNNING");
});

// ================= SERVER =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () =>
  console.log("🚀 SERVER RUNNING ON", PORT)
);
