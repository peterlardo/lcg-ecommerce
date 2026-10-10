// Son de notification synthétisé (Web Audio) — aucun fichier audio requis.
// Les navigateurs bloquent l'audio avant interaction : unlockNotificationAudio()
// est appelé au premier geste de l'utilisateur pour déverrouiller le contexte.

let ctx: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) ctx = new Ctor()
  return ctx
}

export function unlockNotificationAudio() {
  const c = getContext()
  if (c && c.state === "suspended") void c.resume()
}

export function playNotificationSound() {
  const c = getContext()
  if (!c) return
  if (c.state === "suspended") void c.resume()

  const now = c.currentTime
  const notes = [880, 1244.5] // la - mi (ding montant)
  notes.forEach((freq, i) => {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = "sine"
    osc.frequency.value = freq
    const start = now + i * 0.12
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28)
    osc.connect(gain).connect(c.destination)
    osc.start(start)
    osc.stop(start + 0.32)
  })
}
