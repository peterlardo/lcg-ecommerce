import Link from "next/link"
import Image from "next/image"
import { ProductCard } from "@/components/shared/product-card"
import { products } from "@/data/products"
import { Snowflake, ArrowRight, Droplets, ShieldCheck, Truck, CalendarClock } from "lucide-react"

export default function HomePage() {
  const featuredProducts = products.filter((p) => p.isFeatured).slice(0, 4)

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-hero-gradient text-primary-foreground">
        <Image
          src="/assets/hero-ice.jpg"
          alt="Glaçons en eau minérale LCG plongeant dans l'eau"
          width="1920"
          height="1080"
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-24 md:py-36">
          <div className="max-w-2xl animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest backdrop-blur">
              <Snowflake className="h-3.5 w-3.5" aria-hidden="true" />
              Brazzaville · Livraison réfrigérée
            </span>
            <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.08] tracking-tight md:text-6xl">
              La fraîcheur pure,<br />
              <span className="text-gradient-ice">livrée chez vous.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-primary-foreground/85 md:text-lg">
              LCG produit des glaçons haut de gamme à base d&apos;eau minérale : cubes, glace pilée, sphères et blocs. Commandez en ligne ou réservez pour vos événements.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/produits"
                className="inline-flex items-center gap-2 rounded-full bg-primary-foreground px-7 py-3.5 font-display text-sm font-bold text-primary shadow-frost transition-transform hover:scale-[1.04]"
              >
                Commander des glaçons
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/professionnels"
                className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/35 px-7 py-3.5 font-display text-sm font-bold text-primary-foreground backdrop-blur transition-colors hover:bg-primary-foreground/10"
              >
                Offres professionnels
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card-soft transition-transform hover:-translate-y-1">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ice-gradient text-primary">
              <Droplets className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-base font-bold">100 % eau minérale</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Chaque glaçon est produit exclusivement à partir d&apos;eau minérale contrôlée.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card-soft transition-transform hover:-translate-y-1">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ice-gradient text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-base font-bold">Hygiène irréprochable</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Production tracée, conditionnement scellé et chaîne du froid respectée.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card-soft transition-transform hover:-translate-y-1">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ice-gradient text-primary">
              <Truck className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-base font-bold">Livraison rapide</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Livraison réfrigérée à Brazzaville, du sac 1 kg au big bag 25 kg.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card-soft transition-transform hover:-translate-y-1">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ice-gradient text-primary">
              <CalendarClock className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-base font-bold">Réservation événement</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Réservez vos volumes à l&apos;avance pour mariages, réceptions et festivals.
            </p>
          </div>
        </div>
      </section>

      {/* Catalogue */}
      <section className="bg-frost py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">Catalogue</p>
              <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">Nos glaçons phares</h2>
            </div>
            <Link
              href="/produits"
              className="inline-flex items-center gap-2 text-sm font-bold text-primary transition-colors hover:text-primary-glow"
            >
              Voir tout le catalogue
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="mt-8 text-center sm:hidden">
            <Link
              href="/produits"
              className="inline-flex items-center gap-2 text-sm font-bold text-primary transition-colors hover:text-primary-glow"
            >
              Voir tout le catalogue
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Production */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="overflow-hidden rounded-3xl shadow-frost">
            <Image
              src="/assets/production.jpg"
              alt="Unité de production hygiénique de glaçons LCG"
              width="1200"
              height="800"
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Notre production</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">De l&apos;eau minérale au glaçon parfait</h2>
            <p className="mt-5 leading-relaxed text-muted-foreground">
              Notre unité de production à Ouenzé, Brazzaville, transforme une eau minérale rigoureusement contrôlée en glaçons cristallins. Chaque lot est tracé, conditionné en sachets scellés et stocké à température négative constante jusqu&apos;à la livraison.
            </p>
            <ul className="mt-6 space-y-3 text-sm font-medium">
              <li className="flex items-center gap-3">
                <Snowflake className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                Eau minérale filtrée et analysée
              </li>
              <li className="flex items-center gap-3">
                <Snowflake className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                Conditionnements de 1 kg à 25 kg
              </li>
              <li className="flex items-center gap-3">
                <Snowflake className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                Chaîne du froid garantie jusqu&apos;à votre porte
              </li>
              <li className="flex items-center gap-3">
                <Snowflake className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                Capacité de production adaptée aux grands événements
              </li>
            </ul>
            <Link
              href="/a-propos"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-frost transition-transform hover:scale-[1.03]"
            >
              Découvrir LCG
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-hero-gradient px-8 py-14 text-center text-primary-foreground md:px-16">
          <Snowflake className="absolute -left-6 -top-6 h-32 w-32 opacity-10 animate-float" aria-hidden="true" />
          <Snowflake className="absolute -bottom-8 -right-8 h-40 w-40 opacity-10 animate-float" aria-hidden="true" />
          <h2 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">Un événement en préparation ?</h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/85">
            Réservez vos glaçons à l&apos;avance — mariage, réception, bar éphémère ou festival — et soyez livré à la date et au lieu de votre choix.
          </p>
          <Link
            href="/panier"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary-foreground px-8 py-4 font-display text-sm font-bold text-primary transition-transform hover:scale-[1.04]"
          >
            Réserver maintenant
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  )
}
