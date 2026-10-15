import { B2bDocumentsScreen } from "@/components/admin/b2b-documents-screen"

export default function DevisB2bPage() {
  return (
    <B2bDocumentsScreen
      title="Devis"
      subtitle="Première étape de la vente B2B : le devis. Accepté par le client, il devient un bon de commande, puis une facture."
      types={["DEVIS"]}
      creatable="DEVIS"
    />
  )
}
