"use client"

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="max-w-md space-y-4">
        <div className="text-6xl">📡</div>
        <h1 className="text-2xl font-bold text-foreground">Hors ligne</h1>
        <p className="text-muted-foreground">
          Vous n&apos;êtes pas connecté au serveur LCG. Vérifiez votre connexion réseau puis réessayez.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Réessayer
        </button>
      </div>
    </div>
  )
}