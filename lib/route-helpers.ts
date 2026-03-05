// lib/route-helpers.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

export type RouteContextWithId = {
  params: Promise<{ id: string }>;
};

export async function getIdFromContext(ctx: RouteContextWithId): Promise<string> {
  const { id } = await ctx.params;
  return id;
}

export function ok(data: any, status: number = 200) {
  return NextResponse.json({ data, error: null }, { status });
}

export function bad(message: string, status: number = 400, details?: any) {
  return NextResponse.json(
    { data: null, error: { message, details: details ?? null } },
    { status }
  );
}