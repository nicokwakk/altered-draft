const BASE_URL = 'https://raw.githubusercontent.com/PolluxTroy0/Altered-TCG-Card-Database/main/SETS'

const cache = {}

export async function fetchSet(setCode, lang = 'EN') {
  const key = `${setCode}_${lang}`
  if (cache[key]) return cache[key]

  const url = `${BASE_URL}/${setCode}/${setCode}_${lang}.json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch set ${setCode} (${lang}): ${res.status}`)

  const json = await res.json()
  // Root is a plain array
  const raw = Array.isArray(json) ? json : (json['hydra:member'] || [])
  const cards = raw.map(normalizeCard)
  cache[key] = cards
  return cards
}

// Map verbose rarity strings to short codes used in pack generation
function normalizeRarity(raw) {
  const ref = (raw?.reference ?? '').toUpperCase()
  if (ref === 'UNIQUE') return 'U'
  if (ref === 'RARE') return 'R1'
  if (ref === 'UNCOMMON') return 'R2'
  return 'C' // COMMON and anything else
}

function normalizeCard(raw) {
  // Determine R1 vs R2 from the reference string suffix
  const refStr = raw.reference ?? ''
  const isR2 = refStr.endsWith('_R2')
  const baseRarity = normalizeRarity(raw.rarity)
  const rarity = baseRarity === 'R1' && isR2 ? 'R2' : baseRarity

  return {
    reference: refStr,
    name: raw.name,
    faction: raw.mainFaction?.reference ?? raw.faction?.reference ?? 'XX',
    factionName: raw.mainFaction?.name ?? raw.faction?.name ?? 'Unknown',
    rarity,
    // imagePath is already a full URL in the dataset
    imagePath: raw.imagePath ?? null,
    cardType: raw.cardType?.reference ?? '',
    mainCost: raw.elements?.MAIN_COST ?? null,
    recallCost: raw.elements?.RECALL_COST ?? null,
    forestPower: raw.elements?.FOREST_POWER ?? null,
    mountainPower: raw.elements?.MOUNTAIN_POWER ?? null,
    oceanPower: raw.elements?.OCEAN_POWER ?? null,
  }
}

export function getImageUrl(card) {
  return card?.imagePath ?? null
}

export const SETS = [
  { code: 'CORE',    name: 'Beyond the Gates' },
  { code: 'ALIZE',   name: 'Trial By Frost' },
  { code: 'BISE',    name: 'Whisper From The Maze' },
  { code: 'CYCLONE', name: 'Skybound Odyssey' },
  { code: 'DUSTER',  name: 'Seeds of Unity' },
  { code: 'EOLE',    name: 'Roots of Corruption / Neverending Journey' },
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
