/**
 * Database Connection
 *
 * Provides a Drizzle ORM instance connected to PostgreSQL.
 * Uses the postgres.js driver.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./db-schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn(
    "DATABASE_URL is not set. Database operations will fail. Set it in .env.local"
  );
}

// Create the postgres.js client
const client = postgres(connectionString ?? "postgres://localhost:5432/reelforge", {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create the Drizzle instance with schema
export const db = drizzle(client, { schema });

// Export for migration usage
export { client };
