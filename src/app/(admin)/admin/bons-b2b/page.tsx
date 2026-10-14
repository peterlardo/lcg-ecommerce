import { B2bDocumentsScreen } from "@/components/admin/b2b-documents-screen"

export default function BonsB2bPage() {
  return (
    <B2bDocumentsScreen
      title="Commandes, livraisons et factures"
      subtitle="Chaque bon de commande confirmé donne un bon de livraison, puis une facture. Un avoir s'établit depuis la facture."
      types={["COMMANDE", "LIVRAISON", "FACTURE", "AVOIR"]}
      creatable="COMMANDE"
    />
  )
}
