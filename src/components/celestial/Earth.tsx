import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMissionStore } from '../../store/missionStore';
import { SCALE_FACTOR, BODY_DATA } from '../../utils/missionPhysics';

export default function Earth() {
  const meshRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const { missionTime } = useMissionStore();

  const earthTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, '#1a5fb4');
    gradient.addColorStop(0.5, '#26a269');
    gradient.addColorStop(1, '#1a5fb4');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    
    ctx.fillStyle = '#f6f5f4';
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.beginPath();
      ctx.arc(x, y, Math.random() * 20 + 5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    return new THREE.CanvasTexture(canvas);
  }, []);

  useFrame(() => {
    if (meshRef.current) {
      const angle = (missionTime * 0.000001) % (Math.PI * 2);
      meshRef.current.position.x = Math.cos(angle) * BODY_DATA.earth.orbitRadius * SCALE_FACTOR;
      meshRef.current.position.z = Math.sin(angle) * BODY_DATA.earth.orbitRadius * SCALE_FACTOR;
      meshRef.current.rotation.y += 0.001;
    }
    if (atmosphereRef.current) {
      atmosphereRef.current.position.copy(meshRef.current!.position);
    }
  });

  const radius = BODY_DATA.earth.radius * SCALE_FACTOR;

  return (
    <>
      <mesh ref={meshRef}>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial map={earthTexture} />
      </mesh>
      
      <mesh ref={atmosphereRef}>
        <sphereGeometry args={[radius * 1.05, 64, 64]} />
        <meshBasicMaterial 
          color="#4a90e2" 
          transparent 
          opacity={0.15}
          side={THREE.BackSide}
        />
      </mesh>
      
      <pointLight 
        position={[meshRef.current?.position.x || 0, 0, meshRef.current?.position.z || 0]} 
        intensity={0.3} 
        distance={radius * 5} 
        color="#4a90e2"
      />
    </>
  );
}
