import { NextResponse } from "next/server";

// NextAuth replaced by Supabase Auth (CODAA-70).
// Auth is now handled by the FE via @supabase/supabase-js.
// This route is kept as a stub to avoid 404 on old bookmarks.
export function GET() {
  return NextResponse.json({ error: "Use Supabase Auth" }, { status: 410 });
}

export function POST() {
  return NextResponse.json({ error: "Use Supabase Auth" }, { status: 410 });
}
