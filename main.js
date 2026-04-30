import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js';

// Scene
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.x = 0;
camera.position.y = 0;
camera.position.z = 3;

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);


// Earth Geometry
const earthGeometry = new THREE.SphereGeometry(1, 64, 64);
const earth_c_geometry = new THREE.SphereGeometry(1.01, 64, 64);
const earth_atom = new THREE.SphereGeometry(1.05, 64, 64); 

// Texture
const textureLoader = new THREE.TextureLoader();
const earthTexture = textureLoader.load('earth nasa.jpg');
const earthCloudsTexture = textureLoader.load('earth_cloud.jpg');

// Material
const material = new THREE.MeshStandardMaterial({
  map: earthTexture,
  opacity: 1,
  transparent: false
});
const cloudMaterial = new THREE.MeshStandardMaterial({
  map: earthCloudsTexture,
  transparent: true,
  opacity: 0.5
});
const earthAtomMaterial = new THREE.MeshStandardMaterial({
  color: 0x009CDF,
  transparent: true,
  opacity: 0.3,
  blending: THREE.AdditiveBlending,
  side: THREE.BackSide
});
// Mesh
const earth = new THREE.Mesh(earthGeometry, material);
scene.add(earth);
const earthClouds = new THREE.Mesh(earth_c_geometry, cloudMaterial);
//scene.add(earthClouds);
const earthAtom = new THREE.Mesh(earth_atom, earthAtomMaterial);
scene.add(earthAtom);

// Light (sun)
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 3, 5);
scene.add(light);

// Ambient light (soft fill)
const ambientLight = new THREE.AmbientLight(0x333333);
scene.add(ambientLight);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();  

window.addEventListener('click', (event) => {

  // 1. Convert mouse
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // 2. Update ray
  raycaster.setFromCamera(mouse, camera);

  // 3. Intersect
  const intersects = raycaster.intersectObject(earth);

  if (intersects.length > 0) {
    const point = intersects[0].point;
    console.log("Hit:", point);
  }

});

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // rotate earth
  earth.rotation.y += 0.0011;
  earthClouds.rotation.y -= 0.002;
  earthAtom.rotation.y += 0.0011; 
  earth.rotation.z = 0.41;
  earthAtom.rotation.z = 0.41;
  renderer.render(scene, camera);
}

animate();

// Resize handling
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});