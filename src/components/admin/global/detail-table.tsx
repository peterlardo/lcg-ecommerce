"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { normalizeText } from "./format"

export interface DetailColumn<T> {
  /** Clé de la ligne (utilisée pour la recherche par défaut). */
  key: string
  label: string
  align?: "left" | "right" | "center"
  /** Classes CSS additionnelles appliquées aux cellules de la colonne. */
  className?: string
  render: (row: T) => React.ReactNode
}

export interface DetailTableProps<T> {
  rows: T[]
  columns: DetailColumn<T>[]
  /** Texte indexé par la recherche ; par défaut = concaténation des colonnes. */
  searchText?: (row: T) => string
  emptyLabel?: string
  /** Total réel (avant plafond API) : alimente le compteur « X affichés sur Y ». */
  total?: number
}

const ALIGN: Record<string, string> = {
  left: "text-left",
  right: "text-right tabular-nums",
  center: "text-center",
}

/**
 * Tableau dense des sections de détail du rapport global.
 * Recherche texte insensible aux accents + compteur « X affichés sur Y ».
 */
export function DetailTable<T>({
  rows,
  columns,
  searchText,
  emptyLabel = "Aucune donnée sur la période",
  total,
}: DetailTableProps<T>) {
  const [query, setQuery] = useState("")

  const needle = normalizeText(query.trim())
  const filtered = needle
    ? rows.filter((row) => {
        const text = searchText
          ? searchText(row)
          : columns.map((c) => String((row as Record<string, unknown>)[c.key] ?? "")).join(" ")
        return normalizeText(text).includes(needle)
      })
    : rows

  const reference = total ?? rows.length

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full sm:w-72">
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher…"
            aria-label="Rechercher dans le tableau"
            className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-8 pr-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <p className="text-xs text-gray-500">
          <span className="font-semibold text-gray-900">{filtered.length}</span> affichés sur{" "}
          <span className="font-semibold text-gray-900">{reference}</span>
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[640px] text-xs">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`whitespace-nowrap px-2.5 py-2 font-medium text-gray-500 ${ALIGN[c.align ?? "left"]}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-4 text-center text-xs text-gray-400">
                  {rows.length === 0 ? emptyLabel : "Aucun résultat pour cette recherche"}
                </td>
              </tr>
            ) : (
              filtered.map((row, index) => (
                <tr
                  key={String((row as { id?: unknown }).id ?? index)}
                  className="border-t border-gray-100 align-top hover:bg-gray-50/70"
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-2.5 py-1.5 text-gray-700 ${ALIGN[c.align ?? "left"]} ${c.className ?? ""}`}
                    >
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
