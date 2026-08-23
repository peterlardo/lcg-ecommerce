import "dotenv/config"
import { Pool } from "pg"

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()
  try {
    const res = await client.query(`SELECT data_type, udt_name FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'role'`)
    console.log("User.role column:", res.rows)
    const res2 = await client.query(`SELECT typname, enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'Role'`)
    console.log("Role enum values:", res2.rows)
    const res4 = await client.query(`SELECT DISTINCT role FROM "User"`)
    console.log("Distinct roles:", res4.rows)
  } finally {
    client.release()
    await pool.end()
  }
}
main()
