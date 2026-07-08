"use client"

import { useState } from "react"
import { MapPin, Phone, Mail, Clock, Send } from "lucide-react"

const contactInfo = [
  {
    icon: MapPin,
    title: "Adresse",
    content: "Zone Industrielle d'Ouenzé\nBrazzaville, République du Congo",
  },
  {
    icon: Phone,
    title: "Téléphone",
    content: "+242 05 555 55 55\n+242 06 666 66 66",
  },
  {
    icon: Mail,
    title: "Email",
    content: "contact@lcg.cg\ncommandes@lcg.cg",
  },
  {
    icon: Clock,
    title: "Horaires",
    content: "Lun-Ven : 7h30 - 18h00\nSam : 8h00 - 14h00\nDim : Fermé",
  },
]

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" })
  const [sent, setSent] = useState(false)

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Message de contact :", form)
    setSent(true)
    setForm({ name: "", email: "", subject: "", message: "" })
    setTimeout(() => setSent(false), 3000)
  }

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 text-white py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4">Contactez-nous</h1>
          <p className="text-primary-100 text-lg max-w-xl mx-auto">
            Une question, une commande spéciale ? Notre équipe est à votre écoute.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Envoyez-nous un message</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Nom complet *
                    </label>
                    <input
                      id="name"
                      required
                      value={form.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Votre nom"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="votre@email.com"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                    Sujet *
                  </label>
                  <input
                    id="subject"
                    required
                    value={form.subject}
                    onChange={(e) => handleChange("subject", e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Objet de votre message"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={5}
                    value={form.message}
                    onChange={(e) => handleChange("message", e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                    placeholder="Votre message..."
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors"
                >
                  {sent ? "Message envoyé !" : (
                    <>
                      Envoyer <Send className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            {contactInfo.map((info, i) => {
              const Icon = info.icon
              return (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary-50 rounded-lg text-primary-600 flex-shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">{info.title}</h3>
                      <p className="text-sm text-gray-600 whitespace-pre-line">{info.content}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Map Placeholder */}
        <div className="mt-10 bg-gray-100 border border-gray-200 rounded-xl h-72 sm:h-80 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <MapPin className="h-10 w-10 mx-auto mb-2" />
            <p className="text-sm font-medium">Carte interactive</p>
            <p className="text-xs">Zone Industrielle d&apos;Ouenzé, Brazzaville</p>
          </div>
        </div>
      </div>
    </div>
  )
}
