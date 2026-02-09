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
import dashboardRoutes from "./routes/dashboard.routes.js";
import settingsRouter from "./routes/settings.routes.js";
import usersRouter from "./routes/users.routes.js";

// ❌ แนะนำ “ปิดก่อน” กันชน route/ชื่อ endpoint สับสน
// import documentTypesRouter from "./routes/documentTypes.routes.js";
// import itJobTypesRouter from "./routes/itJobTypes.routes.js";

import { startTrashPurgeJob } from "./jobs/trashPurge.job.js";
import { authRequired } from "./middlewares/auth.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

console.log("✅ LOADED src/app.js");

// ✅ middleware พื้นฐาน
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ✅ CORS
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

// ✅ dashboard routes
app.use("/dashboard", dashboardRoutes);

// ✅ API
app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/folders", foldersRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/trash", trashRouter);

// ✅ ✅ สำคัญ: ให้ตรงกับที่ frontend เรียก
// จะได้เป็น /api/settings/document-types และ /api/settings/it-job-types
app.use("/api/settings", settingsRouter);

app.use("/api/users", usersRouter);

// ❌ ถ้าจะเปิดใช้ router แยก ต้อง “ตั้ง endpoint ให้ชัด” ไม่ให้ชน/สับสนกับ settings
// app.use("/api/document-types", documentTypesRouter);
// app.use("/api/it-job-types", itJobTypesRouter);

// ✅ me
app.get("/api/me", authRequired, (req, res) => {
  res.json({ me: req.user });
});

// ✅ frontend static
const frontendPath = path.resolve(__dirname, "../../frontend");
app.use(express.static(frontendPath));

// ✅ fallback สำหรับ SPA (กันชน /api)
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// ✅ Global error handler (ต้องอยู่ท้ายสุด)
app.use(errorHandler);

// ✅ start jobs
startTrashPurgeJob();

export default app;