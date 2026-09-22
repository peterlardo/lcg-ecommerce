import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";

    const where: Record<string, unknown> = { isActive: true };

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
      ];
    }

    if (category) {
      where.category = category;
    }

    const clients = await getPrisma().b2BClient.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(clients);
  } catch (error) {
    console.error("GET /api/clients-b2b error:", error);
    return NextResponse.json(
      { error: "Erreur lors du chargement des clients" },
      { status: 500 }
    );
  }
}
