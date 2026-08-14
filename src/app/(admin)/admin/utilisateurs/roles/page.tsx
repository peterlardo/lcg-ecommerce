"use client"

import { useCallback, useEffect, useState } from "react"
import { ShieldCheck, Users, Save, ChevronDown, ChevronUp, ArrowLeft, Plus, Trash2, X } from "lucide-react"
import Link from "next/link"

interface RoleProfile {
  id: string; key: string; label: string; description: string | null; color: string | null; isActive: boolean; isSystem: boolean; userCount: number
}

interface RolePermission {
  module: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean
}

interface RoleData {
  role: string; permissions: RolePermission[]
}

const moduleLabels: Record<string, string> = {
  dashboard: "Tableau de bord", ventes: "Ventes", tickets: "Tickets", commandes: "Commandes", stock: "Stock", caisse: "Caisse",
  "journal-caisse": "Journal de caisse", production: "Production", distribution: "Distribution", livraisons: "Livraisons",
  reservations: "Réservations", "points-de-vente": "Points de vente", produits: "Produits", rapports: "Rapports",
  "controle-distant": "Contrôle distant", utilisateurs: "Utilisateurs",
}

export default function RolesPage() {
  const [profiles, setProfiles] = useState<RoleProfile[]>([])
  const [roleData, setRoleData] = useState<Record<string, RoleData>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedRole, setExpandedRole] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [newRole, setNewRole] = useState({ key: "", label: "", description: "", color: "#6366f1" })
  const [createError, setCreateError] = useState("")

  const loadProfiles = useCallback(async () => {
    try {
      const res = await fetch("/api/role-profiles")
      if (res.ok) setProfiles(await res.json())
    } finally { setLoading(false) }
  }, [])

  const loadRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/roles")
      if (res.ok) {
        const data = await res.json()
        const map: Record<string, RoleData> = {}
        for (const r of data.roles) map[r.role] = r
        setRoleData(map)
      }
    } catch {}
  }, [])

  useEffect(() => { void loadProfiles(); void loadRoles() }, [loadProfiles, loadRoles])

  const updatePermission = (role: string, module: string, field: keyof RolePermission, value: boolean) => {
    setRoleData((prev) => {
      const existing = prev[role]
      if (!existing) return prev
      return {
        ...prev,
        [role]: {
          ...existing,
          permissions: existing.permissions.map((p) => (p.module === module ? { ...p, [field]: value } : p)),
        },
      }
    })
    setHasChanges(role)
  }

  const toggleAllModules = (role: string, field: keyof RolePermission, value: boolean) => {
    setRoleData((prev) => {
      const existing = prev[role]
      if (!existing) return prev
      return {
        ...prev,
        [role]: {
          ...existing,
          permissions: existing.permissions.map((p) => ({ ...p, [field]: value })),
        },
      }
    })
    setHasChanges(role)
  }

  const saveRole = async (role: string) => {
    const data = roleData[role]
    if (!data) return
    setSaving(true)
    try {
      const res = await fetch("/api/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, permissions: data.permissions }),
      })
      if (res.ok) setHasChanges(null)
    } finally { setSaving(false) }
  }

  const createRole = async (e: React.FormEvent) => {
    e.preventDefault(); setCreateError("")
    const res = await fetch("/api/role-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newRole),
    })
    if (!res.ok) { const b = await res.json(); setCreateError(b.error || "Erreur"); return }
    setNewRole({ key: "", label: "", description: "", color: "#6366f1" })
    setShowCreate(false)
    await loadProfiles()
  }

  const deleteRole = async (id: string) => {
    if (!confirm("Supprimer ce profil de rôle ?")) return
    const res = await fetch(`/api/role-profiles/${id}`, { method: "DELETE" })
    if (res.ok) { await loadProfiles(); await loadRoles() }
  }

  const toggleActive = async (id: string, isActive: boolean) => {
    await fetch(`/api/role-profiles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    })
    await loadProfiles()
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/utilisateurs" className="rounded-lg p-2 hover:bg-muted transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">Profils de rôles</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">Créez et gérez les profils de rôles, puis assignez-les aux utilisateurs.</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 sm:text-sm">
          <Plus className="h-4 w-4" /> Nouveau rôle
        </button>
      </div>

      {showCreate && (
        <form onSubmit={createRole} className="rounded-xl border border-border bg-card p-3 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Créer un profil de rôle</h2>
            <button type="button" onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          {createError && <p className="mb-3 text-sm text-red-600">{createError}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Clé (identifiant)</label>
              <input required placeholder="Ex: RESPONSABLE_VENTE" value={newRole.key} onChange={(e) => setNewRole({ ...newRole, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground uppercase sm:py-2.5 sm:text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Libellé</label>
              <input required placeholder="Ex: Responsable de vente" value={newRole.label} onChange={(e) => setNewRole({ ...newRole, label: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground sm:py-2.5 sm:text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Description</label>
              <input placeholder="Description du rôle" value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground sm:py-2.5 sm:text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Couleur</label>
              <div className="flex items-center gap-2">
                <input type="color" value={newRole.color} onChange={(e) => setNewRole({ ...newRole, color: e.target.value })} className="h-10 w-10 cursor-pointer rounded border border-input" />
                <span className="text-xs text-muted-foreground">{newRole.color}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
              <Plus className="mr-1 inline h-4 w-4" /> Créer le rôle
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {profiles.map((p) => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color || "#6b7280" }} />
                <span className="text-sm font-semibold text-foreground">{p.label}</span>
              </div>
              {p.isSystem ? (
                <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">Système</span>
              ) : (
                <button onClick={() => deleteRole(p.id)} className="text-muted-foreground hover:text-red-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{p.description || "—"}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" /> {p.userCount} utilisateur(s)</span>
              <button onClick={() => toggleActive(p.id, p.isActive)} className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${p.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                {p.isActive ? "Actif" : "Inactif"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-base font-semibold text-foreground sm:text-lg mb-3">Permissions par rôle</h2>
        <p className="text-xs text-muted-foreground sm:text-sm mb-4">Configurez les permissions par défaut pour chaque rôle. Ces permissions s&apos;appliquent aux modules accessibles.</p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Chargement...</div>
      ) : (
        <div className="space-y-4">
          {Object.values(roleData).map((rd) => {
            const profile = profiles.find((p) => p.key === rd.role)
            const isExpanded = expandedRole === rd.role
            const activeCount = rd.permissions.filter((p) => p.canView || p.canCreate || p.canEdit || p.canDelete).length
            const allView = rd.permissions.every((p) => p.canView)
            const allCreate = rd.permissions.every((p) => p.canCreate)
            const allEdit = rd.permissions.every((p) => p.canEdit)
            const allDelete = rd.permissions.every((p) => p.canDelete)

            return (
              <div key={rd.role} className="rounded-xl border border-border bg-card shadow-card-soft overflow-hidden">
                <div className="flex flex-col gap-2 px-3 py-3 cursor-pointer hover:bg-muted/30 transition-colors sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4" onClick={() => setExpandedRole(isExpanded ? null : rd.role)}>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {profile && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: profile.color || "#6b7280" }} />}
                    <span className="text-xs font-semibold text-foreground sm:text-sm">{profile?.label || rd.role}</span>
                    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground sm:text-xs">
                      <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> {profile?.userCount ?? 0} utilisateur(s)
                    </span>
                    <span className="text-[10px] text-muted-foreground sm:text-xs">{activeCount} module(s)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isExpanded && hasChanges === rd.role && (
                      <button onClick={(e) => { e.stopPropagation(); saveRole(rd.role) }} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50">
                        <Save className="h-3.5 w-3.5" /> {saving ? "..." : "Sauvegarder"}
                      </button>
                    )}
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm">
                        <thead className="bg-muted/50 text-[10px] text-muted-foreground sm:text-xs">
                          <tr>
                            <th className="px-2 py-2 text-left font-medium sm:px-5 sm:py-2.5">Module</th>
                            <th className="px-2 py-2 text-center font-medium sm:px-3 sm:py-2.5"><button onClick={() => toggleAllModules(rd.role, "canView", !allView)} className="hover:text-foreground transition-colors">Voir {allView ? "✓" : ""}</button></th>
                            <th className="px-2 py-2 text-center font-medium sm:px-3 sm:py-2.5"><button onClick={() => toggleAllModules(rd.role, "canCreate", !allCreate)} className="hover:text-foreground transition-colors">Créer {allCreate ? "✓" : ""}</button></th>
                            <th className="px-2 py-2 text-center font-medium sm:px-3 sm:py-2.5"><button onClick={() => toggleAllModules(rd.role, "canEdit", !allEdit)} className="hover:text-foreground transition-colors">Modifier {allEdit ? "✓" : ""}</button></th>
                            <th className="px-2 py-2 text-center font-medium sm:px-3 sm:py-2.5"><button onClick={() => toggleAllModules(rd.role, "canDelete", !allDelete)} className="hover:text-foreground transition-colors">Supprimer {allDelete ? "✓" : ""}</button></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {rd.permissions.map((perm) => (
                            <tr key={perm.module} className="hover:bg-muted/20">
                              <td className="px-2 py-2 font-medium text-foreground sm:px-5 sm:py-2.5">{moduleLabels[perm.module] || perm.module}</td>
                              {(["canView", "canCreate", "canEdit", "canDelete"] as const).map((field) => (
                                <td key={field} className="px-2 py-2 text-center sm:px-3 sm:py-2.5">
                                  <button onClick={() => updatePermission(rd.role, perm.module, field, !perm[field])} className={`inline-flex h-5 w-9 items-center rounded-full transition-colors ${perm[field] ? "bg-primary" : "bg-muted"}`}>
                                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${perm[field] ? "translate-x-4.5" : "translate-x-0.5"}`} />
                                  </button>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
