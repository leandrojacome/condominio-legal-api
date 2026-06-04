import { NextResponse } from "next/server";
import spec from "@/lib/openapi-spec";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(spec, {
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  });
}
