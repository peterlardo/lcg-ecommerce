"use client"

import { useState, useEffect } from "react"
import { Package, Plus, Edit, Trash2, Search, Filter, ChevronDown, X } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { categories } from "@/data/store"
import type { Product, ProductVariant } from "@/data/store"

const emptyVariant = { format: "", price: 0, stock: 0, unit: "" }

export default function ProduitsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "",
    subtitle: "",
    description: "",
    image: "",
    categoryId: "",
    categorySlug: "",
    categoryName: "",
    isFeatured: false,
    badge: "",
    variants: [{ ...emptyVariant }],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/produits")
      if (res.ok) setProducts(await res.json())
    } catch (err) {
      console.error("Erreur:", err)
    } finally {
      setLoading(false)
    }
  }

  const getMinPrice = (variants: { price: number }[]) =>
    Math.min(...variants.map((v) => v.price))
  const getMaxPrice = (variants: { price: number }[]) =>
    Math.max(...variants.map((v) => v.price))
  const getTotalStock = (variants: { stock: number }[]) =>
    variants.reduce((sum, v) => sum + v.stock, 0)

  const openCreate = () => {
    setEditingId(null)
    setForm({
      name: "",
      subtitle: "",
      description: "",
      image: "",
      categoryId: "",
      categorySlug: "",
      categoryName: "",
      isFeatured: false,
      badge: "",
      variants: [{ ...emptyVariant }],
    })
    setShowModal(true)
  }

  const openEdit = (product: Product) => {
    setEditingId(product.id)
    setForm({
      name: product.name,
      subtitle: product.subtitle || "",
      description: product.description || "",
      image: product.image || "",
      categoryId: product.categoryId || "",
      categorySlug: product.categorySlug || "",
      categoryName: product.categoryName || "",
      isFeatured: product.isFeatured,
      badge: product.badge || "",
      variants: product.variants.map((v) => ({
        format: v.format,
        price: v.price,
        stock: v.stock,
        unit: v.unit || "",
      })),
    })
    setShowModal(true)
  }

  const handleCategoryChange = (catSlug: string) => {
    const cat = categories.find((c) => c.slug === catSlug)
    setForm({
      ...form,
      categorySlug: catSlug,
      categoryId: cat?.id || "",
      categoryName: cat?.name || "",
    })
  }

  const addVariant = () => {
    setForm({ ...form, variants: [...form.variants, { ...emptyVariant }] })
  }

  const removeVariant = (index: number) => {
    if (form.variants.length <= 1) return
    setForm({ ...form, variants: form.variants.filter((_, i) => i !== index) })
  }

  const updateVariant = (index: number, field: string, value: string | number) => {
    const variants = [...form.variants]
    ;(variants[index] as any)[field] = value
    setForm({ ...form, variants })
  }

  const handleSave = async () => {
    if (!form.name || form.variants.some((v) => !v.format)) return
    try {
      if (editingId) {
        await fetch(`/api/produits/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
      } else {
        await fetch("/api/produits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
      }
      await fetchProducts()
      setShowModal(false)
    } catch (err) {
      console.error("Erreur:", err)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Supprimer "${name}" ?`)) return
    try {
      await fetch(`/api/produits/${id}`, { method: "DELETE" })
      await fetchProducts()
    } catch (err) {
      console.error("Erreur:", err)
    }
  }

  const filtered = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory =
      selectedCategory === "all" || p.categorySlug === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Produits</h1>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Ajouter un produit
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="pl-9 pr-8 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 appearance-none bg-white"
          >
            <option value="all">Toutes catégories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">Chargement...</p>
        </div>
      ) : (
        <>
          <div className="hidden lg:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Produit</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Catégorie</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Prix</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
                          {product.image ? (
                            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-5 w-5 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-500">
                            {product.variants.length} variante{product.variants.length > 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{product.categoryName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-900">
                        {getMinPrice(product.variants) === getMaxPrice(product.variants)
                          ? formatPrice(getMinPrice(product.variants))
                          : `${formatPrice(getMinPrice(product.variants))} - ${formatPrice(getMaxPrice(product.variants))}`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${
                        getTotalStock(product.variants) < 20 ? "text-red-600" : getTotalStock(product.variants) < 50 ? "text-yellow-600" : "text-gray-900"
                      }`}>
                        {getTotalStock(product.variants)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                        product.isFeatured ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {product.isFeatured ? "En vedette" : "Standard"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(product)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(product.id, product.name)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="p-8 text-center">
                <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Aucun produit trouvé</p>
              </div>
            )}
          </div>

          <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((product) => (
              <div key={product.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.categoryName}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    product.isFeatured ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {product.isFeatured ? "En vedette" : "Standard"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-900">
                    {getMinPrice(product.variants) === getMaxPrice(product.variants)
                      ? formatPrice(getMinPrice(product.variants))
                      : `${formatPrice(getMinPrice(product.variants))} - ${formatPrice(getMaxPrice(product.variants))}`}
                  </span>
                  <span className={`font-medium ${getTotalStock(product.variants) < 20 ? "text-red-600" : "text-gray-900"}`}>
                    Stock: {getTotalStock(product.variants)}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-gray-100">
                  <button onClick={() => openEdit(product)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                    <Edit className="h-3.5 w-3.5" /> Modifier
                  </button>
                  <button onClick={() => handleDelete(product.id, product.name)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="h-3.5 w-3.5" /> Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">
                {editingId ? "Modifier le produit" : "Ajouter un produit"}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block text-sm font-semibold sm:col-span-2">
                  Nom du produit *
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
                    placeholder="Ex: Glaçons cubes — Sac 1 kg" />
                </label>
                <label className="block text-sm font-semibold sm:col-span-2">
                  Sous-titre
                  <input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
                    placeholder="Ex: Cubes classiques en eau minérale" />
                </label>
                <label className="block text-sm font-semibold sm:col-span-2">
                  Description
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 resize-none"
                    placeholder="Description détaillée..." />
                </label>
                <label className="block text-sm font-semibold">
                  Image (URL)
                  <input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
                    placeholder="/assets/product.jpg" />
                </label>
                <label className="block text-sm font-semibold">
                  Badge
                  <input value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
                    placeholder="Ex: Best-seller, Premium" />
                </label>
                <label className="block text-sm font-semibold">
                  Catégorie
                  <select value={form.categorySlug} onChange={(e) => handleCategoryChange(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500">
                    <option value="">Sélectionner...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.slug}>{cat.name}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-3 mt-6">
                  <input type="checkbox" checked={form.isFeatured}
                    onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                  <span className="text-sm font-semibold">Produit en vedette</span>
                </label>
              </div>

              <div className="border-t border-gray-200 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900">Variantes</h3>
                  <button onClick={addVariant} className="text-xs font-medium text-primary-600 hover:text-primary-700">
                    + Ajouter une variante
                  </button>
                </div>
                <div className="space-y-3">
                  {form.variants.map((v, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <input value={v.format} onChange={(e) => updateVariant(i, "format", e.target.value)}
                          className="rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                          placeholder="Format (ex: sac 1 kg)" />
                        <input type="number" value={v.price || ""} onChange={(e) => updateVariant(i, "price", Number(e.target.value))}
                          className="rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                          placeholder="Prix FCFA" />
                        <input type="number" value={v.stock || ""} onChange={(e) => updateVariant(i, "stock", Number(e.target.value))}
                          className="rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                          placeholder="Stock" />
                        <input value={v.unit} onChange={(e) => updateVariant(i, "unit", e.target.value)}
                          className="rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                          placeholder="Unité (sac, boîte)" />
                      </div>
                      <button onClick={() => removeVariant(i)} className="p-2 text-gray-400 hover:text-red-600 shrink-0 mt-0.5">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Annuler
              </button>
              <button onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors">
                {editingId ? "Enregistrer" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
