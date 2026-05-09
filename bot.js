const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

// ================== CONFIG ==================
const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;
const TIK_API = "https://tikdlfree.netlify.app/api"; // إذا فيه API فعلي
const API_URL = "https://adhahi.dz/api/v1/public/wilaya-quotas";

const FILE = "./data.json";

// ================== DB ==================
function load() {
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify({ users: {}, last: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(FILE));
}

function save(d) {
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
}

// ================== SEND ==================
async function send(chatId, text, options = {}) {
  try {
    await axios.post(`${API}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...options
    });
  } catch (e) {
    console.log("send error:", e.message);
  }
}

// ================== MENU UI ==================
function menu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📍 اختيار ولاية", callback_data: "choose" }],
        [{ text: "🌍 كل الولايات", callback_data: "all" }]
      ]
    }
  };
}

// ================== NORMALIZE ==================
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// ================== TIKTOK API ==================
async function getTikTok(url) {
  try {
    const res = await axios.get(`${TIK_API}/download`, {
      params: { url }
    });
    return res.data;
  } catch {
    return null;
  }
}

// ================== CHECK API ==================
async function getAPI() {
  try {
    const res = await axios.get(API_URL);
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
}

// ================== OPEN CHECK ==================
function isOpen(w) {
  return w?.available === true || Number(w?.remainingQuota || 0) > 0;
}

// ================== MAIN CHECK ==================
async function check() {
  const db = load();
  const api = await getAPI();

  for (const userId in db.users) {
    const user = db.users[userId];
    const list = user.wilayas || [];

    for (const wname of list) {
      const found = api.find(x =>
        norm(x.wilayaNameAr) === norm(wname)
      );

      if (!found) continue;

      const open = isOpen(found);

      if (!db.last[userId]) db.last[userId] = {};

      if (open && !db.last[userId][wname]) {
        db.last[userId][wname] = true;
        await send(userId, `🚨 فتح التسجيل:\n📍 ${wname}`);
      }

      if (!open) {
        db.last[userId][wname] = false;
      }
    }
  }

  save(db);
}

// ================== WEBHOOK ==================
app.post("/webhook", async (req, res) => {
  const db = load();

  try {
    const u = req.body;

    // ================== MESSAGE ==================
    if (u.message) {
      const chatId = u.message.chat.id;
      const text = u.message.text || "";

      if (!db.users[chatId]) {
        db.users[chatId] = { wilayas: [] };
      }

      // ===== START =====
      if (text === "/start") {
        return send(chatId,
          "👋 مرحبا بك في البوت\n\nأرسل رابط TikTok أو اختر من القائمة 👇",
          menu()
        );
      }

      // ===== TIKTOK DETECT =====
      if (text.includes("tiktok.com")) {
        await send(chatId, "⏳ جاري معالجة الفيديو...");

        const data = await getTikTok(text);

        if (!data) {
          return send(chatId, "❌ فشل تحميل الفيديو");
        }

        return send(chatId,
`🎬 معلومات الفيديو:

👤 الحساب: ${data.author || "غير معروف"}
❤️ إعجابات: ${data.likes || "?"}

🔗 تحميل:
${data.download || "غير متوفر"}`
        );
      }

      // ===== DEFAULT MESSAGE =====
      return send(chatId,
        `🤖 تم استلام رسالتك:\n${text}\n\nأرسل رابط TikTok أو اختر خدمة 👇`,
        menu()
      );
    }

    // ================== CALLBACK ==================
    if (u.callback_query) {
      const chatId = u.callback_query.message.chat.id;
      const cb = u.callback_query.data;

      await axios.post(`${API}/answerCallbackQuery`, {
        callback_query_id: u.callback_query.id
      });

      if (cb === "all") {
        db.users[chatId].wilayas = ["all"];
        await send(chatId, "✅ تم تفعيل كل الولايات");
      }

      if (cb === "choose") {
        const buttons = Object.keys(db.users[chatId].wilayas).map(w => ([{
          text: w,
          callback_data: `w_${w}`
        }]));

        await send(chatId, "📍 اختر ولاية:", {
          reply_markup: { inline_keyboard: buttons }
        });
      }

      if (cb.startsWith("w_")) {
        const w = cb.replace("w_", "");

        if (!db.users[chatId].wilayas.includes(w)) {
          db.users[chatId].wilayas.push(w);
        }

        await send(chatId, `✅ تم اختيار: ${w}`);
      }
    }

    save(db);
    res.sendStatus(200);

  } catch (e) {
    console.log(e.message);
    res.sendStatus(200);
  }
});

// ================== SERVER ==================
app.get("/", (req, res) => res.send("BOT RUNNING"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("RUN:", PORT));

// ================== LOOP ==================
setInterval(() => {
  check().catch(console.error);
}, 30000);
