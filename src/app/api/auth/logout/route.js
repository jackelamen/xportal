import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST(request) {
  const kind = new URL(request.url).searchParams.get("kind");
  if (kind === "operator") {
    await destroySession("operator");
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  await destroySession("client");
  return NextResponse.redirect(new URL("/", request.url));
}
