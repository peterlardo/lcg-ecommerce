import { readFileSync, writeFileSync } from "node:fs"
import { buildTicketHtml } from "../src/lib/ticket-template"

const logo = readFileSync("public/logo-lcg.jpeg")
const logoDataUri = `data:image/jpeg;base64,${logo.toString("base64")}`

const html = buildTicketHtml({
  orderNumber: "LCG-M2Z4X9-K7Q2",
  customerName: "Bar Le Fleuve",
  paymentMethod: "MOBILE_MONEY",
  paymentStatus: "PAID",
  total: 23500,
  createdAt: new Date().toISOString(),
  pointOfSale: { name: "Point de vente Ouenzé", code: "PV-001" },
  logo: logoDataUri,
  items: [
    { name: "Glaçon Cubes", format: "Sachet 1kg", quantity: 8, price: 1500, total: 12000 },
    { name: "Glaçon Cylindres", format: "Sac 10kg", quantity: 2, price: 4500, total: 9000 },
    { name: "Glace Pilée", format: "Seau 5kg", quantity: 1, price: 2500, total: 2500 },
  ],
})

writeFileSync("sample-ticket.html", `<!DOCTYPE html>${html}`, "utf-8")
console.log("OK - sample-ticket.html généré")
