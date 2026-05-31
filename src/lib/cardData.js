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
  const cards = raw.map(normalizeCard)
  cache[key] = cards
  return cards
}

function normalizeRarity(raw, refStr) {
  const ref = (raw?.reference ?? '').toUpperCase()
  if (ref === 'UNIQUE') return 'U'
  if (ref === 'EXALTED') return 'EX'  // treated as rare in pack generation (set 5+)
  if (ref === 'RARE') return refStr.endsWith('_R2') ? 'R2' : 'R1'
  if (ref === 'UNCOMMON') return 'R2'
  return 'C'
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
    mainCost: raw.elements?.MAIN_COST ?? null,
    recallCost: raw.elements?.RECALL_COST ?? null,
    forestPower: raw.elements?.FOREST_POWER ?? null,
    mountainPower: raw.elements?.MOUNTAIN_POWER ?? null,
    oceanPower: raw.elements?.OCEAN_POWER ?? null,
  }
}

export const SETS = [
  { code: 'CORE',    name: 'Beyond the Gates',       color: '#1a4a6e' },
  { code: 'ALIZE',   name: 'Trial by Frost',          color: '#2a5a7a' },
  { code: 'BISE',    name: 'Whisper from the Maze',   color: '#3a3a6e' },
  { code: 'CYCLONE', name: 'Skybound Odyssey',         color: '#1a5a4a' },
  { code: 'DUSTER',  name: 'Seeds of Unity',           color: '#4a4a1a' },
  { code: 'EOLE',    name: 'Roots of Corruption',      color: '#4a2a1a' },
  { code: 'FUGUE',   name: 'Neverending Journey',      color: '#2a1a4a' },
]

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
