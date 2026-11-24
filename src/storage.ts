import fs from "node:fs";
import path from "node:path";
import { createDefaultState } from "./defaults";
import { AppState } from "./types";

const dataRoot = path.resolve(process.cwd(), "data");

const ensureDir = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const userDir = (userId: string) => path.join(dataRoot, "users", userId);
const statePath = (userId: string) => path.join(userDir(userId), "app-state.json");

export const readUserState = (userId: string): AppState => {
  ensureDir(userDir(userId));
  const file = statePath(userId);
  if (!fs.existsSync(file)) {
    const initial = createDefaultState();
    fs.writeFileSync(file, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  try {
    const data = fs.readFileSync(file, "utf-8");
    const parsed = JSON.parse(data) as AppState;
    // Validate that we have a valid state object
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid state format");
    }
    return parsed;
  } catch (error) {
    console.error("Error reading user state, using fallback:", error);
    const fallback = createDefaultState();
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2), "utf-8");
    return fallback;
  }
};

export const writeUserState = (userId: string, state: AppState) => {
  try {
    ensureDir(userDir(userId));
    const file = statePath(userId);
    // Write to a temporary file first, then rename (atomic write)
    const tempFile = `${file}.tmp`;
    const jsonData = JSON.stringify(state, null, 2);
    fs.writeFileSync(tempFile, jsonData, "utf-8");
    fs.renameSync(tempFile, file);
    console.log(`State written successfully to ${file}, size: ${jsonData.length} bytes`);
  } catch (error) {
    console.error("Error writing user state:", error);
    throw error;
  }
};
