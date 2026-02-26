import dotenv from "dotenv";
dotenv.config({ override: true });
import express from "express";
import { createServer as createViteServer } from "vite";
import { initDb } from "./src/db/index.ts";
import multer from "multer";
import { GoogleGenAI, Type } from "@google/genai";
import db from "./src/db/index.ts";

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  if (!process.env.GEMINI_API_KEY) {
    console.error("CRITICAL: GEMINI_API_KEY is missing from environment variables.");
  } else {
    console.log("GEMINI_API_KEY is present.");
  }

  // Initialize Database
  initDb();

  // Middleware to parse JSON bodies
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/questions/history", (req, res) => {
    try {
      const questions = db.prepare('SELECT * FROM questions ORDER BY id DESC LIMIT 100').all();
      res.json({ questions });
    } catch (error) {
      console.error("Error fetching history:", error);
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  app.post("/api/generate-questions", upload.single("file"), async (req, res) => {
    try {
      const { moduleId, githubUrl, textContext } = req.body;
      const file = req.file;

      let contextText = "";

      // 1. Process GitHub URL
      if (githubUrl) {
        try {
          // Naive extraction of owner/repo from URL
          const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
          if (match) {
            const [, owner, repo] = match;
            const readmeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`);
            if (readmeRes.ok) {
              const readmeData = await readmeRes.json();
              contextText += `\n\nGitHub Repository README:\n${Buffer.from(readmeData.content, 'base64').toString('utf-8')}`;
            }
          }
        } catch (e) {
          console.error("Failed to fetch GitHub README", e);
        }
      }

      // 2. Process File (TXT/MD/HTML)
      if (file) {
        // For simplicity, assuming text-based files. PDF requires more complex handling or Gemini File API.
        contextText += `\n\nUploaded Document Context (${file.originalname}):\n${file.buffer.toString('utf-8')}`;
      }

      // 3. Process Text Context
      if (textContext) {
        contextText += `\n\nUser Provided Text Context:\n${textContext}`;
      }

      // Fetch existing questions to avoid repetition
      const existingQuestions = db.prepare('SELECT content FROM questions WHERE module_id = ?').all(moduleId) as {content: string}[];
      const existingQuestionsText = existingQuestions.map(q => `- ${q.content}`).join('\n');

      // 3. Call Gemini API
      let apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        console.error("API Key is missing or invalid (placeholder) in /api/generate-questions");
        return res.status(500).json({ error: "Server configuration error: API Key missing or invalid" });
      }
      
      apiKey = apiKey.trim();
      console.log(`Using API Key: Length=${apiKey.length}, Prefix=${apiKey.substring(0, 4)}...`);

      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `
        You are an expert, rigorous technical interviewer.
        Generate exactly 15 interview questions based on the following context and module type.
        Module Type: ${moduleId}
        
        CRITICAL REQUIREMENT: ALL questions MUST be generated in Simplified Chinese (简体中文).
        
        The questions MUST be structured from easy to hard (progressive difficulty).
        Be strict and realistic.
        
        CRITICAL: DO NOT generate any of the following questions, as they have already been asked in previous sessions:
        ${existingQuestionsText || "None."}
        
        Context:
        ${contextText || "No specific context provided. Generate general questions for this module."}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                content: { type: Type.STRING, description: "The interview question" },
                difficulty: { type: Type.STRING, description: "Easy, Medium, or Hard" },
                category: { type: Type.STRING, description: "The topic category" }
              },
              required: ["content", "difficulty", "category"]
            }
          }
        }
      });

      const questionsText = response.text || "[]";
      const questions = JSON.parse(questionsText);

      // 4. Save to Database
      const insertStmt = db.prepare('INSERT INTO questions (module_id, content, difficulty) VALUES (?, ?, ?)');
      const transaction = db.transaction((qs) => {
        for (const q of qs) {
          insertStmt.run(moduleId, q.content, q.difficulty);
        }
      });
      transaction(questions);

      res.json({ questions });
    } catch (error) {
      console.error("Error generating questions:", error);
      res.status(500).json({ error: "Failed to generate questions" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving (placeholder for build output)
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
