import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SERVER_ROOT = path.resolve(__dirname, "..");
export const CLIENT_DIST = path.resolve(SERVER_ROOT, "../client/dist");

export const PORT = Number(process.env.PORT ?? 5000);
export const IS_PROD = process.env.NODE_ENV === "production";
