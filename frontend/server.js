import express from "express";
import path from "path";

const app = express();
const PORT = 5500;

app.use(express.static(path.join(process.cwd(), "public")));

app.listen(PORT, () => {
  console.log(`🌐 Frontend running at http://localhost:${PORT}`);
});
