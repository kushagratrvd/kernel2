import { createTRPCRouter, creatorProcedure } from "../init";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { userApiKey } from "@/server/db/user-api-key-schema";
import { question, category, topic } from "@/server/db/question-bank-schema";
import { auditLog } from "@/server/db/audit-schema";
import { encrypt, decrypt, maskApiKey } from "@/lib/encryption";
import { executeSubmission, checkOutputsMatch } from "@/server/codebox";

// ─── Constants ────────────────────────────────────────────────────────────────

export interface ModelOption {
  id: string;
  label: string;
  provider: "gemini" | "groq";
  description?: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  // Google Gemini
  { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash", provider: "gemini", description: "Google's recommended fast flash model" },
  { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash", provider: "gemini", description: "Google's advanced flash model" },
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", provider: "gemini", description: "Next-gen flash model by Google" },
  // Groq Models (Top 4 Active Models)
  { id: "openai/gpt-oss-120b", label: "GPT OSS 120B", provider: "groq", description: "OpenAI flagship 120B open-weight (500 tps)" },
  { id: "openai/gpt-oss-20b", label: "GPT OSS 20B", provider: "groq", description: "OpenAI high-speed model (1000 tps)" },
  { id: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B", provider: "groq", description: "Alibaba Cloud Qwen 3.8 (450 tps)" },
  { id: "groq/compound-mini", label: "Compound Mini", provider: "groq", description: "Groq built-in reasoning system (450 tps)" },
];

// Default language for canonical solution execution (Python)
const CANONICAL_LANGUAGE_ID = 71;

/**
 * Creates a GoogleGenAI client configured with Referer & Origin headers.
 * This allows API keys with HTTP Referrer restrictions (e.g. http://localhost:3000/*)
 * to be validated and used from the backend server.
 */
function createGeminiClient(apiKey: string): GoogleGenAI {
  const referer = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  const normalizedReferer = referer.endsWith("/") ? referer : `${referer}/`;
  const origin = referer.replace(/\/+$/, "");

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        Referer: normalizedReferer,
        Origin: origin,
      },
    },
  });
}

/**
 * Calls Groq's OpenAI-compatible chat completions endpoint with JSON mode enabled.
 */
async function callGroq({
  apiKey,
  model,
  prompt,
}: {
  apiKey: string;
  model: string;
  prompt: string;
}): Promise<string> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "You are an expert technical assessment creator. Output ONLY valid JSON containing a 'questions' array.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody?.error?.message || `HTTP ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Groq API returned an empty response.");
  }
  return content;
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const mcqOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

const testCaseSchema = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  isSample: z.boolean(),
});

// Shape AI must return for MCQ
const aiMcqSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  options: z.array(mcqOptionSchema).min(2),
  correctOptionId: z.string().min(1),
  hint: z.string().optional().nullable(),
  questionScore: z.number().min(1).default(10),
});

// Shape AI must return for Code
const aiCodeSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  starterCode: z.record(z.string(), z.string()),
  testCases: z.array(testCaseSchema).min(1),
  canonicalSolution: z.string().min(1), // Python canonical — not persisted
  allowedLanguages: z.array(z.number()).min(1),
  timeLimit: z.number().min(1).max(60).default(5),
  memoryLimit: z.number().min(1000).default(128000),
  hint: z.string().optional().nullable(),
  questionScore: z.number().min(1).default(10),
});

// Shape AI must return for Numerical (stored as "text" type)
const aiNumericalSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  correctOptionId: z.string().min(1), // The numerical answer as string
  hint: z.string().optional().nullable(),
  questionScore: z.number().min(1).default(10),
});

// ─── Prompt Builder ───────────────────────────────────────────────────────────

function buildPrompt(input: {
  questionType: "mcq" | "code" | "text";
  prompt: string;
  difficulty: "easy" | "medium" | "hard";
  count: number;
  optionCount?: number;
  testCaseCount?: number;
}): string {
  const difficultyDesc = {
    easy: "straightforward, suitable for beginners",
    medium: "moderately challenging, requiring solid understanding",
    hard: "challenging, requiring advanced knowledge and problem-solving",
  }[input.difficulty];

  if (input.questionType === "mcq") {
    return `You are an expert question author for a programming contest platform.
Generate EXACTLY ${input.count} unique MCQ question(s) about: "${input.prompt}".

CRITICAL REQUIREMENT:
- You MUST generate EXACTLY ${input.count} question(s) in the "questions" array.
- The "questions" array length MUST be ${input.count}. Do not generate fewer or stop early.

Difficulty: ${input.difficulty} (${difficultyDesc})

Requirements for each question:
- Each question must be ${difficultyDesc}.
- Generate exactly ${input.optionCount ?? 4} answer options per question.
- Option IDs must be lowercase letters: "a", "b", "c", "d" (etc).
- correctOptionId must match one of the option IDs exactly.
- description should be the full question body (can include markdown, code snippets).
- questionScore should reflect difficulty (easy: 5-10, medium: 10-20, hard: 20-40).

Return ONLY valid JSON matching this schema with EXACTLY ${input.count} item(s) in the "questions" array:
{
  "questions": [
    {
      "title": "Short descriptive title",
      "description": "Full question text (markdown supported)",
      "options": [{"id": "a", "text": "Option A"}, {"id": "b", "text": "Option B"}, {"id": "c", "text": "Option C"}, {"id": "d", "text": "Option D"}],
      "correctOptionId": "a",
      "hint": "Optional hint or null",
      "questionScore": 10
    }
  ]
}`;
  }

  if (input.questionType === "code") {
    return `You are an expert competitive programming problem author.
Generate EXACTLY ${input.count} unique coding problem(s) about: "${input.prompt}".

CRITICAL REQUIREMENT:
- You MUST generate EXACTLY ${input.count} coding problem(s) in the "questions" array.
- The "questions" array length MUST be ${input.count}. Each problem must have a distinct problem statement and title.

Difficulty: ${input.difficulty} (${difficultyDesc})

Requirements for each problem:
- description: Full problem statement in markdown. Include problem explanation, input format, output format, constraints.
- starterCode: A record mapping language IDs to starter/template code. Always include language ID 71 (Python 3). Other optional IDs: 63 (JavaScript/Node), 54 (C++), 50 (C), 62 (Java).
- testCases: Exactly ${input.testCaseCount ?? 5} test cases. At least 2 must have isSample: true (visible to contestants). The rest isSample: false (hidden).
- canonicalSolution: A COMPLETE, CORRECT Python 3 solution that passes ALL test cases. This is used for validation only.
- allowedLanguages: Array of language IDs supported. Must include 71.
- timeLimit: seconds (1-30). memoryLimit: KB (32000-512000).
- questionScore should reflect difficulty (easy: 10-20, medium: 20-40, hard: 40-100).

Return ONLY valid JSON matching this schema with EXACTLY ${input.count} item(s) in the "questions" array:
{
  "questions": [
    {
      "title": "Problem Title",
      "description": "Full problem statement in markdown",
      "starterCode": {"71": "import sys\\n\\n# Write your solution here"},
      "testCases": [
        {"input": "5\\n1 2 3 4 5", "expectedOutput": "15", "isSample": true},
        {"input": "3\\n10 20 30", "expectedOutput": "60", "isSample": false}
      ],
      "canonicalSolution": "import sys\\n\\ndata = sys.stdin.read().split()\\nn = int(data[0])\\nnums = list(map(int, data[1:n+1]))\\nprint(sum(nums))",
      "allowedLanguages": [71, 63, 54, 62],
      "timeLimit": 5,
      "memoryLimit": 128000,
      "hint": "Optional hint or null",
      "questionScore": 20
    }
  ]
}`;
  }

  // Numerical
  return `You are an expert question author.
Generate EXACTLY ${input.count} unique numerical answer question(s) about: "${input.prompt}".

CRITICAL REQUIREMENT:
- You MUST generate EXACTLY ${input.count} question(s) in the "questions" array.
- The "questions" array length MUST be ${input.count}. Do not generate fewer or stop early.

Difficulty: ${input.difficulty} (${difficultyDesc})

Requirements for each question:
- The answer (correctOptionId) MUST be a number stored as a string (e.g. "42", "3.14", "-7").
- description should be the full question text.
- questionScore should reflect difficulty (easy: 5-10, medium: 10-20, hard: 20-40).

Return ONLY valid JSON matching this schema with EXACTLY ${input.count} item(s) in the "questions" array:
{
  "questions": [
    {
      "title": "Short descriptive title",
      "description": "Full question text (markdown supported)",
      "correctOptionId": "42",
      "hint": "Optional hint or null",
      "questionScore": 10
    }
  ]
}`;
}

// ─── Business Rule Validators ─────────────────────────────────────────────────

function validateMcqQuestion(q: z.infer<typeof aiMcqSchema>, requestedOptions: number) {
  const errors: string[] = [];
  if (q.options.length !== requestedOptions) {
    errors.push(`Expected ${requestedOptions} options, got ${q.options.length}`);
  }
  const ids = q.options.map((o) => o.id);
  if (new Set(ids).size !== ids.length) errors.push("Option IDs are not unique");
  if (!ids.includes(q.correctOptionId)) errors.push(`correctOptionId "${q.correctOptionId}" not found in options`);
  return errors;
}

function validateCodeQuestion(q: z.infer<typeof aiCodeSchema>) {
  const errors: string[] = [];
  if (q.testCases.length === 0) errors.push("No test cases generated");
  const hasSample = q.testCases.some((tc) => tc.isSample);
  if (!hasSample) errors.push("No sample test case (isSample: true) found");
  if (!q.starterCode["71"]) errors.push("Missing Python (71) starter code");
  if (!q.allowedLanguages.includes(71)) errors.push("Python (71) not in allowedLanguages");
  if (q.timeLimit <= 0) errors.push("timeLimit must be > 0");
  if (q.memoryLimit <= 0) errors.push("memoryLimit must be > 0");
  return errors;
}

function validateNumericalQuestion(q: z.infer<typeof aiNumericalSchema>) {
  const errors: string[] = [];
  const parsed = Number(q.correctOptionId);
  if (isNaN(parsed)) errors.push(`correctOptionId "${q.correctOptionId}" is not a valid number`);
  return errors;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const aiRouter = createTRPCRouter({
  // ─── Model Discovery ───────────────────────────────────────────────────────

  listModels: creatorProcedure.query(() => {
    return AVAILABLE_MODELS;
  }),

  // ─── API Key Management ────────────────────────────────────────────────────

  listKeys: creatorProcedure.query(async ({ ctx }) => {
    const keys = await ctx.db.query.userApiKey.findMany({
      where: eq(userApiKey.userId, ctx.user.id),
      columns: {
        id: true,
        name: true,
        provider: true,
        maskedKey: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: (k, { desc }) => [desc(k.createdAt)],
    });
    return keys;
  }),

  addKey: creatorProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        provider: z.enum(["gemini", "groq"]).default("gemini"),
        apiKey: z.string().min(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Live validation
      if (input.provider === "gemini") {
        try {
          const genai = createGeminiClient(input.apiKey);
          const candidateModels = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.8-flash"];
          let lastErr: any = null;
          let validated = false;
          for (const m of candidateModels) {
            try {
              await genai.models.generateContent({
                model: m,
                contents: "ping",
                config: { maxOutputTokens: 5 },
              });
              validated = true;
              break;
            } catch (e: any) {
              lastErr = e;
              const str = String(e?.message);
              if (
                str.includes("Requests from referer") ||
                str.includes("API_KEY_INVALID") ||
                str.includes("API_KEY_HTTP_REFERRER_BLOCKED") ||
                str.includes("PERMISSION_DENIED")
              ) {
                break;
              }
            }
          }
          if (!validated) {
            throw lastErr || new Error("Failed to validate key with Gemini API");
          }
        } catch (err: any) {
          let msg = "Invalid or revoked key";
          if (err?.message) {
            try {
              const parsed = typeof err.message === "string" && err.message.trim().startsWith("{")
                ? JSON.parse(err.message)
                : null;
              const errObj = parsed?.error ?? parsed;
              const isReferrerBlocked =
                errObj?.details?.some((d: any) => d.reason === "API_KEY_HTTP_REFERRER_BLOCKED") ||
                errObj?.message?.includes("Requests from referer") ||
                String(err.message).includes("API_KEY_HTTP_REFERRER_BLOCKED") ||
                String(err.message).includes("Requests from referer");

              if (isReferrerBlocked) {
                msg = "This API key has HTTP Referrer restrictions in Google Cloud. To fix: in Google Cloud Console (APIs & Services > Credentials), either (A) add 'http://localhost:3000/*' to your allowed website referrers, or (B) set Application restrictions to 'None' and set API restrictions to 'Generative Language API'.";
              } else if (errObj?.message) {
                msg = errObj.message;
              } else {
                msg = err.message;
              }
            } catch {
              if (String(err.message).includes("Requests from referer") || String(err.message).includes("API_KEY_HTTP_REFERRER_BLOCKED")) {
                msg = "This API key has HTTP Referrer restrictions in Google Cloud. To fix: in Google Cloud Console (APIs & Services > Credentials), either (A) add 'http://localhost:3000/*' to allowed website referrers, or (B) set Application restrictions to 'None' and restrict the key by API to 'Generative Language API'.";
              } else {
                msg = err.message;
              }
            }
          }
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Gemini API key validation failed: ${msg}`,
          });
        }
      } else if (input.provider === "groq") {
        try {
          const res = await fetch("https://api.groq.com/openai/v1/models", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${input.apiKey.trim()}`,
              "Content-Type": "application/json",
            },
          });

          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            const msg = errBody?.error?.message || `HTTP ${res.status} ${res.statusText}`;
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Groq verification failed: ${msg}`,
            });
          }
        } catch (err: any) {
          if (err instanceof TRPCError) throw err;
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Failed to verify Groq API key: ${err?.message || "Connection failed"}`,
          });
        }
      }

      // 2. Encrypt and store
      const masked = maskApiKey(input.apiKey.trim());
      const { ciphertext, iv, authTag } = encrypt(input.apiKey.trim());

      const [newKey] = await ctx.db
        .insert(userApiKey)
        .values({
          id: crypto.randomUUID(),
          userId: ctx.user.id,
          name: input.name.trim(),
          provider: input.provider,
          encryptedKey: ciphertext,
          iv,
          authTag,
          maskedKey: masked,
        })
        .returning({
          id: userApiKey.id,
          name: userApiKey.name,
          provider: userApiKey.provider,
          maskedKey: userApiKey.maskedKey,
          lastUsedAt: userApiKey.lastUsedAt,
          createdAt: userApiKey.createdAt,
        });

      await ctx.db.insert(auditLog).values({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        action: "AI_KEY_ADDED",
        entityType: "user_api_key",
        entityId: newKey.id,
        metadata: { name: input.name.trim(), provider: input.provider },
      });

      return newKey;
    }),

  deleteKey: creatorProcedure
    .input(z.object({ keyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Strict ownership: only owner can delete
      const key = await ctx.db.query.userApiKey.findFirst({
        where: and(
          eq(userApiKey.id, input.keyId),
          eq(userApiKey.userId, ctx.user.id)
        ),
      });

      if (!key) {
        throw new TRPCError({ code: "NOT_FOUND", message: "API key not found." });
      }

      await ctx.db.delete(userApiKey).where(eq(userApiKey.id, input.keyId));

      await ctx.db.insert(auditLog).values({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        action: "AI_KEY_DELETED",
        entityType: "user_api_key",
        entityId: input.keyId,
        metadata: { name: key.name },
      });

      return { success: true };
    }),

  // ─── Question Generation ───────────────────────────────────────────────────

  generateQuestions: creatorProcedure
    .input(
      z.object({
        keyId: z.string(),
        model: z.string().min(1),
        prompt: z.string().min(5),
        categoryId: z.string().optional().nullable(),
        topicId: z.string().optional().nullable(),
        questionType: z.enum(["mcq", "code", "text"]),
        difficulty: z.enum(["easy", "medium", "hard"]),
        count: z.number().min(1),
        testCaseCount: z.number().min(1).max(10).optional(),
        optionCount: z.number().min(2).max(8).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Strict ownership — get user's own key only
      const keyRecord = await ctx.db.query.userApiKey.findFirst({
        where: and(
          eq(userApiKey.id, input.keyId),
          eq(userApiKey.userId, ctx.user.id)
        ),
      });

      if (!keyRecord) {
        throw new TRPCError({ code: "NOT_FOUND", message: "API key not found." });
      }

      // 2. Decrypt key
      const plainKey = decrypt({
        ciphertext: keyRecord.encryptedKey,
        iv: keyRecord.iv,
        authTag: keyRecord.authTag,
      });

      // 3. Update lastUsedAt
      await ctx.db
        .update(userApiKey)
        .set({ lastUsedAt: new Date() })
        .where(eq(userApiKey.id, keyRecord.id));

      // 4. Audit: generation started
      const auditId = crypto.randomUUID();
      await ctx.db.insert(auditLog).values({
        id: auditId,
        userId: ctx.user.id,
        action: "AI_GENERATION_STARTED",
        entityType: "ai_generation",
        entityId: auditId,
        metadata: {
          provider: keyRecord.provider,
          model: input.model,
          questionType: input.questionType,
          difficulty: input.difficulty,
          count: input.count,
        },
      });

      // 5. Build prompt and call Provider (Groq or Gemini)
      const promptText = buildPrompt({
        questionType: input.questionType,
        prompt: input.prompt,
        difficulty: input.difficulty,
        count: input.count,
        optionCount: input.optionCount,
        testCaseCount: input.testCaseCount,
      });

      let rawText: string;
      if (keyRecord.provider === "groq") {
        try {
          rawText = await callGroq({
            apiKey: plainKey,
            model: input.model,
            prompt: promptText,
          });
        } catch (err: any) {
          await ctx.db.insert(auditLog).values({
            id: crypto.randomUUID(),
            userId: ctx.user.id,
            action: "AI_GENERATION_FAILED",
            entityType: "ai_generation",
            entityId: auditId,
            metadata: { error: err?.message ?? "Groq API call failed" },
          });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Groq API error: ${err?.message ?? "Unknown error"}`,
          });
        }
      } else {
        try {
          const genai = createGeminiClient(plainKey);
          const response = await genai.models.generateContent({
            model: input.model,
            contents: promptText,
            config: {
              responseMimeType: "application/json",
              maxOutputTokens: 8192,
            },
          });
          rawText = response.text ?? "";
        } catch (err: any) {
          await ctx.db.insert(auditLog).values({
            id: crypto.randomUUID(),
            userId: ctx.user.id,
            action: "AI_GENERATION_FAILED",
            entityType: "ai_generation",
            entityId: auditId,
            metadata: { error: err?.message ?? "Gemini API call failed" },
          });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Gemini API error: ${err?.message ?? "Unknown error"}`,
          });
        }
      }

      // 6. Parse JSON
      let parsed: unknown;
      try {
        // Strip markdown code fences if AI adds them
        const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        await ctx.db.insert(auditLog).values({
          id: crypto.randomUUID(),
          userId: ctx.user.id,
          action: "AI_GENERATION_FAILED",
          entityType: "ai_generation",
          entityId: auditId,
          metadata: { error: "JSON parse failed", rawPreview: rawText.slice(0, 200) },
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI returned invalid JSON. Please try again.",
        });
      }

      let questionsList: unknown[] = [];
      if (Array.isArray(parsed)) {
        questionsList = parsed;
      } else if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        if (Array.isArray(obj.questions)) {
          questionsList = obj.questions;
        } else if (Array.isArray(obj.problems)) {
          questionsList = obj.problems;
        } else if (Array.isArray(obj.data)) {
          questionsList = obj.data;
        } else if (Array.isArray(obj.items)) {
          questionsList = obj.items;
        } else {
          const values = Object.values(obj);
          if (
            values.length > 0 &&
            typeof values[0] === "object" &&
            values[0] !== null &&
            ("title" in (values[0] as any) || "description" in (values[0] as any))
          ) {
            questionsList = values;
          } else {
            questionsList = [parsed];
          }
        }
      } else {
        questionsList = [parsed];
      }

      if (!questionsList || questionsList.length === 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI response did not contain questions. Please try again.",
        });
      }

      // 7. Validate each question via Zod + business rules
      const results: Array<{
        draft: Record<string, unknown>;
        canonicalSolution?: string; // code only — for client preview
        validationErrors: string[];
        testValidation?: Array<{ input: string; expectedOutput: string; passed: boolean; error?: string }>;
      }> = [];

      for (let i = 0; i < questionsList.length; i++) {
        const raw = questionsList[i];
        const questionErrors: string[] = [];

        if (input.questionType === "mcq") {
          const zodResult = aiMcqSchema.safeParse(raw);
          if (!zodResult.success) {
            const issues = zodResult.error.issues.map((e) => `${e.path.map(String).join(".")}: ${e.message}`);
            results.push({ draft: raw as Record<string, unknown>, validationErrors: issues });
            continue;
          }
          const q = zodResult.data;
          const bizErrors = validateMcqQuestion(q, input.optionCount ?? 4);
          questionErrors.push(...bizErrors);
          results.push({
            draft: {
              title: q.title,
              description: q.description,
              options: q.options,
              correctOptionId: q.correctOptionId,
              hint: q.hint ?? null,
              questionScore: q.questionScore,
            },
            validationErrors: questionErrors,
          });
        } else if (input.questionType === "code") {
          const zodResult = aiCodeSchema.safeParse(raw);
          if (!zodResult.success) {
            const issues = zodResult.error.issues.map((e) => `${e.path.map(String).join(".")}: ${e.message}`);
            results.push({ draft: raw as Record<string, unknown>, validationErrors: issues });
            continue;
          }
          const q = zodResult.data;
          const bizErrors = validateCodeQuestion(q);
          questionErrors.push(...bizErrors);

          results.push({
            draft: {
              title: q.title,
              description: q.description,
              starterCode: q.starterCode,
              testCases: q.testCases,
              allowedLanguages: q.allowedLanguages,
              timeLimit: q.timeLimit,
              memoryLimit: q.memoryLimit,
              hint: q.hint ?? null,
              questionScore: q.questionScore,
            },
            canonicalSolution: q.canonicalSolution, // For client preview and on-demand execution
            validationErrors: questionErrors,
          });
        } else {
          // Numerical
          const zodResult = aiNumericalSchema.safeParse(raw);
          if (!zodResult.success) {
            const issues = zodResult.error.issues.map((e) => `${e.path.map(String).join(".")}: ${e.message}`);
            results.push({ draft: raw as Record<string, unknown>, validationErrors: issues });
            continue;
          }
          const q = zodResult.data;
          const bizErrors = validateNumericalQuestion(q);
          questionErrors.push(...bizErrors);
          results.push({
            draft: {
              title: q.title,
              description: q.description,
              correctOptionId: q.correctOptionId,
              hint: q.hint ?? null,
              questionScore: q.questionScore,
            },
            validationErrors: questionErrors,
          });
        }
      }

      // 9. Audit: completed
      const passedCount = results.filter((r) => r.validationErrors.length === 0).length;
      await ctx.db.insert(auditLog).values({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        action: "AI_GENERATION_COMPLETED",
        entityType: "ai_generation",
        entityId: auditId,
        metadata: {
          provider: "gemini",
          model: input.model,
          questionType: input.questionType,
          requestedCount: input.count,
          returnedCount: results.length,
          passedValidation: passedCount,
        },
      });

      return {
        questions: results,
        meta: {
          questionType: input.questionType,
          categoryId: input.categoryId ?? null,
          topicId: input.topicId ?? null,
          difficulty: input.difficulty,
        },
      };
    }),

  // ─── Regenerate Single Question ────────────────────────────────────────────

  regenerateQuestion: creatorProcedure
    .input(
      z.object({
        keyId: z.string(),
        model: z.string().min(1),
        prompt: z.string().min(5),
        questionType: z.enum(["mcq", "code", "text"]),
        difficulty: z.enum(["easy", "medium", "hard"]),
        testCaseCount: z.number().min(1).max(10).optional(),
        optionCount: z.number().min(2).max(8).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Reuse the same generation flow inline with count=1
      // (Avoids circular self-reference — aiRouter cannot call itself)
      const keyRecord = await ctx.db.query.userApiKey.findFirst({
        where: and(eq(userApiKey.id, input.keyId), eq(userApiKey.userId, ctx.user.id)),
      });
      if (!keyRecord) throw new TRPCError({ code: "NOT_FOUND", message: "API key not found." });

      const plainKey = decrypt({
        ciphertext: keyRecord.encryptedKey,
        iv: keyRecord.iv,
        authTag: keyRecord.authTag,
      });

      await ctx.db.update(userApiKey).set({ lastUsedAt: new Date() }).where(eq(userApiKey.id, keyRecord.id));

      const promptText = buildPrompt({
        questionType: input.questionType,
        prompt: input.prompt,
        difficulty: input.difficulty,
        count: 1,
        optionCount: input.optionCount,
        testCaseCount: input.testCaseCount,
      });

      let rawText: string;
      if (keyRecord.provider === "groq") {
        try {
          rawText = await callGroq({
            apiKey: plainKey,
            model: input.model,
            prompt: promptText,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Groq API call failed";
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Groq API error: ${msg}` });
        }
      } else {
        try {
          const genai = createGeminiClient(plainKey);
          const response = await genai.models.generateContent({
            model: input.model,
            contents: promptText,
            config: {
              responseMimeType: "application/json",
              maxOutputTokens: 8192,
            },
          });
          rawText = response.text ?? "";
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Gemini API call failed";
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Gemini API error: ${msg}` });
        }
      }

      let parsed: unknown;
      try {
        const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI returned invalid JSON. Please try again." });
      }

      const arr = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as any)?.questions)
        ? (parsed as any).questions
        : (parsed as any)?.question
        ? [(parsed as any).question]
        : [parsed];
      const raw = arr[0];

      if (input.questionType === "mcq") {
        const zodResult = aiMcqSchema.safeParse(raw);
        if (!zodResult.success) {
          const issues = zodResult.error.issues.map((e) => `${e.path.map(String).join(".")}: ${e.message}`);
          return { draft: raw as Record<string, unknown>, validationErrors: issues };
        }
        const q = zodResult.data;
        return {
          draft: { title: q.title, description: q.description, options: q.options, correctOptionId: q.correctOptionId, hint: q.hint ?? null, questionScore: q.questionScore },
          validationErrors: validateMcqQuestion(q, input.optionCount ?? 4),
        };
      } else if (input.questionType === "code") {
        const zodResult = aiCodeSchema.safeParse(raw);
        if (!zodResult.success) {
          const issues = zodResult.error.issues.map((e) => `${e.path.map(String).join(".")}: ${e.message}`);
          return { draft: raw as Record<string, unknown>, validationErrors: issues };
        }
        const q = zodResult.data;
        const bizErrors = validateCodeQuestion(q);
        return {
          draft: { title: q.title, description: q.description, starterCode: q.starterCode, testCases: q.testCases, allowedLanguages: q.allowedLanguages, timeLimit: q.timeLimit, memoryLimit: q.memoryLimit, hint: q.hint ?? null, questionScore: q.questionScore },
          canonicalSolution: q.canonicalSolution,
          validationErrors: bizErrors,
        };
      } else {
        const zodResult = aiNumericalSchema.safeParse(raw);
        if (!zodResult.success) {
          const issues = zodResult.error.issues.map((e) => `${e.path.map(String).join(".")}: ${e.message}`);
          return { draft: raw as Record<string, unknown>, validationErrors: issues };
        }
        const q = zodResult.data;
        return {
          draft: { title: q.title, description: q.description, correctOptionId: q.correctOptionId, hint: q.hint ?? null, questionScore: q.questionScore },
          validationErrors: validateNumericalQuestion(q),
        };
      }
    }),

  // ─── Execute Code Test Cases on Codebox ─────────────────────────────────────

  runCode: creatorProcedure
    .input(
      z.object({
        sourceCode: z.string().min(1),
        languageId: z.number().default(CANONICAL_LANGUAGE_ID),
        testCases: z.array(
          z.object({
            input: z.string(),
            expectedOutput: z.string(),
            isSample: z.boolean().optional(),
          })
        ).min(1),
        timeLimit: z.number().optional().default(5),
        memoryLimit: z.number().optional().default(128000),
      })
    )
    .mutation(async ({ input }) => {
      const results = await Promise.all(
        input.testCases.map(async (tc) => {
          try {
            const runResult = await executeSubmission({
              source_code: input.sourceCode,
              language_id: input.languageId,
              stdin: tc.input,
              expected_output: tc.expectedOutput,
              cpu_time_limit: input.timeLimit,
              memory_limit: input.memoryLimit,
            });
            const passed = checkOutputsMatch(runResult.stdout, tc.expectedOutput);
            return {
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              stdout: runResult.stdout ?? "",
              passed,
              error: passed
                ? undefined
                : (runResult.stderr || runResult.compile_output || `Expected "${tc.expectedOutput}", got "${runResult.stdout?.trim() ?? ""}"`),
            };
          } catch (err: any) {
            return {
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              stdout: "",
              passed: false,
              error: err?.message || "Execution failed on Codebox",
            };
          }
        })
      );
      return results;
    }),

  // ─── Batch Save ────────────────────────────────────────────────────────────

  saveGeneratedQuestions: creatorProcedure
    .input(
      z.object({
        questions: z.array(
          z.object({
            questionType: z.enum(["mcq", "code", "text"]),
            categoryId: z.string().optional().nullable(),
            topicId: z.string().optional().nullable(),
            difficulty: z.enum(["easy", "medium", "hard"]),
            draft: z.object({
              title: z.string().min(1),
              description: z.string().min(1),
              options: z.array(z.object({ id: z.string(), text: z.string() })).optional().nullable(),
              correctOptionId: z.string().optional().nullable(),
              hint: z.string().optional().nullable(),
              questionScore: z.number().min(1),
              starterCode: z.record(z.string(), z.string()).optional().nullable(),
              allowedLanguages: z.array(z.number()).optional().nullable(),
              timeLimit: z.number().min(1).max(60).optional().nullable(),
              memoryLimit: z.number().min(1000).optional().nullable(),
              testCases: z
                .array(
                  z.object({
                    input: z.string(),
                    expectedOutput: z.string(),
                    isSample: z.boolean(),
                  })
                )
                .optional()
                .nullable(),
            }),
          })
        ).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate category/topic existence
      for (const q of input.questions) {
        if (q.categoryId) {
          const cat = await ctx.db.query.category.findFirst({
            where: eq(category.id, q.categoryId),
          });
          if (!cat) throw new TRPCError({ code: "BAD_REQUEST", message: `Category "${q.categoryId}" not found.` });
        }
        if (q.topicId) {
          const top = await ctx.db.query.topic.findFirst({
            where: eq(topic.id, q.topicId),
          });
          if (!top) throw new TRPCError({ code: "BAD_REQUEST", message: `Topic "${q.topicId}" not found.` });
        }
      }

      // Batch insert in a transaction
      const savedIds: string[] = [];

      await ctx.db.transaction(async (tx) => {
        for (const q of input.questions) {
          const questionId = crypto.randomUUID();

          // Strip canonicalSolution if it somehow slipped into the draft
          const safeDraft = { ...q.draft } as Record<string, unknown>;
          delete safeDraft["canonicalSolution"];
          delete safeDraft["_canonicalSolution"];

          await tx.insert(question).values({
            id: questionId,
            questionType: q.questionType,
            categoryId: q.categoryId ?? null,
            topicId: q.topicId ?? null,
            difficulty: q.difficulty,
            status: "DRAFT",
            currentVersionId: null,
            currentDraft: safeDraft,
            createdById: ctx.user.id,
          });

          await tx.insert(auditLog).values({
            id: crypto.randomUUID(),
            userId: ctx.user.id,
            action: "QUESTION_CREATED",
            entityType: "question",
            entityId: questionId,
            metadata: {
              questionType: q.questionType,
              difficulty: q.difficulty,
              title: q.draft.title,
              source: "ai_generated",
            },
          });

          savedIds.push(questionId);
        }
      });

      // Audit: batch saved
      await ctx.db.insert(auditLog).values({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        action: "AI_QUESTIONS_SAVED",
        entityType: "question",
        entityId: savedIds[0]!,
        metadata: { savedCount: savedIds.length, questionIds: savedIds },
      });

      return { savedIds };
    }),
});
