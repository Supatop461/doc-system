// src/app.js
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

import foldersRouter from "./routes/folders.routes.js";
import documentsRouter from "./routes/documents.routes.js";
import authRouter from "./routes/auth.routes.js";
import trashRouter from "./routes/trash.routes.js";
import { startTrashPurgeJob } from "./jobs/trashPurge.job.js";

// ✅ ใช้มาตรฐานใหม่ (เราจะแก้ไฟล์นี้ต่อในขั้นถัดไป)
import { authRequired } from "./middlewares/auth.js";

const app = express();

console.log("✅ LOADED src/app.js");

// ✅ middleware พื้นฐาน
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ✅ CORS (ปรับ origin ได้ตามต้องการ)
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ static uploads
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

// ✅ API
app.use("/api/auth", authRouter);
app.use("/api/folders", foldersRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/trash", trashRouter);

// ✅ me
app.get("/api/me", authRequired, (req, res) => {
  res.json({ me: req.user });
});

// ✅ frontend static
const frontendPath = path.resolve(__dirname, "../../frontend");
app.use(express.static(frontendPath));

// ✅ fallback สำหรับ SPA (กันชน /api)
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// ✅ Global error handler (ต้องอยู่ท้ายสุดก่อน export)
app.use((err, req, res, next) => {
  console.error("🔥 ERROR:", err);
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || "Internal Server Error",
  });
});

// ✅ start jobs (คงไว้เหมือนเดิม)
startTrashPurgeJob();

export default app;
