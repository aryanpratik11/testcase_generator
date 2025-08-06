import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from "node-fetch";

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
      textOutput = textOutput
        .replace(/```json/i, "")
        .replace(/```/g, "")
        .trim();
      summaries = JSON.parse(textOutput);
    } catch {
      // Fallback: split by line
      summaries = textOutput
        .split("\n")
        .map((s) => s.trim().replace(/^[-*]\s*/, "")) // remove bullets
        .filter((s) => s && s !== "[" && s !== "]" && s !== ",");
    }

    res.json({ generatedCases: summaries });
  } catch (error) {
    console.error("Error generating test cases:", error);
    res.status(500).json({ error: "Failed to generate test cases" });
  }
});

app.post("/api/generateCode", async (req, res) => {
  try {
    const { summary, language, codeContext } = req.body;
    if (!summary || !language || !codeContext) {
      return res.status(400).json({ error: "Missing required data" });
    }

    const prompt = `
You are an expert software tester.  
Given the following ${language} code and the test case summary: "${summary}",  
generate the full **unit test code** in ${language}'s most common test framework  
(JUnit for Java, PyTest for Python, Jest for JavaScript, NUnit for C#).  
Do not include explanations — output only the complete test code.

Code Context:
${codeContext}
`;

    const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash-latest" });
    const result = await model.generateContent(prompt);
    const code = result.response.text().trim();

    res.json({ code });
  } catch (error) {
    console.error("Error generating full test case code:", error);
    res.status(500).json({ error: "Failed to generate test case code" });
  }
});

app.post("/api/create-pr", async (req, res) => {
  try {
    const { owner, repo, filePath, fileContent, token } = req.body;

    const branchName = "add-generated-tests";

    // Step 1: Get default branch SHA
    const repoData = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { Authorization: `token ${token}` }
    }).then(r => r.json());

    const baseBranch = repoData.default_branch;

    const branchData = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`, {
      headers: { Authorization: `token ${token}` }
    }).then(r => r.json());

    const baseSha = branchData.object.sha;

    // Step 2: Create new branch
    await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      headers: { Authorization: `token ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseSha
      })
    });

    // Step 3: Create the file
    await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
      method: "PUT",
      headers: { Authorization: `token ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Add generated test cases",
        content: Buffer.from(fileContent).toString("base64"),
        branch: branchName
      })
    });

    // Step 4: Create PR
    const pr = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      headers: { Authorization: `token ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Add generated test cases",
        head: branchName,
        base: baseBranch,
        body: "This PR adds generated test cases from the Test Case Generator tool."
      })
    }).then(r => r.json());

    res.json({ prUrl: pr.html_url });
  } catch (err) {
    console.error("Error creating PR:", err);
    res.status(500).json({ error: "Failed to create PR" });
  }
});

app.listen(5000, () => {
  console.log("✅ Backend running on http://localhost:5000");
});