const axios = require("axios");

const TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = "8486232633";

let lastState = {};
let lastUpdateId = 0;

const wilayas = [
  "الجزائر", "وهران", "قسنطينة", "تيبازة",
  "البليد", "سطيف", "عنابة", "تيزي وزو",
  "بجاية", "باتنة", "الجلفة", "بسكرة"
];

// ================== SEND ==================
async function send(chatId, msg) {
  try {
    await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: msg,
    });
  } catch (e) {
    console.log("send error:", e.message);
  }
}

// ================== SCRAPER ==================
async function check() {
  try {
    const res = await axios.get("https://adhahi.dz");
    const html = res.data;

    for (let w of wilayas) {
      const isAvailable = !html.includes(`${w} — حجز غير متوفر`);

      if (!lastState[w]) lastState[w] = "closed";

      if (isAvailable && lastState[w] === "closed") {
        lastState[w] = "open";
        await send(CHAT_ID, `🚨 فتح التسجيل في ولاية: ${w}`);
        console.log(w, "OPEN");
      }

      if (!isAvailable) {
        lastState[w] = "closed";
      }
    }
  } catch (e) {
    console.log("scraper error:", e.message);
  }
}

// ================== GET UPDATES ==================
async function getUpdates() {
  const res = await axios.get(
    `https://api.telegram.org/bot${TOKEN}/getUpdates`,
    {
      params: {
        offset: lastUpdateId + 1,
        timeout: 10,
      },
    }
  );

  return res.data.result;
}

// ================== SMART HANDLER ==================
async function handleUpdates(updates) {
  for (let update of updates) {
    lastUpdateId = update.update_id;

    if (!update.message) continue;

    const msg = update.message;
    const text = (msg.text || "").toLowerCase();
    const name = msg.from.first_name || "User";
    const chatId = msg.chat.id;

    console.log(`📩 ${name}: ${text}`);

    // ================= START =================
    if (text === "/start") {
      return send(chatId,
        `👋 مرحبا ${name}!\n🤖 بوت متابعة التسجيل في الولايات.`
      );
    }

    // ================= WILAYAS =================
    if (text === "/wilayas") {
      return send(chatId,
        `📍 الولايات:\n${wilayas.join(" • ")}`
      );
    }

    // ================= GREETINGS =================
    if (["مرحبا", "سلام", "hello", "hi"].some(w => text.includes(w))) {
      return send(chatId, `👋 أهلا ${name}، مرحبا بك!`);
    }

    // ================= THANKS =================
    if (["شكرا", "merci", "thanks"].some(w => text.includes(w))) {
      return send(chatId, `😊 العفو ${name}!`);
    }

    // ================= REGISTRATION =================
    if (text.includes("تسجيل") || text.includes("فتح")) {
      return send(chatId,
        `🔔 أنا أراقب فتح التسجيل 24/7.\nوغادي نبلغك مباشرة عند أي ولاية تفتح.`
      );
    }

    // ================= BOT INFO =================
    if (text.includes("بوت") || text.includes("bot")) {
      return send(chatId,
        `🤖 أنا بوت ذكي:\n- أراقب موقع adhahi.dz\n- أبلغك عند فتح التسجيل`
      );
    }

    // ================= WILAYA QUESTION =================
    if (text.includes("ولاية")) {
      return send(chatId,
        `📍 الولايات المتابعة:\n${wilayas.join(" • ")}`
      );
    }

    // ================= HELP =================
    if (text.includes("كيف") || text.includes("help")) {
      return send(chatId,
        `ℹ️ جرب:\n/start\n/wilayas\nأو اطرح أي سؤال`
      );
    }

    // ================= DEFAULT =================
    return send(chatId,
      `🤔 لم أفهم رسالتك يا ${name}.\nجرب /start أو /wilayas`
    );
  }
}

// ================== MAIN LOOP ==================
async function runBot() {
  console.log("🤖 Bot running...");

  setInterval(check, 60000);

  while (true) {
    try {
      const updates = await getUpdates();
      await handleUpdates(updates);
    } catch (e) {
      console.log("bot error:", e.message);
    }
  }
}

runBot();
