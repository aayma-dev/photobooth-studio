'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface RealisticEnvelopeProps {
  isOpen: boolean;
  onOpen?: () => void;
}

export default function RealisticEnvelope({ isOpen, onOpen }: RealisticEnvelopeProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const flapRef = useRef<THREE.Mesh | null>(null);
  const sealRef = useRef<THREE.Mesh | null>(null);
  const [flapRotation, setFlapRotation] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Animate flap when isOpen changes
  useEffect(() => {
    if (isOpen && !isAnimating) {
      setIsAnimating(true);
      let startTime: number | null = null;
      const duration = 1500;
      
      const animateFlap = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(1, elapsed / duration);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const rotation = -Math.PI * 0.95 * easeOut;
        setFlapRotation(rotation);
        
        if (flapRef.current) {
          flapRef.current.rotation.x = rotation;
        }
        
        // Fade seal
        if (sealRef.current && progress > 0.2) {
          const sealProgress = Math.min(1, (progress - 0.2) / 0.5);
          const mat = sealRef.current.material as THREE.MeshStandardMaterial;
          mat.opacity = 1 - sealProgress;
          mat.transparent = true;
        }
        
        if (progress < 1) {
          requestAnimationFrame(animateFlap);
        } else {
          setIsAnimating(false);
          if (onOpen) onOpen();
        }
      };
      
      requestAnimationFrame(animateFlap);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf2eadc);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(2, 1.2, 3.5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(400, 280);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting - Studio quality
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);
    
    const keyLight = new THREE.DirectionalLight(0xfff5e0, 1);
    keyLight.position.set(2, 3, 2);
    keyLight.castShadow = true;
    scene.add(keyLight);
    
    const fillLight = new THREE.PointLight(0xe8c8a0, 0.4);
    fillLight.position.set(-1, 1, 2);
    scene.add(fillLight);
    
    const rimLight = new THREE.PointLight(0xffddbb, 0.3);
    rimLight.position.set(0, 2, -2);
    scene.add(rimLight);

    // Paper texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f0e5d0';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 6000; i++) {
      ctx.fillStyle = `rgba(100, 70, 40, ${Math.random() * 0.06})`;
      ctx.fillRect(Math.floor(Math.random() * 512), Math.floor(Math.random() * 512), 1, 1);
    }
    const paperTexture = new THREE.CanvasTexture(canvas);
    paperTexture.wrapS = THREE.RepeatWrapping;
    paperTexture.wrapT = THREE.RepeatWrapping;
    paperTexture.repeat.set(2, 2);

    // Envelope body
    const bodyGeometry = new THREE.BoxGeometry(2.2, 0.05, 1.6);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xe8d5b5, roughness: 0.4, metalness: 0.05, map: paperTexture });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = -0.1;
    body.castShadow = true;
    scene.add(body);

    // Envelope flap
    const flapGeometry = new THREE.BoxGeometry(2.2, 0.04, 1.2);
    const flapMaterial = new THREE.MeshStandardMaterial({ color: 0xf0e5d0, roughness: 0.35, metalness: 0.03, map: paperTexture });
    const flap = new THREE.Mesh(flapGeometry, flapMaterial);
    flap.position.set(0, 0.08, 0.2);
    flap.rotation.x = flapRotation;
    flap.castShadow = true;
    scene.add(flap);
    flapRef.current = flap;

    // Wax seal
    const sealGeometry = new THREE.CylinderGeometry(0.22, 0.25, 0.08, 32);
    const sealMaterial = new THREE.MeshStandardMaterial({ color: 0x8B3a3a, roughness: 0.2, metalness: 0.1 });
    const seal = new THREE.Mesh(sealGeometry, sealMaterial);
    seal.position.set(0, 0.12, 0.45);
    seal.castShadow = true;
    scene.add(seal);
    sealRef.current = seal;

    // Emboss on seal
    const embossGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const embossMat = new THREE.MeshStandardMaterial({ color: 0xa05050 });
    const emboss = new THREE.Mesh(embossGeo, embossMat);
    emboss.position.set(0, 0.155, 0.46);
    scene.add(emboss);

    // Animation loop
    let time = 0;
    const animate = () => {
      requestAnimationFrame(animate);
      time += 0.005;
      // Gentle floating
      body.position.y = -0.1 + Math.sin(time) * 0.003;
      flap.position.y = 0.08 + Math.sin(time) * 0.003;
      
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      if (rendererRef.current) rendererRef.current.dispose();
    };
  }, []);

  return (
    <div 
      ref={mountRef} 
      className="w-80 h-56 cursor-pointer mx-auto"
      onClick={() => !isOpen && !isAnimating && onOpen?.()}
    />
  );
}