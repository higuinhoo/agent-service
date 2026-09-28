import { db } from "./client";
import { organizations, users } from "./schema/index";
import { hash } from "bcryptjs";

async function seed(): Promise<void> {
  console.info("Seeding database...");

  // Organização padrão
  const [org] = await db
    .insert(organizations)
    .values({
      name: "Organização Demo",
      slug: "demo",
    })
    .onConflictDoNothing()
    .returning();

  if (!org) {
    console.info("Organization already exists, skipping seed.");
    process.exit(0);
  }

  // Admin padrão
  const passwordHash = await hash("admin123", 12);
  await db
    .insert(users)
    .values({
      organizationId: org.id,
      name: "Administrador",
      email: "admin@demo.com",
      passwordHash,
      role: "admin",
    })
    .onConflictDoNothing();

  console.info("Seed completed:");
  console.info("  Org:", org.slug);
  console.info("  Email: admin@demo.com");
  console.info("  Password: admin123");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
