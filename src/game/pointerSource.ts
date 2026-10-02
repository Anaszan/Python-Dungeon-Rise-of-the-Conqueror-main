// Where a pointer event in the dungeon actually landed.
//
// react-three-fiber deliberately binds its pointer listeners to the canvas's
// *parent* element rather than to the canvas ("to ensure events are registered
// on a shared target, and not on the canvas itself"). drei's <Html> portals
// into that same parent — which is where the spell console beside the target
// and the monster nameplates live. So a pointerdown on the code editor bubbles
// up to the shared element, r3f raycasts it into the scene anyway, and it
// comes out the other side as a click on whatever is drawn behind the panel.
//
// That is the bug this fixes: clicking into the code box to type a spell was
// read as a click on the floor behind it, and sent the player walking off
// mid-fight. Stopping it in React is too late — r3f's listener sits on an
// ancestor of the panel and fires while the native event is still bubbling,
// before React's own delegated listener at the app root ever sees it.
//
// So the test is on the native event's target instead: the dungeon answers a
// pointer only when it landed on the canvas. Compared by nodeName rather than
// `instanceof HTMLCanvasElement` so this stays a plain function that can be
// tested without a DOM.
export function startedOnCanvas(target: EventTarget | null | undefined): boolean {
  return (target as { nodeName?: string } | null | undefined)?.nodeName === 'CANVAS'
}
