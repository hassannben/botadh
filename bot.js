const axios = require("axios");
const express = require("express");

const app = express();

const TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = "8486232633";

let lastState = {};
let lastUpdateId = 0;

const wilayas = [
"الجزائر", "وهران", "قسنطينة", "تيبازة",
"البليدة", "سطيف", "عنابة", "تيزي وزو",
"بجاية", "باتنة", "الجلفة", "بسكرة"
];

// ================= SERVER =================
app.get("/", (req, res) => {
res.send("Bot running ✅");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
console.log(`Server started on ${PORT}`);
});

// ================= SEND =================
async function send(chatId, msg) {
try {
await axios.post(
`https://api.telegram.org/bot${TOKEN}/sendMessage`,
{
chat_id: chatId,
text: msg,
}
);
} catch (e) {
console.log("send error:", e.response?.data || e.message);
}
}

// ================= SCRAPER =================
async function check() {
try {
const res = await axios.get("https://adhahi.dz", {
timeout: 10000,
});

```
const html = res.data;

for (let w of wilayas) {
  const isAvailable =
    !html.includes(`${w} — حجز غير متوفر`);

  if (!lastState[w]) {
    lastState[w] = "closed";
  }

  if (isAvailable && lastState[w] === "closed") {
    lastState[w] = "open";

    await send(
      CHAT_ID,
      `🚨 فتح التسجيل في ولاية: ${w}`
    );

    console.log(`${w} OPEN`);
  }

  if (!isAvailable) {
    lastState[w] = "closed";
  }
}
```

} catch (e) {
console.log(
"scraper error:",
e.response?.data || e.message
);
}
}

// ================= GET UPDATES =================
async function getUpdates() {
try {
const res = await axios.get(
`https://api.telegram.org/bot${TOKEN}/getUpdates`,
{
params: {
offset: lastUpdateId + 1,
timeout: 20,
},
}
);

```
return res.data.result;
```

} catch (e) {
console.log(
"updates error:",
e.response?.data || e.message
);

```
return [];
```

}
}

// ================= HANDLE =================
async function handleUpdates(updates) {
for (const update of updates) {
lastUpdateId = update.update_id;

```
if (!update.message) continue;

const msg = update.message;
const text = (msg.text || "").toLowerCase();
const name = msg.from.first_name || "User";
const chatId = msg.chat.id;

console.log(`📩 ${name}: ${text}`);

if (text === "/start") {
  await send(
    chatId,
    `👋 مرحبا ${name}\n🤖 بوت مراقبة التسجيل يعمل 24/7`
  );

  continue;
}

if (text === "/wilayas") {
  await send(
    chatId,
    `📍 الولايات:\n${wilayas.join(" • ")}`
  );

  continue;
}

if (
  ["مرحبا", "سلام", "hello", "hi"]
    .some(w => text.includes(w))
) {
  await send(chatId, `👋 أهلا ${name}`);

  continue;
}

if (
  ["شكرا", "merci", "thanks"]
    .some(w => text.includes(w))
) {
  await send(chatId, `😊 العفو ${name}`);

  continue;
}

await send(
  chatId,
  `🤖 الأوامر:\n/start\n/wilayas`
);
```

}
}

// ================= POLLING LOOP =================
async function poll() {
const updates = await getUpdates();

if (updates.length > 0) {
await handleUpdates(updates);
}
}

// ================= START =================
console.log("🤖 Bot running...");

setInterval(check, 60000);

setInterval(poll, 3000);
