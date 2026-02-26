import dotenv from "dotenv";
dotenv.config({ override: true });
import express from "express";
import { createServer as createViteServer } from "vite";
import { initDb } from "./src/db/index.ts";
import multer from "multer";
import { GoogleGenAI, Type } from "@google/genai";
import db from "./src/db/index.ts";
import { PROVIDER_DEFS, PROVIDER_MAP, findProviderForModel } from "./src/providers.ts";

// ============================================================
// Multi-provider generation helpers
// ============================================================

interface GenerationResult {
  title: string;
  questions: Array<{
    content: string;
    difficulty: string;
    category: string;
    answer: string;
  }>;
}

function getErrorDetail(error: any): string {
  if (!error) return "Unknown error";
  const name = error.name ? String(error.name) : "Error";
  const message = error.message ? String(error.message) : String(error);
  const cause = error.cause;
  const causeMessage =
    cause && typeof cause === "object" && "message" in cause
      ? String((cause as any).message)
      : cause
      ? String(cause)
      : "";
  return causeMessage ? `${name}: ${message} | cause: ${causeMessage}` : `${name}: ${message}`;
}

function isTransientGoogleConnectionError(error: any): boolean {
  const detail = getErrorDetail(error).toLowerCase();
  return (
    detail.includes("fetch failed") ||
    detail.includes("apiconnectionerror") ||
    detail.includes("connection") ||
    detail.includes("connecttimeout") ||
    detail.includes("timed out") ||
    detail.includes("econnreset") ||
    detail.includes("enotfound")
  );
}

function toClientSafeErrorMessage(error: any): string {
  const detail = getErrorDetail(error);
  if (detail.toLowerCase().includes("fetch failed")) {
    return "Google Gemini request failed due to a transient network/gateway issue. Please retry or switch to gemini-2.5-flash-lite.";
  }
  return error?.message || "Failed to generate questions";
}

const JSON_INSTRUCTION = `\n\nYou MUST respond with ONLY a valid JSON object (no markdown fences, no extra text). The JSON structure must be:
{
  "title": "string (3-8 Chinese characters summarizing the set)",
  "questions": [
    {
      "content": "the interview question",
      "difficulty": "Easy | Medium | Hard",
      "category": "topic category",
      "answer": "the perfect referral answer"
    }
  ]
}`;

const DEFAULT_SYSTEM_PROMPT = `You are an expert, rigorous technical interviewer.
Hard requirements:
- All questions and answers must be in Simplified Chinese.
- Return exactly 15 questions.
- Difficulty must progress from Easy to Hard.
- Avoid semantic duplicates with provided historical questions.
- Keep answers concise but comprehensive and interview-ready.`;

const MODULE_SYSTEM_PROMPTS: Record<string, string> = {
  full_simulation: `You are a strict interviewer simulating one complete real interview round.
Objectives:
- Build one realistic flow: warm-up calibration -> technical fundamentals -> deep dive -> project validation -> behavioral judgment -> wrap-up reflection.
- Questions must feel connected and follow-up friendly, not a random list.
Hard requirements:
- Use Simplified Chinese only.
- Return exactly 15 questions.
- difficulty only: Easy | Medium | Hard.
- Target difficulty distribution: 5 Easy, 6 Medium, 4 Hard.
- Avoid semantic duplicates with historical questions.`,
  knowledge: `You are a principle-focused technical interviewer.
Objectives:
- Assess understanding depth through concept definition, mechanism reasoning, trade-off analysis, failure diagnosis, and advanced extension.
- Emphasize "why" and "when it breaks", not rote memorization.
Hard requirements:
- Use Simplified Chinese only.
- Return exactly 15 questions.
- difficulty only: Easy | Medium | Hard.
- Target difficulty distribution: 4 Easy, 6 Medium, 5 Hard.
- Each answer should include mechanism and boundary conditions.
- Avoid semantic duplicates with historical questions.`,
  project: `You are a project deep-dive interviewer.
Objectives:
- Focus only on project/resume/context details, not generic textbook questions.
- Cover business goal, architecture design, implementation decisions, performance & reliability, and retrospective evolution.
Hard requirements:
- Use Simplified Chinese only.
- Return exactly 15 questions.
- difficulty only: Easy | Medium | Hard.
- Target difficulty distribution: 3 Easy, 6 Medium, 6 Hard.
- Answers should include verifiable project signals (metrics, constraints, trade-offs, incident handling, or rollout strategy).
- Avoid semantic duplicates with historical questions.`,
  scenario: `You are a situational and behavioral interviewer assessing judgment under uncertainty.
Objectives:
- Cover conflict handling, prioritization, ambiguous requirements, incident response, cross-team influence, and risk/ethics.
- Scenario questions must include concrete constraints (role, time pressure, resource limits, or conflicting goals).
Hard requirements:
- Use Simplified Chinese only.
- Return exactly 15 questions.
- difficulty only: Easy | Medium | Hard.
- Target difficulty distribution: 5 Easy, 5 Medium, 5 Hard.
- Answers should be structured and actionable (steps, stakeholders, rationale, result, retrospective).
- Avoid semantic duplicates with historical questions.`,
};

function getSystemPromptForModule(moduleId: string): string {
  return MODULE_SYSTEM_PROMPTS[moduleId] || DEFAULT_SYSTEM_PROMPT;
}

const MODULE_RULE_PACK: Record<string, string> = {
  full_simulation: "RP_FULL_SIM_V1",
  knowledge: "RP_KNOWLEDGE_V1",
  project: "RP_PROJECT_V1",
  scenario: "RP_SCENARIO_V1",
};

const CONTEXT_CARD_LIMIT = 7000;

function compactText(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncateMiddle(input: string, maxChars: number): string {
  if (input.length <= maxChars) return input;
  const head = Math.floor(maxChars * 0.7);
  const tail = maxChars - head;
  return `${input.slice(0, head)}\n\n[...CONTEXT TRUNCATED...]\n\n${input.slice(input.length - tail)}`;
}

function buildContextCard(rawContext: string): string {
  if (!rawContext.trim()) return "No specific context provided.";

  // Keep semantic context, strip heavy noise (code fences / html tags / extra spaces)
  const cleaned = compactText(
    rawContext
      .replace(/```[\s\S]*?```/g, "[CODE_BLOCK_OMITTED]")
      .replace(/<[^>]+>/g, " ")
      .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
      .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
  );

  return truncateMiddle(cleaned, CONTEXT_CARD_LIMIT);
}

function buildUserPrompt(
  moduleId: string,
  contextCard: string,
  existingQuestionsText: string
): string {
  const rulePack = MODULE_RULE_PACK[moduleId] || "RP_DEFAULT_V1";
  return compactText(`
TASK: Generate interview question set.
MODULE: ${moduleId}
RULE_PACK: ${rulePack}
OUTPUT: JSON object only; title(3-8 Chinese chars) + questions[15] with content,difficulty,category,answer.
LANG: Simplified Chinese for all question content and answers.

HISTORY_QUESTIONS_ALL (must avoid semantic duplicates; include ALL lines):
${existingQuestionsText || "None."}

CONTEXT_CARD:
${contextCard}
`);
}

async function generateWithGoogle(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<GenerationResult> {
  const ai = new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      timeout: 90_000,
      retryOptions: { attempts: 5 },
    },
  });
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `${systemPrompt}\n\n${userPrompt}${JSON_INSTRUCTION}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "A concise summary of the question set (3-8 chars)" },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  content: { type: Type.STRING, description: "The interview question" },
                  difficulty: { type: Type.STRING, description: "Easy, Medium, or Hard" },
                  category: { type: Type.STRING, description: "The topic category" },
                  answer: { type: Type.STRING, description: "The perfect referral answer" },
                },
                required: ["content", "difficulty", "category", "answer"],
              },
            },
          },
          required: ["title", "questions"],
        },
      },
    });
    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    throw new Error(`Google model ${model} request failed: ${getErrorDetail(error)}`);
  }
}

async function generateWithOpenAICompatible(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  baseUrl = "https://api.openai.com/v1"
): Promise<GenerationResult> {
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt + JSON_INSTRUCTION },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error?.message || `OpenAI-compatible API error (${resp.status})`);
  return JSON.parse(data.choices[0].message.content);
}

async function generateWithAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<GenerationResult> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey.trim(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        { role: "user", content: userPrompt + JSON_INSTRUCTION },
      ],
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error?.message || `Anthropic API error (${resp.status})`);
  const text = data.content[0].text;
  // Extract JSON from possible markdown fences
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse Anthropic response as JSON");
  return JSON.parse(jsonMatch[0]);
}

// Dispatch to the right provider
async function generateQuestions(
  providerId: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<GenerationResult> {
  switch (providerId) {
    case "google":
      return generateWithGoogle(apiKey, model, systemPrompt, userPrompt);
    case "openai":
      return generateWithOpenAICompatible(apiKey, model, systemPrompt, userPrompt, "https://api.openai.com/v1");
    case "deepseek":
      return generateWithOpenAICompatible(apiKey, model, systemPrompt, userPrompt, "https://api.deepseek.com");
    case "anthropic":
      return generateWithAnthropic(apiKey, model, systemPrompt, userPrompt);
    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
}

// Helper: resolve API key for a given provider (DB first, env fallback for google)
function resolveApiKey(providerId: string): string | null {
  const row = db.prepare("SELECT api_key FROM api_providers WHERE id = ? AND is_active = 1").get(providerId) as { api_key: string } | undefined;
  if (row?.api_key) return row.api_key;
  // Fallback: env var for google
  if (providerId === "google" && process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  return null;
}

// Helper: mask an API key for display
function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.substring(0, 4) + "****" + key.substring(key.length - 4);
}

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
      // 1. Registered batches
      const regQuery = `
        SELECT 
          qb.id as batch_id,
          qb.created_at, 
          qb.module_id, 
          qb.title,
          (
            SELECT COUNT(*)
            FROM interview_practices ip
            WHERE ip.batch_id = qb.id
          ) as practice_count,
          json_group_array(json_object(
            'id', q.id, 
            'content', q.content, 
            'difficulty', q.difficulty,
            'answer', q.answer
          )) as questions_json
        FROM question_batches qb
        JOIN questions q ON qb.id = q.batch_id
        GROUP BY qb.id
      `;
      const registered = db.prepare(regQuery).all() as any[];

      // 2. Legacy questions (no batch_id)
      const legacyQuery = `
        SELECT 
          created_at, 
          module_id, 
          json_group_array(json_object(
            'id', id, 
            'content', content, 
            'difficulty', difficulty,
            'answer', answer
          )) as questions_json
        FROM questions 
        WHERE batch_id IS NULL 
        GROUP BY created_at, module_id
      `;
      const legacy = db.prepare(legacyQuery).all() as any[];

      const formattedReg = registered.map(b => ({
        id: b.batch_id,
        created_at: b.created_at,
        module_id: b.module_id,
        title: b.title || "Untitled Batch",
        questions: JSON.parse(b.questions_json),
        practice_count: Number(b.practice_count || 0)
      }));

      const formattedLegacy = legacy.map((b, i) => ({
        id: `legacy-${b.created_at}`, // Use timestamp as part of ID
        created_at: b.created_at,
        module_id: b.module_id,
        title: "Legacy Question Set",
        questions: JSON.parse(b.questions_json),
        isLegacy: true
      }));

      const all = [...formattedReg, ...formattedLegacy].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      res.json({ batches: all });
    } catch (error) {
      console.error("Error fetching history:", error);
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  app.delete("/api/questions/batch/:id", (req, res) => {
    try {
      const { id } = req.params;

      if (id.startsWith('legacy-')) {
        const timestamp = id.replace('legacy-', '');
        const result = db.prepare('DELETE FROM questions WHERE created_at = ? AND batch_id IS NULL').run(timestamp);
        return res.json({ success: true, deleted: result.changes });
      }

      db.exec("PRAGMA foreign_keys = ON");
      const result = db.prepare('DELETE FROM question_batches WHERE id = ?').run(id);

      if (result.changes > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Batch not found" });
      }
    } catch (error) {
      console.error("Error deleting batch:", error);
      res.status(500).json({ error: "Failed to delete batch" });
    }
  });

  app.get("/api/questions/batch/:id/practices", (req, res) => {
    try {
      const { id } = req.params;
      if (id.startsWith("legacy-")) {
        return res.json({ practices: [] });
      }

      const practices = db.prepare(`
        SELECT id, batch_id, transcript_text, duration_seconds, created_at
        FROM interview_practices
        WHERE batch_id = ?
        ORDER BY created_at DESC, id DESC
      `).all(id);

      res.json({ practices });
    } catch (error) {
      console.error("Error fetching interview practices:", error);
      res.status(500).json({ error: "Failed to fetch interview practices" });
    }
  });

  app.post("/api/interviews", (req, res) => {
    try {
      const { batchId, transcript, durationSeconds } = req.body || {};

      if (!batchId || typeof transcript !== "string" || !transcript.trim()) {
        return res.status(400).json({ error: "batchId and transcript are required" });
      }

      const exists = db.prepare("SELECT id FROM question_batches WHERE id = ?").get(batchId);
      if (!exists) {
        return res.status(404).json({ error: "Batch not found" });
      }

      const result = db.prepare(`
        INSERT INTO interview_practices (batch_id, transcript_text, duration_seconds)
        VALUES (?, ?, ?)
      `).run(batchId, transcript.trim(), Number.isFinite(durationSeconds) ? Math.round(Number(durationSeconds)) : null);

      res.json({ success: true, practiceId: result.lastInsertRowid });
    } catch (error) {
      console.error("Error saving interview practice:", error);
      res.status(500).json({ error: "Failed to save interview practice" });
    }
  });

  app.delete("/api/interviews/:id", (req, res) => {
    try {
      const { id } = req.params;
      const result = db.prepare("DELETE FROM interview_practices WHERE id = ?").run(id);
      if (result.changes > 0) {
        return res.json({ success: true });
      }
      res.status(404).json({ error: "Practice not found" });
    } catch (error) {
      console.error("Error deleting interview practice:", error);
      res.status(500).json({ error: "Failed to delete interview practice" });
    }
  });

  // ============================================================
  // API Provider Management Routes
  // ============================================================

  // List all configured providers (with masked keys)
  app.get("/api/providers", (req, res) => {
    try {
      const rows = db.prepare("SELECT id, display_name, api_key, base_url, is_active, created_at, updated_at FROM api_providers").all() as any[];

      // Also check env-based Google key
      const hasEnvGoogle = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY");

      const providers = PROVIDER_DEFS.map(def => {
        const row = rows.find(r => r.id === def.id);
        const hasKey = !!(row?.api_key) || (def.id === "google" && hasEnvGoogle);
        return {
          ...def,
          configured: hasKey,
          isActive: row ? !!row.is_active : (def.id === "google" && hasEnvGoogle),
          maskedKey: row?.api_key ? maskKey(row.api_key) : (def.id === "google" && hasEnvGoogle ? maskKey(process.env.GEMINI_API_KEY!) : null),
          source: row?.api_key ? "db" : (def.id === "google" && hasEnvGoogle ? "env" : null),
          baseUrl: row?.base_url || null,
        };
      });

      res.json({ providers });
    } catch (error) {
      console.error("Error fetching providers:", error);
      res.status(500).json({ error: "Failed to fetch providers" });
    }
  });

  // Save / update a provider's API key
  app.post("/api/providers", (req, res) => {
    try {
      const { id, apiKey, baseUrl } = req.body;
      if (!id || !apiKey) {
        return res.status(400).json({ error: "id and apiKey are required" });
      }

      const def = PROVIDER_MAP[id];
      if (!def) {
        return res.status(400).json({ error: `Unknown provider: ${id}` });
      }

      db.prepare(`
        INSERT INTO api_providers (id, display_name, api_key, base_url, is_active, updated_at)
        VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          api_key = excluded.api_key,
          base_url = excluded.base_url,
          is_active = 1,
          updated_at = CURRENT_TIMESTAMP
      `).run(id, def.name, apiKey.trim(), baseUrl || null);

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving provider:", error);
      res.status(500).json({ error: "Failed to save provider" });
    }
  });

  // Delete a provider's configuration
  app.delete("/api/providers/:id", (req, res) => {
    try {
      const { id } = req.params;
      const result = db.prepare("DELETE FROM api_providers WHERE id = ?").run(id);
      res.json({ success: true, deleted: result.changes > 0 });
    } catch (error) {
      console.error("Error deleting provider:", error);
      res.status(500).json({ error: "Failed to delete provider" });
    }
  });

  // Test a provider's API key
  app.post("/api/providers/:id/test", async (req, res) => {
    try {
      const { id } = req.params;
      const { apiKey } = req.body;

      const def = PROVIDER_MAP[id];
      if (!def) return res.status(400).json({ error: `Unknown provider: ${id}` });

      // Use provided apiKey or resolve from DB/env
      const key = apiKey?.trim() || resolveApiKey(id);
      if (!key) return res.status(400).json({ error: "No API key provided or configured" });

      // Simple test: try a tiny generation
      const testPrompt = "Say hello in one word.";

      try {
        switch (id) {
          case "google": {
            const ai = new GoogleGenAI({ apiKey: key });
            await ai.models.generateContent({ model: def.models[0].id, contents: testPrompt });
            break;
          }
          case "openai":
          case "deepseek": {
            const baseUrl = id === "deepseek" ? "https://api.deepseek.com" : "https://api.openai.com/v1";
            const resp = await fetch(`${baseUrl}/chat/completions`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
              body: JSON.stringify({
                model: def.models[0].id,
                messages: [{ role: "user", content: testPrompt }],
                max_tokens: 10,
              }),
            });
            if (!resp.ok) {
              const errData = await resp.json().catch(() => ({}));
              throw new Error((errData as any).error?.message || `HTTP ${resp.status}`);
            }
            break;
          }
          case "anthropic": {
            const resp = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: def.models[0].id,
                max_tokens: 10,
                messages: [{ role: "user", content: testPrompt }],
              }),
            });
            if (!resp.ok) {
              const errData = await resp.json().catch(() => ({}));
              throw new Error((errData as any).error?.message || `HTTP ${resp.status}`);
            }
            break;
          }
        }
        res.json({ success: true, message: "连接成功！API Key 有效。" });
      } catch (testError: any) {
        res.json({ success: false, message: `连接失败: ${testError.message}` });
      }
    } catch (error) {
      console.error("Error testing provider:", error);
      res.status(500).json({ error: "Failed to test provider" });
    }
  });

  // Get the Google API key for client-side voice (InterviewRoom)
  app.get("/api/providers/google/client-key", (req, res) => {
    const key = resolveApiKey("google");
    if (!key) return res.status(404).json({ error: "Google API key not configured" });
    res.json({ apiKey: key });
  });

  app.post("/api/generate-questions", upload.single("file"), async (req, res) => {
    try {
      const { moduleId, githubUrl, textContext, modelId, providerId: explicitProviderId } = req.body;
      const file = req.file;

      const modelToUse = modelId || "gemini-2.5-flash";

      // Resolve which provider this model belongs to
      const providerDef = explicitProviderId
        ? PROVIDER_MAP[explicitProviderId]
        : findProviderForModel(modelToUse);
      
      if (!providerDef) {
        return res.status(400).json({ error: `Cannot find provider for model: ${modelToUse}` });
      }

      const providerId = providerDef.id;
      console.log(`Generating questions using provider: ${providerId}, model: ${modelToUse}`);

      // Resolve API key
      const apiKey = resolveApiKey(providerId);
      if (!apiKey) {
        return res.status(400).json({
          error: `未配置 ${providerDef.name} 的 API Key。请先在 API 设置中添加。`,
        });
      }

      let contextText = "";

      // 1. Process GitHub URL
      if (githubUrl) {
        try {
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
        contextText += `\n\nUploaded Document Context (${file.originalname}):\n${file.buffer.toString('utf-8')}`;
      }

      // 3. Process Text Context
      if (textContext) {
        contextText += `\n\nUser Provided Text Context:\n${textContext}`;
      }

      // Fetch existing questions to avoid repetition
      const existingQuestions = db.prepare('SELECT content FROM questions WHERE module_id = ?').all(moduleId) as { content: string }[];
      // User requirement: keep ALL historical questions, include question text only (no answers)
      const existingQuestionsText = existingQuestions.map((q, idx) => `${idx + 1}. ${compactText(q.content)}`).join('\n');

      const systemPrompt = getSystemPromptForModule(moduleId);
      const contextCard = buildContextCard(contextText);
      const userPrompt = buildUserPrompt(moduleId, contextCard, existingQuestionsText);

      console.log(
        `Prompt length: system=${systemPrompt.length}, user=${userPrompt.length}, contextCard=${contextCard.length}, history=${existingQuestionsText.length} chars`
      );

      // Dispatch to the appropriate provider
      let actualModelUsed = modelToUse;
      let fallbackFromModel: string | null = null;
      let responseData: GenerationResult;
      try {
        responseData = await generateQuestions(providerId, apiKey, modelToUse, systemPrompt, userPrompt);
      } catch (error: any) {
        // Gemini 2.5 Flash occasionally hits transient network/gateway issues.
        // Auto-fallback to Flash Lite to keep the flow stable.
        if (
          providerId === "google" &&
          modelToUse === "gemini-2.5-flash" &&
          isTransientGoogleConnectionError(error)
        ) {
          const fallbackModel = "gemini-2.5-flash-lite";
          console.warn(
            `Primary model failed, falling back: ${modelToUse} -> ${fallbackModel}. Reason: ${getErrorDetail(error)}`
          );
          responseData = await generateQuestions(providerId, apiKey, fallbackModel, systemPrompt, userPrompt);
          fallbackFromModel = modelToUse;
          actualModelUsed = fallbackModel;
        } else {
          throw error;
        }
      }
      const { title, questions } = responseData;

      // Save to Database
      const batchStmt = db.prepare('INSERT INTO question_batches (module_id, title) VALUES (?, ?)');
      const insertStmt = db.prepare('INSERT INTO questions (batch_id, module_id, content, difficulty, answer) VALUES (?, ?, ?, ?, ?)');

      const transaction = db.transaction((qs: any[], batchTitle: string) => {
        const batchInfo = batchStmt.run(moduleId, batchTitle);
        const batchId = batchInfo.lastInsertRowid;

        for (const q of qs) {
          insertStmt.run(batchId, moduleId, q.content, q.difficulty, q.answer);
        }
        return batchId;
      });

      const batchId = transaction(questions, title);

      res.json({ batchId, title, questions, modelUsed: actualModelUsed, fallbackFromModel });
    } catch (error: any) {
      console.error("Error generating questions:", getErrorDetail(error));
      if (error?.stack) {
        console.error(error.stack);
      }
      res.status(500).json({ error: toClientSafeErrorMessage(error) });
    }
  });

  // Ensure unknown API routes return JSON instead of falling through to Vite HTML.
  app.use("/api", (req, res) => {
    res.status(404).json({
      error: `API route not found: ${req.method} ${req.originalUrl}`,
    });
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
