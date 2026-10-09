import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMissionStore } from '../../store/missionStore';
import { SCALE_FACTOR, BODY_DATA } from '../../utils/missionPhysics';

export default function Moon() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { missionTime } = useMissionStore();

  const moonTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = '#9a9996';
    ctx.fillRect(0, 0, 256, 256);
    
    ctx.fillStyle = '#77767b';
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      ctx.beginPath();
      ctx.arc(x, y, Math.random() * 10 + 3, 0, Math.PI * 2);
      ctx.fill();
    }
    
    return new THREE.CanvasTexture(canvas);
  }, []);

  useFrame(() => {
    if (meshRef.current) {
      const earthAngle = (missionTime * 0.000001) % (Math.PI * 2);
      const earthX = Math.cos(earthAngle) * BODY_DATA.earth.orbitRadius * SCALE_FACTOR;
      const earthZ = Math.sin(earthAngle) * BODY_DATA.earth.orbitRadius * SCALE_FACTOR;
      
      const moonAngle = (missionTime * 0.00001) % (Math.PI * 2);
      meshRef.current.position.x = earthX + Math.cos(moonAngle) * BODY_DATA.moon.orbitRadius * SCALE_FACTOR;
      meshRef.current.position.z = earthZ + Math.sin(moonAngle) * BODY_DATA.moon.orbitRadius * SCALE_FACTOR;
      meshRef.current.rotation.y += 0.001;
    }
  });

  const radius = BODY_DATA.moon.radius * SCALE_FACTOR;

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 32, 32]} />
      <meshStandardMaterial map={moonTexture} />
    </mesh>
  );
}
