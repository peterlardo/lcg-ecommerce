import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"

export default async function ComptePage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/auth/connexion")
  }

  const { name, email } = session.user

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Mon compte</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Informations personnelles</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <p><span className="font-medium text-gray-900">Nom :</span> {name}</p>
            <p><span className="font-medium text-gray-900">Email :</span> {email}</p>
          </div>
          <Link
            href="/compte/parametres"
            className="mt-4 inline-block text-sm font-medium text-[#1f4fa3] hover:underline"
          >
            Modifier mes informations
          </Link>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-md">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Adresses</h2>
          <p className="text-sm text-gray-500">Aucune adresse enregistrée pour le moment.</p>
          <button
            type="button"
            className="mt-4 text-sm font-medium text-[#1f4fa3] hover:underline"
          >
            Ajouter une adresse
          </button>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-md md:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Historique des commandes</h2>
          <p className="text-sm text-gray-500">Aucune commande pour le moment.</p>
        </div>
      </div>
    </div>
  )
}
