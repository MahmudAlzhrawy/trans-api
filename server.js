const express = require("express");
const multer = require("multer");
const cors = require("cors");
const pdfParse = require("pdf-parse");
const translate = require("@iamtraction/google-translate");

const app = express();
const upload = multer();

app.use(cors({ origin: "https://z-translator.vercel.app", methods: ["POST", "GET"] }));

app.post("/translate", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const data = await pdfParse(req.file.buffer);
    const text = data.text;

    const words = Array.from(
      new Set(
        text
          .split(/\s+/)
          .filter((w) => /^[A-Za-z]+$/.test(w))
          .map((w) => w.toLowerCase())
      )
    ).slice(0, 5000);

    const translations = [];
    const batchSize = 50;

    for (let i = 0; i < words.length; i += batchSize) {
      const batch = words.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (word) => {
          try {
            const result = await translate(word, { to: "ar" });
            return { word, translation: result.text };
          } catch (err) {
            console.error(`❌ Error translating "${word}":`, err.message);
            return { word, translation: "❌ فشل الترجمة" };
          }
        })
      );

      translations.push(...batchResults);

      await new Promise((res) => setTimeout(res, 500));
      console.log(`✅ Translated ${Math.min(i + batchSize, words.length)}/${words.length} words`);
    }

    res.json({ words: translations });
  } catch (err) {
    console.error("🔥 Server Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(5000, () =>
  console.log("✅ PDF Translator API running on port 5000")
);
