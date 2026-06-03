import { UNIQUES_EN } from './uniquesData.js'

const BASE_URL = 'https://raw.githubusercontent.com/PolluxTroy0/Altered-TCG-Card-Database/main/SETS'

const cache = {}

export async function fetchSet(setCode, lang = 'EN') {
  const key = `${setCode}_${lang}`
  if (cache[key]) return cache[key]

  const url = `${BASE_URL}/${setCode}/${setCode}_${lang}.json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch set ${setCode} (${lang}): ${res.status}`)

  const json = await res.json()
  const raw = Array.isArray(json) ? json : (json['hydra:member'] || [])
  const cards = raw.map(normalizeCard).filter(isStandardPrinting)
  cache[key] = cards
  return cards
}

// Reference format: ALT_<SET>_<PRINT>_<FACTION>_<NUM>_<RARITY...>
// <PRINT> is the printing variant: 'B' = the actual booster set card,
// 'A' = alternate-art reprint, 'P' = promo. 'A'/'P' are the SAME gameplay
// card as their 'B' twin, just different art. We keep only 'B' so each card
// has exactly one canonical printing in the pool/packs/stats (every 'A' has a
// 'B' twin; the only 'P'-only entries are promo cards that aren't in boosters).
function isStandardPrinting(card) {
  return (card.reference.split('_')[2] === 'B')
}

export function isUniqueRef(ref) {
  return /_U_\d+$/.test(ref ?? '')
}

// A dealt card "token" is normally just its reference, but the multi-copy cube draft
// tags each copy with the faction column it was placed in: "<ref>@<FACTION>". This lets
// the same card appear in two faction columns at once. Strip the tag to get the real ref
// (for set/rarity parsing, decklist export, and looking up the canonical card data).
export function cardBaseRef(token) {
  if (!token) return token
  const at = token.indexOf('@')
  return at === -1 ? token : token.slice(0, at)
}

const LOCALE = { EN: 'en-us', FR: 'fr-fr', ES: 'es-es', DE: 'de-de', IT: 'it-it' }
const uniqueCache = {}

// Unique cards (…_U_<serial>) don't exist in the community set files. The 24 cube
// uniques are bundled locally (data in uniquesData.js, images in /public/uniques) so
// the cube keeps working after Altered's API is retired. We serve the bundled EN copy
// first; any other unique (or non-EN locale) still fetches live from the API while it's
// up, then falls back to the bundled EN snapshot if the request fails.
export async function fetchUnique(reference, lang = 'EN') {
  const key = `${reference}_${lang}`
  if (uniqueCache[key]) return uniqueCache[key]
  const snapshot = UNIQUES_EN[reference]
  // EN: prefer the bundled snapshot (no network — future-proof).
  if (snapshot && lang === 'EN') {
    uniqueCache[key] = snapshot
    return snapshot
  }
  const locale = LOCALE[lang] ?? 'en-us'
  try {
    const res = await fetch(`https://api.altered.gg/cards/${reference}?locale=${locale}`, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`Failed to fetch unique ${reference}: ${res.status}`)
    const card = normalizeCard(await res.json())
    uniqueCache[key] = card
    return card
  } catch (err) {
    // API down / not found → fall back to the bundled EN snapshot if we have one.
    if (snapshot) { uniqueCache[key] = snapshot; return snapshot }
    throw err
  }
}

// Fetch many uniques; failures are skipped (the card simply won't appear).
export async function fetchUniques(references, lang = 'EN') {
  const out = []
  await Promise.all([...new Set(references)].map(async r => {
    try { out.push(await fetchUnique(r, lang)) } catch { /* skip */ }
  }))
  return out
}

// Strip #...# formatting markers used in Altered card text fields
function stripMarkers(val) {
  if (val == null) return null
  const n = Number(String(val).replace(/#/g, ''))
  return isNaN(n) ? null : n
}

function normalizeRarity(raw, refStr) {
  const ref = (raw?.reference ?? '').toUpperCase()
  if (ref === 'UNIQUE') return 'U'
  if (ref === 'EXALTED') return 'EX'  // treated as rare in pack generation (set 5+)
  if (ref === 'RARE') return refStr.endsWith('_R2') ? 'R2' : 'R1'
  if (ref === 'UNCOMMON') return 'R2'
  // Also handle _E suffix in reference string (Exalted shorthand)
  if (refStr.endsWith('_E')) return 'EX'
  return 'C'
}

// COREKS has its own dataset — no remapping needed
export function apiSetCode(code) {
  return code
}

function normalizeCard(raw) {
  const refStr = raw.reference ?? ''
  return {
    reference: refStr,
    name: raw.name,
    faction: raw.mainFaction?.reference ?? raw.faction?.reference ?? 'XX',
    factionName: raw.mainFaction?.name ?? raw.faction?.name ?? 'Unknown',
    rarity: normalizeRarity(raw.rarity, refStr),
    imagePath: raw.imagePath ?? null,
    cardType: raw.cardType?.reference ?? '',
    mainCost: stripMarkers(raw.elements?.MAIN_COST),
    recallCost: stripMarkers(raw.elements?.RECALL_COST),
    forestPower: stripMarkers(raw.elements?.FOREST_POWER),
    mountainPower: stripMarkers(raw.elements?.MOUNTAIN_POWER),
    oceanPower: stripMarkers(raw.elements?.OCEAN_POWER),
  }
}

export const SETS = [
  { code: 'CORE',    name: 'Beyond the Gates',     color: '#1a4a6e' },
  { code: 'COREKS',  name: 'Beyond the Gates KS',  color: '#1a3a5e', hidden: true },
  { code: 'ALIZE',   name: 'Trial by Frost',        color: '#2a5a7a' },
  { code: 'BISE',    name: 'Whisper from the Maze', color: '#3a3a6e' },
  { code: 'CYCLONE', name: 'Skybound Odyssey',       color: '#1a5a4a' },
  { code: 'DUSTER',  name: 'Seeds of Unity',         color: '#4a4a1a' },
  { code: 'EOLE',    name: 'Roots of Corruption',    color: '#4a2a1a' },
  { code: 'FUGUE',   name: 'Neverending Journey',    color: '#2a1a4a' },
]

// Short display names for use in UI (codes → friendly abbreviation)
// CORE and COREKS are merged under BTG
export const SET_ABBREV = {
  CORE:    'BTG',
  COREKS:  'BTG',
  ALIZE:   'TBF',
  BISE:    'WTM',
  CYCLONE: 'SKY',
  DUSTER:  'SDU',
  EOLE:    'ROC',
  FUGUE:   'NEJ',
}

export const SET_FULL_NAMES = {
  BTG: 'Beyond the Gates',
  TBF: 'Trial by Frost',
  WTM: 'Whisper from the Maze',
  SKY: 'Skybound Odyssey',
  SDU: 'Seeds of Unity',
  ROC: 'Roots of Corruption',
  NEJ: 'Neverending Journey',
}

// Canonical icon per abbreviation (BTG maps to CORE icon)
export const SET_ABBREV_ICON_CODE = {
  BTG: 'CORE',
  TBF: 'ALIZE',
  WTM: 'BISE',
  SKY: 'CYCLONE',
  SDU: 'DUSTER',
  ROC: 'EOLE',
  NEJ: 'FUGUE',
}

export const FACTIONS = ['AX', 'BR', 'LY', 'MU', 'OR', 'YZ']

export const FACTION_COLORS = {
  AX: 'text-ax bg-ax/10 border-ax/40',
  BR: 'text-br bg-br/10 border-br/40',
  LY: 'text-ly bg-ly/10 border-ly/40',
  MU: 'text-mu bg-mu/10 border-mu/40',
  OR: 'text-or bg-or/10 border-or/40',
  YZ: 'text-yz bg-yz/10 border-yz/40',
}

export const FACTION_NAMES = {
  AX: 'Axiom',
  BR: 'Bravos',
  LY: 'Lyra',
  MU: 'Muna',
  OR: 'Ordis',
  YZ: 'Yzmir',
}
