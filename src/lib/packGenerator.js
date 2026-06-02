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
function deduplicateByNameFaction(cards) {
  const seen = new Set()
  return cards.filter(c => {
    const key = `${c.name}__${c.faction}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Split a card list into the four draft pools (deduped, tokens excluded). */
function splitPools(allCards, includeHeroes) {
  const isDraftable = c => c.cardType !== 'TOKEN'
  const heroes  = includeHeroes
    ? deduplicateByNameFaction(allCards.filter(c => isDraftable(c) && c.cardType === 'HERO' && c.rarity !== 'U'))
    : []
  const commons = deduplicateByNameFaction(allCards.filter(c => isDraftable(c) && c.rarity === 'C' && c.cardType !== 'HERO'))
  const rares   = deduplicateByNameFaction(allCards.filter(c => isDraftable(c) && (c.rarity === 'R1' || c.rarity === 'R2' || c.rarity === 'EX')))
  const uniques = deduplicateByNameFaction(allCards.filter(c => isDraftable(c) && c.rarity === 'U'))
  return { heroes, commons, rares, uniques }
}

export function generateAllPacks(allCards, playerCount, packsPerPlayer = 4, options = {}) {
  const { includeHeroes = true, cubeMode = false } = options
  const { heroes, commons, rares, uniques } = splitPools(allCards, includeHeroes)

  const totalPacks = playerCount * packsPerPlayer

  if (cubeMode) {
    return generateCubePacks(heroes, commons, rares, uniques, totalPacks, includeHeroes)
  }

  const packs = []
  for (let i = 0; i < totalPacks; i++) {
    packs.push(generateOnePack(heroes, commons, rares, uniques, i))
  }
  return packs
}

/**
 * Chaos / mixed-booster draft: build single-set boosters per set according to
 * the requested counts, then shuffle ALL boosters together so they are dealt
 * out at random. Each booster follows normal composition (its own set only).
 * @param {Object<string, object[]>} cardsBySet - { setCode: normalized cards }
 * @param {Object<string, number>} packMix - { setCode: number of boosters }
 * @returns {string[][]} flat, shuffled array of packs
 */
export function generateChaosPacks(cardsBySet, packMix, options = {}) {
  const { includeHeroes = true } = options
  const allPacks = []
  for (const [setCode, count] of Object.entries(packMix)) {
    if (!count || count < 1) continue
    const cards = cardsBySet[setCode] ?? []
    if (!cards.length) continue
    const { heroes, commons, rares, uniques } = splitPools(cards, includeHeroes)
    for (let i = 0; i < count; i++) {
      allPacks.push(generateOnePack(heroes, commons, rares, uniques, i))
    }
  }
  return shuffle(allPacks)
}

/**
 * Cube DRAFT from a multiset of card OBJECTS (preserves duplicate copies — a cube
 * may intentionally run multiple copies of a card, so we do NOT dedupe). Deals
 * equal-size packs (unequal packs deadlock the pass-and-pick rotation); heroes are
 * not included here (this cube drafts them separately). 4 players → 16 packs of 12.
 * @param {object[]} cardObjects - normalized cards, with duplicates preserved
 * @param {number} totalPacks - players × 4
 */
export function generateCubeDraftPacks(cardObjects, totalPacks) {
  if (totalPacks < 1) return []
  const body = shuffle(cardObjects)
  const perPack = Math.min(13, Math.floor(body.length / totalPacks))
  const packs = []
  let b = 0
  for (let i = 0; i < totalPacks; i++) {
    const pack = []
    for (let s = 0; s < perPack; s++) pack.push(body[b++].reference)
    packs.push(pack)
  }
  return packs
}

/**
 * Cube mode: each card appears at most once across ALL packs, and EVERY pack is
 * the same size (critical — unequal packs deadlock the pass-and-pick rotation).
 *
 * The pool is curated and arbitrarily sized, so we don't force a fixed
 * common/rare structure (that depletes pools unevenly and breaks the draft).
 * Instead: deal 1 hero per pack when there are enough heroes for every pack,
 * then fill each pack with an equal number of body cards (commons/rares/uniques
 * shuffled together). Leftover cards are simply not used this draft.
 */
function generateCubePacks(heroes, commons, rares, uniques, totalPacks, includeHeroes) {
  if (totalPacks < 1) return []
  const heroPool = shuffle(includeHeroes ? heroes : [])
  // Only dedicate a hero slot if there's one for every pack (keeps packs equal).
  const dedicatedHeroes = heroPool.length >= totalPacks
  const body = shuffle([
    ...(dedicatedHeroes ? [] : heroPool), // not enough heroes to slot → draft them as body
    ...commons, ...rares, ...uniques,
  ])

  const heroPerPack = dedicatedHeroes ? 1 : 0
  // Cap pack size at 13 for huge cubes; otherwise split the body evenly.
  const bodyPerPack = Math.min(13 - heroPerPack, Math.floor(body.length / totalPacks))

  const packs = []
  let hIdx = 0, bIdx = 0
  for (let i = 0; i < totalPacks; i++) {
    const pack = []
    if (heroPerPack) pack.push(heroPool[hIdx++].reference)
    for (let s = 0; s < bodyPerPack; s++) pack.push(body[bIdx++].reference)
    packs.push(pack)
  }
  return packs
}

function generateOnePack(heroes, commons, rares, uniques, packIndex) {
  const pack = []

  // 1 hero (only if heroes pool is non-empty)
  if (heroes.length) {
    const hero = pickRandom(heroes)
    if (hero) pack.push(hero.reference)
  }

  // 8 commons: 1 per faction + 3 paired draws
  const commonsByFaction = {}
  for (const f of FACTIONS) {
    commonsByFaction[f] = commons.filter(c => c.faction === f)
  }

  const usedRefs = new Set(pack)

  // 9 commons: 1 per faction (6) + 3 paired draws (3) = 9
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
