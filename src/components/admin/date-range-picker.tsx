"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { DayPicker, type DateRange } from "react-day-picker"
import { fr } from "react-day-picker/locale"
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react"
import "react-day-picker/style.css"
import "./date-range-picker.css"

export interface DateRangeValue {
  from: string
  to: string
}

function toIso(d: Date | undefined): string {
  if (!d) return ""
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function fromIso(s: string): Date | undefined {
  if (!s) return undefined
  const [y, m, d] = s.split("-").map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

function label(d: Date | undefined): string {
  if (!d) return "—"
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

export function DateRangePicker({
  value,
  onChange,
  max,
  placeholder = "Choisir une période",
}: {
  value: DateRangeValue
  onChange: (v: DateRangeValue) => void
  max?: Date
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = useMemo<DateRange | undefined>(() => {
    const from = fromIso(value.from)
    const to = fromIso(value.to)
    if (!from && !to) return undefined
    return { from, to }
  }, [value.from, value.to])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const handleSelect = (range: DateRange | undefined) => {
    if (!range) {
      onChange({ from: "", to: "" })
      return
    }
    onChange({ from: toIso(range.from), to: toIso(range.to) })
    if (range.from && range.to) setOpen(false)
  }

  const summary = value.from || value.to
    ? `${label(fromIso(value.from))}  →  ${label(fromIso(value.to))}`
    : placeholder

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${open ? "border-primary-500 bg-primary-50 text-gray-900" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}
      >
        <CalendarDays className="h-4 w-4 text-gray-400" />
        <span className="whitespace-nowrap">{summary}</span>
        {!!(value.from || value.to) && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onChange({ from: "", to: "" })
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                e.stopPropagation()
                onChange({ from: "", to: "" })
              }
            }}
            className="ml-1 rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Effacer la période"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-2 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
          <DayPicker
            mode="range"
            resetOnSelect
            selected={selected}
            onSelect={handleSelect}
            locale={fr}
            weekStartsOn={1}
            numberOfMonths={2}
            defaultMonth={fromIso(value.from) ?? max}
            disabled={max ? { after: max } : undefined}
            components={{
              Chevron: ({ orientation }) =>
                orientation === "left" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />,
            }}
          />
          <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
            <span className="text-xs text-gray-500">
              {value.from || value.to ? `${label(fromIso(value.from))} → ${label(fromIso(value.to))}` : "Sélectionnez une date de début puis de fin"}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700"
            >
              Valider
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
