import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { setupSockets } from "./sockets";
import { CLIENT_DIST, IS_PROD, PORT } from "./config";

const app = express();
app.disable("x-powered-by");

// In development the Vite dev server proxies to us, but allow direct
// cross-origin calls too (e.g. client on :3000, server on :5000).
if (!IS_PROD) {
  app.use(cors());
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// Production: serve the built client and fall back to index.html for SPA routes.
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST, { maxAge: "1d", index: false }));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });
}

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: IS_PROD ? undefined : { origin: true },
  serveClient: false,
  // Song Mode uploads a parsed note list (up to SONG_LIMITS.maxNotes), which
  // can exceed the 1MB default.
  maxHttpBufferSize: 3_000_000,
});

setupSockets(io);

httpServer.listen(PORT, () => {
  console.log(`PianoJam server listening on http://localhost:${PORT}`);
  if (!fs.existsSync(CLIENT_DIST)) {
    console.log("No client build found. Run `npm run build -w client` to serve the app from this server.");
  }
});
