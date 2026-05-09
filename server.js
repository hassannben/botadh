const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

// ================== GET TIKTOK INFO ==================
app.get("/download", async (req, res) => {
  try {
    const url = req.query.url;

    if (!url) {
      return res.json({ error: "no url" });
    }

    // 🔥 API بديل (مفتوح)
    const api = `https://tikwm.com/api/?url=${encodeURIComponent(url)}`;

    const response = await axios.get(api);

    const data = response.data?.data;

    if (!data) {
      return res.json({ error: "failed" });
    }

    res.json({
      author: data.author?.unique_id,
      nickname: data.author?.nickname,
      likes: data.digg_count,
      views: data.play_count,
      title: data.title,
      download: data.play, // بدون watermark
      cover: data.cover
    });

  } catch (e) {
    res.json({ error: e.message });
  }
});

// ================== HEALTH ==================
app.get("/", (req, res) => {
  res.send("TikTok API Running 🚀");
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log("API RUNNING ON", PORT));