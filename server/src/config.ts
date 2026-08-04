import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SERVER_ROOT = path.resolve(__dirname, "..");
export const CLIENT_DIST = path.resolve(SERVER_ROOT, "../client/dist");

export const PORT = Number(process.env.PORT ?? 5000);
export const IS_PROD = process.env.NODE_ENV === "production";

// Comma-separated list of allowed client origins in production, e.g. the
// Cloudflare Pages URL and any custom domain (client and server are on
// different hosts/origins in production, unlike local dev's Vite proxy).
export const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
