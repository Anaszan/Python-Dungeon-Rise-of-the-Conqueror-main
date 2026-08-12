import { useRef, type RefObject } from 'react'
import { OrthographicCamera } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ISO_OFFSET } from './constants'

export function IsoCamera({ target }: { target: RefObject<THREE.Vector3> }) {
  const camRef = useRef<THREE.OrthographicCamera>(null!)
  const desired = useRef(new THREE.Vector3())

  useFrame(() => {
    const cam = camRef.current
    if (!cam) return
    desired.current.set(
      target.current.x + ISO_OFFSET.x,
      target.current.y + ISO_OFFSET.y,
      target.current.z + ISO_OFFSET.z,
    )
    cam.position.lerp(desired.current, 0.08)
    cam.lookAt(target.current.x, target.current.y, target.current.z)
  })

  return (
    <OrthographicCamera
      ref={camRef}
      makeDefault
      zoom={56}
      position={[ISO_OFFSET.x, ISO_OFFSET.y, ISO_OFFSET.z]}
      near={0.1}
      far={200}
    />
  )
}
