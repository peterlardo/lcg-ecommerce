import { B2bDocumentsScreen } from "@/components/admin/b2b-documents-screen"

export default function BonsB2bPage() {
  return (
    <B2bDocumentsScreen
      title="Commandes, factures et livraisons"
      subtitle="Un bon de commande se crée à partir d'un devis, la facture à partir du bon de commande, et le bon de livraison une fois la facture entièrement payée."
      types={["COMMANDE", "FACTURE", "LIVRAISON", "AVOIR"]}
      creatable="COMMANDE"
    />
  )
}
