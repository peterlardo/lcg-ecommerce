"use client"

import { useState, useEffect } from "react"
import { MessageSquare, Search, Trash2, Eye, EyeOff, X, ChevronDown } from "lucide-react"
import type { ContactMessage } from "@/data/store"

export default function MessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all")
  const [selected, setSelected] = useState<ContactMessage | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchMessages = async () => {
    try {
      const res = await fetch("/api/messages")
      if (res.ok) setMessages(await res.json())
    } catch (err) {
      console.error("Erreur:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMessages()
  }, [])

  const handleMarkRead = async (id: string) => {
    await fetch(`/api/messages/${id}`, { method: "PATCH" })
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, lu: true } : m)))
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/messages/${id}`, { method: "DELETE" })
    setMessages((prev) => prev.filter((m) => m.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const filtered = messages.filter((m) => {
    const matchesSearch =
      m.nom.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      m.message.toLowerCase().includes(search.toLowerCase())
    const matchesFilter =
      filter === "all" || (filter === "unread" && !m.lu) || (filter === "read" && m.lu)
    return matchesSearch && matchesFilter
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <p className="text-sm text-gray-500">
          {messages.filter((m) => !m.lu).length} non lu{messages.filter((m) => !m.lu).length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher dans les messages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
          />
        </div>
        <div className="relative">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="pl-3 pr-8 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 appearance-none bg-white"
          >
            <option value="all">Tous</option>
            <option value="unread">Non lus</option>
            <option value="read">Lus</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">Chargement...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <MessageSquare className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Aucun message trouvé</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-3">
            {filtered.map((msg) => (
              <button
                key={msg.id}
                onClick={() => {
                  setSelected(msg)
                  if (!msg.lu) handleMarkRead(msg.id)
                }}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selected?.id === msg.id
                    ? "border-primary-300 bg-primary-50/50"
                    : !msg.lu
                      ? "border-primary-200 bg-white shadow-sm"
                      : "border-gray-200 bg-white hover:shadow-sm"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                      !msg.lu ? "bg-primary-500" : "bg-transparent"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${!msg.lu ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
                        {msg.nom}
                      </p>
                      <span className="text-xs text-gray-400 shrink-0">{msg.createdAt}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{msg.objet}</p>
                    <p className="text-xs text-gray-400 mt-1 truncate">{msg.message}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-2">
            {selected ? (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{selected.nom}</h2>
                    <p className="text-sm text-gray-500">{selected.objet}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!selected.lu && (
                      <button
                        onClick={() => handleMarkRead(selected.id)}
                        className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Marquer comme lu"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(selected.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase">Nom</p>
                    <p className="text-sm text-gray-900 mt-0.5">{selected.nom}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase">Téléphone</p>
                    <p className="text-sm text-gray-900 mt-0.5">{selected.telephone}</p>
                  </div>
                  {selected.email && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase">Email</p>
                      <p className="text-sm text-gray-900 mt-0.5">{selected.email}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase">Date</p>
                    <p className="text-sm text-gray-900 mt-0.5">{selected.createdAt}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Message</p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{selected.message}</p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
                <MessageSquare className="h-12 w-12 text-gray-300 mb-4" />
                <p className="text-sm text-gray-500">Sélectionnez un message pour le lire</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
