import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./client";

async function runMigrations(): Promise<void> {
  console.info("Running database migrations...");
  await migrate(db, { migrationsFolder: "./migrations" });
  console.info("Migrations completed.");
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
