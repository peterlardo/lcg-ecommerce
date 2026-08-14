"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, Check, Plus, Save, ShieldCheck, UserPlus, Users, X } from "lucide-react"
import Link from "next/link"

const modules = ["dashboard", "ventes", "tickets", "commandes", "stock", "caisse", "journal-caisse", "production", "distribution", "livraisons", "reservations", "points-de-vente", "produits", "rapports", "controle-distant", "utilisateurs"]
const labels: Record<string, string> = { dashboard: "Dashboard", ventes: "Ventes", tickets: "Tickets de vente", commandes: "Commandes", stock: "Stock", caisse: "Caisse", "journal-caisse": "Journal de caisse", production: "Production", distribution: "Distribution", livraisons: "Livraisons", reservations: "Pré-commandes", "points-de-vente": "Points de vente", produits: "Produits", rapports: "Rapports", "controle-distant": "Contrôle distant", utilisateurs: "Utilisateurs" }

interface RoleProfile { id: string; key: string; label: string; description: string | null; color: string | null; isActive: boolean; isSystem: boolean }
interface Permission { module: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }
interface PointOfSale { id: string; name: string; code: string }
interface User { id: string; name: string | null; email: string; phone: string | null; role: string; isActive: boolean; image: string | null; permissions: Permission[]; managedPointOfSales: PointOfSale[] }
const empty = { name: "", email: "", phone: "", password: "", role: "STOCK_MANAGER", image: "" }
const emptyPermissions = () => modules.map((module) => ({ module, canView: false, canCreate: false, canEdit: false, canDelete: false }))

export default function UtilisateursPage() {
  const [users, setUsers] = useState<User[]>([])
  const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([])
  const [roleProfiles, setRoleProfiles] = useState<RoleProfile[]>([])
  const [form, setForm] = useState(empty)
  const [selected, setSelected] = useState<string | null>(null)
  const [editRole, setEditRole] = useState("")
  const [editActive, setEditActive] = useState(true)
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [createPermissions, setCreatePermissions] = useState<Permission[]>(emptyPermissions())
  const [createPosIds, setCreatePosIds] = useState<string[]>([])
  const [editPosIds, setEditPosIds] = useState<string[]>([])
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editPassword, setEditPassword] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const editFileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    const response = await fetch("/api/utilisateurs")
    if (response.ok) setUsers(await response.json())
    setLoading(false)
  }

  const loadPOS = async () => {
    const res = await fetch("/api/points-de-vente")
    if (res.ok) {
      const data = await res.json()
      const list = Array.isArray(data) ? data : data.points ?? []
      setPointsOfSale(list.filter((p: PointOfSale) => true))
    }
  }

  const loadRoles = async () => {
    const res = await fetch("/api/role-profiles")
    if (res.ok) setRoleProfiles(await res.json())
  }

  useEffect(() => { void load(); void loadPOS(); void loadRoles() }, [])

  const handlePhotoUpload = async (file: File, forCreate: boolean) => {
    const fd = new FormData()
    fd.append("file", file)
    setUploading(true)
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      if (res.ok) {
        const { url } = await res.json()
        if (forCreate) setForm((f) => ({ ...f, image: url }))
      }
    } finally { setUploading(false) }
  }

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault(); setError("")
    const response = await fetch("/api/utilisateurs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, permissions: createPermissions, posIds: createPosIds }),
    })
    const body = await response.json()
    if (!response.ok) setError(body.error || "Erreur")
    else { setMessage("Utilisateur créé"); setForm(empty); setCreatePermissions(emptyPermissions()); setCreatePosIds([]); setShowCreate(false); await load() }
  }

  const selectUser = (user: User) => {
    setSelected(user.id)
    setEditName(user.name || "")
    setEditEmail(user.email)
    setEditPhone(user.phone || "")
    setEditPassword("")
    setEditRole(user.role)
    setEditActive(user.isActive)
    setPermissions(modules.map((module) => user.permissions.find((permission) => permission.module === module) || { module, canView: user.role === "ADMIN", canCreate: user.role === "ADMIN", canEdit: user.role === "ADMIN", canDelete: user.role === "ADMIN" }))
    setEditPosIds(user.managedPointOfSales.map((p) => p.id))
  }

  const toggleCreateModule = (module: string) => setCreatePermissions((current) => current.map((permission) => permission.module === module ? { ...permission, canView: !permission.canView } : permission))
  const togglePermission = (module: string, action: keyof Omit<Permission, "module">) => setPermissions((current) => current.map((permission) => permission.module === module ? { ...permission, [action]: !permission[action] } : permission))

  const saveUser = async () => {
    if (!selected) return
    const payload: Record<string, unknown> = { name: editName, phone: editPhone, role: editRole, isActive: editActive, permissions, posIds: editPosIds }
    if (editPassword.trim()) payload.password = editPassword.trim()
    const response = await fetch(`/api/utilisateurs/${selected}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (response.ok) { setMessage("Utilisateur mis à jour"); setEditPassword(""); await load() } else setError("Impossible d'enregistrer")
  }

  const handleEditPhoto = async (file: File) => {
    const fd = new FormData()
    fd.append("file", file)
    setUploading(true)
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      if (res.ok && selected) {
        const { url } = await res.json()
        await fetch(`/api/utilisateurs/${selected}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: url }) })
        await load()
      }
    } finally { setUploading(false) }
  }

  const getRoleProfile = (key: string) => roleProfiles.find((r) => r.key === key)
  const activeRoles = roleProfiles.filter((r) => r.isActive)
  const selectedUser = selected ? users.find((u) => u.id === selected) : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Administration</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Utilisateurs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gérer les comptes, rôles, droits d&apos;accès et points de vente assignés.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/utilisateurs/roles" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <ShieldCheck className="h-4 w-4" /> Profils de rôles
          </Link>
          <button onClick={() => setShowCreate((v) => !v)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
            <UserPlus className="h-4 w-4" /> Nouvel utilisateur
          </button>
        </div>
      </div>

      {message && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex items-center justify-between">{message}<button onClick={() => setMessage("")} className="text-green-500 hover:text-green-700"><X className="h-4 w-4" /></button></div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">{error}<button onClick={() => setError("")} className="text-red-500 hover:text-red-700"><X className="h-4 w-4" /></button></div>}

      {showCreate && (
        <form onSubmit={createUser} className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold text-foreground">Créer un utilisateur</h2>

          <div className="flex flex-col gap-6 sm:flex-row">
            <div className="flex flex-col items-center gap-3">
              <div className="relative h-20 w-20 overflow-hidden rounded-full border-2 border-dashed border-border bg-muted flex items-center justify-center">
                {form.image ? (
                  <img src={form.image} alt="Photo" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <label className="cursor-pointer text-xs font-semibold text-primary hover:underline">
                {uploading ? "Envoi..." : "Ajouter une photo"}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f, true) }} />
              </label>
            </div>

            <div className="flex-1 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              <input required placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground" />
              <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground" />
              <input placeholder="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground" />
              <input required type="password" placeholder="Mot de passe (min. 6 car.)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground" />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground">
                {activeRoles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </div>
          </div>

          {getRoleProfile(form.role) && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getRoleProfile(form.role)?.color || "#6b7280" }} />
              {getRoleProfile(form.role)?.description}
            </div>
          )}

          <div className="mt-4 border-t border-border pt-4">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Points de vente assignés</h3>
            <p className="mb-3 text-xs text-muted-foreground">Sélectionnez les points de vente que cet utilisateur pourra gérer.</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {pointsOfSale.map((pos) => (
                <label key={pos.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground">
                  <input type="checkbox" checked={createPosIds.includes(pos.id)} onChange={() => setCreatePosIds((prev) => prev.includes(pos.id) ? prev.filter((id) => id !== pos.id) : [...prev, pos.id])} className="h-4 w-4 accent-primary" />
                  {pos.name}
                </label>
              ))}
              {pointsOfSale.length === 0 && <p className="text-xs text-muted-foreground">Aucun point de vente disponible.</p>}
            </div>
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Modules visibles</h3>
                <p className="mt-1 text-xs text-muted-foreground">Cochez les modules que cet utilisateur pourra voir dans son dashboard.</p>
              </div>
              <button type="button" onClick={() => setCreatePermissions((current) => current.map((permission) => ({ ...permission, canView: true })))} className="text-xs font-semibold text-primary hover:underline">Tout cocher</button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {createPermissions.map((permission) => (
                <label key={permission.module} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground">
                  <input type="checkbox" checked={permission.canView} onChange={() => toggleCreateModule(permission.module)} className="h-4 w-4 accent-primary" />
                  {labels[permission.module]}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
              <Plus className="mr-1 inline h-4 w-4" />Créer
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
        <section className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Chargement...</p>}
          {users.map((user) => {
            const rp = getRoleProfile(user.role)
            return (
              <button key={user.id} onClick={() => selectUser(user)} className={`w-full rounded-xl border bg-card p-4 text-left ${selected === user.id ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {user.image ? (
                      <img src={user.image} alt={user.name || ""} className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{(user.name || user.email).charAt(0).toUpperCase()}</div>
                    )}
                    <div>
                      <p className="font-semibold text-foreground">{user.name || user.email}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${user.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{user.isActive ? "Actif" : "Inactif"}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {rp ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${rp.color || "#6b7280"}20`, color: rp.color || "#6b7280" }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: rp.color || "#6b7280" }} />
                      {rp.label}
                    </span>
                  ) : (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{user.role}</span>
                  )}
                </div>
                {user.managedPointOfSales.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {user.managedPointOfSales.map((pos) => (
                      <span key={pos.id} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{pos.name}</span>
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </section>

        {selected && selectedUser && (
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative group">
                  {selectedUser.image ? (
                    <img src={selectedUser.image} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-border" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">{(selectedUser.name || selectedUser.email).charAt(0).toUpperCase()}</div>
                  )}
                  <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="h-5 w-5 text-white" />
                    <input ref={editFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleEditPhoto(f) }} />
                  </label>
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">{selectedUser.name || selectedUser.email}</h2>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Profil & statut</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Nom</label>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" placeholder="Nom complet" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Email</label>
                  <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" placeholder="email@lcg.cg" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Téléphone</label>
                  <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" placeholder="+242 ..." />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Nouveau mot de passe (optionnel)</label>
                  <input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" placeholder="Laisser vide pour garder" />
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">Rôle assigné</label>
                  <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground">
                    {activeRoles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                  {getRoleProfile(editRole) && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getRoleProfile(editRole)?.color || "#6b7280" }} />
                      {getRoleProfile(editRole)?.description}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Statut</label>
                  <button type="button" onClick={() => setEditActive(!editActive)} className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${editActive ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-600"}`}>
                    <span className={`h-2 w-2 rounded-full ${editActive ? "bg-green-500" : "bg-gray-400"}`} />
                    {editActive ? "Actif" : "Inactif"}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <h3 className="mb-2 text-sm font-semibold text-foreground">Points de vente assignés</h3>
              <p className="mb-3 text-xs text-muted-foreground">Cocher les points de vente que cet utilisateur peut gérer.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {pointsOfSale.map((pos) => (
                  <label key={pos.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground">
                    <input type="checkbox" checked={editPosIds.includes(pos.id)} onChange={() => setEditPosIds((prev) => prev.includes(pos.id) ? prev.filter((id) => id !== pos.id) : [...prev, pos.id])} className="h-4 w-4 accent-primary" />
                    <span className="truncate">{pos.name} <span className="text-xs text-muted-foreground">({pos.code})</span></span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <h3 className="mb-2 text-sm font-semibold text-foreground">Droits par module</h3>
              <p className="mb-3 text-xs text-muted-foreground">Cochez les actions autorisées pour cet utilisateur.</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead className="border-b border-border text-xs text-muted-foreground">
                    <tr><th className="px-3 py-3">Module</th><th className="px-3 py-3 text-center">Voir</th><th className="px-3 py-3 text-center">Créer</th><th className="px-3 py-3 text-center">Modifier</th><th className="px-3 py-3 text-center">Supprimer</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {permissions.map((permission) => (
                      <tr key={permission.module}>
                        <td className="px-3 py-3 font-medium text-foreground">{labels[permission.module]}</td>
                        {(["canView", "canCreate", "canEdit", "canDelete"] as const).map((action) => (
                          <td key={action} className="px-3 py-3 text-center">
                            <button type="button" onClick={() => togglePermission(permission.module, action)} className={`mx-auto flex h-7 w-7 items-center justify-center rounded-md border ${permission[action] ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent"}`}><Check className="h-4 w-4" /></button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button onClick={saveUser} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
                <Save className="h-4 w-4" /> Enregistrer
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
