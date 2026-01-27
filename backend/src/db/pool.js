import pg from "pg";
const { Pool } = pg;

// debug ชั่วคราว เพื่อดูว่าอ่าน env ถูกไหม (พอใช้ได้แล้วค่อยลบ)
console.log("DB CONNECT =>", {
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  database: process.env.PGDATABASE,
});

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: String(process.env.PGSSL).toLowerCase() === "true"
    ? { rejectUnauthorized: false }
    : false,
});

export default pool;
