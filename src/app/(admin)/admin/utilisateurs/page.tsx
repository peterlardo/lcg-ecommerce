"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Camera, Check, Eye, EyeOff, LogOut, Plus, Save, ShieldCheck, UserPlus, X } from "lucide-react"
import Link from "next/link"
import { isCommercialRole, PERMISSION_MODULES, PERMISSION_MODULE_LABELS } from "@/lib/permissions"

// liste commune (permissions.ts) : un module absent d'ici voyait ses droits effacés à chaque enregistrement de la fiche
const modules: string[] = [...PERMISSION_MODULES]
const labels = PERMISSION_MODULE_LABELS

interface RoleProfile { id: string; key: string; label: string; description: string | null; color: string | null; isActive: boolean; isSystem: boolean }
interface Permission { module: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }
interface PointOfSale { id: string; name: string; code: string }
interface User { id: string; name: string | null; email: string; phone: string | null; role: string; isActive: boolean; image: string | null; permissions: Permission[]; managedPointOfSales: PointOfSale[]; openSession: { deviceName: string | null; deviceType: string | null; lastActiveAt: string } | null; sessionLimit: number }
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
  const [editSessionLimit, setEditSessionLimit] = useState(1)
  const [showCreatePassword, setShowCreatePassword] = useState(false)
  const [showEditPassword, setShowEditPassword] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  // objectif de chiffre d'affaires du mois en cours, par commercial
  const [targets, setTargets] = useState<Record<string, number>>({})
  const [targetMonth, setTargetMonth] = useState("")
  const [targetInput, setTargetInput] = useState("")
  const [targetSaving, setTargetSaving] = useState(false)
  // retour affiché à côté du bouton « Enregistrer » (le bandeau du haut de page est hors de vue à cet endroit)
  const [saveStatus, setSaveStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const editFileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/utilisateurs")
      if (response.ok) setUsers(await response.json())
      else setError("Impossible de charger les utilisateurs")
    } catch {
      setError("Impossible de charger les utilisateurs")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    const fetchUsers = async () => {
      try {
        const res = await fetch("/api/utilisateurs", { signal: controller.signal })
        if (controller.signal.aborted) return
        if (res.ok) setUsers(await res.json())
      } catch {
        if (!controller.signal.aborted) setError("Impossible de charger les utilisateurs")
      }
    }

    const fetchPoints = async () => {
      try {
        const res = await fetch("/api/points-de-vente/list", { signal: controller.signal })
        if (controller.signal.aborted) return
        if (res.ok) {
          const data = await res.json()
          setPointsOfSale(Array.isArray(data) ? data : data.points ?? [])
        }
      } catch {
        // Non bloquant : la gestion des utilisateurs reste utilisable sans la liste des PDV
      }
    }

    const fetchRoles = async () => {
      try {
        const res = await fetch("/api/role-profiles", { signal: controller.signal })
        if (controller.signal.aborted) return
        if (res.ok) setRoleProfiles(await res.json())
      } catch {
        // Non bloquant : le rôle saisi via l'API reste valide
      }
    }

    void Promise.allSettled([fetchUsers(), fetchPoints(), fetchRoles()]).then(() => {
      if (!controller.signal.aborted) setLoading(false)
    })

    return () => controller.abort()
  }, [])

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
    event.preventDefault(); setError(""); setMessage("")
    // Garde anti double-clic : les requêtes serveur mettent plusieurs secondes,
    // un second clic pendant l'envoi créait un doublon (409 « email existe déjà »).
    if (creating) return
    setCreating(true)
    try {
      const response = await fetch("/api/utilisateurs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, permissions: createPermissions, posIds: createPosIds }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(body?.error || (response.status === 401 || response.status === 403 ? "Session expirée ou accès refusé : reconnectez-vous" : "Erreur lors de la création"))
      } else {
        setMessage("Utilisateur créé"); setForm(empty); setCreatePermissions(emptyPermissions()); setCreatePosIds([]); setShowCreate(false); await load()
      }
    } catch {
      setError("Connexion au serveur impossible : utilisateur non créé")
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    const init = async () => {
      try {
        const res = await fetch("/api/commercial/targets", { signal: controller.signal })
        if (!res.ok) return
        const data = await res.json()
        if (controller.signal.aborted) return
        setTargetMonth(data.month ?? "")
        setTargets(Object.fromEntries((data.targets ?? []).map((t: { userId: string; targetAmount: number }) => [t.userId, t.targetAmount])))
      } catch {}
    }
    void init()
    return () => controller.abort()
  }, [])

  const saveTarget = async (user: User) => {
    if (targetSaving) return
    const amount = Number(targetInput || 0)
    if (!Number.isFinite(amount) || amount < 0) { setError("Objectif invalide"); return }
    setTargetSaving(true)
    setError("")
    setMessage("")
    try {
      const res = await fetch("/api/commercial/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, yearMonth: targetMonth || undefined, targetAmount: amount }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.error || "Impossible d'enregistrer l'objectif"); return }
      setTargets((current) => ({ ...current, [user.id]: amount }))
      setMessage(`Objectif de ${user.name || user.email} enregistré`)
    } catch {
      setError("Connexion au serveur impossible : objectif non enregistré")
    } finally {
      setTargetSaving(false)
    }
  }

  const selectUser = (user: User) => {
    setSelected(user.id)
    setSaveStatus(null)
    setTargetInput(targets[user.id] ? String(targets[user.id]) : "")
    setEditName(user.name || "")
    setEditEmail(user.email)
    setEditPhone(user.phone || "")
    setEditPassword("")
    setEditRole(user.role)
    setEditActive(user.isActive)
    setEditSessionLimit(user.sessionLimit || 1)
    setPermissions(modules.map((module) => user.permissions.find((permission) => permission.module === module) || { module, canView: user.role === "ADMIN", canCreate: user.role === "ADMIN", canEdit: user.role === "ADMIN", canDelete: user.role === "ADMIN" }))
    setEditPosIds(user.managedPointOfSales.map((p) => p.id))
  }

  const toggleCreateModule = (module: string) => setCreatePermissions((current) => current.map((permission) => permission.module === module ? { ...permission, canView: !permission.canView } : permission))
  const togglePermission = (module: string, action: keyof Omit<Permission, "module">) => setPermissions((current) => current.map((permission) => permission.module === module ? { ...permission, [action]: !permission[action] } : permission))

  const saveUser = async () => {
    if (!selected || saving) return
    const payload: Record<string, unknown> = { name: editName, email: editEmail, phone: editPhone, role: editRole, isActive: editActive, sessionLimit: editSessionLimit, permissions, posIds: editPosIds }
    if (editPassword.trim()) payload.password = editPassword.trim()
    setSaving(true)
    setSaveStatus(null)
    setMessage("")
    setError("")
    try {
      const response = await fetch(`/api/utilisateurs/${selected}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (response.ok) {
        setEditPassword("")
        await load()
        setMessage("Utilisateur mis à jour")
        setSaveStatus({ ok: true, text: `Modifications enregistrées à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` })
      } else {
        const body = await response.json().catch(() => null)
        const text = response.status === 401 || response.status === 403 ? "Session expirée ou accès refusé : reconnectez-vous" : body?.error || "Impossible d'enregistrer"
        setError(text)
        setSaveStatus({ ok: false, text })
      }
    } catch {
      setError("Connexion au serveur impossible : rien n'a été enregistré")
      setSaveStatus({ ok: false, text: "Connexion au serveur impossible : rien n'a été enregistré" })
    } finally {
      setSaving(false)
    }
  }

  // Une seule session ouverte par compte : l'administrateur peut la libérer (appareil éteint sans déconnexion…)
  const releaseSession = async (user: User) => {
    if (!confirm(`Libérer la session de ${user.name || user.email} ?\n\nL'appareil actuellement connecté sera déconnecté.`)) return
    setError("")
    setMessage("")
    const response = await fetch(`/api/utilisateurs/${user.id}/sessions`, { method: "DELETE" })
    if (response.ok) { setMessage("Session libérée : le compte peut se connecter sur un autre appareil"); await load() } else setError("Impossible de libérer la session")
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
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Administration</p>
          <h1 className="mt-1 text-xl sm:text-2xl font-bold text-foreground">Utilisateurs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gérer les comptes, rôles, droits d&apos;accès et points de vente assignés.</p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Link href="/admin/utilisateurs/roles" className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <ShieldCheck className="h-4 w-4" /> Profils de rôles
          </Link>
          <button onClick={() => setShowCreate((v) => !v)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
            <UserPlus className="h-4 w-4" /> Nouvel utilisateur
          </button>
        </div>
      </div>

      {message && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex items-center justify-between">{message}<button onClick={() => setMessage("")} className="text-green-500 hover:text-green-700"><X className="h-4 w-4" /></button></div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">{error}<button onClick={() => setError("")} className="text-red-500 hover:text-red-700"><X className="h-4 w-4" /></button></div>}

      {showCreate && (
        <form onSubmit={createUser} className="rounded-xl border border-border bg-card p-3 sm:p-5">
          <h2 className="mb-4 font-semibold text-foreground">Créer un utilisateur</h2>

          <div className="flex flex-col gap-6 sm:flex-row">
            <div className="flex flex-col items-center gap-3">
              <div className="relative h-20 w-20 overflow-hidden rounded-full border-2 border-dashed border-border bg-muted flex items-center justify-center">
                {form.image ? (
                  <Image src={form.image} alt="Photo" width={80} height={80} className="h-full w-full object-cover" />
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
              <div className="relative">
                <input required type={showCreatePassword ? "text" : "password"} placeholder="Mot de passe (min. 6 car.)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-10 text-sm text-foreground" />
                <button type="button" onClick={() => setShowCreatePassword((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showCreatePassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                  {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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
            <button type="submit" disabled={creating || uploading} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-wait disabled:opacity-60">
              <Plus className={`mr-1 inline h-4 w-4 ${creating ? "animate-pulse" : ""}`} />{creating ? "Création…" : "Créer"}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
        <section className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Chargement...</p>}
          {users.map((user) => {
            const rp = getRoleProfile(user.role)
            return (
              <button key={user.id} onClick={() => selectUser(user)} className={`w-full rounded-xl border bg-card p-4 text-left ${selected === user.id ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {user.image ? (
                      <Image src={user.image} alt={user.name || ""} width={36} height={36} className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{(user.name || user.email).charAt(0).toUpperCase()}</div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{user.name || user.email}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${user.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{user.isActive ? "Actif" : "Inactif"}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {rp ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${rp.color || "#6b7280"}20`, color: rp.color || "#6b7280" }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: rp.color || "#6b7280" }} />
                      {rp.label}
                    </span>
                  ) : (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{user.role}</span>
                  )}
                </div>
                {user.managedPointOfSales.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {user.managedPointOfSales.map((pos) => (
                      <span key={pos.id} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{pos.name}</span>
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </section>

        {selected && selectedUser && (
          <section className="rounded-xl border border-border bg-card p-3 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-4">
                <div className="relative group">
                  {selectedUser.image ? (
                    <Image src={selectedUser.image} alt="" width={64} height={64} className="h-16 w-16 rounded-full object-cover ring-2 ring-border" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">{(selectedUser.name || selectedUser.email).charAt(0).toUpperCase()}</div>
                  )}
                  <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="h-5 w-5 text-white" />
                    <input ref={editFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleEditPhoto(f) }} />
                  </label>
                </div>
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-foreground">{selectedUser.name || selectedUser.email}</h2>
                  <p className="truncate text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>
              <ShieldCheck className="h-6 w-6 shrink-0 text-primary" />
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
                  <div className="relative">
                    <input type={showEditPassword ? "text" : "password"} value={editPassword} onChange={(e) => setEditPassword(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm text-foreground" placeholder="Laisser vide pour garder" />
                    <button type="button" onClick={() => setShowEditPassword((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showEditPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                      {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
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
                    <tr><th className="px-2 py-2 sm:px-3 sm:py-3">Module</th><th className="px-2 py-2 sm:px-3 sm:py-3 text-center">Voir</th><th className="px-2 py-2 sm:px-3 sm:py-3 text-center">Créer</th><th className="px-2 py-2 sm:px-3 sm:py-3 text-center">Modifier</th><th className="px-2 py-2 sm:px-3 sm:py-3 text-center">Supprimer</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {permissions.map((permission) => (
                      <tr key={permission.module}>
                        <td className="px-2 py-2 sm:px-3 sm:py-3 font-medium text-foreground">{labels[permission.module]}</td>
                        {(["canView", "canCreate", "canEdit", "canDelete"] as const).map((action) => (
                          <td key={action} className="px-2 py-2 sm:px-3 sm:py-3 text-center">
                            <button type="button" onClick={() => togglePermission(permission.module, action)} className={`mx-auto flex h-7 w-7 items-center justify-center rounded-md border ${permission[action] ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent"}`}><Check className="h-4 w-4" /></button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {isCommercialRole(selectedUser.role) && (
              <div className="mt-5 flex flex-wrap items-end justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
                <label className="min-w-0 flex-1 text-sm font-semibold text-foreground">
                  Objectif de chiffre d&apos;affaires{targetMonth ? ` — ${targetMonth.slice(5)}/${targetMonth.slice(0, 4)}` : " du mois"}
                  <input
                    type="number"
                    min={0}
                    step="1000"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    placeholder="Ex. 5000000"
                    className="mt-1 block w-full max-w-xs rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal"
                  />
                  <span className="mt-1 block text-sm font-normal text-muted-foreground">En FCFA. Saisissez 0 pour ne pas afficher d&apos;objectif sur son tableau de bord.</span>
                </label>
                <button type="button" onClick={() => saveTarget(selectedUser)} disabled={targetSaving} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60">
                  <Save className="h-4 w-4" /> {targetSaving ? "Enregistrement…" : "Enregistrer l'objectif"}
                </button>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Connexions simultanées</p>
                <p className="text-sm text-muted-foreground">
                  {editSessionLimit > 1
                    ? `Ce compte peut être connecté sur ${editSessionLimit} appareils à la fois (compte partagé).`
                    : "Une seule session à la fois : se connecter ailleurs déconnecte l'autre appareil."}
                </p>
              </div>
              <select
                value={editSessionLimit}
                onChange={(e) => setEditSessionLimit(Number(e.target.value))}
                className="w-44 rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground"
                aria-label="Sessions simultanées autorisées"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n === 1 ? "1 appareil (défaut)" : `${n} appareils`}</option>
                ))}
              </select>
            </div>

            {(() => {
              const user = users.find((u) => u.id === selected)
              if (!user) return null
              return (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Session ouverte</p>
                    <p className="text-sm text-muted-foreground">
                      {user.openSession
                        ? `${user.openSession.deviceName || "Appareil inconnu"} · dernière activité à ${new Date(user.openSession.lastActiveAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                        : "Aucune : ce compte n'est connecté nulle part"}
                    </p>
                  </div>
                  {user.openSession && (
                    <button type="button" onClick={() => releaseSession(user)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-200 bg-card px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                      <LogOut className="h-4 w-4" /> Libérer la session
                    </button>
                  )}
                </div>
              )
            })()}

            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              {saveStatus && (
                <p role="status" className={`inline-flex items-center gap-1.5 text-sm font-medium ${saveStatus.ok ? "text-green-700" : "text-red-700"}`}>
                  {saveStatus.ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />} {saveStatus.text}
                </p>
              )}
              <button onClick={saveUser} disabled={saving} aria-busy={saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-wait disabled:opacity-60">
                <Save className={`h-4 w-4 ${saving ? "animate-pulse" : ""}`} /> {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
