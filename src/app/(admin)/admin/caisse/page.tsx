"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import {
  Banknote,
  ChevronDown,
  CreditCard,
  Download,
  FileText,
  Lock,
  Printer,
  RefreshCw,
  Search,
  Smartphone,
  WalletCards,
} from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { PAYMENT_STATUS_LBL } from "@/lib/report-labels"
import { exportClotureCaisseExcel, exportClotureCaissePDF, type ClotureReport } from "@/lib/report-export"

interface PaymentBreakdown {
  method: string
  total: number
  count: number
}

interface ReportPayload {
  summary: {
    todayRevenue: number
    todayOrders: number
    cashExpected: number
    cashGap: number
  }
  paymentBreakdown: PaymentBreakdown[]
  daily: { name: string; revenu: number; commandes: number }[]
}

interface CashSessionRow {
  id: string
  pointOfSaleId: string
  openedById: string | null
  openedAt: string
  closedAt: string | null
  openingBalance: number
  closingBalance: number | null
  status: string
  reportGeneratedAt: string | null
  reportReference: string | null
  pointOfSale: { name: string; code: string }
  openedBy: { id: string; name: string | null; email: string } | null
}

interface PointOfSaleRow {
  id: string
  name: string
  code: string
  isActive: boolean
}

type Tab = "jour" | "journal"

const paymentLabels: Record<string, string> = {
  CASH_ON_DELIVERY: "Espèces / à la livraison",
  MOBILE_MONEY: "Mobile Money",
  CARD: "Carte bancaire",
}

const paymentIcons: Record<string, typeof Banknote> = {
  CASH_ON_DELIVERY: Banknote,
  MOBILE_MONEY: Smartphone,
  CARD: CreditCard,
}

const fmtDateTime = (value: string | Date) => new Date(value).toLocaleString("fr-FR")

export default function CaissePage() {
  const { data: auth } = useSession()
  const role = auth?.user?.role as string | undefined
  const canManage = role === "ADMIN" || role === "STOCK_MANAGER"
  const isAdmin = role === "ADMIN"

  const [tab, setTab] = useState<Tab>("jour")

  const [data, setData] = useState<ReportPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reportsKey, setReportsKey] = useState(0)

  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null)

  // Ma caisse (session personnelle + points de vente)
  const [mySession, setMySession] = useState<CashSessionRow | null>(null)
  const [points, setPoints] = useState<PointOfSaleRow[]>([])
  const [sessionKey, setSessionKey] = useState(0)
  const [posChoice, setPosChoice] = useState("")
  const [cashInput, setCashInput] = useState("")
  const [cashSaving, setCashSaving] = useState(false)
  const [report, setReport] = useState<ClotureReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [cashMv, setCashMv] = useState<{ type: "IN" | "OUT"; amount: string; reason: string; reference: string }>({ type: "IN", amount: "", reason: "", reference: "" })
  const [cashMvSaving, setCashMvSaving] = useState(false)
  const [cashMvEdit, setCashMvEdit] = useState<{ id: string; type: "IN" | "OUT"; amount: string; reason: string; reference: string } | null>(null)

  // Journal de caisse
  const [sessions, setSessions] = useState<CashSessionRow[] | null>(null)
  const [journalLoading, setJournalLoading] = useState(true)
  const [journalError, setJournalError] = useState("")
  const [journalPos, setJournalPos] = useState("")
  const [journalStatus, setJournalStatus] = useState("all")
  const [journalQuery, setJournalQuery] = useState("")
  const [journalKey, setJournalKey] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rowReport, setRowReport] = useState<ClotureReport | null>(null)
  const [rowReportLoading, setRowReportLoading] = useState(false)
  const rowRequestRef = useRef(0)

  // Onglet Aujourd'hui : indicateurs + rapprochement
  useEffect(() => {
    const controller = new AbortController()
    const init = async () => {
      setLoading(true)
      setError("")
      try {
        const res = await fetch("/api/reports", { signal: controller.signal })
        if (controller.signal.aborted) return
        if (!res.ok) throw new Error("Impossible de charger la caisse")
        setData(await res.json())
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Erreur de chargement")
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void init()
    return () => controller.abort()
  }, [reportsKey])

  // Points de vente + session de caisse personnelle (aperçu non marquant du rapport)
  useEffect(() => {
    if (!role) return
    const controller = new AbortController()
    const init = async () => {
      try {
        const res = await fetch("/api/points-de-vente/list", { signal: controller.signal })
        if (res.ok) {
          const body = await res.json()
          if (Array.isArray(body) && !controller.signal.aborted) setPoints(body as PointOfSaleRow[])
        }
      } catch {
        // sélecteur de point de vente laissé vide
      }
      if (controller.signal.aborted) return
      try {
        const res = await fetch("/api/points-de-vente/caisse?mine=1", { signal: controller.signal })
        if (!res.ok || controller.signal.aborted) return
        const body = await res.json()
        const open = Array.isArray(body)
          ? ((body as CashSessionRow[]).find((item) => item.status === "OPEN") ?? null)
          : null
        setMySession(open)
        setCashInput("")
        if (!open) {
          setReport(null)
          return
        }
        // Aperçu non marquant : fournit l'attendu pour l'écart et l'état du rapport.
        try {
          const preview = await fetch(`/api/points-de-vente/caisse/${open.id}/rapport`, {
            signal: controller.signal,
          })
          if (preview.ok && !controller.signal.aborted) {
            setReport((await preview.json()) as ClotureReport)
          }
        } catch {
          // aperçu facultatif
        }
      } catch {
        // aucune session chargée
      }
    }
    void init()
    return () => controller.abort()
  }, [role, sessionKey])

  // Journal : liste chronologique des sessions (50 dernières)
  useEffect(() => {
    const controller = new AbortController()
    const init = async () => {
      setJournalLoading(true)
      setJournalError("")
      try {
        const query = journalPos ? `?pointOfSaleId=${encodeURIComponent(journalPos)}` : ""
        const res = await fetch(`/api/points-de-vente/caisse${query}`, { signal: controller.signal })
        const body = await res.json()
        if (controller.signal.aborted) return
        if (!res.ok) {
          setSessions(null)
          setJournalError(
            res.status === 403
              ? "Accès au journal non autorisé pour votre profil."
              : (body.error || "Impossible de charger le journal"),
          )
        } else {
          setSessions(Array.isArray(body) ? (body as CashSessionRow[]) : [])
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setJournalError(err instanceof Error ? err.message : "Erreur de chargement")
        }
      } finally {
        if (!controller.signal.aborted) setJournalLoading(false)
      }
    }
    void init()
    return () => controller.abort()
  }, [journalPos, journalKey])

  const refreshAll = () => {
    setReportsKey((key) => key + 1)
    setSessionKey((key) => key + 1)
    setJournalKey((key) => key + 1)
  }

  const cashActual = Number(cashInput) || 0
  const expected = data?.summary.cashExpected ?? 0
  const mobileMoney = data?.paymentBreakdown.find((item) => item.method === "MOBILE_MONEY")?.total ?? 0
  const card = data?.paymentBreakdown.find((item) => item.method === "CARD")?.total ?? 0

  const activePoints = useMemo(() => points.filter((point) => point.isActive), [points])
  const defaultPosId = activePoints[0]?.id ?? ""
  const openPosId = posChoice || defaultPosId

  const sessionExpected = report?.reconciliation.expected ?? null
  const countedGap =
    cashInput !== "" && sessionExpected !== null ? cashActual - sessionExpected : null

  const submitCash = async (action: "open" | "close") => {
    if (action === "open" && !openPosId) {
      setFeedback({ tone: "error", message: "Sélectionnez un point de vente" })
      return
    }
    // Le rapport de clôture est obligatoire : il retrace les transactions et
    // les quantités vendues avant que la caisse puisse être fermée.
    if (action === "close" && mySession && !mySession.reportGeneratedAt) {
      setFeedback({
        tone: "error",
        message: "Générez d'abord le rapport de clôture de la journée.",
      })
      return
    }
    setCashSaving(true)
    setFeedback(null)
    try {
      const res = await fetch("/api/points-de-vente/caisse", {
        method: action === "close" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "close"
            ? { id: mySession?.id, closingBalance: cashActual }
            : { pointOfSaleId: openPosId, openingBalance: cashActual },
        ),
      })
      const body = await res.json()
      if (!res.ok) {
        setFeedback({ tone: "error", message: body.error || "Opération impossible" })
      } else {
        setCashInput("")
        setReport(null)
        setFeedback({
          tone: "success",
          message: action === "close" ? "Caisse fermée" : "Caisse ouverte",
        })
        setSessionKey((key) => key + 1)
        setJournalKey((key) => key + 1)
      }
    } catch {
      setFeedback({ tone: "error", message: "Erreur réseau" })
    } finally {
      setCashSaving(false)
    }
  }

  // Le POST horodate la session : c'est lui qui autorise ensuite la fermeture.
  const openReport = async (stamp: boolean) => {
    if (!mySession) return
    setReportLoading(true)
    setFeedback(null)
    try {
      const res = await fetch(`/api/points-de-vente/caisse/${mySession.id}/rapport`, {
        method: stamp ? "POST" : "GET",
      })
      const body = await res.json()
      if (!res.ok) {
        setFeedback({ tone: "error", message: body.error || "Rapport indisponible" })
        return
      }
      const reportData = body as ClotureReport
      setReport(reportData)
      if (stamp) {
        exportClotureCaissePDF(reportData)
        setFeedback({
          tone: "success",
          message: `Rapport de clôture généré et téléchargé (${reportData.session.reportReference}). Vous pouvez fermer la caisse.`,
        })
        setSessionKey((key) => key + 1)
        setJournalKey((key) => key + 1)
      }
    } catch {
      setFeedback({ tone: "error", message: "Erreur réseau" })
    } finally {
      setReportLoading(false)
    }
  }


  const reloadReport = async () => {
    if (!mySession) return
    try {
      const res = await fetch(`/api/points-de-vente/caisse/${mySession.id}/rapport`)
      if (res.ok) setReport((await res.json()) as ClotureReport)
    } catch {}
  }

  const submitCashMovement = async () => {
    if (!mySession) return
    const amount = Number(cashMv.amount)
    if (!Number.isFinite(amount) || amount <= 0 || !cashMv.reason.trim()) {
      setFeedback({ tone: "error", message: "Montant et motif obligatoires" })
      return
    }
    setCashMvSaving(true)
    setFeedback(null)
    try {
      const res = await fetch(`/api/points-de-vente/caisse/${mySession.id}/mouvements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: cashMv.type, amount, reason: cashMv.reason.trim(), reference: cashMv.reference.trim() || null }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setFeedback({ tone: "error", message: body.error || "Impossible d'ajouter le mouvement" }) }
      else {
        setCashMv({ type: "IN", amount: "", reason: "", reference: "" })
        setFeedback({ tone: "success", message: cashMv.type === "IN" ? "Encaissement ajouté" : "Décaissement ajouté" })
        await reloadReport()
      }
    } catch { setFeedback({ tone: "error", message: "Erreur réseau" }) }
    finally { setCashMvSaving(false) }
  }

  const saveCashMovementEdit = async () => {
    if (!mySession || !cashMvEdit) return
    const amount = Number(cashMvEdit.amount)
    if (!Number.isFinite(amount) || amount <= 0 || !cashMvEdit.reason.trim()) return
    setCashMvSaving(true)
    try {
      const res = await fetch(`/api/points-de-vente/caisse/${mySession.id}/mouvements/${cashMvEdit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: cashMvEdit.type, amount, reason: cashMvEdit.reason.trim(), reference: cashMvEdit.reference.trim() || null }),
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); setFeedback({ tone: "error", message: b.error || "Modification impossible" }) }
      else { setCashMvEdit(null); setFeedback({ tone: "success", message: "Mouvement modifié" }); await reloadReport() }
    } catch { setFeedback({ tone: "error", message: "Erreur réseau" }) }
    finally { setCashMvSaving(false) }
  }

  const deleteCashMovement = async (mid: string) => {
    if (!mySession) return
    setCashMvSaving(true)
    try {
      const res = await fetch(`/api/points-de-vente/caisse/${mySession.id}/mouvements/${mid}`, { method: "DELETE" })
      if (!res.ok) { const b = await res.json().catch(() => ({})); setFeedback({ tone: "error", message: b.error || "Suppression impossible" }) }
      else { setFeedback({ tone: "success", message: "Mouvement supprimé" }); await reloadReport() }
    } catch { setFeedback({ tone: "error", message: "Erreur réseau" }) }
    finally { setCashMvSaving(false) }
  }

  const toggleRow = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      setRowReport(null)
      return
    }
    setExpandedId(id)
    setRowReport(null)
    setRowReportLoading(true)
    rowRequestRef.current += 1
    const request = rowRequestRef.current
    try {
      const res = await fetch(`/api/points-de-vente/caisse/${id}/rapport`)
      const body = await res.json()
      if (request !== rowRequestRef.current) return
      if (!res.ok) {
        setFeedback({ tone: "error", message: body.error || "Rapport indisponible" })
      } else {
        setRowReport(body as ClotureReport)
      }
    } catch {
      if (request === rowRequestRef.current) {
        setFeedback({ tone: "error", message: "Erreur réseau" })
      }
    } finally {
      if (request === rowRequestRef.current) setRowReportLoading(false)
    }
  }

  const filteredSessions = useMemo(() => {
    const list = sessions ?? []
    const query = journalQuery.trim().toLowerCase()
    return list.filter((item) => {
      if (journalStatus !== "all" && item.status !== journalStatus) return false
      if (!query) return true
      return `${item.pointOfSale?.name ?? ""} ${item.pointOfSale?.code ?? ""} ${
        item.openedBy?.name ?? ""
      } ${item.openedBy?.email ?? ""} ${item.reportReference ?? ""}`
        .toLowerCase()
        .includes(query)
    })
  }, [sessions, journalStatus, journalQuery])

  const statusBadge = (status: string) =>
    status === "OPEN" ? (
      <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
        Ouverte
      </span>
    ) : (
      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
        Fermée
      </span>
    )

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Caisse</h1>
          <p className="mt-1 text-xs text-gray-500 sm:text-sm">
            {tab === "jour"
              ? "Encaissements du jour, contrôle espèces et rapprochement."
              : "Journal chronologique des sessions de caisse et détail des ventes."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
            <button
              onClick={() => setTab("jour")}
              className={`min-h-9 rounded-md px-3 py-1.5 text-xs font-semibold sm:text-sm ${
                tab === "jour" ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              Aujourd&apos;hui
            </button>
            <button
              onClick={() => setTab("journal")}
              className={`min-h-9 rounded-md px-3 py-1.5 text-xs font-semibold sm:text-sm ${
                tab === "journal" ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              Journal
            </button>
          </div>
          <button
            onClick={refreshAll}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" /> Actualiser
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 sm:px-4 sm:py-3 sm:text-sm">
          {error}
        </div>
      )}
      {feedback && (
        <div
          className={`rounded-lg border px-3 py-2 text-xs sm:px-4 sm:py-3 sm:text-sm ${
            feedback.tone === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {tab === "jour" && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
            <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
              <p className="text-xs font-medium text-gray-500">Ventes du jour</p>
              <p className="mt-1 break-words text-base font-bold text-gray-900 sm:text-xl">
                {loading ? "..." : formatPrice(data?.summary.todayRevenue ?? 0)}
              </p>
            </div>
            <div className="min-w-0 rounded-xl border border-green-200 bg-green-50/40 p-3 sm:p-4">
              <p className="text-xs font-medium text-green-700">Espèces attendues</p>
              <p className="mt-1 break-words text-base font-bold text-green-800 sm:text-xl">
                {formatPrice(expected)}
              </p>
            </div>
            <div className="min-w-0 rounded-xl border border-blue-200 bg-blue-50/40 p-3 sm:p-4">
              <p className="text-xs font-medium text-blue-700">Mobile Money</p>
              <p className="mt-1 break-words text-base font-bold text-blue-800 sm:text-xl">
                {formatPrice(mobileMoney)}
              </p>
            </div>
            <div className="min-w-0 rounded-xl border border-purple-200 bg-purple-50/40 p-3 sm:p-4">
              <p className="text-xs font-medium text-purple-700">Carte</p>
              <p className="mt-1 break-words text-base font-bold text-purple-800 sm:text-xl">
                {formatPrice(card)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
            <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5 lg:col-span-2">
              <h2 className="mb-3 text-xs font-semibold text-gray-900 sm:mb-4 sm:text-sm">
                Rapprochement des paiements
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px] sm:min-w-[480px]">
                  <thead className="border-b border-gray-200 bg-gray-50/80">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-4 sm:py-3">
                        Mode
                      </th>
                      <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-4 sm:py-3">
                        Transactions
                      </th>
                      <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-4 sm:py-3">
                        Montant
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(data?.paymentBreakdown ?? []).map((item) => {
                      const Icon = paymentIcons[item.method] ?? WalletCards
                      return (
                        <tr key={item.method}>
                          <td className="px-2 py-2 sm:px-4 sm:py-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 sm:h-8 sm:w-8">
                                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              </span>
                              <span className="min-w-0 break-words text-xs font-medium text-gray-800 sm:text-sm">
                                {paymentLabels[item.method] ?? item.method}
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right text-xs text-gray-600 sm:px-4 sm:py-3 sm:text-sm">
                            {item.count}
                          </td>
                          <td className="px-2 py-2 text-right text-xs font-semibold text-gray-900 sm:px-4 sm:py-3 sm:text-sm">
                            {formatPrice(item.total)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2 sm:mb-4">
                <h2 className="text-xs font-semibold text-gray-900 sm:text-sm">Ma caisse</h2>
                {statusBadge(mySession?.status ?? "CLOSED")}
              </div>
              <div className="space-y-3 sm:space-y-4">
                <div className="rounded-lg bg-gray-50 p-3">
                  {mySession ? (
                    <>
                      <div className="flex items-start gap-2">
                        <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                        <div className="min-w-0">
                          <p className="break-words text-xs font-semibold text-gray-900 sm:text-sm">
                            {mySession.pointOfSale.name} ({mySession.pointOfSale.code})
                          </p>
                          <p className="mt-0.5 break-words text-xs text-gray-500">
                            Ouverte le {fmtDateTime(mySession.openedAt)} · fond{" "}
                            {formatPrice(mySession.openingBalance)}
                          </p>
                          {mySession.closedAt && (
                            <p className="mt-0.5 break-words text-xs text-gray-500">
                              Fermée le {fmtDateTime(mySession.closedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-gray-500 sm:text-sm">
                      Aucune caisse ouverte.
                      {canManage
                        ? " Sélectionnez un point de vente pour ouvrir."
                        : " Consultation uniquement."}
                    </p>
                  )}
                </div>

                {report && mySession?.status === "OPEN" && (
                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                    <div className="rounded-lg bg-gray-50 p-2">
                      <p className="text-gray-500">Fond</p>
                      <p className="mt-0.5 font-semibold text-gray-900">
                        {formatPrice(report.reconciliation.openingBalance)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-2">
                      <p className="text-gray-500">Attendu</p>
                      <p className="mt-0.5 font-semibold text-gray-900">
                        {formatPrice(report.reconciliation.expected)}
                      </p>
                    </div>
                    <div className="col-span-2 rounded-lg bg-gray-50 p-2 sm:col-span-1">
                      <p className="text-gray-500">Ventes</p>
                      <p className="mt-0.5 font-semibold text-gray-900">
                        {formatPrice(report.reconciliation.revenue)}
                      </p>
                    </div>
                  </div>
                )}

                {canManage && mySession?.status === "OPEN" && (
                  <div
                    className={`rounded-lg border p-3 ${
                      mySession.reportGeneratedAt
                        ? "border-green-200 bg-green-50"
                        : "border-amber-200 bg-amber-50"
                    }`}
                  >
                    <p
                      className={`text-xs font-semibold ${
                        mySession.reportGeneratedAt ? "text-green-900" : "text-amber-900"
                      }`}
                    >
                      Rapport de clôture
                    </p>
                    <p
                      className={`mt-1 text-xs ${
                        mySession.reportGeneratedAt ? "text-green-800" : "text-amber-800"
                      }`}
                    >
                      {mySession.reportGeneratedAt
                        ? `Réf. ${mySession.reportReference} — la caisse peut être fermée.`
                        : "Générez le rapport avant de fermer la caisse."}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => void openReport(false)}
                        disabled={reportLoading}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 disabled:opacity-50"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Aperçu
                      </button>
                      <button
                        onClick={() => void openReport(true)}
                        disabled={reportLoading}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {reportLoading
                          ? "Génération…"
                          : mySession.reportGeneratedAt
                            ? "Régénérer"
                            : "Générer le rapport"}
                      </button>
                    </div>
                  </div>
                )}

                
                {mySession?.status === "OPEN" && (
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs font-semibold text-gray-900">Mouvements de caisse</p>
                    <p className="mt-0.5 text-[11px] text-gray-500">Encaissements (+) et décaissements (-) hors ventes. Motif obligatoire.</p>
                    {canManage && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <select value={cashMv.type} onChange={(e)=>setCashMv(v=>({...v,type:e.target.value as "IN"|"OUT"}))} className="rounded-lg border border-gray-300 px-2 py-2 text-xs">
                          <option value="IN">Encaissement</option>
                          <option value="OUT">Décaissement</option>
                        </select>
                        <input type="number" min={0} value={cashMv.amount} onChange={(e)=>setCashMv(v=>({...v,amount:e.target.value}))} placeholder="Montant" className="rounded-lg border border-gray-300 px-2 py-2 text-xs" />
                        <input value={cashMv.reason} onChange={(e)=>setCashMv(v=>({...v,reason:e.target.value}))} placeholder="Motif *" className="col-span-2 rounded-lg border border-gray-300 px-2 py-2 text-xs" />
                        <input value={cashMv.reference} onChange={(e)=>setCashMv(v=>({...v,reference:e.target.value}))} placeholder="Référence (optionnel)" className="rounded-lg border border-gray-300 px-2 py-2 text-xs" />
                        <button onClick={()=>void submitCashMovement()} disabled={cashMvSaving} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{cashMvSaving?"...":"Ajouter"}</button>
                      </div>
                    )}
                    <div className="mt-2 max-h-40 overflow-y-auto">
                      {(report?.cashMovements ?? []).length === 0 ? (
                        <p className="text-[11px] text-gray-500">Aucun mouvement.</p>
                      ) : (
                        <table className="w-full text-[11px]">
                          <tbody className="divide-y divide-gray-100">
                            {(report?.cashMovements ?? []).map((m)=>(
                              <tr key={m.id}>
                                <td className="py-1"><span className={m.type==="IN"?"font-semibold text-green-700":"font-semibold text-red-700"}>{m.type==="IN"?"+":"-"}</span> {formatPrice(m.amount)}</td>
                                <td className="py-1 text-gray-700">{m.reason}{m.reference ? " ("+m.reference+")" : ""}</td>
                                <td className="py-1 text-right text-gray-400">{m.author??""}</td>
                                {isAdmin && mySession.status==="OPEN" && (
                                  <td className="py-1 text-right whitespace-nowrap">
                                    <button onClick={()=>setCashMvEdit({id:m.id,type:m.type as "IN"|"OUT",amount:String(m.amount),reason:m.reason,reference:m.reference??""})} className="mr-1 text-gray-500 hover:text-gray-800">Mod.</button>
                                    <button onClick={()=>void deleteCashMovement(m.id)} className="text-red-500 hover:text-red-700">Suppr.</button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                    {cashMvEdit && isAdmin && (
                      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
                        <p className="text-[11px] font-semibold text-amber-900">Modifier le mouvement (admin)</p>
                        <div className="mt-1 grid grid-cols-2 gap-1.5">
                          <select value={cashMvEdit.type} onChange={(e)=>setCashMvEdit(v=>v?{...v,type:e.target.value as "IN"|"OUT"}:v)} className="rounded border border-gray-300 px-2 py-1 text-[11px]"><option value="IN">Encaissement</option><option value="OUT">Décaissement</option></select>
                          <input type="number" min={0} value={cashMvEdit.amount} onChange={(e)=>setCashMvEdit(v=>v?{...v,amount:e.target.value}:v)} className="rounded border border-gray-300 px-2 py-1 text-[11px]" />
                          <input value={cashMvEdit.reason} onChange={(e)=>setCashMvEdit(v=>v?{...v,reason:e.target.value}:v)} className="col-span-2 rounded border border-gray-300 px-2 py-1 text-[11px]" />
                          <input value={cashMvEdit.reference} onChange={(e)=>setCashMvEdit(v=>v?{...v,reference:e.target.value}:v)} className="rounded border border-gray-300 px-2 py-1 text-[11px]" placeholder="Réf." />
                          <div className="flex gap-1"><button onClick={()=>void saveCashMovementEdit()} disabled={cashMvSaving} className="rounded bg-primary px-2 py-1 text-[11px] font-semibold text-white">OK</button><button onClick={()=>setCashMvEdit(null)} className="rounded border px-2 py-1 text-[11px]">Annuler</button></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
{canManage ? (
                  mySession?.status === "OPEN" ? (
                    <div className="space-y-3">
                      <label className="block text-xs font-medium text-gray-700 sm:text-sm">
                        Espèces comptées
                        <input
                          type="number"
                          min={0}
                          value={cashInput}
                          onChange={(event) => setCashInput(event.target.value)}
                          placeholder="0"
                          aria-label="Espèces comptées"
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                        />
                      </label>
                      <div className="rounded-lg bg-gray-50 p-3">
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="text-gray-500">Attendu</span>
                          <span className="font-semibold text-gray-900">
                            {sessionExpected === null ? "—" : formatPrice(sessionExpected)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs sm:text-sm">
                          <span className="text-gray-500">Écart</span>
                          <span
                            className={`font-semibold ${
                              countedGap === null
                                ? "text-gray-900"
                                : countedGap === 0
                                  ? "text-gray-900"
                                  : countedGap > 0
                                    ? "text-green-700"
                                    : "text-red-700"
                            }`}
                          >
                            {countedGap === null ? "—" : formatPrice(countedGap)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => void submitCash("close")}
                        disabled={cashSaving || !mySession.reportGeneratedAt}
                        title={
                          mySession.reportGeneratedAt
                            ? "Clôturer la caisse"
                            : "Générez d'abord le rapport de clôture"
                        }
                        className="inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Fermer la caisse
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <label className="block text-xs font-medium text-gray-700 sm:text-sm">
                        Point de vente
                        <select
                          value={openPosId}
                          onChange={(event) => setPosChoice(event.target.value)}
                          aria-label="Point de vente"
                          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                        >
                          {activePoints.length === 0 && <option value="">Aucun point de vente</option>}
                          {activePoints.map((point) => (
                            <option key={point.id} value={point.id}>
                              {point.name} ({point.code})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-medium text-gray-700 sm:text-sm">
                        Fond de caisse
                        <input
                          type="number"
                          min={0}
                          value={cashInput}
                          onChange={(event) => setCashInput(event.target.value)}
                          placeholder="0"
                          aria-label="Fond de caisse"
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                        />
                      </label>
                      <button
                        onClick={() => void submitCash("open")}
                        disabled={cashSaving || !openPosId}
                        className="inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Ouvrir la caisse
                      </button>
                    </div>
                  )
                ) : (
                  <p className="flex items-start gap-2 text-xs text-gray-500">
                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Ouverture et fermeture réservées aux gestionnaires de caisse.
                  </p>
                )}
              </div>
            </section>
          </div>
        </>
      )}

      {tab === "journal" && (
        <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
          <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xs font-semibold text-gray-900 sm:text-sm">
              Sessions de caisse
              {sessions !== null && (
                <span className="ml-2 font-normal text-gray-500">
                  {filteredSessions.length} / {sessions.length}
                </span>
              )}
            </h2>
            <div className="flex flex-wrap gap-2">
              <select
                value={journalPos}
                onChange={(event) => setJournalPos(event.target.value)}
                aria-label="Filtrer par point de vente"
                className="min-h-9 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs sm:text-sm"
              >
                <option value="">Tous les points de vente</option>
                {points.map((point) => (
                  <option key={point.id} value={point.id}>
                    {point.name} ({point.code})
                  </option>
                ))}
              </select>
              <select
                value={journalStatus}
                onChange={(event) => setJournalStatus(event.target.value)}
                aria-label="Filtrer par statut"
                className="min-h-9 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs sm:text-sm"
              >
                <option value="all">Tous les statuts</option>
                <option value="OPEN">Ouvertes</option>
                <option value="CLOSED">Fermées</option>
              </select>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={journalQuery}
                  onChange={(event) => setJournalQuery(event.target.value)}
                  placeholder="Rechercher…"
                  aria-label="Rechercher dans le journal"
                  className="min-h-9 w-full rounded-lg border border-gray-300 py-1.5 pl-8 pr-3 text-xs sm:text-sm sm:w-56"
                />
              </div>
            </div>
          </div>

          {journalError && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:text-sm">
              {journalError}
            </div>
          )}

          {journalLoading && sessions === null ? (
            <p className="py-6 text-center text-sm text-gray-500">Chargement…</p>
          ) : !journalError && filteredSessions.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Aucune session de caisse.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="border-b border-gray-200 bg-gray-50/80">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-3 sm:py-3">
                      Ouverture
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-3 sm:py-3">
                      Fermeture
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-3 sm:py-3">
                      Point de vente
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-3 sm:py-3">
                      Caissier
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-3 sm:py-3">
                      Fond
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-3 sm:py-3">
                      Clôture
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-3 sm:py-3">
                      Statut
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-3 sm:py-3">
                      Rapport
                    </th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSessions.map((item) => (
                    <Fragment key={item.id}>
                      <tr
                        onClick={() => void toggleRow(item.id)}
                        className={`cursor-pointer hover:bg-gray-50 ${
                          expandedId === item.id ? "bg-gray-50" : ""
                        }`}
                      >
                        <td className="px-2 py-2 text-xs text-gray-700 sm:px-3 sm:py-3 sm:text-sm">
                          {fmtDateTime(item.openedAt)}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-700 sm:px-3 sm:py-3 sm:text-sm">
                          {item.closedAt ? fmtDateTime(item.closedAt) : "—"}
                        </td>
                        <td className="px-2 py-2 text-xs font-medium text-gray-800 sm:px-3 sm:py-3 sm:text-sm">
                          <span className="break-words">
                            {item.pointOfSale?.name ?? "—"}
                            <span className="ml-1 text-gray-400">({item.pointOfSale?.code})</span>
                          </span>
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-700 sm:px-3 sm:py-3 sm:text-sm">
                          <span className="break-words">
                            {item.openedBy?.name || item.openedBy?.email || "—"}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right text-xs font-semibold text-gray-900 sm:px-3 sm:py-3 sm:text-sm">
                          {formatPrice(item.openingBalance)}
                        </td>
                        <td className="px-2 py-2 text-right text-xs font-semibold text-gray-900 sm:px-3 sm:py-3 sm:text-sm">
                          {item.closingBalance === null ? "—" : formatPrice(item.closingBalance)}
                        </td>
                        <td className="px-2 py-2 sm:px-3 sm:py-3">{statusBadge(item.status)}</td>
                        <td className="px-2 py-2 text-xs text-gray-600 sm:px-3 sm:py-3 sm:text-sm">
                          {item.reportReference ?? "—"}
                        </td>
                        <td className="px-2 py-2 text-right sm:px-3 sm:py-3">
                          <ChevronDown
                            className={`h-4 w-4 text-gray-400 transition-transform ${
                              expandedId === item.id ? "rotate-180" : ""
                            }`}
                          />
                        </td>
                      </tr>
                      {expandedId === item.id && (
                        <tr>
                          <td colSpan={9} className="bg-gray-50/60 px-2 py-3 sm:px-3 sm:py-4">
                            {rowReportLoading ? (
                              <p className="py-3 text-center text-xs text-gray-500 sm:text-sm">
                                Chargement du détail…
                              </p>
                            ) : rowReport ? (
                              <div className="space-y-3">
                                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-[11px] text-gray-500">
                                    {rowReport.session.reportReference
                                      ? `Réf. ${rowReport.session.reportReference}`
                                      : "Rapport non généré"}
                                  </p>
                                  <div className="flex gap-1.5">
                                    <button onClick={() => exportClotureCaissePDF(rowReport)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50"><Printer className="h-3.5 w-3.5" /> PDF</button>
                                    <button onClick={() => exportClotureCaisseExcel(rowReport)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50"><Download className="h-3.5 w-3.5" /> Excel</button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-7 sm:text-sm">
                                  <div className="rounded-lg border border-gray-200 bg-white p-2"><p className="text-gray-500">Fond</p><p className="mt-0.5 font-semibold text-gray-900">{formatPrice(rowReport.reconciliation.openingBalance)}</p></div>
                                  <div className="rounded-lg border border-gray-200 bg-white p-2"><p className="text-gray-500">Ventes</p><p className="mt-0.5 font-semibold text-gray-900">{formatPrice(rowReport.reconciliation.revenue)}</p></div>
                                  <div className="rounded-lg border border-gray-200 bg-white p-2"><p className="text-gray-500">+ Encaissements</p><p className="mt-0.5 font-semibold text-green-700">{formatPrice(rowReport.reconciliation.cashIn ?? 0)}</p></div>
                                  <div className="rounded-lg border border-gray-200 bg-white p-2"><p className="text-gray-500">- Décaissements</p><p className="mt-0.5 font-semibold text-red-700">{formatPrice(rowReport.reconciliation.cashOut ?? 0)}</p></div>
                                  <div className="rounded-lg border border-gray-200 bg-white p-2"><p className="text-gray-500">Attendu</p><p className="mt-0.5 font-semibold text-gray-900">{formatPrice(rowReport.reconciliation.expected)}</p></div>
                                  <div className="rounded-lg border border-gray-200 bg-white p-2"><p className="text-gray-500">Compté</p><p className="mt-0.5 font-semibold text-gray-900">{rowReport.reconciliation.closingBalance === null ? "-" : formatPrice(rowReport.reconciliation.closingBalance)}</p></div>
                                  <div className="rounded-lg border border-gray-200 bg-white p-2"><p className="text-gray-500">Écart</p><p className={`mt-0.5 font-semibold ${rowReport.reconciliation.gap === null ? "text-gray-900" : rowReport.reconciliation.gap === 0 ? "text-gray-900" : rowReport.reconciliation.gap > 0 ? "text-green-700" : "text-red-700"}`}>{rowReport.reconciliation.gap === null ? "-" : formatPrice(rowReport.reconciliation.gap)}</p></div>
                                </div>

                                                                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                                      Encaissements ventes ({rowReport.totals.orders} commande{rowReport.totals.orders > 1 ? "s" : ""})
                                    </p>
                                    <table className="w-full">
                                      <tbody className="divide-y divide-gray-100">
                                        {rowReport.paymentBreakdown.map((item) => (
                                          <tr key={item.method}>
                                            <td className="py-1.5 text-xs text-gray-700 sm:text-sm">{paymentLabels[item.method] ?? item.method}</td>
                                            <td className="py-1.5 text-right text-xs text-gray-500 sm:text-sm">{item.count} tx</td>
                                            <td className="py-1.5 text-right text-xs font-semibold text-gray-900 sm:text-sm">{formatPrice(item.amount)}</td>
                                          </tr>
                                        ))}
                                        {rowReport.paymentBreakdown.length === 0 && (
                                          <tr><td colSpan={3} className="py-2 text-xs text-gray-500 sm:text-sm">Aucune vente sur cette session.</td></tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>

                                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Produits vendus</p>
                                    <div className="max-h-48 overflow-y-auto">
                                      <table className="w-full">
                                        <tbody className="divide-y divide-gray-100">
                                          {rowReport.soldByProduct.map((item) => (
                                            <tr key={item.variantId}>
                                              <td className="py-1.5 text-xs text-gray-700 sm:text-sm">{item.productName}{item.format && (<span className="ml-1 text-gray-400">{item.format}</span>)}</td>
                                              <td className="py-1.5 text-right text-xs text-gray-500 sm:text-sm">×{item.quantity}</td>
                                              <td className="py-1.5 text-right text-xs font-semibold text-gray-900 sm:text-sm">{formatPrice(item.amount)}</td>
                                            </tr>
                                          ))}
                                          {rowReport.soldByProduct.length === 0 && (
                                            <tr><td colSpan={3} className="py-2 text-xs text-gray-500 sm:text-sm">Aucun produit vendu.</td></tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>

                                <div className="rounded-lg border border-gray-200 bg-white p-3">
                                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Mouvements manuels de caisse ({(rowReport.cashMovements ?? []).length})</p>
                                  {(rowReport.cashMovements ?? []).length === 0 ? (
                                    <p className="text-xs text-gray-500 sm:text-sm">Aucun mouvement manuel.</p>
                                  ) : (
                                    <div className="max-h-48 overflow-y-auto">
                                      <table className="w-full">
                                        <tbody className="divide-y divide-gray-100">
                                          {(rowReport.cashMovements ?? []).map((m) => (
                                            <tr key={m.id}>
                                              <td className="py-1.5 text-xs sm:text-sm"><span className={m.type==="IN" ? "font-semibold text-green-700" : "font-semibold text-red-700"}>{m.type==="IN" ? "Encaissement" : "Décaissement"}</span></td>
                                              <td className="py-1.5 text-xs text-gray-700 sm:text-sm">{m.reason}{m.reference ? " ("+m.reference+")" : ""}</td>
                                              <td className="py-1.5 text-right text-xs text-gray-500 sm:text-sm">{m.author ?? ""}</td>
                                              <td className="py-1.5 text-right text-xs font-semibold text-gray-900 sm:text-sm">{formatPrice(m.amount)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>

                                <div className="rounded-lg border border-gray-200 bg-white p-3">
                                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                                    Détail des ventes
                                  </p>
                                  <div className="max-h-64 overflow-y-auto">
                                    <table className="w-full">
                                      <thead>
                                        <tr className="border-b border-gray-100">
                                          <th className="py-1.5 text-left text-xs font-medium text-gray-500">
                                            N°
                                          </th>
                                          <th className="py-1.5 text-left text-xs font-medium text-gray-500">
                                            Heure
                                          </th>
                                          <th className="py-1.5 text-left text-xs font-medium text-gray-500">
                                            Client
                                          </th>
                                          <th className="py-1.5 text-left text-xs font-medium text-gray-500">
                                            Mode
                                          </th>
                                          <th className="py-1.5 text-left text-xs font-medium text-gray-500">
                                            Paiement
                                          </th>
                                          <th className="py-1.5 text-right text-xs font-medium text-gray-500">
                                            Total
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {rowReport.orders.map((order) => (
                                          <tr key={order.id}>
                                            <td className="py-1.5 text-xs text-gray-700 sm:text-sm">
                                              {order.orderNumber}
                                            </td>
                                            <td className="py-1.5 text-xs text-gray-500 sm:text-sm">
                                              {fmtDateTime(order.createdAt)}
                                            </td>
                                            <td className="max-w-[140px] truncate py-1.5 text-xs text-gray-700 sm:text-sm">
                                              {order.customerName || "—"}
                                            </td>
                                            <td className="py-1.5 text-xs text-gray-700 sm:text-sm">
                                              {order.paymentMethodLabel}
                                            </td>
                                            <td className="py-1.5 text-xs text-gray-700 sm:text-sm">
                                              {PAYMENT_STATUS_LBL[order.paymentStatus] ??
                                                order.paymentStatus}
                                            </td>
                                            <td className="py-1.5 text-right text-xs font-semibold text-gray-900 sm:text-sm">
                                              {formatPrice(order.total)}
                                            </td>
                                          </tr>
                                        ))}
                                        {rowReport.orders.length === 0 && (
                                          <tr>
                                            <td
                                              colSpan={6}
                                              className="py-2 text-xs text-gray-500 sm:text-sm"
                                            >
                                              Aucune vente sur cette session.
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                <p className="text-right text-xs text-gray-400">
                                  {rowReport.totals.items} article(s) · {rowReport.totals.products}{" "}
                                  produit(s) · {rowReport.totals.movements} mouvement(s)
                                </p>
                              </div>
                            ) : (
                              <p className="py-3 text-center text-xs text-gray-500 sm:text-sm">
                                Détail indisponible.
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
