/**
 * Server-side session helper
 *
 * Gets the current user session from the request headers.
 * Use this in API routes to authenticate requests.
 */

import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function getServerSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}
