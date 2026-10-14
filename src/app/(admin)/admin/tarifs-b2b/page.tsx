"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { AlertCircle, Search, Tags } from "lucide-react"
import { formatPrice } from "@/lib/utils"

// Tarifs B2B : prix publics et, pour un client choisi, prix de son contrat. Écran de consultation ;
// les prix négociés se saisissent dans l'écran Contrats. Portage de tarifs-b2b.php (lcgapp3).

interface ClientOption {
  id: string
  companyName: string | null
  tradeName: string | null
  contactName: string | null
}

interface Row {
  variantId: string
  name: string
  format: string
  unit: string | null
  publicPrice: number
}

interface Contract {
  id: string
  applicable: boolean
  startsAt: string
  endsAt: string | null
  paymentTermsDays: number
  minOrderAmount: number
  discountPercent: number
  items: { productVariantId: string; unitPrice: number }[]
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Africa/Brazzaville" })

export default function TarifsB2bPage() {
  const { data: session } = useSession()
  const [rows, setRows] = useState<Row[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientId, setClientId] = useState("")
  const [contract, setContract] = useState<Contract | null>(null)
  const [contractLoading, setContractLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

  const role = session?.user?.role
  const userId = session?.user?.id

  useEffect(() => {
    if (!role) return
    const controller = new AbortController()
    const init = async () => {
      try {
        // un commercial ne propose que ses clients ; les autres profils autorisés les voient tous
        const mine = role === "COMMERCIAL" ? `&commercialId=${userId}` : ""
        const [productsRes, clientsRes] = await Promise.all([
          fetch("/api/produits", { signal: controller.signal }),
          fetch(`/api/clients?type=B2B&active=true${mine}`, { signal: controller.signal }),
        ])
        if (controller.signal.aborted) return
        if (!productsRes.ok) { setError("Chargement des produits impossible"); return }
        const products = (await productsRes.json()) as { name: string; variants: { id: string; format: string; price: number; unit: string | null }[] }[]
        setRows(
          products
            .flatMap((p) => p.variants.map((v) => ({ variantId: v.id, name: p.name, format: v.format, unit: v.unit, publicPrice: v.price })))
            .sort((a, b) => `${a.name} ${a.format}`.localeCompare(`${b.name} ${b.format}`, "fr", { numeric: true })),
        )
        if (clientsRes.ok) setClients(await clientsRes.json())
        else if (clientsRes.status === 403) setError("Cet écran est réservé à l'administrateur, aux commerciaux et au comptable.")
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) setError("Connexion au serveur impossible")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void init()
    return () => controller.abort()
  }, [role, userId])

  // contrat du client choisi : seul un contrat actif et dans sa période fixe des prix
  useEffect(() => {
    if (!clientId) return
    const controller = new AbortController()
    const init = async () => {
      try {
        const res = await fetch(`/api/b2b-contracts?clientId=${encodeURIComponent(clientId)}&status=ACTIVE`, { signal: controller.signal })
        const data = await res.json().catch(() => null)
        if (controller.signal.aborted) return
        setContract(res.ok ? ((data?.contracts ?? []) as Contract[]).find((c) => c.applicable) ?? null : null)
      } catch {
        if (!controller.signal.aborted) setContract(null)
      } finally {
        if (!controller.signal.aborted) setContractLoading(false)
      }
    }
    void init()
    return () => controller.abort()
  }, [clientId])

  const chooseClient = (id: string) => {
    setClientId(id)
    setContract(null)
    setContractLoading(Boolean(id))
  }

  const negotiated = useMemo(() => new Map((contract?.items ?? []).map((i) => [i.productVariantId, i.unitPrice])), [contract])
  const percent = contract?.discountPercent ?? 0
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? rows.filter((r) => `${r.name} ${r.format}`.toLowerCase().includes(q)) : rows
  }, [rows, search])

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl">
          <Tags className="h-6 w-6 text-primary" />
          Tarifs B2B
        </h1>
        <p className="mt-1 text-sm text-gray-500">Prix publics de chaque article et, pour un client, les prix de son contrat. Pour changer un prix négocié, passez par l&apos;écran <Link href="/admin/contrats-b2b" className="font-semibold text-primary-700 underline">Contrats</Link>.</p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:p-4">
        <label className="flex-1 text-sm font-medium text-gray-700">
          <span className="sr-only">Client</span>
          <select value={clientId} onChange={(e) => chooseClient(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm">
            <option value="">Prix publics (aucun client choisi)</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.companyName || c.tradeName || c.contactName || "Client"}</option>)}
          </select>
        </label>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Produit ou format"
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {clientId && !contractLoading && (
        contract ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Contrat du {formatDate(contract.startsAt)} {contract.endsAt ? `au ${formatDate(contract.endsAt)}` : "sans date de fin"} · paiement à {contract.paymentTermsDays} jour{contract.paymentTermsDays > 1 ? "s" : ""}
            {percent > 0 ? ` · remise de ${percent} % sur les articles sans prix négocié` : ""}
            {contract.minOrderAmount > 0 ? ` · commande minimum ${formatPrice(contract.minOrderAmount)}` : ""}
          </div>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Ce client n&apos;a pas de contrat en cours : les prix publics s&apos;appliquent.</div>
        )
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading && <p className="p-4 text-sm text-gray-500">Chargement...</p>}
        {!loading && shown.length === 0 && <p className="p-8 text-center text-sm text-gray-500">Aucun article.</p>}
        {!loading && shown.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                  <th className="px-3 py-3 sm:px-4">Produit</th>
                  <th className="px-3 py-3">Format</th>
                  <th className="px-3 py-3 text-right">Prix public</th>
                  {clientId && <th className="px-3 py-3 text-right sm:px-4">Prix du client</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shown.map((row) => {
                  const price = negotiated.get(row.variantId)
                  const discounted = price === undefined && percent > 0 ? Math.round(row.publicPrice * (1 - percent / 100)) : null
                  return (
                    <tr key={row.variantId}>
                      <td className="px-3 py-3 font-medium text-gray-900 sm:px-4">{row.name}</td>
                      <td className="px-3 py-3 text-gray-700">{row.format}{row.unit ? <span className="text-gray-500"> · {row.unit}</span> : null}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-gray-700">{formatPrice(row.publicPrice)}</td>
                      {clientId && (
                        <td className="whitespace-nowrap px-3 py-3 text-right sm:px-4">
                          {price !== undefined ? (
                            <>
                              <span className="font-semibold text-primary-700">{formatPrice(price)}</span>
                              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">négocié</span>
                            </>
                          ) : discounted !== null ? (
                            <>
                              <span className="font-semibold text-gray-900">{formatPrice(discounted)}</span>
                              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">− {percent} %</span>
                            </>
                          ) : (
                            <span className="text-gray-500">{contractLoading ? "…" : "prix public"}</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
