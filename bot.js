const axios = require("axios");

const TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = "8486232633";

let lastState = {};
let lastUpdateId = 0;

const wilayas = [
  "الجزائر", "وهران", "قسنطينة", "تيبازة",
  "البليدة", "سطيف", "عنابة", "تيزي وزو",
  "بجاية", "باتنة", "الجلفة", "بسكرة"
];


// ================== SEND MESSAGE ==================
async function send(chatId, msg) {
  await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    chat_id: chatId,
    text: msg,
  });
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


// ================== BOT UPDATES ==================
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

async function handleUpdates(updates) {
  for (let update of updates) {
    lastUpdateId = update.update_id;

    if (!update.message) continue;

    const msg = update.message;
    const text = msg.text || "";
    const name = msg.from.first_name || "User";
    const chatId = msg.chat.id;

    console.log(`📩 ${name}: ${text}`);

    if (text === "/start") {
      await send(chatId, `👋 مرحبا ${name}!\nالبوت يعمل بنجاح.`);
    } 
    else if (text === "/wilayas") {
      await send(chatId, `📍 Wilayas:\n${wilayas.join(", ")}`);
    } 
    else {
      await send(chatId, `📨 ${name}: ${text}`);
    }
  }
}


// ================== MAIN LOOP ==================
async function runBot() {
  console.log("🤖 Bot running...");

  // scraper كل دقيقة
  setInterval(check, 60000);

  // bot listener (polling)
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
