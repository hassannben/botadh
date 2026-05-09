const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;
const API_URL = "https://adhahi.dz/api/v1/public/wilaya-quotas";

const FILE = "./data.json";

const CHECK_INTERVAL = 30000;
const HEARTBEAT_INTERVAL = 300000;

// ================== WILAYAS ==================
const wilayas = [/* نفس القائمة */];

// ================== DB ==================
function load() {
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify({ users: {}, state: {} }, null, 2));
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
      ...options
    });
  } catch (e) {
    console.log(e.message);
  }
}

// ================== NORMALIZE (IMPORTANT FIX) ==================
function norm(t = "") {
  return t
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ================== API ==================
async function getData() {
  try {
    const res = await axios.get(API_URL, { timeout: 15000 });
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
}

// ================== OPEN CHECK ==================
function isOpen(w) {
  return w?.available === true || Number(w?.remainingQuota ?? 0) > 0;
}

// ================== MATCH FIX ==================
function match(api, name) {
  return (
    norm(api?.wilayaNameAr) === norm(name) ||
    norm(api?.wilayaNameFr) === norm(name)
  );
}

// ================== GRID UI (PRO) ==================
function keyboard(selected = []) {
  const rows = [];
  let row = [];

  wilayas.forEach((w, i) => {
    row.push({
      text: selected.includes(w) ? `✅ ${w}` : w,
      callback_data: `w_${w}`
    });

    if (row.length === 2) {
      rows.push(row);
      row = [];
    }
  });

  if (row.length) rows.push(row);

  rows.push([{ text: "🌍 كل الولايات", callback_data: "all" }]);
  return { inline_keyboard: rows };
}

// ================== CHECK ENGINE ==================
async function check() {
  const db = load();
  const api = await getData();

  for (const id in db.users) {
    const user = db.users[id];
    const list = user?.wilayas || [];

    for (const w of list) {
      const found = api.find(x => match(x, w));
      if (!found) continue;

      const open = isOpen(found);

      if (!db.state[id]) db.state[id] = {};
      const prev = db.state[id][w];

      if (open && prev !== "open") {
        db.state[id][w] = "open";
        await send(id, `🚨 فتح التسجيل:\n📍 ${w}`);
      }

      if (!open) {
        db.state[id][w] = "closed";
      }
    }
  }

  save(db);
}

// ================== HEARTBEAT ==================
async function heartbeat() {
  const db = load();

  for (const id in db.users) {
    await send(id, "🟢 البوت يعمل بشكل طبيعي");
  }
}

// ================== WEBHOOK (FIXED STRUCTURE) ==================
app.post("/webhook", async (req, res) => {
  const db = load();
  const u = req.body;

  try {
    // ===== MESSAGE =====
    if (u.message) {
      const chatId = u.message.chat.id;
      const text = u.message.text || "";

      if (!db.users[chatId]) {
        db.users[chatId] = { wilayas: [] };
      }

      if (text === "/start") {
        await send(chatId, "👋 مرحبا بك", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "📍 اختيار ولاية", callback_data: "choose" }]
            ]
          }
        });
      }
    }

    // ===== CALLBACK (FIXED OUTSIDE MESSAGE) =====
    if (u.callback_query) {
      const chatId = u.callback_query.message.chat.id;
      const cb = u.callback_query.data;

      await axios.post(`${API}/answerCallbackQuery`, {
        callback_query_id: u.callback_query.id
      });

      if (!db.users[chatId]) db.users[chatId] = { wilayas: [] };

      if (cb === "choose") {
        await send(chatId, "📍 اختر:", {
          reply_markup: keyboard(db.users[chatId].wilayas)
        });
      }

      if (cb === "all") {
        db.users[chatId].wilayas = [...wilayas];
        await send(chatId, "✅ تم تفعيل الكل");
      }

      if (cb.startsWith("w_")) {
        const w = cb.replace("w_", "");

        const list = db.users[chatId].wilayas;

        if (list.includes(w)) {
          db.users[chatId].wilayas = list.filter(x => x !== w);
        } else {
          list.push(w);
        }

        await send(chatId, `📍 تم التحديث: ${w}`, {
          reply_markup: keyboard(db.users[chatId].wilayas)
        });
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
app.get("/", (req, res) => res.send("BOT PRO RUNNING"));

app.listen(process.env.PORT || 3000);

// ================== LOOPS ==================
setInterval(() => check().catch(console.error), CHECK_INTERVAL);
setInterval(() => heartbeat().catch(console.error), HEARTBEAT_INTERVAL);
