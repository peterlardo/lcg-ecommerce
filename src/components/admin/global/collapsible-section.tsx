"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

export interface CollapsibleSectionProps {
  title: string
  /** Précision affichée sous le titre. */
  subtitle?: string
  /** Nombre d'éléments (pastille à droite du titre). */
  count?: number
  /** Texte libre affiché à droite du titre (ex. « 12 format(s) »). */
  badge?: string
  defaultOpen?: boolean
  children: React.ReactNode
}

/** Section repliable du rapport global. */
export function CollapsibleSection({
  title,
  subtitle,
  count,
  badge,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-gray-50/70 sm:px-4"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-900 sm:text-sm">
            {title}
            {typeof count === "number" && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                {count}
              </span>
            )}
          </span>
          {subtitle && <span className="mt-0.5 block text-xs text-gray-500">{subtitle}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {badge && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">{badge}</span>
          )}
          <ChevronDown
            aria-hidden
            className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {open && <div className="border-t border-gray-100 px-3 py-3 sm:px-4">{children}</div>}
    </section>
  )
}
