/**
 * Auth API Route (better-auth catch-all)
 *
 * Delegates all /api/auth/* requests to better-auth.
 */

import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
