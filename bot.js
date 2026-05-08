const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json({ limit: "1mb" }));

const TOKEN = process.env.BOT_TOKEN;

// ================== WILAYAS ==================
const wilayas = [
"الجزائر", "وهران", "قسنطينة", "تيبازة",
"البليدة", "سطيف", "عنابة", "تيزي وزو",
"بجاية", "باتنة", "الجلفة", "بسكرة"
];

// ================== ROOT ==================
app.get("/", (req, res) => {
res.send("Bot running ✅");
});

// ================== SEND MESSAGE ==================
async function send(chatId, text) {
try {
await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
chat_id: chatId,
text
});
} catch (e) {
console.log("send error:", e.response?.data || e.message);
}
}

// ================== SCRAPER ==================
let lastState = {};

async function checkWilayas() {
try {
const res = await axios.get("https://adhahi.dz", {
timeout: 10000
});

```
const html = res.data;

for (let w of wilayas) {

  // ✔️ FIXED (no template string issues)
  const isAvailable = !html.includes(w + " — حجز غير متوفر");

  if (!lastState[w]) lastState[w] = "closed";

  if (isAvailable && lastState[w] === "closed") {
    lastState[w] = "open";

    console.log(`🚨 ${w} OPEN`);
  }

  if (!isAvailable) {
    lastState[w] = "closed";
  }
}
```

} catch (e) {
console.log("scraper error:", e.message);
}
}

// ================== WEBHOOK ==================
app.post("/webhook", async (req, res) => {
try {
const message = req.body.message;
if (!message) return res.sendStatus(200);

```
const text = (message.text || "").toLowerCase();
const chatId = message.chat.id;
const name = message.from.first_name || "User";

console.log(`📩 ${name}: ${text}`);

if (text === "/start") {
  await send(chatId, `👋 مرحبا ${name}\n🤖 البوت يعمل الآن Webhook`);
}

else if (text === "/wilayas") {
  await send(chatId, `📍 الولايات:\n${wilayas.join(" • ")}`);
}

else if (["مرحبا", "سلام", "hi", "hello"].some(w => text.includes(w))) {
  await send(chatId, `👋 أهلا ${name}`);
}

else if (["شكرا", "merci", "thanks"].some(w => text.includes(w))) {
  await send(chatId, `😊 العفو ${name}`);
}

else if (text.includes("تسجيل")) {
  await send(chatId, `🔔 أنا أراقب فتح التسجيل وسأخبرك فورًا`);
}

else {
  await send(chatId, `🤖 جرب:\n/start\n/wilayas`);
}

res.sendStatus(200);
```

} catch (e) {
console.log("webhook error:", e.message);
res.sendStatus(200);
}
});

// ================== START SERVER ==================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
console.log("🚀 Bot running on port", PORT);
});

// ================== LOOP SCRAPER ==================
setInterval(checkWilayas, 60000);
