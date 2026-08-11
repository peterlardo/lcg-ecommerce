"use client"

import { useEffect, useState } from "react"
import { MapPin, Plus, Trash2, CheckCircle } from "lucide-react"

interface Address {
  id: string
  label: string | null
  street: string
  city: string
  district: string | null
  isDefault: boolean
}

export default function AdressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    label: "",
    street: "",
    city: "Brazzaville",
    district: "",
    isDefault: false,
  })

  useEffect(() => {
    fetch("/api/addresses")
      .then((r) => r.json())
      .then((data) => {
        setAddresses(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError("")

    try {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || "Erreur lors de la création")
      }

      const newAddr = await res.json()
      setAddresses((prev) => {
        const updated = form.isDefault
          ? prev.map((a) => ({ ...a, isDefault: false }))
          : prev
        return [newAddr, ...updated].sort((a, b) =>
          a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1
        )
      })
      setForm({ label: "", street: "", city: "Brazzaville", district: "", isDefault: false })
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette adresse ?")) return
    try {
      await fetch(`/api/addresses/${id}`, { method: "DELETE" })
      setAddresses((prev) => prev.filter((a) => a.id !== id))
    } catch {}
  }

  const handleSetDefault = async (id: string) => {
    try {
      await fetch(`/api/addresses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      })
      setAddresses((prev) =>
        prev.map((a) => ({ ...a, isDefault: a.id === id }))
      )
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight lg:text-3xl">
            Mes adresses
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez vos adresses de livraison.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-full bg-[#1f4fa3] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-[#1f4fa3]/25 transition-transform hover:scale-[1.03]"
        >
          <Plus className="h-4 w-4" />
          Ajouter
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-6 rounded-2xl border border-border bg-white p-6 shadow-sm"
        >
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Label (Maison, Bureau...)
              <input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-shadow focus:border-[#1f4fa3] focus:ring-2 focus:ring-[#1f4fa3]/20"
                placeholder="Ex: Maison"
              />
            </label>
            <label className="block text-sm font-semibold">
              Quartier / Arrondissement
              <input
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-shadow focus:border-[#1f4fa3] focus:ring-2 focus:ring-[#1f4fa3]/20"
                placeholder="Ex: Moungali"
              />
            </label>
            <label className="block text-sm font-semibold sm:col-span-2">
              Adresse complète *
              <input
                required
                value={form.street}
                onChange={(e) => setForm({ ...form, street: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-shadow focus:border-[#1f4fa3] focus:ring-2 focus:ring-[#1f4fa3]/20"
                placeholder="Numéro, rue, repère..."
              />
            </label>
            <label className="block text-sm font-semibold">
              Ville *
              <input
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-shadow focus:border-[#1f4fa3] focus:ring-2 focus:ring-[#1f4fa3]/20"
              />
            </label>
            <label className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 accent-[#1f4fa3]"
              />
              <span className="text-sm font-semibold">Adresse par défaut</span>
            </label>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-[#1f4fa3] px-6 py-2.5 text-sm font-bold text-white shadow-md transition-transform hover:scale-[1.03] disabled:opacity-50"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-full border border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-50"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {addresses.length === 0 && !showForm ? (
        <div className="mt-12 rounded-2xl border border-border bg-white p-12 text-center shadow-sm">
          <MapPin className="mx-auto h-12 w-12 text-gray-200" />
          <h2 className="mt-4 font-display text-xl font-bold">
            Aucune adresse enregistrée
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Ajoutez une adresse pour faciliter vos prochaines commandes.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`flex items-center justify-between rounded-2xl border bg-white p-5 shadow-sm ${
                addr.isDefault
                  ? "border-[#1f4fa3]/30 ring-1 ring-[#1f4fa3]/10"
                  : "border-gray-100"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {addr.label && (
                    <span className="font-display text-sm font-bold">{addr.label}</span>
                  )}
                  {addr.isDefault && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#1f4fa3]/10 px-2 py-0.5 text-xs font-semibold text-[#1f4fa3]">
                      <CheckCircle className="h-3 w-3" /> Défaut
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  {addr.street}{addr.district ? `, ${addr.district}` : ""}, {addr.city}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!addr.isDefault && (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(addr.id)}
                    className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:bg-gray-50"
                  >
                    Définir par défaut
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(addr.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
