import * as THREE from 'three'

// Where the player is standing, right now, as one shared vector.
//
// The dungeon is the battlefield now: monsters decide whether to swing, the
// target lock decides whether it is still in range, and a nameplate decides
// whether it is close enough to draw — all of them every frame, and all of
// them from outside the component tree that owns the player. Threading a ref
// down through GameScene → Monster → nameplate would put a prop on every one
// of them just to carry a number that changes 60 times a second and that no
// component wants to re-render on.
//
// So it lives here, module-level and mutable, the same way touchMoveState
// does for the joystick. Player.tsx writes it (it is the same object its
// positionRef points at, see GameScene), everyone else only ever reads it
// inside a useFrame.
export const playerPosition = new THREE.Vector3(0, 0.6, 0)
