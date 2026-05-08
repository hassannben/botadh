const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

// ================== TELEGRAM ==================
const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

// ================== API ==================
const API_URL =
  "https://adhahi.dz/api/v1/public/wilaya-quotas";

// ================== TV STREAM ==================
const TV_URL =
  "https://sr1.oz-tv.xyz/s1/b_1_HD/index.m3u8";

// ================== WILAYAS ==================
const wilayas = [
  "أدرار","الشلف","الأغواط","أم البواقي","باتنة",
  "بجاية","بسكرة","بشار","البليدة","البويرة",
  "تمنراست","تبسة","تلمسان","تيارت","تيزي وزو",
  "الجزائر","الجلفة","جيجل","سطيف","سعيدة",
  "سكيكدة","سيدي بلعباس","عنابة","قالمة","قسنطينة",
  "المدية","مستغانم","المسيلة","معسكر","ورقلة",
  "وهران","البيض","إليزي","برج بوعريريج","بومرداس",
  "الطارف","تندوف","تيسمسيلت","الوادي","خنشلة",
  "سوق أهراس","تيبازة","ميلة","عين الدفلى","النعامة",
  "عين تموشنت","غرداية","غليزان","المغير","المنيعة",
  "أولاد جلال","بني عباس","إن صالح","إن قزام","توقرت","جانت"
];

// ================== STORAGE ==================
const dataFile = "./data.json";

function loadData() {

  if (!fs.existsSync(dataFile)) {

    fs.writeFileSync(
      dataFile,
      JSON.stringify({
        users: {},
        last: {}
      })
    );
  }

  return JSON.parse(
    fs.readFileSync(dataFile)
  );
}

function saveData(data) {

  fs.writeFileSync(
    dataFile,
    JSON.stringify(data, null, 2)
  );
}

// ================== SEND ==================
async function send(
  chatId,
  text,
  options = {}
) {

  try {

    await axios.post(
      `${API}/sendMessage`,
      {
        chat_id: chatId,
        text,
        ...options
      }
    );

  } catch (e) {

    console.log(
      "send error:",
      e.message
    );
  }
}

// ================== MENU ==================
function mainMenu() {

  return {

    reply_markup: {

      inline_keyboard: [

        [
          {
            text: "📍 اختيار ولاية",
            callback_data: "choose"
          }
        ],

        [
          {
            text: "🌍 كل الولايات",
            callback_data: "all"
          }
        ],

        [
          {
            text: "📺 مشاهدة البث",
            callback_data: "tv"
          }
        ]
      ]
    }
  };
}

// ================== GET API ==================
async function getWilayaStatus() {

  try {

    const res = await axios.get(
      API_URL,
      {
        timeout: 20000,

        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0"
        }
      }
    );

    return res.data || [];

  } catch (e) {

    console.log(
      "API error:",
      e.message
    );

    return [];
  }
}

// ================== CHECK OPEN ==================
async function check() {

  const data = loadData();

  const apiData =
    await getWilayaStatus();

  if (!Array.isArray(apiData))
    return;

  for (let userId in data.users) {

    const user =
      data.users[userId];

    if (!user) continue;

    const selected =
      user.wilayas || [];

    for (let wName of selected) {

      const w = apiData.find(
        x =>
          x.wilayaNameAr === wName
      );

      if (!w) continue;

      const available =
        w.available;

      if (!data.last[userId]) {

        data.last[userId] = {};
      }

      if (
        !data.last[userId][wName]
      ) {

        data.last[userId][wName] =
          "closed";
      }

      // ===== OPEN =====
      if (
        available &&
        data.last[userId][wName] ===
          "closed"
      ) {

        data.last[userId][wName] =
          "open";

        await send(
          userId,
          `🚨 فتح التسجيل في ولاية:\n${wName}`
        );
      }

      // ===== CLOSED =====
      if (!available) {

        data.last[userId][wName] =
          "closed";
      }
    }
  }

  saveData(data);
}

// ================== HEARTBEAT ==================
async function heartbeat() {

  const data = loadData();

  for (let userId in data.users) {

    const user =
      data.users[userId];

    if (!user) continue;

    const count =
      (user.wilayas || []).length;

    await send(
      userId,

      `✅ البوت يعمل بشكل طبيعي

📡 المراقبة شغالة

📍 عدد الولايات: ${count}

⏰ آخر فحص:
${new Date().toLocaleTimeString(
  "ar-DZ"
)}`
    );
  }
}

// ================== WEBHOOK ==================
app.post(
  "/webhook",
  async (req, res) => {

    const data = loadData();

    try {

      const update = req.body;

      // ================== MESSAGE ==================
      if (update.message) {

        const msg =
          update.message;

        const chatId =
          msg.chat.id;

        const text =
          msg.text || "";

        const name =
          msg.from.first_name ||
          "User";

        if (
          !data.users[chatId]
        ) {

          data.users[chatId] = {
            wilayas: []
          };
        }

        // ===== START =====
        if (text === "/start") {

          await send(
            chatId,

            `👋 مرحبا ${name}

🤖 بوت مراقبة الأضاحي والبث المباشر

اختر ما تريد:`,

            mainMenu()
          );
        }

        // ===== HELP =====
        else if (
          text === "/help"
        ) {

          await send(
            chatId,

`📌 الأوامر:

/start
تشغيل البوت

/help
المساعدة

/wilayas
عرض الولايات

/status
عرض الولايات المفعلة

/tv
مشاهدة البث`
          );
        }

        // ===== STATUS =====
        else if (
          text === "/status"
        ) {

          const selected =
            data.users[chatId]
              .wilayas || [];

          if (
            selected.length === 0
          ) {

            await send(
              chatId,
              "❌ لم تختر أي ولاية"
            );

          } else {

            await send(
              chatId,

              `📍 الولايات المفعلة:

${selected.join("\n")}`
            );
          }
        }

        // ===== WILAYAS =====
        else if (
          text === "/wilayas"
        ) {

          await send(
            chatId,
            wilayas.join(" • ")
          );
        }

        // ===== TV =====
        else if (
          text === "/tv"
        ) {

          await send(
            chatId,

            "📺 مشاهدة البث المباشر",

            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text:
                        "▶ تشغيل البث",
                      url: TV_URL
                    }
                  ]
                ]
              }
            }
          );
        }

        // ===== ANY MESSAGE =====
        else {

          await send(
            chatId,

            `👋 أهلا ${name}

البوت يعمل ✅

اكتب /start`
          );
        }

        saveData(data);
      }

      // ================== CALLBACK ==================
      if (
        update.callback_query
      ) {

        const chatId =
          update.callback_query
            .message.chat.id;

        const cb =
          update.callback_query
            .data;

        // remove loading
        await axios.post(
          `${API}/answerCallbackQuery`,
          {
            callback_query_id:
              update.callback_query
                .id
          }
        );

        // ===== ALL =====
        if (cb === "all") {

          data.users[chatId] = {
            wilayas: [...wilayas]
          };

          saveData(data);

          await send(
            chatId,

            `✅ تم تفعيل جميع الولايات

🚨 ستصلك إشعارات عند فتح أي ولاية`
          );
        }

        // ===== CHOOSE =====
        if (
          cb === "choose"
        ) {

          const buttons =
            wilayas.map(w => [
              {
                text: w,
                callback_data:
                  `wilaya_${w}`
              }
            ]);

          await send(
            chatId,
            "📍 اختر ولايتك:",
            {
              reply_markup: {
                inline_keyboard:
                  buttons
              }
            }
          );
        }

        // ===== TV BUTTON =====
        if (cb === "tv") {

          await send(
            chatId,

            "📺 مشاهدة البث المباشر",

            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text:
                        "▶ تشغيل البث",
                      url: TV_URL
                    }
                  ]
                ]
              }
            }
          );
        }

        // ===== SELECT =====
        if (
          cb.startsWith(
            "wilaya_"
          )
        ) {

          const w =
            cb.replace(
              "wilaya_",
              ""
            );

          if (
            !data.users[chatId]
          ) {

            data.users[chatId] = {
              wilayas: []
            };
          }

          if (
            !data.users[
              chatId
            ].wilayas.includes(w)
          ) {

            data.users[
              chatId
            ].wilayas.push(w);
          }

          saveData(data);

          await send(
            chatId,

            `✅ تم تفعيل:

${w}`
          );
        }
      }

      res.sendStatus(200);

    } catch (e) {

      console.log(
        "webhook error:",
        e.message
      );

      res.sendStatus(200);
    }
  }
);

// ================== HOME ==================
app.get("/", (req, res) => {

  res.send("Bot running");
});

// ================== SERVER ==================
const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(
    "🚀 Running on",
    PORT
  );
});

// ================== LOOP ==================

// فحص كل 30 ثانية
setInterval(() => {

  check().catch(
    console.error
  );

}, 30000);

// رسالة طمأنة كل 5 دقائق
setInterval(() => {

  heartbeat().catch(
    console.error
  );

}, 300000);
