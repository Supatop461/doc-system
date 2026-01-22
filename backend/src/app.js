console.log("🔥 LOADED app.js 🔥");
import dotenv from "dotenv";
import express from "express";

import foldersRouter from "./routes/folders.routes.js";

dotenv.config();

const app = express();
app.use(express.json());


app.get("/test-db", async (req, res) => {
  res.json({ ok: true });
});

app.use("/folders", foldersRouter);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
