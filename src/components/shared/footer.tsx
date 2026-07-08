import Link from "next/link"

const footerLinks = {
  produits: [
    { href: "/produits", label: "Tous les produits" },
    { href: "/produits?categorie=particuliers", label: "Particuliers" },
    { href: "/produits?categorie=professionnel", label: "Professionnels" },
    { href: "/produits?categorie=evenementiel", label: "Événementiel" },
  ],
  entreprise: [
    { href: "/a-propos", label: "À propos" },
    { href: "/contact", label: "Contact" },
    { href: "/a-propos#production", label: "Notre production" },
  ],
  aide: [
    { href: "/contact", label: "Service client" },
    { href: "/a-propos#livraison", label: "Livraison" },
    { href: "/contact", label: "Réclamation" },
  ],
}

export function Footer() {
  return (
    <footer className="bg-[#0f172a] text-white/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 pb-10 border-b border-white/10">
          <div>
            <h3 className="text-white text-base font-bold mb-2">LCG</h3>
            <p className="text-sm leading-relaxed max-w-xs">
              La Congolaise des Glaçons — producteur et livreur de glaçons haut de gamme
              à Brazzaville. Eau minérale, hygiène irréprochable, livraison réfrigérée.
            </p>
          </div>
          <div>
            <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-3">
              Produits
            </h4>
            <div className="space-y-2">
              {footerLinks.produits.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block text-sm hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-3">
              Entreprise
            </h4>
            <div className="space-y-2">
              {footerLinks.entreprise.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block text-sm hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-3">
              Aide
            </h4>
            <div className="space-y-2">
              {footerLinks.aide.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block text-sm hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="pt-6 text-center text-xs">
          &copy; {new Date().getFullYear()} LCG — La Congolaise des Glaçons. Tous droits réservés.
        </div>
      </div>
    </footer>
  )
}
