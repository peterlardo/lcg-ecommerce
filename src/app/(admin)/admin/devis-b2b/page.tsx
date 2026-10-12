import { B2bDocumentsScreen } from "@/components/admin/b2b-documents-screen"

export default function DevisB2bPage() {
  return (
    <B2bDocumentsScreen
      title="Devis"
      subtitle="Devis établis pour les clients B2B. Un devis confirmé devient un bon de commande."
      types={["DEVIS"]}
      creatable="DEVIS"
    />
  )
}
