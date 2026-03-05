import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });

  const { prompt } = await req.json().catch(() => ({}));
  if (!prompt || typeof prompt !== "string")
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const json = await res.json();
  if (!res.ok)
    return NextResponse.json({ error: json?.error?.message ?? "Anthropic API error" }, { status: res.status });

  const text: string = json?.content?.[0]?.text ?? "";
  return NextResponse.json({ data: { text } });
}
