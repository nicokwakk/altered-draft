import { FACTIONS } from './cardData.js'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickRandom(pool) {
  if (!pool.length) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * Generate all packs for a draft session.
 * @param {object[]} allCards - normalized card objects from fetchSet
 * @param {number} playerCount
 * @param {number} packsPerPlayer - typically 4
 * @returns {string[][]} array of packs, each pack is an array of card references
 */
export function generateAllPacks(allCards, playerCount, packsPerPlayer = 4) {
  const heroes  = allCards.filter(c => c.cardType === 'HERO')
  const commons = allCards.filter(c => c.rarity === 'C' && c.cardType !== 'HERO')
  const rares   = allCards.filter(c => c.rarity === 'R1' || c.rarity === 'R2')
  const uniques = allCards.filter(c => c.rarity === 'U')

  const totalPacks = playerCount * packsPerPlayer
  const packs = []

  for (let i = 0; i < totalPacks; i++) {
    packs.push(generateOnePack(heroes, commons, rares, uniques, i))
  }

  return packs
}

function generateOnePack(heroes, commons, rares, uniques, packIndex) {
  const pack = []

  // 1 hero
  const hero = pickRandom(heroes)
  if (hero) pack.push(hero.reference)

  // 8 commons: 1 per faction + 3 paired draws
  const commonsByFaction = {}
  for (const f of FACTIONS) {
    commonsByFaction[f] = commons.filter(c => c.faction === f)
  }

  const usedRefs = new Set(pack)

  for (const f of FACTIONS) {
    const pool = commonsByFaction[f].filter(c => !usedRefs.has(c.reference))
    const card = pickRandom(pool.length ? pool : commonsByFaction[f])
    if (card) {
      pack.push(card.reference)
      usedRefs.add(card.reference)
    }
  }

  // 3 paired common draws
  const pairs = [['AX', 'BR'], ['LY', 'MU'], ['OR', 'YZ']]
  for (const [f1, f2] of pairs) {
    const faction = Math.random() < 0.5 ? f1 : f2
    const pool = commonsByFaction[faction].filter(c => !usedRefs.has(c.reference))
    const card = pickRandom(pool.length ? pool : commonsByFaction[faction])
    if (card) {
      pack.push(card.reference)
      usedRefs.add(card.reference)
    }
  }

  // 3 rares (1-in-8 packs: one slot becomes a unique)
  const uniquePack = packIndex % 8 === 7
  const shuffledRares = shuffle(rares)
  let raresAdded = 0
  let rareIdx = 0

  for (let slot = 0; slot < 3; slot++) {
    if (slot === 2 && uniquePack && uniques.length) {
      const uni = pickRandom(uniques.filter(c => !usedRefs.has(c.reference)))
      if (uni) {
        pack.push(uni.reference)
        usedRefs.add(uni.reference)
        continue
      }
    }
    while (rareIdx < shuffledRares.length && usedRefs.has(shuffledRares[rareIdx].reference)) {
      rareIdx++
    }
    if (rareIdx < shuffledRares.length) {
      pack.push(shuffledRares[rareIdx].reference)
      usedRefs.add(shuffledRares[rareIdx].reference)
      rareIdx++
    }
  }

  return pack
}

/**
 * Generate packs from a custom card pool (raw reference list).
 */
export function generatePacksFromPool(references, playerCount, packsPerPlayer = 4) {
  const totalPacks = playerCount * packsPerPlayer
  const shuffled = shuffle(references)
  const packSize = 12
  const packs = []

  for (let i = 0; i < totalPacks; i++) {
    const start = (i * packSize) % shuffled.length
    const pack = []
    for (let j = 0; j < packSize; j++) {
      pack.push(shuffled[(start + j) % shuffled.length])
    }
    packs.push(pack)
  }

  return packs
}
