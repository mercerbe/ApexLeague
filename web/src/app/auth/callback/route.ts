import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  // Full token exchange/session hydration will be added with Supabase auth wiring.
  return NextResponse.redirect(new URL("/", requestUrl.origin));
}
