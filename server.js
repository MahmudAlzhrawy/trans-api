const express = require("express");
const multer = require("multer");
const cors = require("cors");

// ✅ محاولة آمنة لتحميل pdf-parse بغض النظر عن طريقة التصدير
let pdfParse;
try {
  pdfParse = require("pdf-parse");
  if (typeof pdfParse !== "function" && typeof pdfParse.default === "function") {
    pdfParse = pdfParse.default;
  }
} catch (err) {
  console.error("❌ فشل تحميل pdf-parse:", err);
}

const { translate } = require("@vitalets/google-translate-api");

const app = express();
const upload = multer();

app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["POST", "GET"],
  })
);

app.post("/translate", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // ✅ الآن pdfParse مضمونة أنها Function
    const data = await pdfParse(req.file.buffer);
    const text = data.text;

    const words = Array.from(
      new Set(
        text
          .split(/\s+/)
          .filter((w) => /^[A-Za-z]+$/.test(w))
          .map((w) => w.toLowerCase())
      )
    ).slice(0, 100);

    const translations = [];

    // ترجمة على دفعات 50 كلمة في المرة
const batchSize = 50;

for (let i = 0; i < words.length; i += batchSize) {
  const batch = words.slice(i, i + batchSize);

  // ترجمة كل كلمة في الدفعة بالتوازي
  const batchResults = await Promise.all(
    batch.map(async (word) => {
      try {
        const { text: arabic } = await translate(word, { to: "ar" });
        return { word, translation: arabic };
      } catch {
        return { word, translation: "❌ فشل الترجمة" };
      }
    })
  );

  translations.push(...batchResults);

  // انتظار نصف ثانية قبل الدفعة التالية (لتفادي الحظر)
  await new Promise((res) => setTimeout(res, 500));
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
