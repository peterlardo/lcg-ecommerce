import Link from "next/link"
import { MapPin, Timer, ArrowRight, Snowflake } from "lucide-react"

const zones = [
  { name: "Ouenzé", time: "30 – 45 min", desc: "Zone de production — livraison prioritaire" },
  { name: "Talangaï", time: "45 – 60 min", desc: "Livraison quotidienne" },
  { name: "Poto-Poto", time: "45 – 60 min", desc: "Livraison quotidienne" },
  { name: "Moungali", time: "45 – 60 min", desc: "Livraison quotidienne" },
  { name: "Centre-ville / Plateau", time: "60 – 90 min", desc: "Créneaux matin et après-midi" },
  { name: "Bacongo", time: "60 – 90 min", desc: "Créneaux matin et après-midi" },
  { name: "Makélékélé", time: "60 – 90 min", desc: "Créneaux matin et après-midi" },
  { name: "Mfilou / Djiri", time: "Sur réservation", desc: "Commande la veille recommandée" },
]

export default function ZonesLivraisonPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Livraison</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Nos zones de livraison</h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
        Nos véhicules réfrigérés couvrent l&apos;ensemble de Brazzaville depuis notre site de production d&apos;Ouenzé. Retrait sur place également possible au 97 Rue EWO.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {zones.map((zone, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-6 shadow-card-soft">
            <div className="flex items-center gap-2 text-primary">
              <MapPin className="h-4 w-4" />
              <h2 className="font-display text-base font-bold text-foreground">{zone.name}</h2>
            </div>
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold">
              <Timer className="h-4 w-4 text-primary" />
              {zone.time}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{zone.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-16 relative overflow-hidden rounded-3xl bg-hero-gradient px-8 py-14 text-center text-primary-foreground md:px-16">
        <Snowflake className="absolute -left-6 -top-6 h-32 w-32 opacity-10 animate-float" aria-hidden="true" />
        <Snowflake className="absolute -bottom-8 -right-8 h-40 w-40 opacity-10 animate-float" aria-hidden="true" />
        <h2 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
          Votre quartier n&apos;est pas listé ?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-primary-foreground/85">
          Contactez-nous : nous étudions toute demande de livraison ponctuelle ou récurrente, y compris hors Brazzaville pour les gros volumes.
        </p>
        <Link
          href="/contact"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary-foreground px-8 py-4 font-display text-sm font-bold text-primary transition-transform hover:scale-[1.04]"
        >
          Nous contacter
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
