// Vercel serverless function: exchanges an OIDC authorization code (or a refresh
// token) for tokens at Keycloak, using the CONFIDENTIAL client secret — which must
// never reach the browser. Public config is inline; only the secret comes from env
// (KEYCLOAK_CLIENT_SECRET, set in the Vercel project, never in git). Same-origin with
// the SPA, so no CORS handling needed.
const ISSUER = 'https://auth.altered.re/realms/players'
const CLIENT_ID = 'altered-draft'
const TOKEN_ENDPOINT = `${ISSUER}/protocol/openid-connect/token`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  const secret = process.env.KEYCLOAK_CLIENT_SECRET
  if (!secret) return res.status(500).json({ error: 'server_misconfigured' })

  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {})
  const form = new URLSearchParams()
  form.set('client_id', CLIENT_ID)
  form.set('client_secret', secret)

  if (body.grant === 'authorization_code') {
    const { code, code_verifier, redirect_uri } = body
    if (!code || !code_verifier || !redirect_uri) return res.status(400).json({ error: 'invalid_request' })
    form.set('grant_type', 'authorization_code')
    form.set('code', code)
    form.set('code_verifier', code_verifier)
    form.set('redirect_uri', redirect_uri)
  } else if (body.grant === 'refresh_token') {
    if (!body.refresh_token) return res.status(400).json({ error: 'invalid_request' })
    form.set('grant_type', 'refresh_token')
    form.set('refresh_token', body.refresh_token)
  } else {
    return res.status(400).json({ error: 'unsupported_grant' })
  }

  try {
    const r = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: form.toString(),
    })
    const data = await r.json()
    if (!r.ok) {
      // Pass through Keycloak's error (it contains no secret) so the client can diagnose.
      return res.status(r.status).json({ error: data.error || 'token_error', error_description: data.error_description })
    }
    // Return only what the client needs — not the raw upstream payload.
    return res.status(200).json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      id_token: data.id_token,
      token_type: data.token_type,
    })
  } catch {
    return res.status(502).json({ error: 'token_exchange_failed' })
  }
}

function safeParse(s) {
  try { return JSON.parse(s || '{}') } catch { return {} }
}
