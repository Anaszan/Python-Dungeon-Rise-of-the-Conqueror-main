// Hard mode's write-in slots: one box per demand on the monster's โจทย์.
//
// Hard mode used to hand over a single empty textarea with the โจทย์ written
// into it as comments. That is what the difficulty is for — the player writes
// the whole spell — but "the whole spell" and "one undivided box" are not the
// same thing: three numbered demands landed in one space, and nothing on
// screen said which part of what they typed answered which demand. Easy mode
// marks the exact spot for every answer (see blanks.ts), and this is the same
// idea for a box where the player supplies the code rather than one token:
// every demand gets its own box, and the spell is composed from them.
//
// Nothing is taken away by this. Each slot is a full multi-line editor, so a
// player who wants to write the entire spell in the first box still can — the
// other boxes just stay empty. What the checks see is the composition, which
// is the same source either way (see composeSlots).

export type SlotTemplate = {
  title: string
  // One per demand, in the order the โจทย์ lists them. Same strings the
  // brief above the editor shows, so the box and the brief cannot drift.
  labels: string[]
}

export function slotsOf(title: string, brief: string[]): SlotTemplate {
  return { title, labels: brief }
}

// The code as it would run right now: the โจทย์ as comments, with whatever the
// player has written for each demand sitting under it.
//
// The comments stay in the composed source on purpose. They cost nothing —
// every check reads comment-stripped source (see stripComments in trials.ts) —
// and they keep the cast code readable as the thing the player was answering,
// which matters the moment Python reports an error on a line number.
export function composeSlots(template: SlotTemplate, answers: string[]): string {
  const lines = [`# โจทย์จากมอนสเตอร์: ${template.title}`, '']
  for (const [i, label] of template.labels.entries()) {
    lines.push(`# ${i + 1}) ${label}`)
    // Trailing whitespace only — leading indentation is the player's and has
    // to survive, since a slot may well hold the indented body of a block.
    const answer = (answers[i] ?? '').replace(/\s+$/, '')
    if (answer !== '') lines.push(answer)
    lines.push('')
  }
  return lines.join('\n')
}

// How many demands have no code written under them. Used only to label the
// editor — it is never a gate. A spell written entirely in the first box can
// still be perfectly correct, and what decides whether it casts is the
// โจทย์'s checks (see missingCheck), not where the lines were typed.
export function emptySlots(template: SlotTemplate, answers: string[]): number {
  let left = 0
  for (let i = 0; i < template.labels.length; i++) {
    if ((answers[i] ?? '').trim() === '') left++
  }
  return left
}
