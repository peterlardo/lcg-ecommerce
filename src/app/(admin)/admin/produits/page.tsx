"use client"

import { useState } from "react"
import { Package, Plus, Edit, Trash2, Search, Filter, ChevronDown } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { products, categories } from "@/data/products"

export default function ProduitsPage() {
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")

  const filtered = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory =
      selectedCategory === "all" || p.categorySlug === selectedCategory
    return matchesSearch && matchesCategory
  })

  const getMinPrice = (variants: { price: number }[]) =>
    Math.min(...variants.map((v) => v.price))
  const getMaxPrice = (variants: { price: number }[]) =>
    Math.max(...variants.map((v) => v.price))
  const getTotalStock = (variants: { stock: number }[]) =>
    variants.reduce((sum, v) => sum + v.stock, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Produits</h1>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
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

      <div className="hidden lg:block bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/80">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Produit
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Catégorie
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Prix
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Stock
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Statut
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
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
                  <span
                    className={`text-sm font-medium ${
                      getTotalStock(product.variants) < 20
                        ? "text-red-600"
                        : getTotalStock(product.variants) < 50
                          ? "text-yellow-600"
                          : "text-gray-900"
                    }`}
                  >
                    {getTotalStock(product.variants)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                      product.isFeatured
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {product.isFeatured ? "En vedette" : "Standard"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
          <div
            key={product.id}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
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
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  product.isFeatured
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {product.isFeatured ? "En vedette" : "Standard"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-900">
                {getMinPrice(product.variants) === getMaxPrice(product.variants)
                  ? formatPrice(getMinPrice(product.variants))
                  : `${formatPrice(getMinPrice(product.variants))} - ${formatPrice(getMaxPrice(product.variants))}`}
              </span>
              <span
                className={`font-medium ${
                  getTotalStock(product.variants) < 20 ? "text-red-600" : "text-gray-900"
                }`}
              >
                Stock: {getTotalStock(product.variants)}
              </span>
            </div>
            <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-gray-100">
              <button className="flex items-center gap-1 px-3 py-1.5 text-xs text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                <Edit className="h-3.5 w-3.5" /> Modifier
              </button>
              <button className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 className="h-3.5 w-3.5" /> Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
