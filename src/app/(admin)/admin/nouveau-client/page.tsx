"use client"

/**
 * Nouveau client : inscription rapide d'un client B2B (entreprise) ou B2C (particulier) dans le fichier clients.
 * Écran ouvert d'office aux commerciaux et à leur responsable (voir NEW_CLIENT_MODULE dans src/lib/permissions.ts).
 * Pensé pour le terrain et l'écran tactile : un seul formulaire, grandes cibles, position GPS en un appui,
 * et contrôle des doublons avant d'écrire dans la base.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { AlertTriangle, Building2, CheckCircle2, Loader2, LocateFixed, MapPin, Phone, User as UserIcon, UserPlus } from "lucide-react"
import { isCommercialManager, isCommercialRole } from "@/lib/permissions"
import { DUPLICATE_REASON_LABELS, type DuplicateMatch } from "@/lib/client-duplicates"

type ClientType = "B2B" | "B2C"

interface Commercial {
  id: string
  name: string | null
  email: string
}

interface CreatedClient {
  id: string
  type: ClientType
  companyName: string | null
  firstName: string | null
  lastName: string | null
  phone: string | null
  city: string | null
  createdAt: string
}

const emptyForm = {
  companyName: "",
  tradeName: "",
  contactName: "",
  taxId: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  city: "Brazzaville",
  address: "",
  notes: "",
  commercialId: "",
}

function nameOf(c: CreatedClient): string {
  return c.companyName || [c.firstName, c.lastName].filter(Boolean).join(" ") || "(sans nom)"
}

export default function NouveauClientPage() {
  const { data: session, status } = useSession()
  const role = session?.user?.role as string | undefined
  const meId = session?.user?.id as string | undefined
  // Le commercial inscrit ses propres clients ; l'administrateur et le responsable choisissent le commercial attitré.
  const choosesCommercial = role === "ADMIN" || isCommercialManager(role)
  const allowed = role === "ADMIN" || isCommercialRole(role)

  const [type, setType] = useState<ClientType>("B2B")
  const [form, setForm] = useState(emptyForm)
  const [position, setPosition] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [commerciaux, setCommerciaux] = useState<Commercial[]>([])
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([])
  const [confirmDuplicate, setConfirmDuplicate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [created, setCreated] = useState<CreatedClient | null>(null)
  const [recent, setRecent] = useState<CreatedClient[]>([])
  const topRef = useRef<HTMLDivElement | null>(null)
  const duplicatesRef = useRef<HTMLDivElement | null>(null)

  const set = (key: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setConfirmDuplicate(false)
  }

  // Commerciaux proposés à l'administrateur et au responsable
  useEffect(() => {
    if (!choosesCommercial) return
    const controller = new AbortController()
    fetch("/api/commerciaux", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setCommerciaux(Array.isArray(list) ? list : []))
      .catch(() => {})
    return () => controller.abort()
  }, [choosesCommercial])

  // Derniers clients inscrits (les siens pour un commercial, tous pour l'administrateur et le responsable)
  const loadRecent = useCallback(async () => {
    if (!allowed || !meId) return
    try {
      const params = new URLSearchParams()
      if (role === "COMMERCIAL") params.set("commercialId", meId)
      const res = await fetch(`/api/clients?${params.toString()}`)
      if (!res.ok) return
      const list = await res.json()
      setRecent(Array.isArray(list) ? list.slice(0, 5) : [])
    } catch {
      // la liste est un confort : son échec ne doit pas gêner la saisie
    }
  }, [allowed, meId, role])

  useEffect(() => {
    // différé : même façon de faire que l’écran Clients (pas de mise à jour d’état dans le corps de l’effet)
    const t = setTimeout(loadRecent, 0)
    return () => clearTimeout(t)
  }, [loadRecent])

  // Doublons : recherchés pendant la saisie, dès qu'il y a un téléphone ou un nom exploitable
  const phone = form.phone
  const email = form.email
  const companyName = form.companyName
  const tradeName = form.tradeName
  const firstName = form.firstName
  const lastName = form.lastName
  const hasPhone = phone.replace(/\D/g, "").length >= 8
  const hasName = type === "B2B" ? companyName.trim().length > 2 || tradeName.trim().length > 2 : (firstName + lastName).trim().length > 2
  // rien d'exploitable saisi : pas de recherche, et la liste trouvée auparavant n'est plus affichée
  const searchable = hasPhone || hasName || email.trim().length > 0
  const shownDuplicates = searchable ? duplicates : []
  useEffect(() => {
    if (!allowed || !searchable) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ type, phone, email })
      if (type === "B2B") {
        params.set("companyName", companyName)
        params.set("tradeName", tradeName)
      } else {
        params.set("firstName", firstName)
        params.set("lastName", lastName)
      }
      fetch(`/api/clients/doublons?${params.toString()}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((list) => setDuplicates(Array.isArray(list) ? list : []))
        .catch(() => {})
    }, 450)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [allowed, searchable, type, phone, email, companyName, tradeName, firstName, lastName])

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setError("Cet appareil ne donne pas sa position. Saisissez l'adresse : elle sera placée sur la carte automatiquement.")
      return
    }
    setLocating(true)
    setError("")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) })
        setLocating(false)
      },
      () => {
        setLocating(false)
        setError("Position indisponible (autorisation refusée ou signal trop faible). Saisissez l'adresse à la place.")
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  const validate = (): string => {
    if (type === "B2B" && !form.companyName.trim()) return "Indiquez la raison sociale de l'entreprise."
    if (type === "B2C" && !form.firstName.trim() && !form.lastName.trim()) return "Indiquez le nom ou le prénom du client."
    if (form.phone.replace(/\D/g, "").length < 8) return "Indiquez un numéro de téléphone complet : c'est lui qui permet de retrouver le client."
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "L'adresse e-mail n'est pas valide."
    return ""
  }

  const save = async (force: boolean) => {
    const problem = validate()
    if (problem) {
      setError(problem)
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      return
    }
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          ...(type === "B2B"
            ? { companyName: form.companyName, tradeName: form.tradeName, contactName: form.contactName, taxId: form.taxId }
            : { firstName: form.firstName, lastName: form.lastName }),
          phone: form.phone,
          email: form.email,
          city: form.city,
          address: form.address,
          notes: form.notes,
          commercialId: choosesCommercial ? form.commercialId : undefined,
          latitude: position?.lat,
          longitude: position?.lng,
          checkDuplicates: true,
          force,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409 && Array.isArray(data.duplicates)) {
        // le serveur a trouvé un client ressemblant : on le montre et on demande confirmation
        setDuplicates(data.duplicates)
        setConfirmDuplicate(true)
        setTimeout(() => duplicatesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50)
        return
      }
      if (!res.ok) {
        setError(data.error || "Le client n'a pas pu être enregistré.")
        topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
        return
      }
      setCreated(data as CreatedClient)
      setForm({ ...emptyForm, city: form.city, commercialId: form.commercialId })
      setPosition(null)
      setDuplicates([])
      setConfirmDuplicate(false)
      void loadRecent()
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    } catch {
      setError("Connexion interrompue : le client n'a pas été enregistré. Réessayez.")
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    "w-full min-h-12 px-3.5 py-2.5 text-base border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
  const labelCls = "block text-sm font-medium text-gray-700 mb-1.5"

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="max-w-xl mx-auto mt-10 bg-white border border-gray-200 rounded-2xl p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
        <h1 className="text-lg font-semibold text-gray-900">Écran réservé aux commerciaux</h1>
        <p className="text-base text-gray-600 mt-2">L&apos;inscription d&apos;un client est ouverte aux commerciaux, au responsable commercial et à l&apos;administrateur.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5" ref={topRef}>
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <UserPlus className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Nouveau client</h1>
          <p className="text-base text-gray-600">Inscrivez une entreprise (B2B) ou un particulier (B2C) dans le fichier clients.</p>
        </div>
      </div>

      {created && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5" role="status">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-emerald-900">
                {nameOf(created)} est enregistré ({created.type === "B2B" ? "entreprise" : "particulier"}).
              </p>
              <p className="text-base text-emerald-800 mt-0.5">Vous pouvez inscrire le client suivant ci-dessous.</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Link
                  href={created.type === "B2B" ? "/admin/clients-b2b" : "/admin/clients"}
                  className="inline-flex items-center min-h-12 px-4 rounded-xl bg-white border border-emerald-300 text-base font-medium text-emerald-900 hover:bg-emerald-100"
                >
                  Voir le fichier clients
                </Link>
                {created.type === "B2B" && (
                  <Link
                    href="/admin/devis-b2b"
                    className="inline-flex items-center min-h-12 px-4 rounded-xl bg-white border border-emerald-300 text-base font-medium text-emerald-900 hover:bg-emerald-100"
                  >
                    Faire un devis
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-base px-4 py-3 rounded-xl" role="alert">
          {error}
        </div>
      )}

      <form
        className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          void save(false)
        }}
        noValidate
      >
        {/* Type de client */}
        <fieldset>
          <legend className={labelCls}>Type de client</legend>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["B2B", "Entreprise (B2B)", "Hôtel, restaurant, commerce, société", Building2],
                ["B2C", "Particulier (B2C)", "Personne, ménage", UserIcon],
              ] as const
            ).map(([value, title, hint, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={type === value}
                onClick={() => {
                  setType(value)
                  setConfirmDuplicate(false)
                  setError("")
                }}
                className={`flex items-center gap-3 text-left min-h-16 px-4 py-3 rounded-xl border-2 transition-colors ${
                  type === value ? "border-primary bg-primary/5 text-primary" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                <Icon className="h-6 w-6 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-base font-semibold">{title}</span>
                  <span className="block text-sm text-gray-500">{hint}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        {/* Identité */}
        {type === "B2B" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="nc-company">Raison sociale *</label>
              <input id="nc-company" className={inputCls} value={form.companyName} onChange={set("companyName")} placeholder="Ex. : Hôtel Émeraude" autoComplete="organization" />
            </div>
            <div>
              <label className={labelCls} htmlFor="nc-trade">Enseigne</label>
              <input id="nc-trade" className={inputCls} value={form.tradeName} onChange={set("tradeName")} placeholder="Nom affiché sur la devanture" />
            </div>
            <div>
              <label className={labelCls} htmlFor="nc-contact">Personne à contacter</label>
              <input id="nc-contact" className={inputCls} value={form.contactName} onChange={set("contactName")} placeholder="Nom du gérant ou de l'acheteur" autoComplete="name" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="nc-tax">NIU / identifiant fiscal</label>
              <input id="nc-tax" className={inputCls} value={form.taxId} onChange={set("taxId")} placeholder="Facultatif" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} htmlFor="nc-first">Prénom</label>
              <input id="nc-first" className={inputCls} value={form.firstName} onChange={set("firstName")} autoComplete="given-name" />
            </div>
            <div>
              <label className={labelCls} htmlFor="nc-last">Nom *</label>
              <input id="nc-last" className={inputCls} value={form.lastName} onChange={set("lastName")} autoComplete="family-name" />
            </div>
          </div>
        )}

        {/* Coordonnées */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls} htmlFor="nc-phone">Téléphone *</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              <input id="nc-phone" type="tel" inputMode="tel" className={`${inputCls} pl-11`} value={form.phone} onChange={set("phone")} placeholder="06 600 00 00" autoComplete="tel" />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="nc-email">E-mail</label>
            <input id="nc-email" type="email" inputMode="email" className={inputCls} value={form.email} onChange={set("email")} placeholder="Facultatif" autoComplete="email" />
          </div>
          <div>
            <label className={labelCls} htmlFor="nc-city">Ville</label>
            <input id="nc-city" className={inputCls} value={form.city} onChange={set("city")} autoComplete="address-level2" />
          </div>
          <div>
            <label className={labelCls} htmlFor="nc-address">Adresse ou repère</label>
            <input id="nc-address" className={inputCls} value={form.address} onChange={set("address")} placeholder="Rue, quartier, repère" autoComplete="street-address" />
          </div>
        </div>

        {/* Doublons : affichés près du téléphone, là où le commercial regarde en saisissant */}
      {shownDuplicates.length > 0 && (
        <div ref={duplicatesRef} className={`scroll-mt-40 rounded-2xl border p-4 sm:p-5 ${confirmDuplicate ? "bg-amber-50 border-amber-300" : "bg-amber-50/60 border-amber-200"}`} role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 shrink-0 text-amber-600 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-amber-900">
                {shownDuplicates.length === 1 ? "Un client ressemblant existe déjà" : `${shownDuplicates.length} clients ressemblants existent déjà`}
              </p>
              <p className="text-base text-amber-800">Vérifiez qu&apos;il ne s&apos;agit pas du même client avant de l&apos;enregistrer une seconde fois.</p>
              <ul className="mt-3 space-y-2">
                {shownDuplicates.map((d) => (
                  <li key={d.id} className="bg-white border border-amber-200 rounded-xl px-3.5 py-2.5">
                    <p className="text-base font-semibold text-gray-900">
                      {d.label} <span className="font-normal text-gray-500">· {d.type === "B2B" ? "entreprise" : "particulier"}{d.isActive ? "" : " · inactif"}</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      {[d.phone, d.city, d.commercialName ? `suivi par ${d.commercialName}` : null].filter(Boolean).join(" · ") || "Sans coordonnées"}
                      <span className="text-amber-700 font-medium"> — {DUPLICATE_REASON_LABELS[d.reason]}</span>
                    </p>
                  </li>
                ))}
              </ul>
              {confirmDuplicate && (
                <div className="flex flex-wrap gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => void save(true)}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 min-h-12 px-4 rounded-xl bg-amber-600 text-white text-base font-semibold hover:bg-amber-700 disabled:opacity-60"
                  >
                    {saving && <Loader2 className="h-5 w-5 animate-spin" />}
                    C&apos;est un autre client : enregistrer quand même
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDuplicate(false)}
                    className="inline-flex items-center min-h-12 px-4 rounded-xl bg-white border border-amber-300 text-base font-medium text-amber-900 hover:bg-amber-100"
                  >
                    Corriger la saisie
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

        {/* Position sur la carte */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={locate}
              disabled={locating}
              className="inline-flex items-center justify-center gap-2 min-h-12 px-4 rounded-xl bg-white border border-gray-300 text-base font-medium text-gray-800 hover:border-primary hover:text-primary disabled:opacity-60"
            >
              {locating ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
              {position ? "Reprendre ma position" : "Je suis chez le client : relever ma position"}
            </button>
            {position && (
              <button type="button" onClick={() => setPosition(null)} className="inline-flex items-center min-h-12 px-3 text-base text-gray-600 underline">
                Retirer
              </button>
            )}
          </div>
          <p className="flex items-start gap-2 text-sm text-gray-600 mt-3">
            <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
            {position
              ? `Position relevée (${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}), précise à ${position.accuracy} m près. Elle placera le client sur la carte de la zone commerciale.`
              : "Facultatif. Sans position relevée, le client est placé sur la carte d'après son adresse."}
          </p>
        </div>

        {/* Commercial attitré */}
        {choosesCommercial ? (
          <div>
            <label className={labelCls} htmlFor="nc-commercial">Commercial attitré</label>
            <select id="nc-commercial" className={inputCls} value={form.commercialId} onChange={set("commercialId")}>
              <option value="">Aucun pour l&apos;instant</option>
              {commerciaux.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.email}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-base text-gray-600">Ce client sera inscrit à votre nom : vous en serez le commercial attitré.</p>
        )}

        <div>
          <label className={labelCls} htmlFor="nc-notes">Notes</label>
          <textarea id="nc-notes" className={inputCls} rows={3} value={form.notes} onChange={set("notes")} placeholder="Jours de livraison, besoins, remarques…" />
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
          <p className="text-sm text-gray-500">* champs obligatoires</p>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 min-h-14 px-6 rounded-xl bg-primary text-primary-foreground text-base font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
            Enregistrer le client
          </button>
        </div>
      </form>

      {recent.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-3">{role === "COMMERCIAL" ? "Vos derniers clients inscrits" : "Derniers clients inscrits"}</h2>
          <ul className="divide-y divide-gray-100">
            {recent.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-3">
                <span className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center ${c.type === "B2B" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {c.type === "B2B" ? <Building2 className="h-5 w-5" /> : <UserIcon className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-medium text-gray-900 truncate">{nameOf(c)}</span>
                  <span className="block text-sm text-gray-500 truncate">
                    {[c.type === "B2B" ? "Entreprise" : "Particulier", c.phone, c.city].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="text-sm text-gray-500 shrink-0">{new Date(c.createdAt).toLocaleDateString("fr-FR")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
