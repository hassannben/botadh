const axios = require("axios");

const TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = "8486232633";

let lastState = {};

const wilayas = [
  "الجزائر", "وهران", "قسنطينة", "تيبازة",
  "البليدة", "سطيف", "عنابة", "تيزي وزو",
  "بجاية", "باتنة", "الجلفة", "بسكرة"
];

async function send(msg) {
  await axios.post(
    `https://api.telegram.org/bot${TOKEN}/sendMessage`,
    {
      chat_id: CHAT_ID,
      text: msg,
    }
  );
}

async function check() {
  try {
    const res = await axios.get("https://adhahi.dz");
    const html = res.data;

    for (let w of wilayas) {
      const pattern = `${w} — حجز غير متوفر`;
      const isAvailable = !html.includes(pattern);

      if (!lastState[w]) lastState[w] = "closed";

      if (isAvailable && lastState[w] === "closed") {
        lastState[w] = "open";
        await send(`🚨 فتح التسجيل في ولاية: ${w}`);
        console.log(w, "OPEN");
      }

      if (!isAvailable) {
        lastState[w] = "closed";
      }
    }

  } catch (e) {
    console.log("error:", e.message);
  }
}

check();
setInterval(check, 60000);

console.log("🔥 Smart multi-wilaya bot running...");
