const express = require("express");
const axios = require("axios");
const ytDlp = require("yt-dlp-exec");

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
    if (!video) return send(chatId, "❌ الفيديو غير موجود");

    video = video.replace("http://", "https://");

    await axios.post(
      `${API}/sendVideo`,
      {
        chat_id: chatId,
        video,
        caption,
        parse_mode: "HTML"
      },
      {
        timeout: 120000
      }
    );
  } catch (e) {
    console.log("VIDEO ERROR:", e.response?.data || e.message);
    await send(chatId, "❌ فشل إرسال الفيديو");
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
          { text: "🎬 TikTok", callback_data: "tik" },
          { text: "📸 Instagram", callback_data: "ig" }
        ],
        [
          { text: "📘 Facebook", callback_data: "fb" },
          { text: "▶ YouTube", callback_data: "yt" }
        ],
        [
          { text: "📌 المساعدة", callback_data: "help" }
        ]
      ]
    }
  };
}

// ================= DETECT =================
function detect(url) {
  if (/tiktok\.com|vm\.tiktok\.com/i.test(url)) return "tiktok";
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/facebook\.com|fb\.watch/i.test(url)) return "facebook";
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  return null;
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
      country: d.region || "Unknown",
      likes: d.digg_count || 0,
      views: d.play_count || 0,
      video: d.play?.replace("http://", "https://")
    };
  } catch (e) {
    console.log("TIKTOK ERROR:", e.message);
    return null;
  }
}

// ================= INSTAGRAM =================
async function getInstagram(url) {
  try {
    const res = await axios.get(
      `https://api.neoxr.eu/api/igdl?url=${encodeURIComponent(url)}&apikey=free`
    );

    return {
      type: "Instagram",
      author: "Instagram",
      nickname: "User",
      country: "Unknown",
      likes: 0,
      views: 0,
      video: res.data?.data?.[0]?.url?.replace("http://", "https://")
    };
  } catch (e) {
    console.log("IG ERROR:", e.message);
    return null;
  }
}

// ================= FACEBOOK =================
async function getFacebook(url) {
  try {
    const res = await axios.get(
      `https://api.neoxr.eu/api/fb?url=${encodeURIComponent(url)}&apikey=free`
    );

    return {
      type: "Facebook",
      author: "Facebook",
      nickname: "User",
      country: "Unknown",
      likes: 0,
      views: 0,
      video:
        res.data?.data?.hd ||
        res.data?.data?.sd
    };
  } catch (e) {
    console.log("FB ERROR:", e.message);
    return null;
  }
}

// ================= YOUTUBE (REAL yt-dlp) =================
async function getYouTube(url) {
  try {
    const result = await ytDlp(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificates: true,
      preferFreeFormats: true
    });

    const formats = result.formats || [];

    const best = formats
      .filter(f => f.url && f.ext === "mp4")
      .sort((a, b) => (b.height || 0) - (a.height || 0))[0];

    if (!best) return null;

    return {
      type: "YouTube",
      author: result.uploader || "YouTube",
      nickname: result.title || "Video",
      country: "Unknown",
      likes: 0,
      views: result.view_count || 0,
      video: best.url
    };

  } catch (e) {
    console.log("YT ERROR:", e.message);
    return null;
  }
}

// ================= WEBHOOK =================
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

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
`🎬 <b>MEDIA DOWNLOADER PRO</b>

📥 TikTok - Instagram - Facebook - YouTube

📌 أرسل رابط فيديو`,
      menu()
    );
  }

  // ================= CALLBACK =================
  if (callback) {
    await answerCallback(callback.id);

    if (callback.data === "help") {
      return send(chatId, "📌 أرسل رابط فيديو من أي منصة");
    }

    return send(chatId, "📌 أرسل الرابط الآن");
  }

  // ================= URL =================
  if (message && /^https?:\/\//i.test(text)) {
    await send(chatId, "⏳ جاري المعالجة...");

    const type = detect(text);

    let data = null;

    if (type === "tiktok") data = await getTikTok(text);
    else if (type === "instagram") data = await getInstagram(text);
    else if (type === "facebook") data = await getFacebook(text);
    else if (type === "youtube") data = await getYouTube(text);

    if (!data) return send(chatId, "❌ فشل التحميل");

    if (!data.video) {
      return send(chatId, `⚠ ${data.type} غير مدعوم`);
    }

    return sendVideo(
      chatId,
      data.video,
`🎬 <b>${data.type}</b>

👤 ${data.author}
📛 ${data.nickname}
👁 ${data.views}`
    );
  }

  if (message) {
    return send(chatId, "🤖 أرسل رابط صحيح");
  }
});

// ================= HOME =================
app.get("/", (req, res) => {
  res.send("🚀 BOT RUNNING");
});

// ================= SERVER =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("RUNNING ON", PORT));