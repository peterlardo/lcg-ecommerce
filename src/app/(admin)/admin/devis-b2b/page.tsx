import { B2bDocumentsScreen } from "@/components/admin/b2b-documents-screen"

export default function DevisB2bPage() {
  return (
    <B2bDocumentsScreen
      title="Devis"
      subtitle="Première étape de la vente B2B : le devis. Validé par le client, il donne lieu à la facture, puis au bon de livraison une fois la facture payée."
      types={["DEVIS"]}
      creatable="DEVIS"
    />
  )
}
