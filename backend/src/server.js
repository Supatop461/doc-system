import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
