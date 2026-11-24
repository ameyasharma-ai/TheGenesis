import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import axios from "axios";
import { z } from "zod";
import { findUserById, findUserByUsername, insertUser } from "./db";
import { AuthRequest, requireAuth, signToken } from "./auth";
import { readUserState, writeUserState } from "./storage";
import { AppState, ChatMessage } from "./types";

const app = express();
const port = Number(process.env.PORT || 8787);

console.log("--- Genesis Server Starting ---");
console.log("Port:", port);
console.log("LM Studio URL:", process.env.LMSTUDIO_BASE_URL || "http://127.0.0.1:1234/v1");
console.log("OpenRouter Key:", process.env.OPENROUTER_API_KEY ? "Found (starts with " + process.env.OPENROUTER_API_KEY.substring(0, 8) + "...)" : "Not Found");
console.log("-------------------------------");

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: false,
  })
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

const authSchema = z.object({
  username: z.string().trim().min(3).max(32),
  password: z.string().min(8).max(128),
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/register", async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid credentials format" });
    return;
  }
  const { username, password } = parsed.data;
  if (findUserByUsername(username)) {
    res.status(409).json({ error: "Username already exists" });
    return;
  }
  const id = uuid();
  const password_hash = await bcrypt.hash(password, 12);
  const created_at = new Date().toISOString();
  insertUser({ id, username, password_hash, created_at });
  const token = signToken({ userId: id, username });
  res.status(201).json({ token, user: { id, username, createdAt: created_at } });
});

app.post("/api/auth/login", async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid credentials format" });
    return;
  }
  const { username, password } = parsed.data;
  const user = findUserByUsername(username);
  if (!user) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }
  const token = signToken({ userId: user.id, username: user.username });
  res.json({
    token,
    user: { id: user.id, username: user.username, createdAt: user.created_at },
  });
});

app.get("/api/auth/me", requireAuth, (req: AuthRequest, res) => {
  const user = findUserById(req.auth!.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ id: user.id, username: user.username, createdAt: user.created_at });
});

app.get("/api/state", requireAuth, (req: AuthRequest, res) => {
  const state = readUserState(req.auth!.userId);
  res.json(state);
});

app.put("/api/state", requireAuth, (req: AuthRequest, res) => {
  try {
    const state = req.body as AppState;
    if (!state || typeof state !== "object") {
      res.status(400).json({ error: "Invalid state" });
      return;
    }
    console.log(`Saving state for user ${req.auth!.userId}, weeklyTodos: ${state.weeklyTodos?.length || 0}`);
    writeUserState(req.auth!.userId, state);
    console.log(`State saved successfully for user ${req.auth!.userId}`);
    res.json({ ok: true });
  } catch (error) {
    console.error("Error saving state:", error);
    res.status(500).json({ error: "Failed to save state", details: error instanceof Error ? error.message : String(error) });
  }
});

const aiSchema = z.object({
  model: z.string().min(1),
  personalityPrompt: z.string().min(1),
  history: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1),
    })
  ),
  message: z.string().min(1),
});

const buildMessages = (
  personalityPrompt: string,
  history: { role: "user" | "assistant"; content: string }[],
  message: string
) => [
  {
    role: "system",
    content:
      `${personalityPrompt}\n` +
      "You are embedded in a productivity app. Use the user context to provide practical and motivational guidance.",
  },
  ...history.map((item) => ({ role: item.role, content: item.content })),
  { role: "user", content: message },
];

app.get("/api/ai/models", requireAuth, async (_req: AuthRequest, res) => {
  const lmBaseURL = process.env.LMSTUDIO_BASE_URL || "http://127.0.0.1:1234/v1";
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  
  console.log("Fetching models...");
  console.log("LM Studio Base URL:", lmBaseURL);
  console.log("OpenRouter Key Configured:", !!openRouterKey && openRouterKey !== "your_openrouter_api_key_here");
  
  const models: { id: string; name: string; isLocal: boolean }[] = [];

  // Fetch LM Studio Models
  try {
    console.log("Attempting to fetch models from LM Studio...");
    const lmResult = await axios.get(`${lmBaseURL}/models`, { timeout: 3000 });
    if (Array.isArray(lmResult.data?.data)) {
      lmResult.data.data.forEach((m: any) => {
        if (m.id) {
          models.push({ id: m.id, name: `${m.id} (Local)`, isLocal: true });
        }
      });
      console.log(`Found ${lmResult.data.data.length} local models.`);
    }
  } catch (err) {
    console.log("LM Studio not reachable or returned error, skipping local models.");
  }

  // Fetch OpenRouter Models (only free ones)
  if (openRouterKey && openRouterKey !== "your_openrouter_api_key_here") {
    try {
      console.log("Attempting to fetch free models from OpenRouter...");
      const orResult = await axios.get("https://openrouter.ai/api/v1/models", {
        headers: { 
          Authorization: `Bearer ${openRouterKey}`,
          "HTTP-Referer": "https://github.com/GenesisDashboard",
          "X-Title": "The Genesis Dashboard"
        },
        timeout: 10000,
      });
      if (Array.isArray(orResult.data?.data)) {
        orResult.data.data.forEach((m: any) => {
          // Check if it's free - OpenRouter provides pricing info
          const isFree = m.pricing?.prompt === "0" && m.pricing?.completion === "0";
          if (isFree) {
            const idLower = m.id.toLowerCase();
            const isLarge = idLower.includes("70b") || idLower.includes("405b") || (idLower.includes("llama-3") && !idLower.includes("8b"));
            
            let displayName = m.name || m.id;
            if (isLarge) displayName = `✨ ${displayName} (70B+)`;
            
            models.push({ id: m.id, name: displayName, isLocal: false });
          }
        });
        console.log(`Found ${models.filter(m => !m.isLocal).length} free OpenRouter models.`);
      }
    } catch (err) {
      console.error("Error fetching OpenRouter models:", axios.isAxiosError(err) ? err.message : err);
    }
  } else {
    console.log("No valid OpenRouter API key found in environment variables.");
  }

  console.log(`Total models being sent: ${models.length}`);
  res.json({ models });
});

app.post("/api/ai/chat", requireAuth, async (req: AuthRequest, res) => {
  const parsed = aiSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid AI payload" });
    return;
  }
  const { model, personalityPrompt, history, message } = parsed.data;
  const lmBaseURL = process.env.LMSTUDIO_BASE_URL || "http://127.0.0.1:1234/v1";
  
  // Clean the OpenRouter key - remove quotes if they exist
  let openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey && (openRouterKey.startsWith('"') || openRouterKey.startsWith("'"))) {
    openRouterKey = openRouterKey.substring(1, openRouterKey.length - 1);
  }

  let apiURL = `${lmBaseURL}/chat/completions`;
  let headers: any = { "Content-Type": "application/json" };
  let isLocal = true;

  try {
    const lmModels = await axios.get(`${lmBaseURL}/models`, { timeout: 2000 });
    const localModelExists = lmModels.data?.data?.some((m: any) => m.id === model);
    if (!localModelExists && (model.includes("/") || (openRouterKey && openRouterKey !== "your_openrouter_api_key_here"))) {
      apiURL = "https://openrouter.ai/api/v1/chat/completions";
      headers["Authorization"] = `Bearer ${openRouterKey}`;
      isLocal = false;
    }
  } catch (err) {
    if (openRouterKey && openRouterKey !== "your_openrouter_api_key_here") {
      apiURL = "https://openrouter.ai/api/v1/chat/completions";
      headers["Authorization"] = `Bearer ${openRouterKey}`;
      isLocal = false;
    } else {
      res.status(502).json({ error: "LM Studio is offline and no OpenRouter key is configured." });
      return;
    }
  }

  console.log(`Chatting from ${isLocal ? "Local" : "OpenRouter"} using model: ${model}`);

  try {
    const result = await axios.post(
      apiURL,
      {
        model,
        temperature: 0.7,
        messages: buildMessages(personalityPrompt, history, message),
      },
      {
        headers,
        timeout: 60000,
      }
    );
    const content = result.data?.choices?.[0]?.message?.content;
    if (!content) {
      res.status(502).json({ error: `${isLocal ? "LM Studio" : "OpenRouter"} returned empty response` });
      return;
    }
    const responseMessage: ChatMessage = {
      id: uuid(),
      role: "assistant",
      content,
      createdAt: new Date().toISOString(),
    };
    res.json(responseMessage);
  } catch (error) {
    const messageFromError =
      axios.isAxiosError(error) && error.response?.data
        ? JSON.stringify(error.response.data)
        : `Unable to reach ${isLocal ? "LM Studio" : "OpenRouter"}`;
    res.status(502).json({ error: messageFromError });
  }
});

app.post("/api/ai/chat/stream", requireAuth, async (req: AuthRequest, res) => {
  const parsed = aiSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid AI payload" });
    return;
  }
  const { model, personalityPrompt, history, message } = parsed.data;
  
  const lmBaseURL = process.env.LMSTUDIO_BASE_URL || "http://127.0.0.1:1234/v1";
  // Clean the OpenRouter key - remove quotes if they exist
  let openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey && (openRouterKey.startsWith('"') || openRouterKey.startsWith("'"))) {
    openRouterKey = openRouterKey.substring(1, openRouterKey.length - 1);
  }

  let apiURL = `${lmBaseURL}/chat/completions`;
  let headers: any = { "Content-Type": "application/json" };
  let isLocal = true;

  // Check if LM Studio is reachable first by trying to get models
  try {
    const lmModels = await axios.get(`${lmBaseURL}/models`, { timeout: 2000 });
    const localModelExists = lmModels.data?.data?.some((m: any) => m.id === model);
    
    // Explicitly check for slashes as OpenRouter models usually follow "provider/model" format
    if (!localModelExists && (model.includes("/") || (openRouterKey && openRouterKey !== "your_openrouter_api_key_here"))) {
      apiURL = "https://openrouter.ai/api/v1/chat/completions";
      headers["Authorization"] = `Bearer ${openRouterKey}`;
      headers["HTTP-Referer"] = "https://github.com/GenesisDashboard"; 
      headers["X-Title"] = "The Genesis Dashboard";
      isLocal = false;
    }
  } catch (err) {
    if (openRouterKey && openRouterKey !== "your_openrouter_api_key_here") {
      apiURL = "https://openrouter.ai/api/v1/chat/completions";
      headers["Authorization"] = `Bearer ${openRouterKey}`;
      headers["HTTP-Referer"] = "https://github.com/GenesisDashboard";
      headers["X-Title"] = "The Genesis Dashboard";
      isLocal = false;
    } else {
      res.status(502).json({ error: "LM Studio is offline and no OpenRouter key is configured." });
      return;
    }
  }

  console.log(`Streaming from ${isLocal ? "Local" : "OpenRouter"} using model: ${model}`);
  
  try {
    const result = await axios.post(
      apiURL,
      {
        model,
        temperature: 0.7,
        stream: true,
        messages: buildMessages(personalityPrompt, history, message),
      },
      {
        responseType: "stream",
        headers,
        timeout: 120000,
      }
    );
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    let buffer = "";
    result.data.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf-8");
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.replace(/^data:\s*/, "");
        if (payload === "[DONE]") {
          res.end();
          return;
        }
        try {
          const json = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
          };
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            res.write(content);
          }
        } catch {
          continue;
        }
      }
    });
    result.data.on("end", () => res.end());
    result.data.on("error", (err: Error) => {
      console.error("Stream error:", err);
      res.end();
    });
  } catch (error) {
    let messageFromError = `Unable to stream from ${isLocal ? "LM Studio" : "OpenRouter"}`;
    if (axios.isAxiosError(error)) {
      if (error.response?.data) {
        messageFromError = typeof error.response.data === "string" ? error.response.data : JSON.stringify(error.response.data);
      } else if (error.message) {
        messageFromError = error.message;
      }
    }
    if (!res.headersSent) {
      res.status(502).json({ error: messageFromError });
    }
  }
});

app.listen(port, () => {
  console.log(`Genesis API running on http://localhost:${port}`);
});
