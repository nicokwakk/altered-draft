const BASE_URL = 'https://raw.githubusercontent.com/PolluxTroy0/Altered-TCG-Card-Database/main/SETS'
const IMG_BASE = 'https://cdn.alteredcore.org/'

const cache = {}

export async function fetchSet(setCode, lang = 'EN') {
  const key = `${setCode}_${lang}`
  if (cache[key]) return cache[key]

  const url = `${BASE_URL}/${setCode}/${setCode}_${lang}.json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch set ${setCode} (${lang}): ${res.status}`)

  const json = await res.json()
  const cards = (json['hydra:member'] || []).map(normalizeCard)
  cache[key] = cards
  return cards
}

function normalizeCard(raw) {
  return {
    reference: raw.reference,
    name: raw.name,
    faction: raw.mainFaction?.reference ?? raw.faction?.reference ?? 'XX',
    factionName: raw.mainFaction?.name ?? raw.faction?.name ?? 'Unknown',
    rarity: raw.rarity?.reference ?? 'C',
    imagePath: raw.imagePath ? IMG_BASE + raw.imagePath : null,
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
  AX: 'Axile',
  BR: 'Bravura',
  LY: 'Lyra',
  MU: 'Muna',
  OR: 'Ordis',
  YZ: 'Yzmir',
}
