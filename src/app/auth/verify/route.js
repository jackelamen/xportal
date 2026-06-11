import { NextResponse } from "next/server";
import { redeemLoginToken, setSessionCookie } from "@/lib/auth";

export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const result = redeemLoginToken(token);
  if (!result) {
    return NextResponse.redirect(new URL("/?error=expired", request.url));
  }
  await setSessionCookie(result.userType, result.sessionRaw);
  const dest = result.userType === "operator" ? "/admin" : "/portal";
  return NextResponse.redirect(new URL(dest, request.url));
}
