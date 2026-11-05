"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarDays, FileDown, FileSpreadsheet, Loader2, Plus, RefreshCw, Save, Table2, Trash2 } from "lucide-react"

interface Param {
  id?: string
  name: string
  code: string
  unit: string
  weightKg: number
  dailyObjective: number
}

interface Line {
  productName: string
  productCode: string
  shift: string | null
  machine: string | null
  startTime: string | null
  endTime: string | null
  producedQty: number
  rejectedQty: number
  conformQty: number
  unit: string
  operator: string | null
  qualityStatus: string | null
  notes: string | null
}

interface Sheet {
  date: string
  sheetNumber: string
  manager: string | null
  qualityControl: string | null
  shifts: string | null
  emptyPackaging: number | null
  waterM3: number | null
  electricityKwh: number | null
  generatorLiters: number | null
  outageMinutes: number | null
  machineDowntimeMinutes: number | null
  incidents: string | null
  status: string
  lines: Line[]
}

interface SheetListItem {
  id: string
  date: string
  sheetNumber: string
  manager: string | null
  status: string
  lines: number
  conformTotal: number
  rejectedTotal: number
}

interface SynthesisRow {
  date: string
  product: string
  lots: number
  produced: number
  rejected: number
  conform: number
}

const SHIFTS = ["Matin", "Après-midi", "Nuit"]
const MACHINES = ["Machine 1", "Machine 2", "Machine à blocs", "Ensacheuse"]
const QUALITY = ["Conforme", "Non conforme", "À contrôler"]

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00.000Z`))
}

function emptyLine(param?: Param): Line {
  return {
    productName: param?.name ?? "",
    productCode: param?.code ?? "",
    shift: SHIFTS[0],
    machine: MACHINES[0],
    startTime: "",
    endTime: "",
    producedQty: 0,
    rejectedQty: 0,
    conformQty: 0,
    unit: param?.unit ?? "Kg",
    operator: "",
    qualityStatus: QUALITY[0],
    notes: "",
  }
}

export default function FichesProductionPage() {
  const [tab, setTab] = useState<"fiches" | "synthese">("fiches")
  const [params, setParams] = useState<Param[]>([])
  const [sheets, setSheets] = useState<SheetListItem[]>([])
  const [synthesis, setSynthesis] = useState<SynthesisRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [date, setDate] = useState(todayISO())
  const [sheetNumber, setSheetNumber] = useState<string | null>(null)
  const [manager, setManager] = useState("")
  const [qualityControl, setQualityControl] = useState("")
  const [shifts, setShifts] = useState("Matin / Après-midi / Nuit")
  const [lines, setLines] = useState<Line[]>([])
  const [emptyPackaging, setEmptyPackaging] = useState<string>("")
  const [waterM3, setWaterM3] = useState<string>("")
  const [electricityKwh, setElectricityKwh] = useState<string>("")
  const [generatorLiters, setGeneratorLiters] = useState<string>("")
  const [outageMinutes, setOutageMinutes] = useState<string>("")
  const [machineDowntimeMinutes, setMachineDowntimeMinutes] = useState<string>("")
  const [incidents, setIncidents] = useState("")

  const month = date.slice(0, 7)
  const monthStart = `${month}-01`
  const monthEnd = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10)

  const loadLists = useCallback(async (from: string, to: string) => {
    const [paramsRes, sheetsRes] = await Promise.all([
      fetch("/api/production-params"),
      fetch(`/api/production-sheets?from=${from}&to=${to}`),
    ])
    if (paramsRes.ok) {
      const data = await paramsRes.json()
      setParams(data.params ?? [])
    }
    if (sheetsRes.ok) {
      const data = await sheetsRes.json()
      setSheets(data.sheets ?? [])
      setSynthesis(data.synthesis ?? [])
    }
  }, [])

  const loadSheet = useCallback(async (d: string) => {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/production-sheets/${d}`)
      if (!res.ok) throw new Error("Chargement impossible")
      const data = await res.json()
      const s = data.sheet as Sheet | null
      setParams(data.params ?? [])
      setSheetNumber(s?.sheetNumber ?? null)
      setManager(s?.manager ?? "")
      setQualityControl(s?.qualityControl ?? "")
      setShifts(s?.shifts ?? "Matin / Après-midi / Nuit")
      setLines(s?.lines?.map((l) => ({ ...l })) ?? [])
      setEmptyPackaging(s?.emptyPackaging != null ? String(s.emptyPackaging) : "")
      setWaterM3(s?.waterM3 != null ? String(s.waterM3) : "")
      setElectricityKwh(s?.electricityKwh != null ? String(s.electricityKwh) : "")
      setGeneratorLiters(s?.generatorLiters != null ? String(s.generatorLiters) : "")
      setOutageMinutes(s?.outageMinutes != null ? String(s.outageMinutes) : "")
      setMachineDowntimeMinutes(s?.machineDowntimeMinutes != null ? String(s.machineDowntimeMinutes) : "")
      setIncidents(s?.incidents ?? "")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur")
      setSheetNumber(null)
      setLines([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      await loadSheet(todayISO())
      await loadLists(monthStart, monthEnd)
    }
    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const init = async () => {
      await loadLists(monthStart, monthEnd)
    }
    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  const updateLine = (index: number, patch: Partial<Line>) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l
        const merged = { ...l, ...patch }
        merged.conformQty = Math.max(0, (merged.producedQty || 0) - (merged.rejectedQty || 0))
        return merged
      })
    )
  }

  const totals = useMemo(() => {
    return lines.reduce(
      (acc, l) => ({
        produced: acc.produced + (l.producedQty || 0),
        rejected: acc.rejected + (l.rejectedQty || 0),
        conform: acc.conform + (l.conformQty || 0),
      }),
      { produced: 0, rejected: 0, conform: 0 }
    )
  }, [lines])

  const addLine = () => {
    setLines((prev) => [...prev, emptyLine(params[0])])
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/production-sheets/${date}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manager,
          qualityControl,
          shifts,
          incidents,
          emptyPackaging: emptyPackaging === "" ? null : Number(emptyPackaging),
          waterM3: waterM3 === "" ? null : Number(waterM3),
          electricityKwh: electricityKwh === "" ? null : Number(electricityKwh),
          generatorLiters: generatorLiters === "" ? null : Number(generatorLiters),
          outageMinutes: outageMinutes === "" ? null : Number(outageMinutes),
          machineDowntimeMinutes: machineDowntimeMinutes === "" ? null : Number(machineDowntimeMinutes),
          lines,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Enregistrement impossible")
      setMessage("Fiche enregistrée.")
      setSheetNumber(data.sheet?.sheetNumber ?? sheetNumber)
      await loadLists(monthStart, monthEnd)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur")
    } finally {
      setSaving(false)
    }
  }

  const exportPDF = async () => {
    const mod = await import("@/lib/production-sheet-pdf")
    mod.exportProductionSheetPDF(
      {
        date: `${date}T00:00:00.000Z`,
        sheetNumber: sheetNumber ?? "—",
        manager,
        qualityControl,
        shifts,
        emptyPackaging: emptyPackaging === "" ? null : Number(emptyPackaging),
        waterM3: waterM3 === "" ? null : Number(waterM3),
        electricityKwh: electricityKwh === "" ? null : Number(electricityKwh),
        generatorLiters: generatorLiters === "" ? null : Number(generatorLiters),
        outageMinutes: outageMinutes === "" ? null : Number(outageMinutes),
        machineDowntimeMinutes: machineDowntimeMinutes === "" ? null : Number(machineDowntimeMinutes),
        incidents,
        lines,
      },
      params,
      ""
    )
  }

  const synthProducts = useMemo(() => Array.from(new Set(synthesis.map((r) => r.product))).sort(), [synthesis])
  const synthDates = useMemo(() => Array.from(new Set(synthesis.map((r) => r.date))).sort(), [synthesis])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fiches de production</h1>
          <p className="text-sm text-gray-500">Documentation journalière de la production — sans effet sur le stock.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab("fiches")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${tab === "fiches" ? "bg-blue-600 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"}`}
          >
            <FileSpreadsheet className="h-4 w-4" /> Fiche du jour
          </button>
          <button
            onClick={() => setTab("synthese")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${tab === "synthese" ? "bg-blue-600 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"}`}
          >
            <Table2 className="h-4 w-4" /> Synthèse du mois
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      {tab === "fiches" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end gap-4 rounded-xl bg-white p-4 ring-1 ring-gray-200">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Date de la fiche</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={() => void loadSheet(date)}
              className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              <CalendarDays className="h-4 w-4" /> Ouvrir
            </button>
            {sheetNumber && (
              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">N° {sheetNumber}</span>
            )}
            <div className="ml-auto flex gap-2">
              <button
                onClick={exportPDF}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                <FileDown className="h-4 w-4" /> Exporter PDF
              </button>
              <button
                onClick={save}
                disabled={saving || loading}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-white p-10 text-gray-500 ring-1 ring-gray-200">
              <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
            </div>
          ) : (
            <>
              <div className="grid gap-4 rounded-xl bg-white p-4 ring-1 ring-gray-200 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Responsable production</label>
                  <input value={manager} onChange={(e) => setManager(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Contrôle qualité</label>
                  <input value={qualityControl} onChange={(e) => setQualityControl(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Postes</label>
                  <input value={shifts} onChange={(e) => setShifts(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="rounded-xl bg-white ring-1 ring-gray-200">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <h2 className="text-sm font-semibold text-gray-900">Détail des lots de la journée</h2>
                  <button onClick={addLine} className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100">
                    <Plus className="h-4 w-4" /> Ajouter une ligne
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                        <th className="px-2 py-2">Produit</th>
                        <th className="px-2 py-2">Poste</th>
                        <th className="px-2 py-2">Ligne / machine</th>
                        <th className="px-2 py-2">Début</th>
                        <th className="px-2 py-2">Fin</th>
                        <th className="px-2 py-2 text-right">Produit</th>
                        <th className="px-2 py-2 text-right">Rejeté</th>
                        <th className="px-2 py-2 text-right">Conforme</th>
                        <th className="px-2 py-2">Opérateur</th>
                        <th className="px-2 py-2">Contrôle</th>
                        <th className="px-2 py-2">Observations</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.length === 0 && (
                        <tr>
                          <td colSpan={12} className="px-4 py-6 text-center text-gray-400">
                            Aucune ligne — cliquez sur « Ajouter une ligne ».
                          </td>
                        </tr>
                      )}
                      {lines.map((line, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="px-2 py-1.5">
                            <select
                              value={line.productCode}
                              onChange={(e) => {
                                const p = params.find((x) => x.code === e.target.value)
                                updateLine(i, { productCode: e.target.value, productName: p?.name ?? "", unit: p?.unit ?? line.unit })
                              }}
                              className="w-36 rounded border border-gray-200 px-2 py-1 text-sm"
                            >
                              {params.map((p) => (
                                <option key={p.code} value={p.code}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <select value={line.shift ?? ""} onChange={(e) => updateLine(i, { shift: e.target.value })} className="w-28 rounded border border-gray-200 px-2 py-1 text-sm">
                              {SHIFTS.map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <select value={line.machine ?? ""} onChange={(e) => updateLine(i, { machine: e.target.value })} className="w-36 rounded border border-gray-200 px-2 py-1 text-sm">
                              {MACHINES.map((m) => (
                                <option key={m}>{m}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="time" value={line.startTime ?? ""} onChange={(e) => updateLine(i, { startTime: e.target.value })} className="w-24 rounded border border-gray-200 px-2 py-1 text-sm" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="time" value={line.endTime ?? ""} onChange={(e) => updateLine(i, { endTime: e.target.value })} className="w-24 rounded border border-gray-200 px-2 py-1 text-sm" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min={0} value={line.producedQty} onChange={(e) => updateLine(i, { producedQty: Number(e.target.value) || 0 })} className="w-20 rounded border border-gray-200 px-2 py-1 text-right text-sm" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min={0} value={line.rejectedQty} onChange={(e) => updateLine(i, { rejectedQty: Number(e.target.value) || 0 })} className="w-20 rounded border border-gray-200 px-2 py-1 text-right text-sm" />
                          </td>
                          <td className="px-2 py-1.5 text-right font-medium text-gray-900">{line.conformQty}</td>
                          <td className="px-2 py-1.5">
                            <input value={line.operator ?? ""} onChange={(e) => updateLine(i, { operator: e.target.value })} className="w-28 rounded border border-gray-200 px-2 py-1 text-sm" />
                          </td>
                          <td className="px-2 py-1.5">
                            <select value={line.qualityStatus ?? ""} onChange={(e) => updateLine(i, { qualityStatus: e.target.value })} className="w-28 rounded border border-gray-200 px-2 py-1 text-sm">
                              {QUALITY.map((q) => (
                                <option key={q}>{q}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input value={line.notes ?? ""} onChange={(e) => updateLine(i, { notes: e.target.value })} className="w-40 rounded border border-gray-200 px-2 py-1 text-sm" />
                          </td>
                          <td className="px-2 py-1.5">
                            <button onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {lines.length > 0 && (
                      <tfoot>
                        <tr className="bg-gray-50 font-semibold text-gray-900">
                          <td className="px-2 py-2" colSpan={5}>
                            Total journée ({lines.length} ligne{lines.length > 1 ? "s" : ""})
                          </td>
                          <td className="px-2 py-2 text-right">{totals.produced}</td>
                          <td className="px-2 py-2 text-right">{totals.rejected}</td>
                          <td className="px-2 py-2 text-right">{totals.conform}</td>
                          <td colSpan={4}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              <div className="rounded-xl bg-white p-4 ring-1 ring-gray-200">
                <h2 className="mb-3 text-sm font-semibold text-gray-900">Consommations et arrêts</h2>
                <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                  {(
                    [
                      ["Sachets / sacs vides", emptyPackaging, setEmptyPackaging],
                      ["Eau (m³)", waterM3, setWaterM3],
                      ["Électricité (kWh)", electricityKwh, setElectricityKwh],
                      ["Gasoil (L)", generatorLiters, setGeneratorLiters],
                      ["Coupures (min)", outageMinutes, setOutageMinutes],
                      ["Pannes machines (min)", machineDowntimeMinutes, setMachineDowntimeMinutes],
                    ] as [string, string, (v: string) => void][]
                  ).map(([label, value, setter]) => (
                    <div key={label}>
                      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
                      <input
                        type="number"
                        min={0}
                        value={value}
                        onChange={(e) => setter(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <label className="mb-1 block text-xs font-medium text-gray-500">Incidents, lots non conformes et mesures</label>
                  <textarea
                    value={incidents}
                    onChange={(e) => setIncidents(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Aucun incident signalé."
                  />
                </div>
              </div>
            </>
          )}

          <div className="rounded-xl bg-white ring-1 ring-gray-200">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">Fiches du mois ({month})</h2>
              <button onClick={() => void loadLists(monthStart, monthEnd)} className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200">
                <RefreshCw className="h-4 w-4" /> Actualiser
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="px-4 py-2">N° fiche</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Responsable</th>
                  <th className="px-4 py-2 text-right">Lignes</th>
                  <th className="px-4 py-2 text-right">Conforme</th>
                  <th className="px-4 py-2 text-right">Rejeté</th>
                  <th className="px-4 py-2">Statut</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sheets.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                      Aucune fiche ce mois-ci.
                    </td>
                  </tr>
                )}
                {sheets.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">{s.sheetNumber}</td>
                    <td className="px-4 py-2">{fmtDate(s.date.slice(0, 10))}</td>
                    <td className="px-4 py-2">{s.manager ?? "—"}</td>
                    <td className="px-4 py-2 text-right">{s.lines}</td>
                    <td className="px-4 py-2 text-right">{s.conformTotal}</td>
                    <td className="px-4 py-2 text-right">{s.rejectedTotal}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        {s.status === "SUBMITTED" ? "Enregistrée" : s.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => {
                          setDate(s.date.slice(0, 10))
                          void loadSheet(s.date.slice(0, 10))
                        }}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        Ouvrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "synthese" && (
        <div className="rounded-xl bg-white ring-1 ring-gray-200">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Synthèse du mois — {month} (quantités conformes)</h2>
            <button onClick={() => void loadLists(monthStart, monthEnd)} className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200">
              <RefreshCw className="h-4 w-4" /> Actualiser
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="px-4 py-2">Date</th>
                  {synthProducts.map((p) => (
                    <th key={p} className="px-4 py-2 text-right">
                      {p}
                    </th>
                  ))}
                  <th className="px-4 py-2 text-right">Rejeté</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {synthDates.length === 0 && (
                  <tr>
                    <td colSpan={synthProducts.length + 3} className="px-4 py-6 text-center text-gray-400">
                      Aucune donnée ce mois-ci.
                    </td>
                  </tr>
                )}
                {synthDates.map((d) => {
                  const rows = synthesis.filter((r) => r.date === d)
                  const dayConform = rows.reduce((a, r) => a + r.conform, 0)
                  const dayRejected = rows.reduce((a, r) => a + r.rejected, 0)
                  return (
                    <tr key={d} className="border-b border-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">{fmtDate(d)}</td>
                      {synthProducts.map((p) => {
                        const r = rows.find((x) => x.product === p)
                        return (
                          <td key={p} className={`px-4 py-2 text-right ${r ? "text-gray-900" : "text-gray-300"}`}>
                            {r ? r.conform : "—"}
                          </td>
                        )
                      })}
                      <td className="px-4 py-2 text-right text-amber-700">{dayRejected || "—"}</td>
                      <td className="px-4 py-2 text-right font-semibold">{dayConform}</td>
                    </tr>
                  )
                })}
              </tbody>
              {synthDates.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50 font-semibold text-gray-900">
                    <td className="px-4 py-2">Total mois</td>
                    {synthProducts.map((p) => (
                      <td key={p} className="px-4 py-2 text-right">
                        {synthesis.filter((r) => r.product === p).reduce((a, r) => a + r.conform, 0)}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right">{synthesis.reduce((a, r) => a + r.rejected, 0)}</td>
                    <td className="px-4 py-2 text-right">{synthesis.reduce((a, r) => a + r.conform, 0)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
