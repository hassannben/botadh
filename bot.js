const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ================= CONFIG =================
const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

// ================= SEND MESSAGE =================
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
    if (!video) return send(chatId, "❌ لم يتم العثور على الفيديو");

    video = video.replace("http://", "https://");

    await axios.post(`${API}/sendVideo`, {
      chat_id: chatId,
      video,
      caption,
      parse_mode: "HTML"
    }, { timeout: 120000 });

  } catch (e) {
    console.log("VIDEO ERROR:", e.response?.data || e.message);
    await send(chatId, "❌ فشل إرسال الفيديو");
  }
}

// ================= MODERN UI MENU =================
function menu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🎬 تحميل فيديو تيك توك", callback_data: "tiktok" }
        ],
        [
          { text: "⚡ كيفية الاستخدام", callback_data: "help" },
          { text: "ℹ️ حول البوت", callback_data: "about" }
        ],
        [
          { text: "🚀 المطور", url: "https://t.me/" }
        ]
      ]
    }
  };
}

// ================= DETECT =================
function detect(url) {
  if (/tiktok\.com|vm\.tiktok\.com/i.test(url)) return "tiktok";
  return null;
}

// ================= TIKTOK API =================
async function getTikTok(url) {
  try {
    const res = await axios.get(
      `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`
    );

    const d = res.data?.data;
    if (!d) return null;

    return {
      author: d.author?.unique_id || "Unknown",
      nickname: d.author?.nickname || "Unknown",
      country: d.region || "Unknown",
      views: d.play_count || 0,
      likes: d.digg_count || 0,
      video: d.play?.replace("http://", "https://")
    };

  } catch (e) {
    console.log("TIKTOK ERROR:", e.message);
    return null;
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
`🔥 <b>WELCOME TO TIKTOK DOWNLOADER PRO</b>

✨ تحميل فيديوهات تيك توك بدون علامة مائية
⚡ سرعة عالية + واجهة احترافية
🌍 يدعم عرض معلومات الفيديو

👇 اختر من القائمة`,
      menu()
    );
  }

  // ================= CALLBACK =================
  if (callback) {
    await answerCallback(callback.id);

    if (callback.data === "help") {
      return send(
        chatId,
`📌 <b>طريقة الاستخدام</b>

1️⃣ انسخ رابط فيديو TikTok
2️⃣ أرسله للبوت
3️⃣ انتظر التحليل
4️⃣ سيتم إرسال الفيديو مباشرة

⚡ سهل وسريع`
      );
    }

    if (callback.data === "about") {
      return send(
        chatId,
`🤖 <b>حول البوت</b>

🎬 TikTok Downloader PRO
⚡ أداء سريع
🔒 آمن
🌍 يعرض معلومات الفيديو`
      );
    }

    if (callback.data === "tiktok") {
      return send(chatId, "📥 أرسل الآن رابط فيديو TikTok");
    }
  }

  // ================= URL HANDLING =================
  if (message && /^https?:\/\//i.test(text)) {

    if (!detect(text)) {
      return send(chatId, "⚠️ فقط روابط TikTok مدعومة حالياً");
    }

    await send(chatId, "⏳ جاري تحليل الفيديو...");

    const data = await getTikTok(text);

    if (!data || !data.video) {
      return send(chatId, "❌ تعذر تحميل الفيديو");
    }

    return sendVideo(
      chatId,
      data.video,
`🎬 <b>TikTok Video</b>

👤 ${data.nickname}
🔗 @${data.author}
🌍 ${data.country}
❤️ ${data.likes}
👁 ${data.views}`
    );
  }

  // ================= DEFAULT =================
  if (message) {
    return send(chatId, "📌 أرسل رابط TikTok أو اضغط /start");
  }
});

// ================= HOME =================
app.get("/", (req, res) => {
  res.send("🚀 TikTok Bot PRO is Running");
});

// ================= SERVER =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 RUNNING ON", PORT));