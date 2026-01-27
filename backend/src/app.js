import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import foldersRouter from "./routes/folders.routes.js";
import documentsRouter from "./routes/documents.routes.js";
import authRouter from "./routes/auth.routes.js";
import trashRouter from "./routes/trash.routes.js";
import { startTrashPurgeJob } from "./jobs/trashPurge.job.js";
import { authMiddleware } from "./middlewares/auth.middleware.js";

const app = express();
app.use(express.json());

console.log("✅ LOADED src/app.js");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

// ✅ API
app.use("/api/auth", authRouter);
app.use("/api/folders", foldersRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/trash", trashRouter);

// ✅ me
app.get("/api/me", authMiddleware, (req, res) => {
  res.json({ me: req.user });
});

// ✅ frontend static
const frontendPath = path.resolve(__dirname, "../../frontend");
app.use(express.static(frontendPath));

// ✅ fallback สำหรับ SPA
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

startTrashPurgeJob();

export default app;
