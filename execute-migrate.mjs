import fs from "fs";
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config();

async function run() {
  const sqlContent = fs.readFileSync("migrate.sql", "utf8");
  const sql = postgres(process.env.DATABASE_URL);
  
  console.log("Executing migrate.sql...");
  await sql.unsafe(sqlContent);
  console.log("✅ migrate.sql executed successfully!");
  await sql.end();
}

run().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
