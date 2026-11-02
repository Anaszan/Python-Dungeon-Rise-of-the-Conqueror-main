// Easy mode's fill-in-the-blank skeletons, split into the parts the player
// may not touch and the parts they have to supply.
//
// The skeletons in lessons.ts have always been written with a `___` marking
// the one thing the player decides (see attackSkeletons / skillSkeletons).
// They used to be handed over as plain text in a textarea, which meant the
// exercise was really "select these three underscores, delete them, and type
// in their place" — with the whole rest of the spell equally deletable, and
// nothing on screen saying which part was the question. Easy mode now renders
// the skeleton as read-only code with a real input box sitting where each
// `___` was, and this is what turns one into the other.
//
// Hard mode and boss fights do not come through here at all: those hand over
// an empty editor on purpose (see trials.ts).

export const BLANK = '___'

export type BlankTemplate = {
  // The literal code around the blanks. Always one longer than `count`, so
  // segment i is what comes before blank i and the last one is the tail
  // after the final blank — including when a blank opens or closes the
  // snippet, where the segment on that side is simply empty.
  segments: string[]
  count: number
}

export function parseBlanks(code: string): BlankTemplate {
  const segments = code.split(BLANK)
  return { segments, count: segments.length - 1 }
}

// The code as it would run right now. A blank the player has not answered
// yet keeps its `___`, so an untouched skeleton still fails the way it always
// did if it ever reaches Python — though in practice the console refuses to
// cast an unfinished one first (see unfilledBlanks), which says far more than
// a SyntaxError does.
export function fillBlanks(template: BlankTemplate, answers: string[]): string {
  return template.segments
    .map((segment, i) => {
      if (i === template.count) return segment
      const answer = answers[i] ?? ''
      return segment + (answer.trim() === '' ? BLANK : answer)
    })
    .join('')
}

// How many blanks are still empty. Whitespace does not count as an answer:
// a space typed into the box would compose into code that looks filled in
// and still breaks.
export function unfilledBlanks(template: BlankTemplate, answers: string[]): number {
  let left = 0
  for (let i = 0; i < template.count; i++) {
    if ((answers[i] ?? '').trim() === '') left++
  }
  return left
}
