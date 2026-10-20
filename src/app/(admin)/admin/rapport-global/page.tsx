"use client"

import { useEffect, useState } from "react"
import { Download, FileSpreadsheet, LayoutDashboard, RefreshCw } from "lucide-react"
import type { GlobalReport } from "@/lib/report-types"
import { exportGlobalPDF, exportGlobalExcel } from "@/lib/report-export"
import { GlobalReportView } from "@/components/admin/global-report-view"
import { DateRangePicker, type DateRangeValue } from "@/components/admin/date-range-picker"

const periods = [
  { id: "day", label: "Journée" },
  { id: "week", label: "Semaine" },
  { id: "month", label: "Mois" },
  { id: "quarter", label: "Trimestre" },
  { id: "custom", label: "Personnalisée" },
]

export default function RapportGlobalPage() {
  const [data, setData] = useState<GlobalReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [period, setPeriod] = useState("month")
  const [pos, setPos] = useState("all")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  const periodParams = (p: string, posId: string, from?: string, to?: string) => {
    const params = new URLSearchParams({ period: p, pos: posId })
    if (p === "custom" && from && to) {
      params.set("from", from)
      params.set("to", to)
    }
    return params
  }

  const load = async (p?: string, posId?: string, from?: string, to?: string, signal?: AbortSignal) => {
    try {
      const params = periodParams(p ?? period, posId ?? pos, from ?? fromDate, to ?? toDate)
      const res = await fetch(`/api/reports/global?${params}`, { signal })
      if (!res.ok) throw new Error("Impossible de charger le rapport global")
      setData(await res.json())
      setError("")
    } catch (err) {
      if (!signal?.aborted) setError(err instanceof Error ? err.message : "Erreur")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    const init = async () => {
      setLoading(true)
      await load(undefined, undefined, undefined, undefined, controller.signal)
    }
    void init()
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePeriodChange = (newPeriod: string) => {
    if (newPeriod === "custom" && (!fromDate || !toDate)) {
      setPeriod("custom")
      return
    }
    setPeriod(newPeriod)
    void load(newPeriod)
  }

  const handleRangeChange = (range: DateRangeValue) => {
    setFromDate(range.from)
    setToDate(range.to)
    if (range.from && range.to) {
      setPeriod("custom")
      setLoading(true)
      void load("custom", undefined, range.from, range.to)
    }
  }

  const allPos = data ? [{ id: "all", name: "Tous" }, ...data.pointsOfSale] : [{ id: "all", name: "Tous" }]

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-gray-900">
            <LayoutDashboard className="h-6 w-6 text-primary-600" /> Rapport global
          </h1>
          <p className="mt-1 text-sm text-gray-500">Synthèse consolidée de tous les processus.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50">
            <RefreshCw className="h-4 w-4" /> Actualiser
          </button>
          {data && (
            <>
              <button onClick={() => exportGlobalPDF(data)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs sm:text-sm font-medium text-red-700 hover:bg-red-100 transition-colors">
                <Download className="h-4 w-4" /> PDF
              </button>
              <button onClick={() => exportGlobalExcel(data)} className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs sm:text-sm font-medium text-green-700 hover:bg-green-100 transition-colors">
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <span className="shrink-0 text-sm font-medium text-gray-500">Période :</span>
        <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1">
          {periods.map((p) => (
            <button key={p.id} onClick={() => handlePeriodChange(p.id)} className={`rounded-md px-2 sm:px-4 py-1.5 text-xs sm:text-sm font-medium transition-colors ${period === p.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {p.label}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <DateRangePicker value={{ from: fromDate, to: toDate }} onChange={handleRangeChange} max={new Date()} />
        )}
      </div>

      {allPos.length > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="shrink-0 text-sm font-medium text-gray-500">Point de vente :</span>
          <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1">
            {allPos.map((p) => (
              <button key={p.id} onClick={() => { setPos(p.id); void load(undefined, p.id) }} className={`rounded-md px-2 sm:px-4 py-1.5 text-xs sm:text-sm font-medium transition-colors ${pos === p.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && !data ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-8 text-center text-xs sm:text-sm text-gray-500">Chargement du rapport global...</div>
      ) : data ? (
        <GlobalReportView data={data} />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-8 text-center text-xs sm:text-sm text-gray-500">Aucune donnée.</div>
      )}
    </div>
  )
}
