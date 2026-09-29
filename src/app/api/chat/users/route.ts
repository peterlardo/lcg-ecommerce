import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const userId = session.user.id

  // Le polling du widget (10s) fait office de heartbeat : on remonte la
  // dernière activité du visiteur pour alimenter l'indicateur de connexion.
  await getPrisma().chatPresence.upsert({
    where: { userId },
    update: { lastSeen: new Date() },
    create: { userId, lastSeen: new Date() },
  })

  const users = await getPrisma().user.findMany({
    where: { isActive: true, id: { not: userId } },
    select: { id: true, name: true, email: true, role: true, image: true },
    orderBy: { name: "asc" },
  })

  const presences = await getPrisma().chatPresence.findMany({
    where: { userId: { in: users.map((u) => u.id) } },
    select: { userId: true, lastSeen: true },
  })
  const presenceMap = new Map(presences.map((p) => [p.userId, p.lastSeen]))
  const ONLINE_THRESHOLD_MS = 60_000

  const unreadCounts = await getPrisma().chatMessage.groupBy({
    by: ["senderId"],
    where: { receiverId: userId, read: false },
    _count: { id: true },
  })
  const unreadMap = new Map(unreadCounts.map((r) => [r.senderId, r._count.id]))

  const lastSent = await getPrisma().chatMessage.findMany({
    where: { senderId: userId },
    orderBy: { createdAt: "desc" },
    distinct: ["receiverId"],
    take: 100,
    select: { receiverId: true, content: true, createdAt: true },
  })
  const lastReceived = await getPrisma().chatMessage.findMany({
    where: { receiverId: userId },
    orderBy: { createdAt: "desc" },
    distinct: ["senderId"],
    take: 100,
    select: { senderId: true, content: true, createdAt: true },
  })

  const lastMsgMap = new Map<string, { content: string; at: Date }>()
  for (const msg of lastSent) {
    const existing = lastMsgMap.get(msg.receiverId)
    if (!existing || msg.createdAt > existing.at) {
      lastMsgMap.set(msg.receiverId, { content: msg.content, at: msg.createdAt })
    }
  }
  for (const msg of lastReceived) {
    const existing = lastMsgMap.get(msg.senderId)
    if (!existing || msg.createdAt > existing.at) {
      lastMsgMap.set(msg.senderId, { content: msg.content, at: msg.createdAt })
    }
  }

  return NextResponse.json(
    users.map((user) => {
      const last = lastMsgMap.get(user.id)
      const lastSeen = presenceMap.get(user.id) ?? null
      const isOnline = !!lastSeen && Date.now() - lastSeen.getTime() < ONLINE_THRESHOLD_MS
      return {
        id: user.id,
        name: user.name || user.email,
        email: user.email,
        role: user.role,
        image: user.image,
        lastMessage: last?.content || null,
        lastAt: last?.at?.toISOString() || null,
        unreadCount: unreadMap.get(user.id) || 0,
        isOnline,
        lastSeen: lastSeen?.toISOString() || null,
      }
    })
  )
}
