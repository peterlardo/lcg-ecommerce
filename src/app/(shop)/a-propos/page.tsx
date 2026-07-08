import Image from "next/image"
import Link from "next/link"
import { Droplets, Factory, HeartHandshake, Leaf, ArrowRight } from "lucide-react"

const values = [
  {
    icon: Droplets,
    title: "Pureté",
    desc: "Uniquement de l'eau minérale contrôlée, pour des glaçons au goût neutre et cristallins.",
  },
  {
    icon: Factory,
    title: "Rigueur industrielle",
    desc: "Processus hygiénique tracé de la production au conditionnement scellé.",
  },
  {
    icon: HeartHandshake,
    title: "Proximité",
    desc: "Une entreprise congolaise au service des familles et des professionnels de Brazzaville.",
  },
  {
    icon: Leaf,
    title: "Responsabilité",
    desc: "Gestion raisonnée de l'eau et emballages PET recyclables.",
  },
]

export default function AboutPage() {
  return (
    <div>
      <section className="mx-auto max-w-6xl px-4 py-16">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Qui sommes-nous</p>
        <h1 className="mt-2 max-w-2xl font-display text-4xl font-extrabold tracking-tight md:text-5xl">La Congolaise des Glaçons</h1>
        <div className="mt-8 grid gap-12 lg:grid-cols-2">
          <div className="space-y-5 leading-relaxed text-muted-foreground">
            <p>
              Basée au 97 Rue EWO à Ouenzé, Brazzaville, <strong className="text-foreground">LCG-SARL</strong> est une société spécialisée dans la production et la vente de tout type de glaçons fabriqués à partir d&apos;eau minérale.
            </p>
            <p>
              Née d&apos;un constat simple — la commande de glaçons se faisait uniquement par téléphone ou en boutique — LCG modernise l&apos;accès au froid de qualité : catalogue en ligne, commande en quelques clics et réservation anticipée pour les événements.
            </p>
            <p>
              Notre ambition : devenir la référence du glaçon premium en République du Congo, au service des particuliers, restaurateurs, hôtels, bars, traiteurs et industriels.
            </p>
          </div>
          <div className="overflow-hidden rounded-3xl shadow-frost">
            <Image
              src="/assets/production.jpg"
              alt="Production de glaçons LCG en environnement contrôlé"
              width="1200"
              height="800"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-frost py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl font-extrabold tracking-tight">Nos valeurs</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-6 shadow-card-soft">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ice-gradient text-primary">
                  <v.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-base font-bold">{v.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
