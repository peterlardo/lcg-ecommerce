"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { Camera, Paperclip, X } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { isCashierRole } from "@/lib/permissions"
import { PROOF_LABEL, PROOF_MAX_BYTES, PROOF_REQUIRED, RECEIPT_METHODS, RECEIPT_METHOD_LABEL, REFERENCE_EXPECTED, REFERENCE_LABEL, REFERENCE_REQUIRED } from "@/lib/payment-methods"
import { prepareProof } from "@/lib/proof-file"

const METHODS = RECEIPT_METHODS.map((value) => ({ value, label: RECEIPT_METHOD_LABEL[value] }))

export interface PayableInvoice {
  id: string
  reference: string
  clientName: string
  /** reste à encaisser (règlements en attente déjà déduits si possible) */
  balance: number
}

/**
 * Encaisser une facture : montant, moyen de règlement, référence, banque et justificatif
 * (preuve du virement, scan du chèque). Le même formulaire sert dans Créances, dans la liste
 * des factures et sur la page d'une facture.
 */
export function InvoicePaymentDialog({ invoice, onClose, onDone }: { invoice: PayableInvoice; onClose: () => void; onDone: (message: string) => void }) {
  const { data: session } = useSession()
  const role = session?.user?.role
  // l'administrateur et la caisse encaissent directement (sauf virement et chèque, toujours à valider)
  const counter = role === "ADMIN" || isCashierRole(role)
  const [amount, setAmount] = useState(String(Math.max(0, Math.round(invoice.balance))))
  const [method, setMethod] = useState("CASH_ON_DELIVERY")
  const [reference, setReference] = useState("")
  const [bank, setBank] = useState("")
  const [notes, setNotes] = useState("")
  const [proofs, setProofs] = useState<File[]>([])
  const [preparing, setPreparing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const proofRequired = PROOF_REQUIRED.includes(method)
  const referenceRequired = REFERENCE_REQUIRED.includes(method)

  const addProofs = async (list: FileList | null) => {
    if (!list || list.length === 0) return
    setPreparing(true)
    setError("")
    try {
      const ready = await Promise.all([...list].map(prepareProof))
      const tooBig = ready.find((f) => f.size > PROOF_MAX_BYTES)
      if (tooBig) { setError(`« ${tooBig.name} » est trop lourd (4 Mo au plus).`); return }
      setProofs((current) => [...current, ...ready].slice(0, 3))
    } finally {
      setPreparing(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting || preparing) return
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) { setError("Indiquez le montant reçu"); return }
    if (value > invoice.balance + 0.01) { setError(`Le montant dépasse le reste à encaisser (${formatPrice(invoice.balance)})`); return }
    if (proofRequired && proofs.length === 0) {
      setError(method === "CHEQUE" ? "Joignez le scan (ou la photo) du chèque." : "Joignez la preuve du virement (avis de virement, capture de l'ordre).")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      const form = new FormData()
      form.set("amount", String(value))
      form.set("method", method)
      form.set("reference", reference)
      form.set("notes", notes)
      if (method === "CHEQUE") form.set("bank", bank)
      if (proofRequired) for (const f of proofs) form.append("proof", f, f.name)
      const res = await fetch(`/api/encaissements/${invoice.id}`, { method: "POST", body: form })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.error || "Enregistrement impossible"); return }
      const waitingFor = method === "CHEQUE"
        ? " : à valider une fois le chèque encaissé (écran Encaissements)."
        : method === "BANK_TRANSFER"
          ? " : à valider une fois le virement reçu sur le compte (écran Encaissements)."
          : " : en attente de validation par la caisse ou l'administrateur (écran Encaissements)."
      onDone(data?.validationStatus === "PENDING"
        ? `Règlement de ${formatPrice(value)} enregistré sur ${invoice.reference}${waitingFor}`
        : `Règlement de ${formatPrice(value)} encaissé sur ${invoice.reference}.`)
    } catch {
      setError("Connexion au serveur impossible : rien n'a été enregistré")
    } finally {
      setSubmitting(false)
    }
  }

  const field = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose() }}>
      <form onSubmit={submit} className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-md sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Encaisser {invoice.reference}</h2>
            <p className="text-sm text-gray-500">{invoice.clientName} · reste à encaisser {formatPrice(invoice.balance)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Montant reçu (FCFA)
            <input type="number" min={1} max={Math.ceil(invoice.balance)} step="1" required value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} text-lg font-bold`} />
            {Number(amount) > 0 && Number(amount) < invoice.balance - 0.005 && (
              <span className="mt-1 block text-xs font-normal text-gray-500">Règlement partiel : il restera {formatPrice(invoice.balance - Number(amount))} à encaisser.</span>
            )}
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Moyen de règlement
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={`${field} bg-white`}>
              {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          {REFERENCE_EXPECTED.includes(method) && (
            <label className="block text-sm font-medium text-gray-700">
              {REFERENCE_LABEL[method] ?? "Référence de la transaction"}{referenceRequired ? " *" : ""}
              <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} required={referenceRequired}
                placeholder={referenceRequired ? "" : "Facultatif, mais utile pour retrouver le paiement"} className={`${field} font-mono`} />
            </label>
          )}
          {method === "CHEQUE" && (
            <label className="block text-sm font-medium text-gray-700">
              Banque émettrice *
              <input type="text" value={bank} onChange={(e) => setBank(e.target.value)} maxLength={120} required placeholder="Ex. : LCB Bank, BGFIBank, Ecobank…" className={field} />
            </label>
          )}
          {proofRequired && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-900">{PROOF_LABEL[method]} *</p>
              <p className="mt-0.5 text-xs text-amber-800">
                {method === "CHEQUE"
                  ? "Photographiez ou scannez le chèque établi (recto, lisible). Le règlement sera validé une fois le chèque encaissé."
                  : "Joignez l'avis de virement ou la capture de l'ordre de virement. Le règlement sera validé une fois l'argent reçu sur le compte."}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {/* sur téléphone : l'appareil photo s'ouvre directement */}
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-900 hover:bg-amber-100">
                  <Camera className="h-4 w-4" /> Prendre une photo
                  <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { void addProofs(e.target.files); e.target.value = "" }} />
                </label>
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-900 hover:bg-amber-100">
                  <Paperclip className="h-4 w-4" /> {preparing ? "Préparation…" : "Choisir un fichier (photo ou PDF)"}
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="sr-only" onChange={(e) => { void addProofs(e.target.files); e.target.value = "" }} />
                </label>
              </div>
              {proofs.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {proofs.map((f, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5 text-sm text-gray-800">
                      <span className="truncate">{f.name} <span className="text-xs text-gray-500">({Math.max(1, Math.round(f.size / 1024))} Ko)</span></span>
                      <button type="button" onClick={() => setProofs((current) => current.filter((_, j) => j !== i))} aria-label={`Retirer ${f.name}`} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <label className="block text-sm font-medium text-gray-700">
            Remarque (facultatif)
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Ex. : remis par le gérant" className={field} />
          </label>
          {(!counter || proofRequired) && <p className="text-sm text-gray-500">Ce règlement sera compté après validation par la caisse ou l&apos;administrateur (écran Encaissements).</p>}
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={submitting} className="min-h-11 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Annuler
          </button>
          <button type="submit" disabled={submitting || preparing} aria-busy={submitting} className="min-h-11 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-60">
            {submitting ? "Enregistrement…" : "Enregistrer le règlement"}
          </button>
        </div>
      </form>
    </div>
  )
}
