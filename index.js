import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkBrandMention } from "./utils/match.js";
import dotenv from "dotenv";
dotenv.config();

const app = express();

const allowedOrigins = [
  "https://gemini-brand.vercel.app", // production
  "http://localhost:3000", // local dev
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  })
);

app.use(bodyParser.json());

// Validate API key
if (!process.env.GEMINI_API_KEY) {
  console.error("ERROR: GEMINI_API_KEY is not set in environment variables");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/check", async (req, res) => {
  try {
    const { prompt, brand } = req.body;

    // Validate input
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({
        prompt: prompt || "",
        mentioned: false,
        position: null,
        error: "Invalid or missing prompt",
      });
    }

    if (!brand || typeof brand !== "string" || !brand.trim()) {
      return res.status(400).json({
        prompt,
        mentioned: false,
        position: null,
        error: "Invalid or missing brand name",
      });
    }

    console.log(`Checking prompt for brand: "${brand}"`);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-lite",
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
      },
    });

    const text = result.response.text();
    console.log(`Model response length: ${text.length} characters`);

    const match = checkBrandMention(text, brand);

    res.json({
      prompt,
      mentioned: match.mentioned,
      position: match.position,
      error: match.error,
    });
  } catch (err) {
    console.error("Gemini API Error:", err);

    // Check for specific error types
    let errorMessage = "Model unavailable, returning fallback result.";

    if (err.message && err.message.includes("API key")) {
      errorMessage = "Invalid API key configuration";
    } else if (err.message && err.message.includes("quota")) {
      errorMessage = "API quota exceeded";
    } else if (err.message) {
      errorMessage = err.message;
    }

    res.status(200).json({
      prompt: req.body.prompt,
      mentioned: false,
      position: null,
      error: errorMessage,
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
  console.log(`✅ API endpoint: http://localhost:${PORT}/api/check`);
});
