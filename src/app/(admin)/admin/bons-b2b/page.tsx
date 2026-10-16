import { B2bDocumentsScreen } from "@/components/admin/b2b-documents-screen"

export default function BonsB2bPage() {
  return (
    <B2bDocumentsScreen
      title="Factures et livraisons"
      subtitle="La facture se crée depuis le devis validé par le client (écran Devis), et le bon de livraison une fois la facture entièrement payée."
      types={["FACTURE", "LIVRAISON", "AVOIR"]}
      creatable={null}
    />
  )
}
