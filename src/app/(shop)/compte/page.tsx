import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { formatPrice, getStatusColor, getStatusLabel } from "@/lib/utils"
import { Package, MapPin, ShoppingBag, Clock, ArrowRight, TrendingUp } from "lucide-react"

export default async function ComptePage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/auth/connexion")
  }

  const userId = session.user.id as string
  const email = session.user.email as string

  const [orders, addresses, totalOrders] = await Promise.all([
    prisma.order.findMany({
      where: {
        OR: [{ userId }, { customerEmail: email }],
      },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      take: 3,
    }),
    prisma.order.count({
      where: {
        OR: [{ userId }, { customerEmail: email }],
      },
    }),
  ])

  const recentOrders = orders.slice(0, 3)
  const pendingOrders = orders.filter((o) => ["PENDING", "CONFIRMED", "PROCESSING", "READY", "OUT_FOR_DELIVERY"].includes(o.status))
  const totalSpent = orders.reduce((sum, o) => sum + o.total, 0)

  return (
    <div className="p-6 lg:p-10">
      {/* Welcome */}
      <div className="rounded-2xl bg-gradient-to-r from-[#1f4fa3] to-[#163a72] p-6 lg:p-8 text-white shadow-lg shadow-[#1f4fa3]/20">
        <p className="text-sm font-medium text-white/70">Bienvenue sur</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold lg:text-3xl">LCG Clients</h1>
        <p className="mt-2 text-sm text-white/80">
          {session.user.name ? `Bonjour ${session.user.name} !` : "Bonjour !"} Gérez vos commandes, parcourez nos produits et suivez vos livraisons.
        </p>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1f4fa3]/10">
            <Package className="h-5 w-5 text-[#1f4fa3]" />
          </div>
          <p className="mt-3 font-display text-2xl font-extrabold text-gray-800">{totalOrders}</p>
          <p className="text-xs text-gray-400">Commandes passées</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
            <Clock className="h-5 w-5 text-amber-500" />
          </div>
          <p className="mt-3 font-display text-2xl font-extrabold text-gray-800">{pendingOrders.length}</p>
          <p className="text-xs text-gray-400">En cours</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50">
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <p className="mt-3 font-display text-2xl font-extrabold text-gray-800">{formatPrice(totalSpent)}</p>
          <p className="text-xs text-gray-400">Total dépensé</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50">
            <MapPin className="h-5 w-5 text-purple-500" />
          </div>
          <p className="mt-3 font-display text-2xl font-extrabold text-gray-800">{addresses.length}</p>
          <p className="text-xs text-gray-400">Adresses enregistrées</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          href="/compte/produits"
          className="group flex items-center gap-4 rounded-2xl border border-border bg-white p-5 shadow-sm transition-all hover:border-[#1f4fa3]/30 hover:shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1f4fa3]/10 transition-colors group-hover:bg-[#1f4fa3]">
            <ShoppingBag className="h-6 w-6 text-[#1f4fa3] transition-colors group-hover:text-white" />
          </div>
          <div className="flex-1">
            <p className="font-display text-sm font-bold text-gray-800">Commander</p>
            <p className="text-xs text-gray-400">Parcourir le catalogue et ajouter au panier</p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-[#1f4fa3]" />
        </Link>
        <Link
          href="/panier"
          className="group flex items-center gap-4 rounded-2xl border border-border bg-white p-5 shadow-sm transition-all hover:border-[#1f4fa3]/30 hover:shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 transition-colors group-hover:bg-green-500">
            <Package className="h-6 w-6 text-green-500 transition-colors group-hover:text-white" />
          </div>
          <div className="flex-1">
            <p className="font-display text-sm font-bold text-gray-800">Mon panier</p>
            <p className="text-xs text-gray-400">Finaliser ma commande en cours</p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-green-500" />
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        {/* Recent orders */}
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold">Commandes récentes</h2>
            {totalOrders > 0 && (
              <Link href="/compte/commandes" className="text-xs font-bold text-[#1f4fa3] hover:underline">
                Tout voir
              </Link>
            )}
          </div>

          {recentOrders.length === 0 ? (
            <div className="py-8 text-center">
              <Package className="mx-auto h-10 w-10 text-gray-200" />
              <p className="mt-2 text-sm text-gray-400">Aucune commande pour le moment.</p>
              <Link
                href="/compte/produits"
                className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#1f4fa3] hover:underline"
              >
                <ShoppingBag className="h-4 w-4" />
                Découvrir nos produits
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/compte/commandes/${order.id}`}
                  className="flex items-center justify-between rounded-xl border border-gray-100 p-4 transition-all hover:border-[#1f4fa3]/20 hover:shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold">{order.orderNumber}</span>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      {new Date(order.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                      {" · "}
                      {order.items.length} article{order.items.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className="font-display text-sm font-bold text-[#1f4fa3]">
                    {formatPrice(order.total)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Addresses */}
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold">Mes adresses</h2>
            <Link href="/compte/adresses" className="text-xs font-bold text-[#1f4fa3] hover:underline">
              Gérer
            </Link>
          </div>
          {addresses.length === 0 ? (
            <div className="py-8 text-center">
              <MapPin className="mx-auto h-10 w-10 text-gray-200" />
              <p className="mt-2 text-sm text-gray-400">Aucune adresse enregistrée.</p>
              <Link
                href="/compte/adresses"
                className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#1f4fa3] hover:underline"
              >
                Ajouter une adresse
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {addresses.map((addr) => (
                <div key={addr.id} className="rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#1f4fa3]" />
                    <span className="text-sm font-semibold">{addr.label || "Adresse"}</span>
                    {addr.isDefault && (
                      <span className="rounded-full bg-[#1f4fa3]/10 px-2 py-0.5 text-[10px] font-bold text-[#1f4fa3]">Défaut</span>
                    )}
                  </div>
                  <p className="mt-1 pl-6 text-xs text-gray-400">
                    {addr.street}{addr.district ? `, ${addr.district}` : ""}, {addr.city}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
