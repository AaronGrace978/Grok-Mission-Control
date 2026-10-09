import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMissionStore } from '../../store/missionStore';
import { SCALE_FACTOR, BODY_DATA } from '../../utils/missionPhysics';

export default function Mars() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { missionTime } = useMissionStore();

  const marsTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    const gradient = ctx.createRadialGradient(256, 256, 50, 256, 256, 256);
    gradient.addColorStop(0, '#cd6245');
    gradient.addColorStop(0.5, '#c1440e');
    gradient.addColorStop(1, '#a2734a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    
    ctx.fillStyle = '#8b4513';
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.beginPath();
      ctx.arc(x, y, Math.random() * 15 + 5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    return new THREE.CanvasTexture(canvas);
  }, []);

  useFrame(() => {
    if (meshRef.current) {
      const angle = (missionTime * 0.0000005) % (Math.PI * 2);
      meshRef.current.position.x = Math.cos(angle) * BODY_DATA.mars.orbitRadius * SCALE_FACTOR;
      meshRef.current.position.z = Math.sin(angle) * BODY_DATA.mars.orbitRadius * SCALE_FACTOR;
      meshRef.current.rotation.y += 0.0008;
    }
  });

  const radius = BODY_DATA.mars.radius * SCALE_FACTOR;

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 48, 48]} />
      <meshStandardMaterial map={marsTexture} />
    </mesh>
  );
}
