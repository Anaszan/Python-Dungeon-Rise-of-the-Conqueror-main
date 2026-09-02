// Loads each rigged GLB the way the game does and checks the clip actually
// binds to the rig: every track has to resolve to a node inside the model.
import { readFileSync } from 'node:fs'
import { AnimationMixer, LoopRepeat, PropertyBinding } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const names = [
  // level 2
  'goblinwarrior', 'goblinmarauder', 'orc', 'orcberserker', 'ghostspecter',
  'wispspecter', 'hollowspecter', 'wraithelite', 'wraithsovereign', 'elderdragon',
  // level 3
  'imp', 'loopimp', 'goblinraider', 'goblinskirmisher', 'goblinvanguard',
  'banshee', 'wailingbanshee', 'shriekingbanshee', 'hydra',
  // level 4
  'arcanewisp', 'functionwisp', 'hexsprite', 'heximp', 'cursesprite',
  'cultist', 'cultistzealot', 'spellknight', 'spellwarden', 'archmage',
  // level 5
  'bookgolem', 'indexgolem', 'ghostlibrarian', 'whisperinglibrarian',
  'silentlibrarian', 'archivist', 'archivistscribe', 'archivistwarden',
  'forbiddentome',
  // level 6
  'trapsprite', 'snaresprite', 'cursedwisp', 'hexwisp', 'blightwisp',
  'brokengolem', 'shatteredgolem', 'cursedknight', 'fallenknight', 'glitchwyrm',
]
const loader = new GLTFLoader()
let bad = 0

for (const n of names) {
  const url = `public/monsters/${n}_attack.glb`
  const buf = readFileSync(url)
  const gltf = await new Promise((res, rej) =>
    loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej))
  const root = gltf.scene.clone(true)
  const mixer = new AnimationMixer(root)
  const report = []
  for (const clip of gltf.animations) {
    const unbound = clip.tracks.filter((t) => {
      const parsed = PropertyBinding.parseTrackName(t.name)
      return PropertyBinding.findNode(root, parsed.nodeName) == null
    })
    const action = mixer.clipAction(clip)
    action.setLoop(LoopRepeat, Infinity).play()
    report.push(`${clip.name} ${clip.duration.toFixed(2)}s tracks=${clip.tracks.length} unbound=${unbound.length}`)
    if (unbound.length) bad++
  }
  // Step through the loop and make sure something actually moves.
  const probe = root.getObjectByName(`${root.children[0]?.name ?? ''}`)
  const before = []
  root.traverse((o) => before.push(o.position.clone().toArray().concat(o.rotation.toArray().slice(0, 3))))
  mixer.update(0.5)
  const after = []
  root.traverse((o) => after.push(o.position.clone().toArray().concat(o.rotation.toArray().slice(0, 3))))
  const moved = before.some((b, i) => b.some((v, k) => Math.abs(v - after[i][k]) > 1e-4))
  if (!moved) bad++
  console.log(`${n.padEnd(17)} clips=${gltf.animations.length} moved=${moved} | ${report.join(' ; ')}`)
  void probe
}
console.log(bad ? `FAIL (${bad})` : 'OK: every clip binds and animates')
process.exit(bad ? 1 : 0)
