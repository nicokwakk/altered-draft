// Vercel proxy: GET full detail (incl. deckCards) for one of the user's Re:Union decks.
// Forwards the Bearer token server-side (the decks API has no browser CORS).
const BASE = 'https://decks.alteredcore.org/api/decks'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ error: 'missing_authorization' })
  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'missing_id' })

  try {
    const r = await fetch(`${BASE}/${encodeURIComponent(String(id))}`, {
      headers: { Authorization: auth, Accept: 'application/json' },
    })
    const text = await r.text()
    res.status(r.status)
    res.setHeader('Content-Type', r.headers.get('content-type') || 'application/json')
    return res.send(text)
  } catch {
    return res.status(502).json({ error: 'upstream_unreachable' })
  }
}
