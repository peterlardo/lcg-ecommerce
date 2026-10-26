/**
 * Relecture périodique économe : le transfert réseau de la base est limité (plan Neon), et un onglet
 * laissé ouvert interrogeait le serveur en continu, caché ou non.
 *
 * - onglet visible : toutes les `visibleMs` ;
 * - onglet caché : toutes les `hiddenMs`, ou jamais si `hiddenMs` est omis ;
 * - retour sur l'onglet : relecture immédiate si la dernière date de plus de `visibleMs`.
 * Renvoie la fonction d'arrêt (à retourner depuis useEffect).
 */
export function pollEconomically(run: () => void, visibleMs: number, hiddenMs?: number): () => void {
  let last = Date.now()
  const tick = () => {
    const hidden = typeof document !== "undefined" && document.visibilityState === "hidden"
    const every = hidden ? hiddenMs : visibleMs
    if (!every || Date.now() - last < every - 250) return
    last = Date.now()
    run()
  }
  // Le minuteur bat à la cadence visible ; `tick` laisse passer selon l'état de l'onglet.
  const timer = setInterval(tick, Math.min(visibleMs, hiddenMs ?? visibleMs))
  const onVisible = () => {
    if (document.visibilityState === "visible" && Date.now() - last >= visibleMs) {
      last = Date.now()
      run()
    }
  }
  document.addEventListener("visibilitychange", onVisible)
  return () => {
    clearInterval(timer)
    document.removeEventListener("visibilitychange", onVisible)
  }
}
