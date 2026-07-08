import Link from "next/link"
import { ArrowRight, CirclePercent, CalendarRange, Truck, Building2, Snowflake } from "lucide-react"

const features = [
  {
    icon: CirclePercent,
    title: "Tarifs dégressifs",
    desc: "Grille tarifaire professionnelle dès 25 kg par semaine, remises sur engagement mensuel.",
  },
  {
    icon: CalendarRange,
    title: "Livraisons programmées",
    desc: "Planifiez des livraisons récurrentes (quotidiennes, hebdomadaires) aux horaires de votre choix.",
  },
  {
    icon: Truck,
    title: "Volumes garantis",
    desc: "Capacité de production réservée pour vos pics d'activité : week-ends, fêtes, saison chaude.",
  },
  {
    icon: Building2,
    title: "Compte professionnel",
    desc: "Un interlocuteur dédié, facturation mensuelle et documents comptables sur demande.",
  },
]

const clients = [
  "Bars & night-clubs",
  "Hôtels & lodges",
  "Restaurants",
  "Traiteurs & événementiel",
  "Poissonneries & marchés",
  "Industries & laboratoires",
]

export default function ProfessionnelsPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-hero-gradient text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <p className="text-xs font-bold uppercase tracking-widest text-primary-foreground/70">Espace B2B</p>
          <h1 className="mt-2 max-w-2xl font-display text-4xl font-extrabold tracking-tight md:text-5xl">
            Des glaçons fiables pour votre établissement
          </h1>
          <p className="mt-5 max-w-xl leading-relaxed text-primary-foreground/85">
            LCG accompagne les professionnels de Brazzaville avec des volumes garantis, une qualité constante et des livraisons à l&apos;heure. Concentrez-vous sur vos clients, on s&apos;occupe du froid.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-5 sm:grid-cols-2">
          {features.map((f, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-7 shadow-card-soft">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ice-gradient text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 font-display text-lg font-bold">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Who we serve */}
      <section className="bg-frost py-16">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-extrabold tracking-tight">Qui servons-nous ?</h2>
            <ul className="mt-6 grid grid-cols-2 gap-3 text-sm font-semibold">
              {clients.map((c, i) => (
                <li key={i} className="rounded-xl border border-border bg-card px-4 py-3 shadow-card-soft">
                  {c}
                </li>
              ))}
            </ul>
            <Link
              href="/contact"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-frost transition-transform hover:scale-[1.03]"
            >
              Demander un devis pro
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div>
            <div className="overflow-hidden rounded-3xl shadow-frost">
              <img
                src="/assets/product-sac.jpg"
                alt="Big bag professionnel de glaçons LCG 25 kg"
                width="1200"
                height="800"
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Why choose us */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="relative overflow-hidden rounded-3xl bg-hero-gradient px-8 py-14 text-center text-primary-foreground md:px-16">
          <Snowflake className="absolute -left-6 -top-6 h-32 w-32 opacity-10 animate-float" aria-hidden="true" />
          <Snowflake className="absolute -bottom-8 -right-8 h-40 w-40 opacity-10 animate-float" aria-hidden="true" />
          <h2 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
            Prêt à passer en volume ?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/85">
            Contactez notre équipe commerciale pour établir un devis personnalisé et organiser vos livraisons régulières.
          </p>
          <Link
            href="/contact"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary-foreground px-8 py-4 font-display text-sm font-bold text-primary transition-transform hover:scale-[1.04]"
          >
            Demander un devis
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  )
}
