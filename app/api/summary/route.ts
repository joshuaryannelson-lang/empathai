// FILE: app/api/ai/summary/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: body.messages,
    }),
  });

  const json = await response.json();

  if (!response.ok) {
    return NextResponse.json(
      { error: json?.error?.message ?? "Unknown error" },
      { status: response.status }
    );
  }

  return NextResponse.json(json);
}