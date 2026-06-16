// Re:Union (Keycloak OIDC) client — Authorization Code + PKCE against a CONFIDENTIAL
// client. The code→token exchange runs server-side in /api/token (which holds the
// secret); everything here is browser-side. Login is optional/additive — the app works
// fully without it. Tokens live in sessionStorage (survive reload within a tab, cleared
// on tab close); the access token is refreshed via /api/token when near expiry.
const ISSUER = 'https://auth.altered.re/realms/players'
const CLIENT_ID = 'altered-draft'
const SCOPES = 'openid profile'
const AUTHORIZE = `${ISSUER}/protocol/openid-connect/auth`
const USERINFO = `${ISSUER}/protocol/openid-connect/userinfo`

const STORE_KEY = 'reunion_tokens' // { access_token, refresh_token, id_token, expires_at }
const PKCE_KEY = 'reunion_pkce'    // transient during the redirect dance

const redirectUri = () => `${window.location.origin}/auth/callback`

// ---- PKCE + state helpers (Web Crypto) ----
function base64url(bytes) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function randomString(len = 64) {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  return base64url(bytes)
}
async function challengeFor(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(new Uint8Array(digest))
}

// ---- token storage ----
function readTokens() {
  try { return JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null') } catch { return null }
}
function storeFromResponse(data) {
  const t = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    id_token: data.id_token,
    expires_at: Date.now() + (data.expires_in ?? 60) * 1000,
  }
  sessionStorage.setItem(STORE_KEY, JSON.stringify(t))
  return t
}
export function clearTokens() { sessionStorage.removeItem(STORE_KEY) }
export function isLoggedIn() { return !!readTokens()?.refresh_token }

// ---- public API ----
export async function login(returnPath) {
  const verifier = randomString(64)
  const state = randomString(16)
  const challenge = await challengeFor(verifier)
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({
    verifier, state, returnPath: returnPath ?? (location.pathname + location.search),
  }))
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    scope: SCOPES,
    redirect_uri: redirectUri(),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })
  window.location.assign(`${AUTHORIZE}?${p.toString()}`)
}

export async function handleCallback() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')
  const err = params.get('error')
  let pkce = null
  try { pkce = JSON.parse(sessionStorage.getItem(PKCE_KEY) || 'null') } catch { /* ignore */ }
  sessionStorage.removeItem(PKCE_KEY)
  if (err) throw new Error(params.get('error_description') || err)
  if (!code || !pkce || state !== pkce.state) throw new Error('Invalid login response.')

  const res = await fetch('/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant: 'authorization_code', code, code_verifier: pkce.verifier, redirect_uri: redirectUri() }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.error || 'Sign-in failed.')
  storeFromResponse(data)
  return pkce.returnPath || '/'
}

async function refresh() {
  const t = readTokens()
  if (!t?.refresh_token) return null
  const res = await fetch('/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant: 'refresh_token', refresh_token: t.refresh_token }),
  })
  const data = await res.json()
  if (!res.ok) { clearTokens(); return null }
  return storeFromResponse(data)
}

// Returns a valid access token (refreshing if within 30s of expiry), or null.
export async function getAccessToken() {
  let t = readTokens()
  if (!t) return null
  if (Date.now() > t.expires_at - 30_000) t = await refresh()
  return t?.access_token ?? null
}

export async function fetchProfile() {
  const token = await getAccessToken()
  if (!token) return null
  try {
    const res = await fetch(USERINFO, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return null
    const u = await res.json()
    return { pseudo: u.pseudo || u.preferred_username || u.name || 'Player', sub: u.sub }
  } catch { return null }
}

// Soft logout: clear local tokens (the Keycloak SSO session persists, so re-connecting
// is one click). Full RP-initiated logout can be added later if wanted.
export function logout() { clearTokens() }
