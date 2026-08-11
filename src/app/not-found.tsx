import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-2 text-7xl font-bold text-primary">404</h1>
      <h2 className="mb-4 text-2xl font-semibold text-gray-800">Page introuvable</h2>
      <p className="mb-8 max-w-md text-gray-500">
        La page que vous recherchez n&apos;existe pas ou a été déplacée.
      </p>
      <Link
        href="/"
        className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:opacity-90"
      >
        Retour à l&apos;accueil
      </Link>
    </div>
  )
}
