// for stars background in non Globe pages
import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function Stars(){
  const minRef = useRef(null);

  useEffect(() =>{
    let frameId = null;
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(75,window.innerWidth / window.innerHeight,0.1,5000);
    camera.position.z = 3;

    // renderer (stars are unlit points, so no lights are needed)
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    function createStarLayer(count, size, spread) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count * 3; i++) {
        pos[i] = (Math.random() - 0.5) * spread;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({color: 0xffffff, size: size, sizeAttenuation: true, transparent: true});
      return new THREE.Points(geo, mat);
    }

    // star layers of near, far and medium distance stars
    const stars = createStarLayer(6000, 1, 2000);
    const starsFar = createStarLayer(4000, 0.5, 3000);
    const starsMid = createStarLayer(2000, 1.2, 1500);
    const layers = [stars, starsFar, starsMid];
    layers.forEach(layer => scene.add(layer));

    function handleResize(){
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener("resize", handleResize);

    function animate() {
      frameId = requestAnimationFrame(animate);
      stars.rotation.z += 0.00020;
      stars.rotation.y += 0.0001;

      starsMid.rotation.z += 0.00022;
      starsMid.rotation.y += 0.0001;
      starsFar.rotation.z += 0.00024;
      starsFar.rotation.y -= 0.0001;

      renderer.render(scene, camera);
    }

    const mount = minRef.current;
    mount?.appendChild(renderer.domElement);
    animate();

    // Stop the loop and free the GPU: without this every page switch leaked
    // another 12,000-point animation running in the background.
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      layers.forEach(layer => { layer.geometry.dispose(); layer.material.dispose(); });
      renderer.dispose();
      renderer.forceContextLoss();
      mount?.removeChild(renderer.domElement);
    };
}, []);

   return (
  <div
    ref={minRef}
    className="relative h-screen w-screen"
  ></div>
 );
}
