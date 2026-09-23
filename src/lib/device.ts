export interface DeviceInfo {
  deviceName: string
  deviceType: "mobile" | "tablet" | "desktop"
}

export function parseUserAgent(userAgent: string | null | undefined): DeviceInfo {
  const ua = userAgent || ""

  let deviceType: DeviceInfo["deviceType"] = "desktop"
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) deviceType = "tablet"
  else if (/Mobi|iPhone|iPod|Android.*Mobile/i.test(ua)) deviceType = "mobile"

  let os = "Desktop"
  if (/iPhone|iPad|iPod/.test(ua)) os = "iOS"
  else if (/Android/.test(ua)) os = "Android"
  else if (/Windows Phone/i.test(ua)) os = "Windows Phone"
  else if (/Windows/.test(ua)) os = "Windows"
  else if (/Mac OS X|Macintosh/.test(ua)) os = "macOS"
  else if (/Linux/.test(ua)) os = "Linux"
  else if (/CrOS/.test(ua)) os = "Chrome OS"

  let browser = "Navigateur"
  if (/Edg\//.test(ua)) browser = "Edge"
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera"
  else if (/Chrome\//.test(ua)) browser = "Chrome"
  else if (/Safari\//.test(ua)) browser = "Safari"
  else if (/Firefox\//.test(ua)) browser = "Firefox"

  return {
    deviceName: `${browser} sur ${os}`,
    deviceType,
  }
}

// Détermine un libellé lisible pour un appareil donné
export function describeDevice(userAgent: string | null | undefined): string {
  const { deviceName, deviceType } = parseUserAgent(userAgent)
  const typeLabel = deviceType === "mobile" ? "Mobile" : deviceType === "tablet" ? "Tablette" : "Ordinateur"
  return `${deviceName} · ${typeLabel}`
}

export function deviceFingerprint(userAgent: string | null | undefined): string {
  const normalized = (userAgent || "").replace(/\s+/g, " ").trim()
  let hash = 0
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i)
    hash |= 0
  }
  return (hash >>> 0).toString(36)
}