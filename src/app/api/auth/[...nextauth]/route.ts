import { goneError } from "@/lib/errors";

// NextAuth replaced by Supabase Auth (CODAA-70).
// Auth is now handled by the FE via @supabase/supabase-js.
// This route is kept as a stub to avoid 404 on old bookmarks.
export function GET() {
  return goneError("Use Supabase Auth");
}

export function POST() {
  return goneError("Use Supabase Auth");
}
