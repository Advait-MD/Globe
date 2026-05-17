import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function Stars(){
  const minRef = useRef(null);
 
  useEffect(() =>{
  
    const scene = new THREE.Scene();
         
        const camera = new THREE.PerspectiveCamera(
          75,
          window.innerWidth / window.innerHeight,
          0.1,
          5000
        );
        camera.position.z = 3;
        
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);

    const light = new THREE.DirectionalLight(0xffffff, 2);
        light.position.set(5, 3, 5);
        scene.add(light);
        
        const glow =  new THREE.AmbientLight( 0x404040);
        
        scene.add( glow ); 
        
    // STARS BACKGROUND
        
        const starCount = 6000;
        const starGeometry = new THREE.BufferGeometry();
        
        const positions = new Float32Array(starCount * 3);
        
        for (let i = 0; i < starCount * 3; i++) {
          positions[i] = (Math.random() - 0.5) * 2000;
        }
        
        starGeometry.setAttribute(
          'position',
          new THREE.BufferAttribute(positions, 3)
        );
        
        const starMaterial = new THREE.PointsMaterial({
          color: 0xffffff,
          size: 1,
          sizeAttenuation: true,
          transparent: true
        });
        
        const stars = new THREE.Points(starGeometry, starMaterial);
        
        function createStarLayer(count, size, spread) {
          const geo = new THREE.BufferGeometry();
          const pos = new Float32Array(count * 3);
        
          for (let i = 0; i < count * 3; i++) {
            pos[i] = (Math.random() - 0.5) * spread;
          }
        
          geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        
          const mat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: size,
            transparent: true
          });
        
          return new THREE.Points(geo, mat);
        }
        
        const starsFar = createStarLayer(4000, 0.5, 3000);
        const starsMid = createStarLayer(2000, 1.2, 1500);
        
        scene.add(stars);
        scene.add(starsFar);
        scene.add(starsMid);
        
        function animate() {
          requestAnimationFrame(animate);
        
          stars.rotation.z += 0.00020;
          stars.rotation.y = 0.0001;
        
          starsMid.rotation.z += 0.00022;
          starsMid.rotation.y += 0.0001;
          
          starsFar.rotation.z += 0.00024;
          starsFar.rotation.y -= 0.0001;
        
          renderer.render(scene, camera);
        }
        
        animate();
        
       if(minRef.current){
   minRef.current.appendChild(renderer.domElement);
   }

   return () => {
   renderer.dispose();
   };
  }, []);

   return (
  <div
    ref={minRef}
    className="relative h-screen w-screen"
  ></div>
 );
}

