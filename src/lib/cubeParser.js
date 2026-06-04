/**
 * Parse a pasted cube decklist into card references.
 *
 * Tolerant of the app's own Export format (`<qty> <REF>` one per line) AND
 * space-separated runs like `1 ALT_CORE_B_YZ_03_C 3 ALT_CORE_B_MU_06_R2`.
 * A bare number (optionally with a trailing `x`, e.g. `3` or `3x`) sets the
 * quantity for the NEXT reference; a reference with no preceding number counts
 * once. Anything that's neither a number nor an `ALT_…` reference is collected
 * in `badTokens` so the UI can surface it instead of failing silently.
 *
 * Returns { entries: [{ qty, ref }], refs: [flat refs with duplicates], badTokens }.
 */
export function parseDecklist(text) {
  const tokens = (text || '').split(/\s+/).filter(Boolean)
  const entries = []
  const badTokens = []
  let pendingQty = 1

  for (const tok of tokens) {
    const qtyMatch = tok.match(/^(\d+)x?$/i)
    if (qtyMatch) {
      pendingQty = Math.max(1, parseInt(qtyMatch[1], 10))
      continue
    }
    if (/^ALT_/i.test(tok)) {
      entries.push({ qty: pendingQty, ref: tok.toUpperCase() })
      pendingQty = 1
    } else {
      badTokens.push(tok)
      pendingQty = 1
    }
  }

  // Merge duplicate refs so quantities accumulate (e.g. listing a ref twice).
  const merged = new Map()
  for (const { qty, ref } of entries) merged.set(ref, (merged.get(ref) ?? 0) + qty)
  const mergedEntries = [...merged.entries()].map(([ref, qty]) => ({ ref, qty }))

  const refs = mergedEntries.flatMap(({ ref, qty }) => Array(qty).fill(ref))

  return { entries: mergedEntries, refs, badTokens }
}
