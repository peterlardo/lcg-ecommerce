"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Snowflake } from "lucide-react"

const slides = [
  {
    image: "/assets/hero-ice.jpg",
    alt: "Glaçons en eau minérale LCG plongeant dans l'eau",
    title: (
      <>
        La fraîcheur pure,<br />
        <span className="text-gradient-ice">livrée chez vous.</span>
      </>
    ),
    description:
      "LCG produit des glaçons haut de gamme à base d'eau minérale : cubes, glace pilée, sphères et blocs. Commandez en ligne ou réservez pour vos événements.",
    cta: { href: "/produits", label: "Commander des glaçons" },
    ctaSecondary: { href: "/professionnels", label: "Offres professionnels" },
  },
  {
    image: "/assets/production.jpg",
    alt: "Unité de production hygiénique de glaçons LCG",
    title: (
      <>
        Production artisanale,<br />
        <span className="text-gradient-ice">qualité garantie.</span>
      </>
    ),
    description:
      "Notre unité de production à Ouenzé, Brazzaville, transforme une eau minérale rigoureusement contrôlée en glaçons cristallins. Chaque lot est tracé et conditionné en sachets scellés.",
    cta: { href: "/a-propos", label: "Découvrir LCG" },
    ctaSecondary: { href: "/produits", label: "Voir nos glaçons" },
  },
  {
    image: "/assets/qualité.png",
    alt: "Contrôle qualité des glaçons en laboratoire",
    title: (
      <>
        Contrôle qualité des glaçons<br />
        <span className="text-gradient-ice">en laboratoire.</span>
      </>
    ),
    description:
      "Chaque lot de glaçons est rigoureusement testé en laboratoire pour garantir la pureté, l&apos;hygiène et la conformité aux normes les plus exigeantes avant d&apos;arriver chez vous.",
    cta: { href: "/a-propos", label: "Notre processus" },
    ctaSecondary: { href: "/produits", label: "Voir nos glaçons" },
  },
]

const INTERVAL = 10000

export function HeroSlider() {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)

  const next = useCallback(() => {
    setCurrent((i) => (i + 1) % slides.length)
  }, [])

  useEffect(() => {
    if (paused) return
    const id = setInterval(next, INTERVAL)
    return () => clearInterval(id)
  }, [paused, next])

  return (
    <section
      className="relative overflow-hidden bg-hero-gradient text-primary-foreground"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Images */}
      {slides.map((slide, i) => (
        <Image
          key={slide.image}
          src={slide.image}
          alt={slide.alt}
          width={1920}
          height={1080}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[2000ms] ${
            i === current ? "opacity-100" : "opacity-0"
          }`}
          priority={i === 0}
        />
      ))}

      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />

      {/* Content */}
      <div className="relative mx-auto max-w-6xl px-4 py-24 md:py-36">
        <div className="max-w-2xl animate-rise">
          <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.08] tracking-tight md:text-6xl">
            {slides[current].title}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-primary-foreground/85 md:text-lg">
            {slides[current].description}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href={slides[current].cta.href}
              className="inline-flex items-center gap-2 rounded-full bg-primary-foreground px-7 py-3.5 font-display text-sm font-bold text-primary shadow-frost transition-transform hover:scale-[1.04]"
            >
              {slides[current].cta.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={slides[current].ctaSecondary.href}
              className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/35 px-7 py-3.5 font-display text-sm font-bold text-primary-foreground backdrop-blur transition-colors hover:bg-primary-foreground/10"
            >
              {slides[current].ctaSecondary.label}
            </Link>
          </div>
        </div>

        {/* Dots */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                i === current
                  ? "w-8 bg-primary-foreground"
                  : "w-2.5 bg-primary-foreground/40 hover:bg-primary-foreground/60"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Decorative snowflakes */}
      <Snowflake className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 opacity-5" aria-hidden="true" />
      <Snowflake className="pointer-events-none absolute -bottom-10 -right-10 h-48 w-48 opacity-5" aria-hidden="true" />
    </section>
  )
}
