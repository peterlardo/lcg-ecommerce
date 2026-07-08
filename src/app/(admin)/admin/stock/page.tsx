"use client"

import { useState, useMemo } from "react"
import {
  Warehouse,
  Search,
  Filter,
  ChevronDown,
  Plus,
  Minus,
  AlertCircle,
  Clock,
} from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { products, categories } from "@/data/products"

interface StockMovement {
  id: string
  variantId: string
  type: "in" | "out"
  quantity: number
  reason: string
  date: string
}

const initialMovements: StockMovement[] = [
  { id: "mov-1", variantId: "var-1-1", type: "in", quantity: 50, reason: "Réapprovisionnement fournisseur", date: "07/07/2026" },
  { id: "mov-2", variantId: "var-3-2", type: "out", quantity: 10, reason: "Commande #LCG-C5D0-3D7E", date: "07/07/2026" },
  { id: "mov-3", variantId: "var-6-2", type: "in", quantity: 5, reason: "Production", date: "06/07/2026" },
  { id: "mov-4", variantId: "var-2-3", type: "out", quantity: 3, reason: "Commande #LCG-G0B6-7H3I", date: "05/07/2026" },
  { id: "mov-5", variantId: "var-7-1", type: "out", quantity: 5, reason: "Commande #LCG-A3F2-1B9C", date: "08/07/2026" },
  { id: "mov-6", variantId: "var-4-2", type: "in", quantity: 30, reason: "Réapprovisionnement", date: "04/07/2026" },
]

export default function StockPage() {
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [movements, setMovements] = useState<StockMovement[]>(initialMovements)
  const [editingVariant, setEditingVariant] = useState<string | null>(null)
  const [movementType, setMovementType] = useState<"in" | "out">("in")
  const [movementQty, setMovementQty] = useState(1)
  const [movementReason, setMovementReason] = useState("")

  const getLastMovement = (variantId: string) => {
    const variantMovements = movements.filter((m) => m.variantId === variantId)
    return variantMovements.length > 0 ? variantMovements[0] : null
  }

  const allVariants = useMemo(() => {
    const result: Array<{
      variantId: string
      productName: string
      productImage: string | null
      categoryName: string
      categorySlug: string
      format: string
      price: number
      stock: number
    }> = []
    for (const product of products) {
      for (const variant of product.variants) {
        result.push({
          variantId: variant.id,
          productName: product.name,
          productImage: product.image,
          categoryName: product.categoryName || "",
          categorySlug: product.categorySlug || "",
          format: variant.format,
          price: variant.price,
          stock: variant.stock,
        })
      }
    }
    return result
  }, [])

  const filteredVariants = allVariants.filter((v) => {
    const matchesSearch = v.productName.toLowerCase().includes(search.toLowerCase())
    const matchesCategory =
      selectedCategory === "all" || v.categorySlug === selectedCategory
    return matchesSearch && matchesCategory
  })

  const handleMovement = (variantId: string) => {
    if (movementQty <= 0) return
    const mov: StockMovement = {
      id: `mov-${Date.now()}`,
      variantId,
      type: movementType,
      quantity: movementQty,
      reason: movementReason || (movementType === "in" ? "Réapprovisionnement" : "Ajustement stock"),
      date: new Date().toLocaleDateString("fr-FR"),
    }
    setMovements((prev) => [mov, ...prev])
    setEditingVariant(null)
    setMovementQty(1)
    setMovementReason("")
  }

  const getEffectiveStock = (variantId: string, baseStock: number) => {
    let stock = baseStock
    for (const mov of movements) {
      if (mov.variantId === variantId) {
        stock += mov.type === "in" ? mov.quantity : -mov.quantity
      }
    }
    return stock
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Gestion des stocks</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-medium">Total variantes</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{allVariants.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 font-medium">En stock</p>
          <p className="text-xl font-bold text-green-600 mt-1">
            {allVariants.filter((v) => getEffectiveStock(v.variantId, v.stock) >= 50).length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-yellow-200 bg-yellow-50/30 p-4">
          <p className="text-xs text-yellow-600 font-medium">Stock faible (&lt;20)</p>
          <p className="text-xl font-bold text-yellow-700 mt-1">
            {allVariants.filter((v) => {
              const stock = getEffectiveStock(v.variantId, v.stock)
              return stock > 0 && stock < 20
            }).length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 bg-red-50/30 p-4">
          <p className="text-xs text-red-600 font-medium">Rupture de stock</p>
          <p className="text-xl font-bold text-red-700 mt-1">
            {allVariants.filter((v) => getEffectiveStock(v.variantId, v.stock) <= 0).length}
          </p>
        </div>
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

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Produit
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Format
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Prix
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Stock actuel
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Dernier mouvement
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredVariants.map((v) => {
                const effectiveStock = getEffectiveStock(v.variantId, v.stock)
                const lastMov = getLastMovement(v.variantId)
                const isLow = effectiveStock < 20 && effectiveStock > 0
                const isOut = effectiveStock <= 0
                const isEditing = editingVariant === v.variantId

                return (
                  <tr
                    key={v.variantId}
                    className={`hover:bg-gray-50/50 transition-colors ${
                      isOut
                        ? "bg-red-50/40"
                        : isLow
                          ? "bg-yellow-50/40"
                          : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isLow && !isOut && (
                          <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                        )}
                        {isOut && (
                          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium text-gray-900">
                          {v.productName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{v.format}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-900">
                        {formatPrice(v.price)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-sm font-bold ${
                          isOut
                            ? "text-red-600"
                            : isLow
                              ? "text-yellow-600"
                              : "text-gray-900"
                        }`}
                      >
                        {effectiveStock}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {lastMov ? (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-xs text-gray-500">
                            {lastMov.date}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Aucun</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-2">
                          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                            <button
                              onClick={() =>
                                setMovementType("in")
                              }
                              className={`px-2 py-1.5 text-xs font-medium transition-colors ${
                                movementType === "in"
                                  ? "bg-green-500 text-white"
                                  : "bg-white text-gray-600 hover:bg-gray-100"
                              }`}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() =>
                                setMovementType("out")
                              }
                              className={`px-2 py-1.5 text-xs font-medium transition-colors ${
                                movementType === "out"
                                  ? "bg-red-500 text-white"
                                  : "bg-white text-gray-600 hover:bg-gray-100"
                              }`}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                          </div>
                          <input
                            type="number"
                            min={1}
                            value={movementQty}
                            onChange={(e) =>
                              setMovementQty(Math.max(1, parseInt(e.target.value) || 1))
                            }
                            className="w-16 px-2 py-1.5 text-xs border border-gray-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                          />
                          <input
                            type="text"
                            placeholder="Raison..."
                            value={movementReason}
                            onChange={(e) => setMovementReason(e.target.value)}
                            className="w-32 px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                          />
                          <button
                            onClick={() => handleMovement(v.variantId)}
                            className="px-2.5 py-1.5 text-xs font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                          >
                            OK
                          </button>
                          <button
                            onClick={() => {
                              setEditingVariant(null)
                              setMovementQty(1)
                              setMovementReason("")
                            }}
                            className="px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingVariant(v.variantId)}
                          className="px-3 py-1.5 text-xs font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                        >
                          Mouvement
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filteredVariants.length === 0 && (
          <div className="p-8 text-center">
            <Warehouse className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Aucune variante trouvée</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Derniers mouvements
        </h3>
        <div className="space-y-2">
          {movements.slice(0, 5).map((mov) => {
            const variant = allVariants.find((v) => v.variantId === mov.variantId)
            return (
              <div
                key={mov.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                      mov.type === "in"
                        ? "bg-green-100 text-green-600"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {mov.type === "in" ? (
                      <Plus className="h-3.5 w-3.5" />
                    ) : (
                      <Minus className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <span className="font-medium text-gray-700 truncate">
                    {variant?.productName} ({variant?.format})
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 flex-shrink-0 ml-3">
                  <span>{mov.reason}</span>
                  <span className="font-medium">
                    {mov.type === "in" ? "+" : "-"}
                    {mov.quantity}
                  </span>
                  <span>{mov.date}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
