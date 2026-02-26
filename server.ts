import express from "express";
import { createServer as createViteServer } from "vite";
import { initDb } from "./src/db/index.ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Database
  initDb();

  // Middleware to parse JSON bodies
  app.use(express.json());

  // API Routes Placeholder
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
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
