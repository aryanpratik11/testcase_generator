import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

// Gemini setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Generate summaries from code
app.post("/api/generate", async (req, res) => {
  try {
    const { files, language } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files provided" });
    }

    // Combine all code into one big string
    const codeText = files
      .map((f) => `File: ${f.path}\n${f.content}`)
      .join("\n\n");

    // AI prompt for summaries
    const prompt = `
You are a software test case generator.  
Analyze the following ${language} code and generate a JSON array of possible test case summaries.  
Do NOT generate full code yet — only clear, short scenario descriptions.

Example output:
[
  "Valid login credentials should allow access",
  "Invalid password should return error",
  "Empty username should show validation message"
]

Code:
${codeText}
`;

    const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash-latest" });
    const result = await model.generateContent(prompt);

    let textOutput = result.response.text().trim();

    // Try parsing AI output into JSON array
    let summaries;
    try {
      summaries = JSON.parse(textOutput);
    } catch {
      // Fallback: split by line
      summaries = textOutput
        .split("\n")
        .map((s) => s.trim().replace(/^-/, "").trim())
        .filter(Boolean);
    }

    res.json({ generatedCases: summaries });
  } catch (error) {
    console.error("Error generating test cases:", error);
    res.status(500).json({ error: "Failed to generate test cases" });
  }
});

app.listen(5000, () => {
  console.log("✅ Backend running on http://localhost:5000");
});
