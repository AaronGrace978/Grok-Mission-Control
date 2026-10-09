import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function Sun() {
  const sunRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (glowRef.current) {
      glowRef.current.rotation.z = state.clock.elapsedTime * 0.1;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      <mesh ref={sunRef}>
        <sphereGeometry args={[8, 32, 32]} />
        <meshBasicMaterial color="#FDB813" />
      </mesh>
      
      <mesh ref={glowRef}>
        <sphereGeometry args={[10, 32, 32]} />
        <meshBasicMaterial 
          color="#FFA500" 
          transparent 
          opacity={0.3}
          side={THREE.BackSide}
        />
      </mesh>
      
      <pointLight position={[0, 0, 0]} intensity={2} distance={2000} decay={2} color="#ffffff" />
    </group>
  );
}
