"use client"

import { createContext, useCallback, useContext, useState } from "react"
import { CircleCheck, X, AlertCircle } from "lucide-react"

interface Toast {
  id: string
  type: "success" | "error"
  title: string
  message?: string
}

interface ToastContextValue {
  showToast: (type: "success" | "error", title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((type: "success" | "error", title: string, message?: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, type, title, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 6000)
  }, [])

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed top-24 right-4 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              style={{ animation: "toast-in 0.35s cubic-bezier(.22, 1, .36, 1) both" }}
              className={`pointer-events-auto rounded-2xl border p-4 shadow-xl backdrop-blur-md ${
                t.type === "success"
                  ? "bg-green-50/95 border-green-200 text-green-900"
                  : "bg-red-50/95 border-red-200 text-red-900"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  t.type === "success" ? "bg-green-100" : "bg-red-100"
                }`}>
                  {t.type === "success" ? (
                    <CircleCheck className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">{t.title}</p>
                  {t.message && (
                    <p className="mt-0.5 text-xs opacity-80 leading-relaxed">{t.message}</p>
                  )}
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  className="shrink-0 rounded-full p-1 hover:bg-black/5 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}
