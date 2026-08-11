"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { ChevronDown, Filter, Printer, ReceiptText, Search } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { buildTicketHtml } from "@/lib/ticket-template"

interface Ticket { id: string; ticketNumber: string; customerName: string; paymentMethod: string | null; paymentStatus: string; total: number; createdAt: string; notes: string | null; pointOfSale: { name: string; code: string } | null; items: { name: string; format: string; quantity: number; price: number; total: number }[] }
const paymentLabels: Record<string, string> = { CARD: "Carte", MOBILE_MONEY: "Mobile Money", CASH_ON_DELIVERY: "Espèces" }

const PER_PAGE = 5

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [pointsOfSale, setPointsOfSale] = useState<{ id: string; name: string; code: string }[]>([])
  const [search, setSearch] = useState("")
  const [date, setDate] = useState("")
  const [posFilter, setPosFilter] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const printTicket = (ticket: Ticket) => {
    const popup = window.open("", "ticket", "width=360,height=700")
    if (!popup) return
    popup.document.write(
      buildTicketHtml({
        orderNumber: ticket.ticketNumber,
        customerName: ticket.customerName,
        paymentMethod: ticket.paymentMethod,
        paymentStatus: ticket.paymentStatus,
        total: ticket.total,
        createdAt: ticket.createdAt,
        pointOfSale: ticket.pointOfSale,
        items: ticket.items,
      })
    )
    popup.document.close()
    popup.focus()
    popup.print()
  }

  useEffect(() => {
    fetch("/api/tickets").then((r) => (r.ok ? r.json() : [])).then(setTickets).finally(() => setLoading(false))
    fetch("/api/points-de-vente").then((r) => (r.ok ? r.json() : { points: [] })).then((data) => {
      const list = Array.isArray(data) ? data : data.points ?? []
      setPointsOfSale(list.filter((p: any) => p.isActive))
    })
  }, [])

  const filtered = useMemo(() => tickets.filter((ticket) => {
    const term = search.toLowerCase()
    const matchesSearch = `${ticket.ticketNumber} ${ticket.customerName} ${ticket.pointOfSale?.name || ""}`.toLowerCase().includes(term)
    const matchesDate = !date || ticket.createdAt.slice(0, 10) === date
    const matchesPos = !posFilter || ticket.pointOfSale?.name === posFilter
    return matchesSearch && matchesDate && matchesPos
  }), [tickets, search, date, posFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const paged = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE)

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleDate = (v: string) => { setDate(v); setPage(1) }
  const handlePos = (v: string) => { setPosFilter(v); setPage(1) }

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm text-muted-foreground">Caisse</p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">Tickets de vente</h1>
        <p className="mt-1 text-sm text-muted-foreground">Registre des ventes comptoir et réimpression des tickets.</p>
      </div>
      <p className="text-sm text-muted-foreground">{filtered.length} ticket(s)</p>
    </div>

    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(event) => handleSearch(event.target.value)} placeholder="Rechercher un ticket, client ou point de vente..." className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-3 text-sm text-foreground" />
      </div>
      <input type="date" value={date} onChange={(event) => handleDate(event.target.value)} className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground" />
      <div className="relative">
        <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <select value={posFilter} onChange={(event) => handlePos(event.target.value)} className="appearance-none rounded-lg border border-input bg-background py-2.5 pl-9 pr-8 text-sm text-foreground">
          <option value="">Tous les points de vente</option>
          {pointsOfSale.map((pos) => <option key={pos.id} value={pos.name}>{pos.name} ({pos.code})</option>)}
        </select>
      </div>
    </div>

    {loading ? (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Chargement des tickets...</div>
    ) : (
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card-soft">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Ticket</th>
              <th className="px-5 py-3">Point de vente</th>
              <th className="px-5 py-3">Client</th>
              <th className="px-5 py-3">Paiement</th>
              <th className="px-5 py-3">Total</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paged.map((ticket) => (
              <Fragment key={ticket.id}>
                <tr className="hover:bg-muted/30">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-foreground">{ticket.ticketNumber}</p>
                    <p className="text-xs text-muted-foreground">{new Date(ticket.createdAt).toLocaleString("fr-FR")}</p>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">{ticket.pointOfSale ? `${ticket.pointOfSale.name} (${ticket.pointOfSale.code})` : "Non affecté"}</td>
                  <td className="px-5 py-4 text-foreground">{ticket.customerName}</td>
                  <td className="px-5 py-4 text-muted-foreground">{paymentLabels[ticket.paymentMethod || ""] || ticket.paymentMethod || "-"}</td>
                  <td className="px-5 py-4 font-semibold text-foreground">{formatPrice(ticket.total)}</td>
                  <td className="px-5 py-4 text-right">
                    <button onClick={() => setExpanded(expanded === ticket.id ? null : ticket.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" title="Voir le ticket">
                      <ChevronDown className={`h-4 w-4 transition-transform ${expanded === ticket.id ? "rotate-180" : ""}`} />
                    </button>
                  </td>
                </tr>
                {expanded === ticket.id && (
                  <tr key={`${ticket.id}-detail`}>
                    <td colSpan={6} className="bg-muted/30 px-5 py-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          {ticket.items.map((item) => (
                            <div key={`${item.name}-${item.format}`} className="flex gap-4 text-sm">
                              <span className="text-foreground">{item.name} {item.format}</span>
                              <span className="text-muted-foreground">x{item.quantity}</span>
                              <span className="font-medium text-foreground">{formatPrice(item.total)}</span>
                            </div>
                          ))}
                          <div className="border-t border-border pt-2 text-sm font-semibold text-foreground">Total : {formatPrice(ticket.total)}</div>
                        </div>
                        <button onClick={() => printTicket(ticket)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
                          <Printer className="h-4 w-4" /> Imprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground"><ReceiptText className="mx-auto mb-2 h-9 w-9 text-muted-foreground/50" />Aucun ticket trouvé.</td></tr>
            )}
          </tbody>
        </table>

        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">{filtered.length} résultat(s) · Page {currentPage}/{totalPages}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={currentPage <= 1} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">&laquo;</button>
              <button onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">&lsaquo;</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1).reduce<(number | string)[]>((acc, p, i, arr) => { if (i > 0 && typeof arr[i - 1] === "number" && p - (arr[i - 1] as number) > 1) acc.push("..."); acc.push(p); return acc; }, []).map((p, i) => typeof p === "string" ? <span key={`e${i}`} className="px-1.5 text-xs text-muted-foreground">…</span> : <button key={p} onClick={() => setPage(p)} className={`min-w-[28px] rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${p === currentPage ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{p}</button>)}
              <button onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">&rsaquo;</button>
              <button onClick={() => setPage(totalPages)} disabled={currentPage >= totalPages} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">&raquo;</button>
            </div>
          </div>
        )}
      </div>
    )}
  </div>
}
