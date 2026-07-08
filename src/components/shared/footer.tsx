import Link from "next/link"

export function Footer() {
  return (
    <footer className="bg-[#0f172a] text-white/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 pb-10 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <img src="/logo-lcg.jpeg" alt="Logo LCG" className="h-9 w-auto brightness-0 invert" />
              <div className="flex flex-col">
                <span className="text-white text-sm font-bold leading-tight">LCG</span>
                <span className="text-[10px] text-white/50 leading-tight">La Congolaise des Glaçons</span>
              </div>
            </div>
            <p className="text-sm leading-relaxed max-w-xs">
              Production et vente de glaçons à base d&apos;eau minérale. Fraîcheur, pureté et professionnalisme à Brazzaville.
            </p>
          </div>
          <div>
            <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-3">Navigation</h4>
            <div className="space-y-2">
              <Link href="/produits" className="block text-sm hover:text-white transition-colors">Nos produits</Link>
              <Link href="/professionnels" className="block text-sm hover:text-white transition-colors">Professionnels</Link>
              <Link href="/zones-livraison" className="block text-sm hover:text-white transition-colors">Zones de livraison</Link>
              <Link href="/a-propos" className="block text-sm hover:text-white transition-colors">Qui sommes-nous</Link>
              <Link href="/faq" className="block text-sm hover:text-white transition-colors">FAQ</Link>
              <Link href="/contact" className="block text-sm hover:text-white transition-colors">Contact</Link>
              <Link href="/panier" className="block text-sm hover:text-white transition-colors">Mon panier</Link>
            </div>
          </div>
          <div>
            <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-3">Contact</h4>
            <div className="space-y-2 text-sm">
              <p>97 Rue EWO, Ouenzé — Brazzaville</p>
              <p>République du Congo</p>
              <p className="mt-2">Commandes par téléphone et en ligne</p>
              <p>Production · Eau minérale · Glaçons · PET · Livraison</p>
            </div>
          </div>
        </div>
        <div className="pt-6 text-center text-xs">
          &copy; {new Date().getFullYear()} LCG-SARL — La Congolaise des Glaçons. Tous droits réservés.
        </div>
      </div>
    </footer>
  )
}
