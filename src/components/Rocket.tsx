import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMissionStore } from '../store/missionStore';
import { calculateRocketPosition } from '../utils/missionPhysics';

export default function Rocket() {
  const groupRef = useRef<THREE.Group>(null);
  const exhaustRef = useRef<THREE.Points>(null);
  const { missionTime, currentPhase } = useMissionStore();

  const exhaustParticles = useMemo(() => {
    const count = 200;
    const positions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 1] = -Math.random() * 3;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    
    return positions;
  }, []);

  useFrame(() => {
    if (groupRef.current) {
      const position = calculateRocketPosition(missionTime, currentPhase);
      groupRef.current.position.copy(position);
      
      const direction = new THREE.Vector3(0, 1, 0);
      if (currentPhase === 'launch') {
        direction.set(0, 1, 0);
      } else if (currentPhase.includes('orbit')) {
        const tangent = new THREE.Vector3(-position.z, 0, position.x).normalize();
        direction.copy(tangent);
      }
      groupRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    }
    
    if (exhaustRef.current && (currentPhase === 'launch' || currentPhase.includes('injection'))) {
      const positions = exhaustRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] -= 0.1;
        if (positions[i + 1] < -5) {
          positions[i + 1] = 0;
          positions[i] = (Math.random() - 0.5) * 0.5;
          positions[i + 2] = (Math.random() - 0.5) * 0.5;
        }
      }
      exhaustRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  const showExhaust = currentPhase === 'launch' || currentPhase.includes('injection');

  return (
    <group ref={groupRef}>
      <mesh castShadow>
        <cylinderGeometry args={[0.3, 0.5, 4, 16]} />
        <meshStandardMaterial color="#e5e5e5" metalness={0.8} roughness={0.2} />
      </mesh>
      
      <mesh position={[0, 2.5, 0]} castShadow>
        <coneGeometry args={[0.3, 1, 16]} />
        <meshStandardMaterial color="#e5e5e5" metalness={0.8} roughness={0.2} />
      </mesh>
      
      <mesh position={[0.4, -1, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.2, 1, 8]} />
        <meshStandardMaterial color="#1e1e1e" />
      </mesh>
      <mesh position={[-0.4, -1, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.2, 1, 8]} />
        <meshStandardMaterial color="#1e1e1e" />
      </mesh>
      <mesh position={[0, -1, 0.4]} castShadow>
        <cylinderGeometry args={[0.15, 0.2, 1, 8]} />
        <meshStandardMaterial color="#1e1e1e" />
      </mesh>
      <mesh position={[0, -1, -0.4]} castShadow>
        <cylinderGeometry args={[0.15, 0.2, 1, 8]} />
        <meshStandardMaterial color="#1e1e1e" />
      </mesh>
      
      {showExhaust && (
        <>
          <points ref={exhaustRef} position={[0, -2.5, 0]}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={exhaustParticles.length / 3}
                array={exhaustParticles}
                itemSize={3}
              />
            </bufferGeometry>
            <pointsMaterial size={0.2} color="#ff6b35" transparent opacity={0.8} />
          </points>
          
          <pointLight position={[0, -2, 0]} intensity={2} distance={10} color="#ff6b35" />
        </>
      )}
    </group>
  );
}
