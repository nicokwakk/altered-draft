// Draft formats offered in the lobby's mode step (step 1 of the wizard). One source of
// truth for the mode selector UI (Lobby `MODES`) and for the engine dispatch
// (config.draftFormat → buildDraftState in draftLogic.js). `available:false` formats render
// as "Coming soon" and can't be selected yet.
export const DRAFT_FORMATS = [
  {
    id: 'booster',
    name: 'Booster Draft',
    players: '2+',
    available: true,
    blurb: 'The classic. Everyone opens a pack at the same time, picks one card, and passes the rest. Fresh packs each of the 4 rounds.',
  },
  {
    id: 'rochester',
    name: 'Rochester',
    players: '2+',
    available: true,
    blurb: 'One pack is laid out face-up for the whole table. Players take turns picking from it in snake order until it’s empty, then the next pack opens. Everyone sees every pick. Slower but very tactical.',
  },
  {
    id: 'rotisserie',
    name: 'Rotisserie',
    players: '2+',
    available: true,
    blurb: 'No packs: the entire pool is face-up. Players take turns drafting any single card (snake order) until pools are full. Maximum control, longer games.',
  },
  {
    id: 'winston',
    name: 'Winston',
    players: '2',
    available: true,
    blurb: '2-player. Three small face-down piles: peek the first, take it or pass (passing adds a card to it). Pass all three and draw blind from the deck.',
  },
]

export const DEFAULT_FORMAT = 'booster'

export function formatById(id) {
  return DRAFT_FORMATS.find(f => f.id === id) ?? DRAFT_FORMATS[0]
}
