// src/routes/fs.routes.js
import { Router } from "express";
import fs from "fs";
import path from "path";
import { authRequired } from "../middlewares/auth.js";

const router = Router();

// =========================
// Config
// =========================
const FS_ROOT = path.resolve(process.env.FS_ROOT || "C:/xampp/htdocs");

// กันโฟลเดอร์ที่ไม่ควรแสดง/เสี่ยง/ใหญ่
const DENY_DIRS = new Set(
  String(process.env.FS_DENY_DIRS || "xampp,phpMyAdmin,phpmyadmin,logs,node_modules,.git")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

const MAX_ITEMS = Number(process.env.FS_MAX_ITEMS || 8000);
const MAX_DEPTH = Number(process.env.FS_MAX_DEPTH || 25);

function safeBasename(name = "") {
  const base = path.basename(String(name || ""));
  if (!base || base === "." || base === "..") return null;
  if (/[\/\\:\0]/.test(base)) return null;
  return base;
}

function toPosix(p) {
  return String(p || "").replaceAll("\\", "/");
}

function isPathInsideRoot(absPath) {
  const rel = path.relative(FS_ROOT, absPath);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function resolveAbsFromRel(relPath) {
  const rel = String(relPath || "").trim();
  // allow empty => root
  if (!rel) return FS_ROOT;

  // normalize separators
  const safeRel = toPosix(rel).replace(/^\/+/, ""); // no leading slash
  // forbid traversal
  if (safeRel.includes("..")) throw new Error("INVALID_PATH");

  const abs = path.resolve(FS_ROOT, safeRel);
  if (!isPathInsideRoot(abs)) throw new Error("OUTSIDE_ROOT");
  return abs;
}

function guessMimeByExt(filename = "") {
  const ext = String(filename).toLowerCase();
  if (ext.endsWith(".pdf")) return "application/pdf";
  if (ext.endsWith(".png")) return "image/png";
  if (ext.endsWith(".jpg") || ext.endsWith(".jpeg")) return "image/jpeg";
  if (ext.endsWith(".gif")) return "image/gif";
  if (ext.endsWith(".webp")) return "image/webp";
  if (ext.endsWith(".doc")) return "application/msword";
  if (ext.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext.endsWith(".xls")) return "application/vnd.ms-excel";
  if (ext.endsWith(".xlsx"))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  if (ext.endsWith(".pptx"))
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return "application/octet-stream";
}

function safeHeaderFilename(name = "") {
  return String(name).replace(/[\r\n"]/g, "").trim();
}

function setContentDisposition(res, type, filename) {
  const clean = safeHeaderFilename(filename) || "download";
  const encoded = encodeURIComponent(clean);
  const fallback = clean.replace(/[^\x20-\x7E]/g, "_") || "download";
  res.setHeader(
    "Content-Disposition",
    `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`
  );
}

// =========================
// FS scan
// =========================

function scanFoldersFlat() {
  const out = [];
  const stack = [{ abs: FS_ROOT, rel: "", depth: 0 }];

  while (stack.length) {
    const cur = stack.pop();
    if (!cur) continue;
    if (cur.depth > MAX_DEPTH) continue;

    let dirents = [];
    try {
      dirents = fs.readdirSync(cur.abs, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const d of dirents) {
      if (!d.isDirectory()) continue;

      const name = d.name;
      if (!name) continue;
      if (DENY_DIRS.has(String(name))) continue;
      if (name.startsWith(".")) continue;

      const abs = path.join(cur.abs, name);
      const rel = cur.rel ? `${cur.rel}/${name}` : name;

      out.push({
        source: "FS",
        type: "folder",
        path: toPosix(rel),
        name,
        parent_path: cur.rel ? toPosix(cur.rel) : "",
      });

      if (out.length >= MAX_ITEMS) return out;

      stack.push({ abs, rel, depth: cur.depth + 1 });
    }
  }

  // sort by path
  out.sort((a, b) => String(a.path).localeCompare(String(b.path), "th"));
  return out;
}

function listFilesInFolder(relFolder = "") {
  const absFolder = resolveAbsFromRel(relFolder);

  let dirents = [];
  try {
    dirents = fs.readdirSync(absFolder, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = [];
  for (const d of dirents) {
    if (!d.isFile()) continue;
    const base = safeBasename(d.name);
    if (!base) continue;

    const abs = path.join(absFolder, base);
    let st;
    try {
      st = fs.statSync(abs);
    } catch {
      continue;
    }

    const rel = relFolder ? `${toPosix(relFolder)}/${base}` : base;

    files.push({
      source: "FS",
      type: "file",
      path: toPosix(rel),
      folder_path: toPosix(relFolder || ""),
      name: base,
      size: st.size,
      updated_at: st.mtime,
      created_at: st.birthtime || st.mtime,
      mime_type: guessMimeByExt(base),
    });

    if (files.length >= MAX_ITEMS) break;
  }

  files.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  return files;
}

// =========================
// Routes
// =========================

router.get("/info", authRequired, (req, res) => {
  return res.json({
    ok: true,
    root: FS_ROOT,
    deny_dirs: [...DENY_DIRS],
    max_items: MAX_ITEMS,
    max_depth: MAX_DEPTH,
  });
});

// ✅ โครงแฟ้มจาก filesystem (flat list)
router.get("/folders", authRequired, (req, res) => {
  try {
    const folders = scanFoldersFlat();
    return res.json({ ok: true, data: folders, meta: { root: FS_ROOT } });
  } catch (e) {
    console.error("GET /api/fs/folders error:", e);
    return res.status(500).json({ ok: false, message: "FS_SCAN_FAILED" });
  }
});

// ✅ ไฟล์ในแฟ้ม (non-recursive)
router.get("/documents", authRequired, (req, res) => {
  try {
    const folder = String(req.query.folder || "").trim(); // relative path from root
    const items = listFilesInFolder(folder);
    return res.json({ ok: true, data: items, meta: { root: FS_ROOT, folder } });
  } catch (e) {
    const msg = String(e?.message || "");
    if (msg === "INVALID_PATH" || msg === "OUTSIDE_ROOT") {
      return res.status(400).json({ ok: false, message: msg });
    }
    console.error("GET /api/fs/documents error:", e);
    return res.status(500).json({ ok: false, message: "FS_LIST_FAILED" });
  }
});

// ✅ preview file (inline)
router.get("/preview", authRequired, (req, res) => {
  try {
    const p = String(req.query.path || "").trim();
    if (!p) return res.status(400).json({ ok: false, message: "MISSING_PATH" });

    const abs = resolveAbsFromRel(p);
    if (!fs.existsSync(abs)) return res.status(404).json({ ok: false, message: "FILE_NOT_FOUND" });

    const filename = path.basename(abs);
    res.setHeader("Content-Type", guessMimeByExt(filename));
    setContentDisposition(res, "inline", filename);
    fs.createReadStream(abs).pipe(res);
  } catch (e) {
    const msg = String(e?.message || "");
    if (msg === "INVALID_PATH" || msg === "OUTSIDE_ROOT") {
      return res.status(400).json({ ok: false, message: msg });
    }
    console.error("GET /api/fs/preview error:", e);
    return res.status(500).json({ ok: false, message: "FS_PREVIEW_FAILED" });
  }
});

// ✅ download file (attachment)
router.get("/download", authRequired, (req, res) => {
  try {
    const p = String(req.query.path || "").trim();
    if (!p) return res.status(400).json({ ok: false, message: "MISSING_PATH" });

    const abs = resolveAbsFromRel(p);
    if (!fs.existsSync(abs)) return res.status(404).json({ ok: false, message: "FILE_NOT_FOUND" });

    const filename = path.basename(abs);
    res.setHeader("Content-Type", guessMimeByExt(filename));
    setContentDisposition(res, "attachment", filename);
    fs.createReadStream(abs).pipe(res);
  } catch (e) {
    const msg = String(e?.message || "");
    if (msg === "INVALID_PATH" || msg === "OUTSIDE_ROOT") {
      return res.status(400).json({ ok: false, message: msg });
    }
    console.error("GET /api/fs/download error:", e);
    return res.status(500).json({ ok: false, message: "FS_DOWNLOAD_FAILED" });
  }
});

export default router;