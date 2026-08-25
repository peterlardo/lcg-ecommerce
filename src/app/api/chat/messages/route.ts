import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma";
import { auth } from "@/lib/auth"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const peerId = searchParams.get("userId")
  if (!peerId) {
    return NextResponse.json({ error: "userId requis" }, { status: 400 })
  }

  const userId = session.user.id

  const messages = await getPrisma().chatMessage.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: peerId },
        { senderId: peerId, receiverId: userId },
      ],
    },
    include: {
      sender: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  })

  await getPrisma().chatMessage.updateMany({
    where: { senderId: peerId, receiverId: userId, read: false },
    data: { read: true },
  })

  const peerPresence = await getPrisma().chatPresence.findUnique({
    where: { userId: peerId },
    select: { lastSeen: true, isTyping: true },
  })

  const isTyping = peerPresence?.isTyping && peerPresence.lastSeen
    ? (Date.now() - new Date(peerPresence.lastSeen).getTime()) < 5000
    : false

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      content: m.content,
      senderId: m.senderId,
      senderName: m.sender.name || m.sender.email,
      read: m.read,
      createdAt: m.createdAt.toISOString(),
      fileUrl: m.fileUrl || null,
      fileName: m.fileName || null,
      fileType: m.fileType || null,
      fileSize: m.fileSize || null,
    })),
    peerTyping: isTyping,
  })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const body = await request.json()
  const receiverId = String(body.receiverId || "").trim()
  const content = String(body.content || "").trim()
  const fileUrl = body.fileUrl ? String(body.fileUrl) : null
  const fileName = body.fileName ? String(body.fileName) : null
  const fileType = body.fileType ? String(body.fileType) : null
  const fileSize = body.fileSize ? Number(body.fileSize) : null

  if (!receiverId) {
    return NextResponse.json({ error: "receiverId requis" }, { status: 400 })
  }

  if (!content && !fileUrl) {
    return NextResponse.json({ error: "Contenu ou fichier requis" }, { status: 400 })
  }

  if (receiverId === session.user.id) {
    return NextResponse.json({ error: "Impossible de s'envoyer un message" }, { status: 400 })
  }

  const receiver = await getPrisma().user.findUnique({ where: { id: receiverId }, select: { id: true } })
  if (!receiver) {
    return NextResponse.json({ error: "Destinataire introuvable" }, { status: 404 })
  }

  const message = await getPrisma().chatMessage.create({
    data: {
      senderId: session.user.id,
      receiverId,
      content: content.slice(0, 2000),
      fileUrl,
      fileName,
      fileType,
      fileSize,
    },
    include: {
      sender: { select: { id: true, name: true, email: true, image: true } },
    },
  })

  await getPrisma().chatPresence.upsert({
    where: { userId: session.user.id },
    update: { isTyping: false, lastSeen: new Date() },
    create: { userId: session.user.id, isTyping: false },
  })

  return NextResponse.json(
    {
      id: message.id,
      content: message.content,
      senderId: message.senderId,
      senderName: message.sender.name || message.sender.email,
      read: message.read,
      createdAt: message.createdAt.toISOString(),
      fileUrl: message.fileUrl || null,
      fileName: message.fileName || null,
      fileType: message.fileType || null,
      fileSize: message.fileSize || null,
    },
    { status: 201 }
  )
}
