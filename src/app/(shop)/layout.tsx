import { Header } from "@/components/shared/header"
import { Footer } from "@/components/shared/footer"
import { WhatsAppButton } from "@/components/shared/whatsapp-button"

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppButton />
    </>
  )
}
