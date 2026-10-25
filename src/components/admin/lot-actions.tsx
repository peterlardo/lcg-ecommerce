"use client"

import { useState } from "react"
import { Boxes, CalendarPlus, Power, PowerOff, Trash2, XCircle } from "lucide-react"

/** Champs d'un lot utiles aux actions de la liste (Production et Lots). */
export interface LotActionTarget {
  id: string
  lotNumber: string
  variantId: string
  status: string
  initialQuantity: number
  remainingQuantity: number
  expiryDate: string | null
}

interface StockLocation {
  id: string
  name: string
  stocks: { variantId: string; quantity: number }[]
}

/** Seuls ces lots se suppriment (même règle côté serveur, DELETE /api/lots/[id]). */
export function isDeletableLot(lot: { status: string }) {
  return lot.status === "EXHAUSTED" || lot.status === "EXPIRED"
}

function dateInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Date de base d'une prolongation : l'expiration actuelle si elle est à venir, sinon aujourd'hui. */
function extensionBase(lot: LotActionTarget) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (!lot.expiryDate) return today
  const current = new Date(lot.expiryDate)
  current.setHours(0, 0, 0, 0)
  return current > today ? current : today
}

function addDays(base: Date, days: number) {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return dateInput(d)
}

/**
 * Boutons d'une ligne de lot : corriger le stock, prolonger l'expiration, activer / désactiver, supprimer.
 * Chaque action passe par les routes existantes : POST /api/lots/[id]/stock, PATCH et DELETE /api/lots/[id].
 * `onDone` reçoit le message de réussite et recharge l'écran ; `onError` affiche l'échec.
 */
export function LotActions({
  lot,
  onDone,
  onError,
}: {
  lot: LotActionTarget
  onDone: (message: string) => void | Promise<void>
  onError: (message: string) => void
}) {
  const [dialog, setDialog] = useState<"stock" | "expiry" | null>(null)
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState("")

  // correction du stock : quantité réellement restante, point de vente de l'écart, motif
  const [locations, setLocations] = useState<StockLocation[]>([])
  const [locationsLoading, setLocationsLoading] = useState(false)
  const [stockQty, setStockQty] = useState("")
  const [stockPos, setStockPos] = useState("")
  const [stockReason, setStockReason] = useState("")

  const [newExpiry, setNewExpiry] = useState("")

  const archived = lot.status === "ARCHIVED"
  const disabled = lot.status === "DISABLED"
  const canToggle = lot.status === "ACTIVE" || disabled
  const posQty = (loc: StockLocation) => loc.stocks.find((s) => s.variantId === lot.variantId)?.quantity ?? 0

  const close = () => {
    if (busy) return
    setDialog(null)
    setDialogError("")
  }

  const openStock = async () => {
    setDialog("stock")
    setDialogError("")
    setStockQty(String(lot.remainingQuantity))
    setStockReason("")
    setLocationsLoading(true)
    try {
      const res = await fetch("/api/stock")
      const body = res.ok ? await res.json() : null
      const list: StockLocation[] = body?.locations ?? []
      setLocations(list)
      // par défaut : le point de vente qui détient le plus de ce format
      const holder = [...list].sort((a, b) => posQty(b) - posQty(a))[0]
      setStockPos(holder?.id ?? "")
      if (!body) setDialogError("Les points de vente n'ont pas pu être chargés")
    } catch {
      setDialogError("Connexion au serveur impossible")
    } finally {
      setLocationsLoading(false)
    }
  }

  const submitStock = async () => {
    if (busy) return
    const target = Number(stockQty)
    if (stockQty.trim() === "" || !Number.isInteger(target) || target < 0) { setDialogError("Saisissez une quantité entière, 0 ou plus"); return }
    if (target === lot.remainingQuantity) { setDialogError("C'est déjà la quantité du lot : rien à corriger"); return }
    if (!stockPos) { setDialogError("Choisissez le point de vente concerné"); return }
    if (!stockReason.trim()) { setDialogError("Indiquez le motif (inventaire, casse, erreur de saisie…)"); return }
    const diff = target - lot.remainingQuantity
    const posName = locations.find((l) => l.id === stockPos)?.name ?? "le point de vente"
    const sign = diff > 0 ? "+" : ""
    if (!window.confirm(`Lot ${lot.lotNumber} : ${lot.remainingQuantity} → ${target} (${sign}${diff}).\n\nLe stock de ${posName} et le stock global changent aussi de ${sign}${diff}. Confirmer ?`)) return
    setBusy(true)
    setDialogError("")
    try {
      const res = await fetch(`/api/lots/${lot.id}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: target, pointOfSaleId: stockPos, reason: stockReason.trim() }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) { setDialogError(body?.error ?? "Correction impossible"); return }
      setDialog(null)
      await onDone(`Lot ${lot.lotNumber} corrigé : ${target} restant(s) (${sign}${diff} sur ${posName})`)
    } catch {
      setDialogError("Connexion au serveur impossible : rien n'a été modifié")
    } finally {
      setBusy(false)
    }
  }

  const openExpiry = () => {
    setDialog("expiry")
    setDialogError("")
    setNewExpiry(addDays(extensionBase(lot), 7))
  }

  const submitExpiry = async () => {
    if (busy) return
    if (!newExpiry) { setDialogError("Choisissez la nouvelle date d'expiration"); return }
    if (newExpiry < dateInput(new Date())) { setDialogError("La nouvelle date ne peut pas être passée"); return }
    setBusy(true)
    setDialogError("")
    try {
      const res = await fetch(`/api/lots/${lot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiryDate: newExpiry }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) { setDialogError(body?.error ?? "Prolongation impossible"); return }
      setDialog(null)
      const label = new Date(newExpiry).toLocaleDateString("fr-FR")
      await onDone(body?.reactivated
        ? `Lot ${lot.lotNumber} prolongé au ${label} : de nouveau vendable en caisse`
        : `Lot ${lot.lotNumber} prolongé au ${label}`)
    } catch {
      setDialogError("Connexion au serveur impossible : rien n'a été modifié")
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async () => {
    if (busy || !canToggle) return
    const next = disabled ? "ACTIVE" : "DISABLED"
    const message = disabled
      ? `Réactiver le lot ${lot.lotNumber} ?\n\nSes ${lot.remainingQuantity} unité(s) redeviennent vendables en caisse.`
      : `Désactiver le lot ${lot.lotNumber} ?\n\nSes ${lot.remainingQuantity} unité(s) ne seront plus vendues en caisse tant que le lot reste désactivé. Le stock des points de vente ne change pas.`
    if (!window.confirm(message)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/lots/${lot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) { onError(body?.error ?? "Changement de statut impossible"); return }
      await onDone(disabled ? `Lot ${lot.lotNumber} réactivé` : `Lot ${lot.lotNumber} désactivé`)
    } catch {
      onError("Connexion au serveur impossible : rien n'a été modifié")
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (busy || !isDeletableLot(lot)) return
    const message = lot.status === "EXPIRED"
      ? `Supprimer le lot expiré ${lot.lotNumber} ?\n\nLe stock des points de vente ne change pas : si des produits de ce lot ont été jetés, sortez-les aussi du stock par une perte. S'il a servi à des ventes ou des mouvements de stock, il est archivé pour garder la traçabilité.`
      : `Supprimer le lot épuisé ${lot.lotNumber} ?\n\nSon historique d'allocations sera effacé. Les ventes et les mouvements de stock sont conservés.`
    if (!window.confirm(message)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/lots/${lot.id}`, { method: "DELETE" })
      const body = await res.json().catch(() => null)
      if (!res.ok) { onError(body?.error ?? "Suppression impossible"); return }
      await onDone(body?.archived ? `Lot ${lot.lotNumber} archivé (gardé pour la traçabilité)` : `Lot ${lot.lotNumber} supprimé`)
    } catch {
      onError("Connexion au serveur impossible : rien n'a été modifié")
    } finally {
      setBusy(false)
    }
  }

  const iconButton = "rounded p-1.5 disabled:cursor-not-allowed disabled:opacity-30"
  const diff = Number(stockQty) - lot.remainingQuantity
  const showDiff = stockQty.trim() !== "" && Number.isInteger(Number(stockQty)) && diff !== 0

  return (
    <>
      <div className="inline-flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={openStock}
          disabled={busy || archived}
          className={`${iconButton} text-primary-600 hover:bg-primary-50`}
          title={archived ? "Un lot archivé ne se corrige plus" : "Modifier le stock du lot"}
          aria-label={`Modifier le stock du lot ${lot.lotNumber}`}
        >
          <Boxes className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={openExpiry}
          disabled={busy || archived}
          className={`${iconButton} text-blue-600 hover:bg-blue-50`}
          title={archived ? "Un lot archivé ne se prolonge plus" : "Prolonger la date d'expiration"}
          aria-label={`Prolonger l'expiration du lot ${lot.lotNumber}`}
        >
          <CalendarPlus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={toggleActive}
          disabled={busy || !canToggle}
          className={`${iconButton} ${disabled ? "text-green-600 hover:bg-green-50" : "text-amber-600 hover:bg-amber-50"}`}
          title={!canToggle ? "Seul un lot actif ou désactivé change d'état" : disabled ? "Réactiver le lot" : "Désactiver le lot (plus vendu en caisse)"}
          aria-label={`${disabled ? "Réactiver" : "Désactiver"} le lot ${lot.lotNumber}`}
        >
          {disabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy || !isDeletableLot(lot)}
          className={`${iconButton} text-red-500 hover:bg-red-50`}
          title={isDeletableLot(lot) ? "Supprimer le lot" : "Seul un lot épuisé ou expiré se supprime : mettez son stock à 0 ou laissez-le expirer"}
          aria-label={`Supprimer le lot ${lot.lotNumber}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 text-left" onClick={(e) => { e.stopPropagation(); close() }}>
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">{dialog === "stock" ? "Modifier le stock" : "Prolonger l'expiration"}</h3>
                <p className="text-sm text-gray-500">Lot {lot.lotNumber}</p>
              </div>
              <button type="button" onClick={close} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100" aria-label="Fermer"><XCircle className="h-5 w-5" /></button>
            </div>

            {dialog === "stock" ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-600">
                  Saisissez la quantité réellement restante dans le lot (actuellement {lot.remainingQuantity} sur {lot.initialQuantity} produits).
                  L&apos;écart est appliqué au lot, au point de vente choisi et au stock global
                  {lot.status === "EXPIRED" ? " (lot expiré : seulement à la baisse)" : ""}.
                </p>
                <label className="block text-sm font-medium text-gray-700">
                  Quantité restante
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={lot.status === "EXPIRED" ? lot.remainingQuantity : lot.initialQuantity}
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none"
                  />
                  {showDiff && (
                    <span className={`mt-1 block text-xs font-semibold ${diff > 0 ? "text-green-700" : "text-red-700"}`}>
                      Écart : {diff > 0 ? "+" : ""}{diff}
                    </span>
                  )}
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Point de vente concerné
                  <select
                    value={stockPos}
                    onChange={(e) => setStockPos(e.target.value)}
                    disabled={locationsLoading}
                    className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base focus:border-primary-500 focus:outline-none"
                  >
                    <option value="">{locationsLoading ? "Chargement…" : "Choisir…"}</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name} ({posQty(loc)} en stock)</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Motif
                  <input
                    value={stockReason}
                    onChange={(e) => setStockReason(e.target.value)}
                    placeholder="Inventaire, casse, erreur de saisie…"
                    className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none"
                  />
                </label>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-600">
                  Expiration actuelle : <span className="font-semibold text-gray-900">{lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString("fr-FR") : "aucune"}</span>
                  {lot.status === "EXPIRED" ? ". Le lot redevient vendable en caisse avec une date à venir." : "."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {[3, 7, 14, 30].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setNewExpiry(addDays(extensionBase(lot), days))}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      +{days} j
                    </button>
                  ))}
                </div>
                <label className="block text-sm font-medium text-gray-700">
                  Nouvelle date d&apos;expiration
                  <input
                    type="date"
                    min={dateInput(new Date())}
                    value={newExpiry}
                    onChange={(e) => setNewExpiry(e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none"
                  />
                </label>
              </div>
            )}

            {dialogError && <p role="alert" className="mt-3 text-sm text-red-700">{dialogError}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={close} disabled={busy} className="min-h-11 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                Annuler
              </button>
              <button
                type="button"
                onClick={dialog === "stock" ? submitStock : submitExpiry}
                disabled={busy || (dialog === "stock" && locationsLoading)}
                className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? "Enregistrement…" : dialog === "stock" ? "Corriger le stock" : "Prolonger"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
