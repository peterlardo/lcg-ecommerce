import Link from "next/link"

export function Footer() {
  return (
    <footer className="bg-deep text-deep-foreground">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-3">
            <img
              src="/logo-lcg.jpeg"
              alt="Logo LCG"
              width="44"
              height="44"
              loading="lazy"
              className="h-11 w-11 rounded-full object-cover"
            />
            <div>
              <p className="font-display text-lg font-bold">LCG</p>
              <p className="text-xs text-deep-foreground/70">La Congolaise des Glaçons</p>
            </div>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-deep-foreground/70">
            Production et vente de glaçons à base d&apos;eau minérale. Fraîcheur, pureté et professionnalisme à Brazzaville.
          </p>
        </div>
        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-deep-foreground/60">Navigation</h3>
          <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <li><Link href="/produits" className="text-deep-foreground/80 transition-colors hover:text-deep-foreground">Nos produits</Link></li>
            <li><Link href="/professionnels" className="text-deep-foreground/80 transition-colors hover:text-deep-foreground">Professionnels</Link></li>
            <li><Link href="/zones-livraison" className="text-deep-foreground/80 transition-colors hover:text-deep-foreground">Zones de livraison</Link></li>
            <li><Link href="/a-propos" className="text-deep-foreground/80 transition-colors hover:text-deep-foreground">Qui sommes-nous</Link></li>
            <li><Link href="/faq" className="text-deep-foreground/80 transition-colors hover:text-deep-foreground">FAQ</Link></li>
            <li><Link href="/contact" className="text-deep-foreground/80 transition-colors hover:text-deep-foreground">Contact</Link></li>
            <li><Link href="/panier" className="text-deep-foreground/80 transition-colors hover:text-deep-foreground">Mon panier</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-deep-foreground/60">Contact</h3>
          <ul className="mt-4 space-y-3 text-sm text-deep-foreground/80">
            <li className="flex items-start gap-2.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin mt-0.5 h-4 w-4 shrink-0" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle></svg>
              97 Rue EWO, Ouenzé — Brazzaville, République du Congo
            </li>
            <li className="flex items-center gap-2.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-phone h-4 w-4 shrink-0" aria-hidden="true"><path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"></path></svg>
              Commandes par téléphone et en ligne
            </li>
            <li className="flex items-center gap-2.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-snowflake h-4 w-4 shrink-0" aria-hidden="true"><path d="m10 20-1.25-2.5L6 18"></path><path d="M10 4 8.75 6.5 6 6"></path><path d="m14 20 1.25-2.5L18 18"></path><path d="m14 4 1.25 2.5L18 6"></path><path d="m17 21-3-6h-4"></path><path d="m17 3-3 6 1.5 3"></path><path d="M2 12h6.5L10 9"></path><path d="m20 10-1.5 2 1.5 2"></path><path d="M22 12h-6.5L14 15"></path><path d="m4 10 1.5 2L4 14"></path><path d="m7 21 3-6-1.5-3"></path><path d="m7 3 3 6h4"></path></svg>
              Production · Eau minérale · Glaçons · PET · Livraison
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-deep-foreground/10 py-5 text-center text-xs text-deep-foreground/50">
        &copy; {new Date().getFullYear()} LCG-SARL — La Congolaise des Glaçons. Tous droits réservés.
      </div>
    </footer>
  )
}
