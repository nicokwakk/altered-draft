import { fetchSet, fetchUniques, isUniqueRef, canonicalCardRef } from './cardData.js'
import { setsForCube } from './cubes.js'

// Resolve a list of card refs into a custom-cube shape { cards, heroes, unresolved }.
// Shared by the paste-a-cube flow and the load-from-Re:Union-deck flow, so a loaded deck
// becomes a customCube identical to a pasted one. Canonicalizes alt-art/promo printings to
// their standard B card (canonicalCardRef), fetches the needed sets + bundled/live uniques,
// splits heroes (cardType HERO) from cards, and reports refs that didn't resolve.
export async function resolveCubeRefs(rawRefs, lang = 'EN') {
  const refs = rawRefs.map(canonicalCardRef)
  const rawCodes = [...new Set(setsForCube(refs))]
  const results = await Promise.all(rawCodes.map(s => fetchSet(s, lang).catch(() => [])))
  const byRef = new Map(results.flat().map(c => [c.reference, c]))
  const uniqueCards = await fetchUniques(refs.filter(isUniqueRef), lang)
  for (const c of uniqueCards) byRef.set(c.reference, c)

  const resolved = [], unresolved = []
  for (const r of refs) (byRef.has(r) ? resolved : unresolved).push(r)
  const heroes = resolved.filter(r => byRef.get(r).cardType === 'HERO')
  const cards = resolved.filter(r => byRef.get(r).cardType !== 'HERO')
  return { cards, heroes, unresolved: [...new Set(unresolved)] }
}
