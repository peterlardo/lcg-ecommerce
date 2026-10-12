"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useParams } from "next/navigation"
import { AlertCircle, ArrowLeft, Printer } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { STATUS_LABEL, TYPE_LABEL, type DocType } from "@/components/admin/b2b-documents-screen"

// Document B2B imprimable (devis, bon de commande, bon de livraison, facture) — portage de b2b-document.php (lcgapp3).

interface DocumentItem {
  id: string
  quantity: number
  unitPrice: number
  lineTotal: number
  productVariant: { format: string; unit: string | null; product: { name: string } } | null
}

interface DocumentDetail {
  id: string
  type: DocType
  reference: string
  status: string
  subtotal: number
  discount: number
  total: number
  notes: string | null
  validUntil: string | null
  createdAt: string
  cancelReason: string | null
  parent: { id: string; reference: string; type: DocType } | null
  children: { id: string; reference: string; type: DocType }[]
  client: {
    companyName: string | null
    tradeName: string | null
    contactName: string | null
    firstName: string | null
    lastName: string | null
    phone: string | null
    email: string | null
    address: string | null
    city: string | null
    taxId: string | null
  } | null
  items: DocumentItem[]
}

const COMPANY = {
  name: "LCG — La Congolaise des Glaçons",
  address: "97 Rue EWO, Ouenzé — Brazzaville, République du Congo",
  phones: "+242 06 739 49 49 · +242 05 607 91 91",
  contact: "www.lcg.cg · contact@lcg.cg",
  legal: "SARL au capital de 1 000 000 FCFA — RCCM : CG-BZV-01-2025-B12-00-146 — NIU : M250000007225623",
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}

export default function B2bDocumentPage() {
  const { id } = useParams<{ id: string }>()
  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    const init = async () => {
      try {
        const res = await fetch(`/api/b2b-documents/${id}`, { signal: controller.signal })
        const data = await res.json().catch(() => null)
        if (controller.signal.aborted) return
        if (!res.ok || !data?.document) {
          setError(res.status === 404 ? "Document introuvable." : res.status === 403 ? "Ce document ne fait pas partie de vos clients." : data?.error || "Chargement impossible")
          return
        }
        setDoc(data.document)
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) setError("Connexion au serveur impossible")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void init()
    return () => controller.abort()
  }, [id])

  const back = doc?.type === "DEVIS" ? "/admin/devis-b2b" : "/admin/bons-b2b"
  const clientName = doc?.client ? doc.client.companyName || doc.client.tradeName || doc.client.contactName || `${doc.client.firstName ?? ""} ${doc.client.lastName ?? ""}`.trim() || "Client" : "Client"

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={back} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <ArrowLeft className="h-4 w-4" /> Retour à la liste
        </Link>
        {doc && (
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            <Printer className="h-4 w-4" /> Imprimer
          </button>
        )}
      </div>

      {loading && <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500 print:hidden">Chargement...</p>}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {doc && (
        <article className="mx-auto max-w-4xl rounded-xl border border-gray-200 bg-white p-5 text-gray-900 sm:p-8 print:max-w-none print:rounded-none print:border-0 print:p-0">
          <header className="flex flex-col gap-4 border-b-2 border-primary pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <Image src="/logo-lcg-transparent.png" alt="" width={64} height={62} className="h-14 w-auto" />
              <div>
                <p className="text-lg font-bold text-primary">{COMPANY.name}</p>
                <p className="text-sm text-gray-600">{COMPANY.address}</p>
                <p className="text-sm text-gray-600">{COMPANY.phones}</p>
                <p className="text-sm text-gray-600">{COMPANY.contact}</p>
              </div>
            </div>
            <div className="sm:text-right">
              <p className="text-2xl font-bold uppercase tracking-wide text-gray-900">{TYPE_LABEL[doc.type].one}</p>
              <p className="font-mono text-base font-semibold">{doc.reference}</p>
              <p className="text-sm text-gray-600">du {formatDate(doc.createdAt)}</p>
              <p className="mt-1 print:hidden">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_LABEL[doc.status]?.className ?? "bg-gray-100 text-gray-700"}`}>{STATUS_LABEL[doc.status]?.label ?? doc.status}</span>
              </p>
            </div>
          </header>

          <section className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Client</p>
              <p className="mt-1 text-base font-bold">{clientName}</p>
              {doc.client?.contactName && doc.client.contactName !== clientName && <p className="text-sm text-gray-700">À l&apos;attention de {doc.client.contactName}</p>}
              {(doc.client?.address || doc.client?.city) && <p className="text-sm text-gray-700">{[doc.client.address, doc.client.city].filter(Boolean).join(", ")}</p>}
              {doc.client?.phone && <p className="text-sm text-gray-700">{doc.client.phone}</p>}
              {doc.client?.email && <p className="text-sm text-gray-700">{doc.client.email}</p>}
              {doc.client?.taxId && <p className="text-sm text-gray-700">NIU : {doc.client.taxId}</p>}
            </div>
            <div className="rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Références</p>
              {doc.parent && <p className="mt-1">Établi à partir de : {TYPE_LABEL[doc.parent.type].one.toLowerCase()} <span className="font-mono">{doc.parent.reference}</span></p>}
              {doc.children.map((child) => (
                <p key={child.id} className="mt-1">Suivi par : {TYPE_LABEL[child.type].one.toLowerCase()} <span className="font-mono">{child.reference}</span></p>
              ))}
              {doc.type === "DEVIS" && doc.validUntil && <p className="mt-1">Valable jusqu&apos;au {formatDate(doc.validUntil)}</p>}
              {!doc.parent && doc.children.length === 0 && !(doc.type === "DEVIS" && doc.validUntil) && <p className="mt-1 text-gray-500">—</p>}
            </div>
          </section>

          {doc.status === "CANCELLED" && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              Document annulé{doc.cancelReason ? ` : ${doc.cancelReason}` : ""}
            </p>
          )}

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="bg-primary text-white">
                  <th className="px-3 py-2 font-semibold">Désignation</th>
                  <th className="px-3 py-2 text-right font-semibold">Quantité</th>
                  {doc.type !== "LIVRAISON" && <th className="px-3 py-2 text-right font-semibold">Prix unitaire</th>}
                  {doc.type !== "LIVRAISON" && <th className="px-3 py-2 text-right font-semibold">Montant</th>}
                </tr>
              </thead>
              <tbody>
                {doc.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-200">
                    <td className="px-3 py-2">{item.productVariant ? `${item.productVariant.product.name} — ${item.productVariant.format}` : "Article retiré du catalogue"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">{item.quantity}{item.productVariant?.unit ? ` ${item.productVariant.unit}` : ""}</td>
                    {doc.type !== "LIVRAISON" && <td className="whitespace-nowrap px-3 py-2 text-right">{formatPrice(item.unitPrice)}</td>}
                    {doc.type !== "LIVRAISON" && <td className="whitespace-nowrap px-3 py-2 text-right font-medium">{formatPrice(item.lineTotal)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {doc.type !== "LIVRAISON" && (
            <div className="mt-4 ml-auto w-full max-w-xs text-sm">
              <p className="flex justify-between py-1 text-gray-700"><span>Sous-total</span><span>{formatPrice(doc.subtotal)}</span></p>
              {doc.discount > 0 && <p className="flex justify-between py-1 text-gray-700"><span>Remise</span><span>− {formatPrice(doc.discount)}</span></p>}
              <p className="flex justify-between border-t-2 border-gray-900 py-2 text-lg font-bold"><span>Total</span><span>{formatPrice(doc.total)}</span></p>
            </div>
          )}

          {doc.notes && (
            <div className="mt-4 rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Remarques</p>
              <p className="mt-1 whitespace-pre-line">{doc.notes}</p>
            </div>
          )}

          <div className="mt-10 grid grid-cols-2 gap-8 text-sm text-gray-700">
            <div>
              <p className="font-semibold">Pour LCG</p>
              <div className="mt-12 border-t border-gray-400 pt-1 text-xs text-gray-500">Nom, signature et cachet</div>
            </div>
            <div>
              <p className="font-semibold">{doc.type === "LIVRAISON" ? "Reçu par le client" : "Pour le client"}</p>
              <div className="mt-12 border-t border-gray-400 pt-1 text-xs text-gray-500">Nom, signature et cachet</div>
            </div>
          </div>

          <footer className="mt-8 border-t border-gray-200 pt-3 text-center text-xs text-gray-500">{COMPANY.legal}</footer>
        </article>
      )}
    </div>
  )
}
