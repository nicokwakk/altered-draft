import { FACTIONS } from './cardData.js'

/**
 * Build the altered.re export string from a player's picks and the card map.
 * Hero goes first, then sorted by faction then name.
 */
export function buildDecklist(pickedRefs, cardMap) {
  const counts = {}
  for (const ref of pickedRefs) {
    counts[ref] = (counts[ref] ?? 0) + 1
  }

  const heroes = []
  const byFaction = {}

  for (const [ref, qty] of Object.entries(counts)) {
    const card = cardMap[ref]
    if (!card) continue
    if (card.cardType === 'HERO') {
      heroes.push({ ref, qty, card })
    } else {
      const f = card.faction
      if (!byFaction[f]) byFaction[f] = []
      byFaction[f].push({ ref, qty, card })
    }
  }

  // Sort each faction group by name
  for (const group of Object.values(byFaction)) {
    group.sort((a, b) => a.card.name.localeCompare(b.card.name))
  }

  const lines = []

  for (const { ref, qty } of heroes) {
    lines.push(`${qty} ${ref}`)
  }

  for (const faction of FACTIONS) {
    for (const { ref, qty } of (byFaction[faction] ?? [])) {
      lines.push(`${qty} ${ref}`)
    }
  }

  // Any faction not in standard list
  for (const [f, group] of Object.entries(byFaction)) {
    if (!FACTIONS.includes(f)) {
      for (const { ref, qty } of group) {
        lines.push(`${qty} ${ref}`)
      }
    }
  }

  return lines.join('\n')
}

/**
 * Group picks by faction for display purposes.
 */
export function groupPicksByFaction(pickedRefs, cardMap) {
  const result = {}
  for (const ref of pickedRefs) {
    const card = cardMap[ref]
    if (!card) continue
    const f = card.cardType === 'HERO' ? 'HERO' : card.faction
    if (!result[f]) result[f] = {}
    result[f][ref] = (result[f][ref] ?? 0) + 1
  }
  return result
}
