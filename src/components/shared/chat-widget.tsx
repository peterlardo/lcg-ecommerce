"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { MessageCircle, Send, X, ChevronLeft, Paperclip, FileText, Image as ImageIcon, Download } from "lucide-react"

interface ChatUser {
  id: string
  name: string
  email: string
  role: string
  image: string | null
  lastMessage: string | null
  lastAt: string | null
  unreadCount: number
}

interface ChatMessage {
  id: string
  content: string
  senderId: string
  senderName: string
  read: boolean
  createdAt: string
  fileUrl: string | null
  fileName: string | null
  fileType: string | null
  fileSize: number | null
}

const ACCEPTED = "image/jpeg,image/png,image/webp,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / 1048576).toFixed(1)} Mo`
}

function fileIcon(type: string | null) {
  if (type === "image") return <ImageIcon className="h-5 w-5" />
  if (type === "pdf") return <FileText className="h-5 w-5 text-red-500" />
  return <FileText className="h-5 w-5 text-blue-500" />
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [users, setUsers] = useState<ChatUser[]>([])
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [myId, setMyId] = useState<string>("")
  const [sending, setSending] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingFile, setPendingFile] = useState<{ url: string; name: string; type: string; size: number } | null>(null)
  const [peerTyping, setPeerTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingSentRef = useRef(false)

  const totalUnread = users.reduce((sum, u) => sum + u.unreadCount, 0)

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/users")
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
        if (!myId) {
          const sessionRes = await fetch("/api/auth/session")
          if (sessionRes.ok) {
            const session = await sessionRes.json()
            setMyId(session?.user?.id || "")
          }
        }
      }
    } catch {}
  }, [myId])

  const loadMessages = useCallback(async (userId: string) => {
    setLoadingMessages(true)
    try {
      const res = await fetch(`/api/chat/messages?userId=${userId}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
        setPeerTyping(data.peerTyping ?? false)
      }
    } catch {} finally {
      setLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers()
    pollRef.current = setInterval(() => {
      if (!isOpen) {
        void loadUsers()
      } else if (selectedUser) {
        void loadMessages(selectedUser.id)
        void loadUsers()
      }
    }, 10000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [isOpen, selectedUser, loadUsers, loadMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (isOpen && selectedUser) inputRef.current?.focus()
  }, [isOpen, selectedUser])

  const selectUser = (user: ChatUser) => {
    setSelectedUser(user)
    setPeerTyping(false)
    void loadMessages(user.id)
  }

  const goBack = () => {
    setSelectedUser(null)
    setMessages([])
    setPendingFile(null)
    setPeerTyping(false)
    void sendTyping(false)
    void loadUsers()
  }

  const sendTyping = async (isTyping: boolean) => {
    try {
      await fetch("/api/chat/typing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTyping }),
      })
    } catch {}
  }

  const handleInputChange = (value: string) => {
    setNewMessage(value)
    if (value.trim() && !typingSentRef.current) {
      typingSentRef.current = true
      void sendTyping(true)
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      typingSentRef.current = false
      void sendTyping(false)
    }, 3000)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      alert("Fichier trop volumineux (max 10 Mo)")
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/chat/upload", { method: "POST", body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        alert(err?.error || "Erreur d'upload")
        return
      }
      const data = await res.json()
      setPendingFile({ url: data.fileUrl, name: data.fileName, type: data.fileType, size: data.fileSize })
    } catch {
      alert("Erreur lors de l'upload")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const sendMessage = async () => {
    if ((!newMessage.trim() && !pendingFile) || !selectedUser || sending) return
    setSending(true)
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: selectedUser.id,
          content: newMessage.trim() || (pendingFile ? `Pièce jointe : ${pendingFile.name}` : ""),
          fileUrl: pendingFile?.url || null,
          fileName: pendingFile?.name || null,
          fileType: pendingFile?.type || null,
          fileSize: pendingFile?.size || null,
        }),
      })
      if (res.ok) {
        const msg = await res.json()
        setMessages((prev) => [...prev, msg])
        setNewMessage("")
        setPendingFile(null)
        typingSentRef.current = false
        void sendTyping(false)
        setUsers((prev) =>
          prev.map((u) =>
            u.id === selectedUser.id
              ? { ...u, lastMessage: msg.content, lastAt: msg.createdAt }
              : u
          )
        )
      }
    } catch {} finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })
  }

  const roleLabel: Record<string, string> = {
    ADMIN: "Admin",
    STOCK_MANAGER: "Stock",
    DELIVERY_AGENT: "Livreur",
    CUSTOMER: "Client",
  }

  const renderAttachment = (msg: ChatMessage) => {
    if (!msg.fileUrl) return null

    if (msg.fileType === "image") {
      return (
        <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="block mt-1.5 rounded-lg overflow-hidden border border-white/20">
          <img src={msg.fileUrl} alt={msg.fileName || "Image"} className="max-h-48 w-auto object-cover" loading="lazy" />
        </a>
      )
    }

    return (
      <a
        href={msg.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1.5 flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs hover:bg-white/20 transition-colors"
      >
        {fileIcon(msg.fileType)}
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{msg.fileName}</p>
          {msg.fileSize && <p className="opacity-60">{formatFileSize(msg.fileSize)}</p>}
        </div>
        <Download className="h-3.5 w-3.5 opacity-60 shrink-0" />
      </a>
    )
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 font-sans">
      {isOpen && (
        <div className="mb-3 w-[360px] h-[500px] rounded-2xl bg-white shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground shrink-0">
            {selectedUser ? (
              <>
                <button onClick={goBack} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{selectedUser.name}</p>
                  {peerTyping ? (
                    <p className="text-[11px] italic opacity-80 truncate flex items-center gap-1">
                      <span className="inline-flex gap-0.5"><span className="animate-bounce" style={{animationDelay:"0ms"}}>.</span><span className="animate-bounce" style={{animationDelay:"150ms"}}>.</span><span className="animate-bounce" style={{animationDelay:"300ms"}}>.</span></span>
                      {" "}en train d&apos;écrire
                    </p>
                  ) : (
                    <p className="text-[11px] opacity-70 truncate">{roleLabel[selectedUser.role] || selectedUser.role}</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <MessageCircle className="h-5 w-5" />
                <span className="text-sm font-semibold">LCG-Box</span>
                {totalUnread > 0 && (
                  <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">{totalUnread}</span>
                )}
              </>
            )}
            <button onClick={() => setIsOpen(false)} className="ml-1 p-1 hover:bg-white/10 rounded-lg transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {!selectedUser ? (
            <div className="flex-1 overflow-y-auto">
              {users.length === 0 && (
                <p className="p-6 text-center text-sm text-gray-400">Aucun utilisateur connecté</p>
              )}
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => selectUser(user)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100"
                >
                  <div className="relative h-9 w-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {(user.name || user.email).charAt(0).toUpperCase()}
                    {user.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 min-w-[16px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                        {user.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                      {user.lastAt && (
                        <span className="text-[10px] text-gray-400 shrink-0">{formatTime(user.lastAt)}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-gray-400 truncate">{roleLabel[user.role] || user.role}</p>
                      {user.lastMessage && (
                        <p className="text-xs text-gray-500 truncate flex-1 text-right">{user.lastMessage}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50/50">
                {loadingMessages && (
                  <p className="text-center text-xs text-gray-400 py-4">Chargement...</p>
                )}
                {!loadingMessages && messages.length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-4">Aucun message. Commencez la conversation !</p>
                )}
                {messages.map((msg) => {
                  const isMine = msg.senderId === myId
                  return (
                    <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${isMine ? "bg-primary text-primary-foreground" : "bg-white border border-gray-200 text-gray-900"}`}>
                        {msg.content && <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>}
                        {msg.fileUrl && (
                          <div className={isMine ? "text-primary-foreground" : "text-gray-900"}>
                            {renderAttachment(msg)}
                          </div>
                        )}
                        <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/60" : "text-gray-400"}`}>
                          {formatTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {pendingFile && (
                <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-2.5 flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    {fileIcon(pendingFile.type)}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">{pendingFile.name}</p>
                      <p className="text-[10px] text-gray-400">{formatFileSize(pendingFile.size)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPendingFile(null)}
                    className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="shrink-0 border-t border-gray-200 bg-white px-3 py-2.5 flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPTED}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || sending}
                  className="h-9 w-9 flex items-center justify-center rounded-full text-gray-400 hover:text-primary hover:bg-gray-100 disabled:opacity-40 transition-colors shrink-0"
                  title="Joindre un fichier"
                >
                  {uploading ? (
                    <div className="h-4 w-4 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
                  ) : (
                    <Paperclip className="h-5 w-5" />
                  )}
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={pendingFile ? "Ajouter un commentaire..." : "Votre message..."}
                  className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  disabled={sending}
                />
                <button
                  onClick={() => void sendMessage()}
                  disabled={(!newMessage.trim() && !pendingFile) || sending}
                  className="h-9 w-9 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  {sending ? (
                    <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative h-14 w-14 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-all"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!isOpen && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-[20px] rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center px-1">
            {totalUnread}
          </span>
        )}
      </button>
    </div>
  )
}
