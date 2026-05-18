import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, OrbitControls, Float, Stars, Environment } from '@react-three/drei'
import * as THREE from 'three'

function ShipModel({ modelPath }: { modelPath: string }) {
  const { scene } = useGLTF(modelPath)
  const cloned = useMemo(() => scene.clone(), [scene])

  const [scale, offset] = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    const s = maxDim > 0 ? 2.2 / maxDim : 1
    const center = new THREE.Vector3()
    box.getCenter(center)
    return [s, center]
  }, [cloned])

  return (
    <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.4}>
      <primitive
        object={cloned}
        scale={scale}
        position={[-offset.x * scale, -offset.y * scale, -offset.z * scale]}
      />
    </Float>
  )
}

function RangerLight({ color }: { color: string }) {
  const lightRef = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    if (lightRef.current) {
      lightRef.current.intensity = 1.5 + Math.sin(clock.elapsedTime * 1.5) * 0.4
    }
  })
  return <pointLight ref={lightRef} position={[2, 3, 3]} intensity={1.5} color={color} />
}

function LoadingPlaceholder() {
  const meshRef = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.elapsedTime * 0.5
    }
  })
  return (
    <mesh ref={meshRef}>
      <octahedronGeometry args={[0.8, 0]} />
      <meshStandardMaterial color="#06b6d4" wireframe emissive="#06b6d4" emissiveIntensity={0.3} />
    </mesh>
  )
}

interface ShipViewerProps {
  modelPath: string
  accentColor: string
}

export default function ShipViewer({ modelPath, accentColor }: ShipViewerProps) {
  return (
    <Canvas
      camera={{ position: [0, 1.2, 5], fov: 40 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={0.8} />
      <RangerLight color={accentColor} />
      <pointLight position={[-3, -2, -3]} intensity={0.4} color={accentColor} />

      <Suspense fallback={<LoadingPlaceholder />}>
        <ShipModel modelPath={modelPath} />
        <Environment preset="night" />
      </Suspense>

      <Stars radius={40} depth={30} count={800} factor={3} saturation={0} fade speed={1} />

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={2.5}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI * 0.7}
      />
    </Canvas>
  )
}
