"use client"

import { useState } from "react"
import { MapPin, Phone, Mail, Clock } from "lucide-react"

const contactCards = [
  { icon: MapPin, title: "Adresse", text: "97 Rue EWO, Ouenzé — Brazzaville, République du Congo" },
  { icon: Phone, title: "Téléphone", text: "Numéro à venir — commandes en ligne disponibles 24h/24" },
  { icon: Mail, title: "E-mail", text: "contact@lcg-glacons.cg (à confirmer)" },
  { icon: Clock, title: "Horaires", text: "Lun – Sam : 7h00 – 19h00 · Dim : 8h00 – 13h00" },
]

export default function ContactPage() {
  const [form, setForm] = useState({ nom: "", telephone: "", email: "", objet: "Question générale", message: "" })
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error("Erreur lors de l'envoi")
      setSent(true)
      setForm({ nom: "", telephone: "", email: "", objet: "Question générale", message: "" })
      setTimeout(() => setSent(false), 3000)
    } catch (err) {
      console.error("Erreur:", err)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Contact</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Parlons froid</h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
        Une question, un devis professionnel ou un événement à préparer ? Écrivez-nous, nous répondons rapidement.
      </p>

      <div className="mt-12 grid gap-12 lg:grid-cols-5">
        {/* Contact info cards */}
        <div className="space-y-6 lg:col-span-2">
          {contactCards.map((c, i) => (
            <div key={i} className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-card-soft">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ice-gradient text-primary">
                <c.icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-sm font-bold">{c.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="lg:col-span-3">
          <form onSubmit={handleSubmit} className="rounded-3xl border border-border bg-card p-8 shadow-card-soft">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-semibold">
                Nom complet *
                <input
                  required
                  value={form.nom}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                  placeholder="Votre nom"
                />
              </label>
              <label className="block text-sm font-semibold">
                Téléphone *
                <input
                  required
                  type="tel"
                  value={form.telephone}
                  onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                  placeholder="+242 …"
                />
              </label>
              <label className="block text-sm font-semibold sm:col-span-2">
                E-mail
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                  placeholder="vous@exemple.com"
                />
              </label>
              <label className="block text-sm font-semibold sm:col-span-2">
                Objet
                <select
                  value={form.objet}
                  onChange={(e) => setForm({ ...form, objet: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                >
                  <option>Question générale</option>
                  <option>Devis professionnel</option>
                  <option>Réservation événement</option>
                  <option>Suivi de commande</option>
                </select>
              </label>
              <label className="block text-sm font-semibold sm:col-span-2">
                Message *
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none ring-ring transition-shadow focus:ring-2 resize-none"
                  placeholder="Votre message…"
                />
              </label>
            </div>
            <button
              type="submit"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground shadow-frost transition-transform hover:scale-[1.03]"
            >
              {sent ? "Message envoyé ✓" : "Envoyer le message"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
