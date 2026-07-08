"use client"

import { useState } from "react"
import Link from "next/link"
import { Send } from "lucide-react"

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", phone: "", email: "", subject: "", message: "" })
  const [sent, setSent] = useState(false)

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Message de contact :", form)
    setSent(true)
    setForm({ name: "", phone: "", email: "", subject: "", message: "" })
    setTimeout(() => setSent(false), 3000)
  }

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 text-white py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-blue-200">Contact</span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mt-2 mb-4">
            Parlons froid
          </h1>
          <p className="text-blue-100 text-lg max-w-xl mx-auto">
            Une question, un devis professionnel ou un événement à préparer ? Écrivez-nous, nous répondons rapidement.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Contact Info */}
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-1">Adresse</h3>
              <p className="text-sm text-gray-600">97 Rue EWO, Ouenzé — Brazzaville, République du Congo</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-1">Téléphone</h3>
              <p className="text-sm text-gray-600">Numéro à venir — commandes en ligne disponibles 24h/24</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-1">E-mail</h3>
              <p className="text-sm text-gray-600">contact@lcg-glacons.cg (à confirmer)</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-1">Horaires</h3>
              <p className="text-sm text-gray-600">Lun – Sam : 7h00 – 19h00 · Dim : 8h00 – 13h00</p>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Nom complet *</label>
                  <input id="name" required value={form.name} onChange={(e) => handleChange("name", e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Votre nom" />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Téléphone *</label>
                  <input id="phone" type="tel" required value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="+242 XX XXX XX XX" />
                </div>
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input id="email" type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="votre@email.com" />
              </div>
              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">Objet</label>
                <select id="subject" value={form.subject} onChange={(e) => handleChange("subject", e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="">Sélectionnez un objet</option>
                  <option value="Question générale">Question générale</option>
                  <option value="Devis professionnel">Devis professionnel</option>
                  <option value="Réservation événement">Réservation événement</option>
                  <option value="Suivi de commande">Suivi de commande</option>
                </select>
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                <textarea id="message" required rows={5} value={form.message} onChange={(e) => handleChange("message", e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" placeholder="Votre message..." />
              </div>
              <button type="submit" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors">
                {sent ? "Message envoyé !" : (
                  <>
                    Envoyer le message <Send className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
