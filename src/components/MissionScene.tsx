import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Stars, PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import Sun from './celestial/Sun';
import Earth from './celestial/Earth';
import Moon from './celestial/Moon';
import Mars from './celestial/Mars';
import Rocket from './Rocket';
import { useMissionStore } from '../store/missionStore';
import { calculateRocketPosition, calculateTelemetry, SCALE_FACTOR, BODY_DATA } from '../utils/missionPhysics';

export default function MissionScene() {
  const { missionTime, isPlaying, playbackSpeed, cameraView, updateMissionTime, updateTelemetry, currentPhase } = useMissionStore();
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const rocketPosRef = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    if (isPlaying) {
      const newTime = missionTime + delta * playbackSpeed * 100;
      updateMissionTime(newTime);
      
      const rocketPos = calculateRocketPosition(newTime, currentPhase);
      rocketPosRef.current.copy(rocketPos);
      
      const telemetry = calculateTelemetry(newTime, currentPhase, rocketPos);
      updateTelemetry(telemetry);
      
      if (cameraRef.current) {
        const camera = cameraRef.current;
        const earthAngle = (newTime * 0.000001) % (Math.PI * 2);
        const earthPos = new THREE.Vector3(
          Math.cos(earthAngle) * BODY_DATA.earth.orbitRadius * SCALE_FACTOR,
          0,
          Math.sin(earthAngle) * BODY_DATA.earth.orbitRadius * SCALE_FACTOR
        );
        
        switch (cameraView) {
          case 'chase':
            const offset = new THREE.Vector3(5, 3, 8);
            const targetPos = rocketPos.clone().add(offset);
            camera.position.lerp(targetPos, 0.05);
            camera.lookAt(rocketPos);
            break;
          
          case 'orbital':
            const orbitRadius = 150;
            const angle = state.clock.elapsedTime * 0.1;
            camera.position.x = Math.cos(angle) * orbitRadius;
            camera.position.y = 80;
            camera.position.z = Math.sin(angle) * orbitRadius;
            camera.lookAt(0, 0, 0);
            break;
          
          case 'cockpit':
            const cockpitOffset = new THREE.Vector3(0, 0.5, 1);
            camera.position.copy(rocketPos.clone().add(cockpitOffset));
            camera.lookAt(rocketPos.clone().add(new THREE.Vector3(0, 0, -10)));
            break;
        }
      }
    }
  });

  return (
    <>
      <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 50, 100]} fov={60} />
      
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', 100, 1000]} />
      
      <Stars radius={300} depth={50} count={5000} factor={4} saturation={0} fade speed={0.5} />
      
      <ambientLight intensity={0.1} />
      
      <Sun />
      <Earth />
      <Moon />
      <Mars />
      <Rocket />
      
      <EffectComposer>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={1.5} />
      </EffectComposer>
    </>
  );
}
