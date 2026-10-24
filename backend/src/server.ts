import express from "express";
import cors from "cors";
import pg from "pg";
import { randomInt } from "node:crypto";

const app = express();
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

app.use(cors());
app.use(express.json());

const otpStore = new Map<string, string>();

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS loans (
      id SERIAL PRIMARY KEY,
      phone VARCHAR(20) NOT NULL,
      friend_name VARCHAR(100) NOT NULL,
      amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
      due_date DATE NOT NULL,
      repaid BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", app: "MiniLedger" });
});

// Demo OTP: intentionally in-memory, for assignment use only.
app.post("/api/auth/request-otp", (req, res) => {
  const { phone } = req.body;

  if (typeof phone !== "string" || !/^\+?[0-9]{10,15}$/.test(phone)) {
    return res.status(400).json({ error: "Enter a valid phone number" });
  }

  const otp = String(randomInt(100000, 1000000));
  otpStore.set(phone, otp);
  console.log(`MiniLedger demo OTP for ${phone}: ${otp}`);

  res.json({ message: "OTP generated. Check the server terminal." });
});

app.post("/api/auth/verify-otp", (req, res) => {
  const { phone, otp } = req.body;

  if (
    typeof phone !== "string" ||
    typeof otp !== "string" ||
    otpStore.get(phone) !== otp
  ) {
    return res.status(401).json({ error: "Invalid OTP" });
  }

  otpStore.delete(phone);
  res.json({ success: true, phone });
});

// List loans for the logged-in demo phone.
app.get("/api/loans", async (req, res) => {
  try {
    const phone = String(req.query.phone ?? "");
    if (!phone) return res.status(400).json({ error: "Phone is required" });

    const result = await pool.query(
      `SELECT id, friend_name AS "friendName", amount::float,
              TO_CHAR(due_date, 'YYYY-MM-DD') AS "dueDate",
              repaid, created_at AS "createdAt"
       FROM loans WHERE phone = $1 ORDER BY created_at DESC`,
      [phone],
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "Could not fetch loans" });
  }
});

// Add a loan.
app.post("/api/loans", async (req, res) => {
  try {
    const { phone, friendName, amount, dueDate } = req.body;
    const parsedAmount = Number(amount);

    if (
      typeof phone !== "string" ||
      !phone ||
      typeof friendName !== "string" ||
      !friendName.trim() ||
      friendName.trim().length > 100 ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0 ||
      typeof dueDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
      Number.isNaN(Date.parse(`${dueDate}T00:00:00Z`))
    ) {
      return res.status(400).json({ error: "Invalid loan details" });
    }

    const result = await pool.query(
      `INSERT INTO loans (phone, friend_name, amount, due_date)
       VALUES ($1, $2, $3, $4)
       RETURNING id, friend_name AS "friendName", amount::float,
                 TO_CHAR(due_date, 'YYYY-MM-DD') AS "dueDate", repaid`,
      [phone, friendName.trim(), parsedAmount, dueDate],
    );
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Could not add loan" });
  }
});

// Mark a loan as repaid.
app.patch("/api/loans/:id/repay", async (req, res) => {
  try {
    const { phone } = req.body;
    const id = Number(req.params.id);

    if (
      !Number.isInteger(id) ||
      id <= 0 ||
      typeof phone !== "string" ||
      !phone
    ) {
      return res.status(400).json({ error: "Invalid request" });
    }

    const result = await pool.query(
      `UPDATE loans SET repaid = TRUE
       WHERE id = $1 AND phone = $2
       RETURNING id, repaid`,
      [id, phone],
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Loan not found" });
    }
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Could not update loan" });
  }
});

// Summary: outstanding total, amount repaid, and outstanding overdue amount.
app.get("/api/summary", async (req, res) => {
  try {
    const phone = String(req.query.phone ?? "");
    if (!phone) return res.status(400).json({ error: "Phone is required" });

    const result = await pool.query(
      `SELECT
         COALESCE(SUM(amount), 0)::float AS "totalLent",
         COALESCE(SUM(amount) FILTER (WHERE repaid), 0)::float AS "totalRepaid",
         COALESCE(SUM(amount) FILTER (
           WHERE NOT repaid AND due_date < CURRENT_DATE
         ), 0)::float AS "overdueAmount"
       FROM loans WHERE phone = $1`,
      [phone],
    );

    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Could not calculate summary" });
  }
});

const port = Number(process.env.PORT) || 4000;

initDb()
  .then(() =>
    app.listen(port, "0.0.0.0", () => {
      console.log(`MiniLedger API running on http://localhost:${port}`);
    }),
  )
  .catch((error) => {
    console.error("Database initialization failed:", error);
    process.exit(1);
  });
