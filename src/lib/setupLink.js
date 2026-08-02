// Shareable "invite link" for a SEALED setup. A tournament organizer configures a sealed
// once, copies the link, and shares it: everyone who opens it lands on a LOCKED lobby with
// exactly those options and starts their OWN room/pool with one click — so nobody can pick
// the wrong settings, and players don't have to wait for a host to launch.
//
// Only the fields that drive sealed pool generation are carried (see Lobby.handleStart).
// playerCount is intentionally NOT encoded: each invited player self-creates a solo room.
// Pasted custom cubes/pools can't be encoded (they're inline card lists) — the share button
// is disabled for those.
const FIELDS = [
  'configTab',        // 'presets' | 'cubes' | 'advanced'
  'selectedPreset',   // set code (presets)
  'selectedCube',     // built-in cube id (cubes)
  'selectedSets',     // { setCode: count } (advanced)
  'heroMode',         // 'packs' | 'free'
  'lang',
  'addUniques',
  'excludeBanlist',
]

// base64url so the value is safe in a query string without percent-encoding.
function toB64Url(str) {
  return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromB64Url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  return decodeURIComponent(escape(atob(b64)))
}

/** Encode a sealed config into a compact, URL-safe token (always tagged mode:'sealed'). */
export function encodeSetup(cfg) {
  const picked = { mode: 'sealed' }
  for (const k of FIELDS) if (cfg[k] != null) picked[k] = cfg[k]
  return toB64Url(JSON.stringify(picked))
}

/** Decode a token back to a config object, or null if it's absent/corrupt/not a sealed setup. */
export function decodeSetup(token) {
  if (!token) return null
  try {
    const obj = JSON.parse(fromB64Url(token))
    if (!obj || obj.mode !== 'sealed') return null
    return obj
  } catch {
    return null
  }
}

/** Build the full invite URL for the current origin. */
export function buildInviteUrl(cfg) {
  return `${window.location.origin}/?setup=${encodeSetup(cfg)}`
}
