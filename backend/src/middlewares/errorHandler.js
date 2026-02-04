// Global error handler (วางท้ายสุดของ app.use)
export function errorHandler(err, req, res, next) {
  const status = err.statusCode || err.status || 500;

  // อย่า log ซ้ำถ้าคุณมี logger แยก
  console.error("[ERROR]", {
    status,
    message: err.message,
    path: req.originalUrl,
    method: req.method,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });

  res.status(status).json({
    ok: false,
    error: {
      message: err.publicMessage || err.message || "Internal Server Error",
      code: err.code || "INTERNAL_ERROR",
    },
  });
}
