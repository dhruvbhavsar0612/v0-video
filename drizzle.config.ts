import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/storage/db-schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/reelforge",
  },
});
