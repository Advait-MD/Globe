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
const bbox = new THREE.BoxGeometry(1, 1, 1); 

// Texture
const textureLoader = new THREE.TextureLoader();
const earthTexture = textureLoader.load('earth nasa.jpg');
//const earthCloudsTexture = textureLoader.load('earth_cloud.jpg');

// Material
const material = new THREE.MeshStandardMaterial({
  map: earthTexture,
  opacity: 1,
  transparent: false
});
const cloudMaterial = new THREE.MeshStandardMaterial({
  transparent: true,
  opacity: 0.1
});
const bboxMaterial = new THREE.MeshStandardMaterial({
  color: 0xff0000,
  transparent: true,
  opacity: 1,
});
// Mesh
const earth = new THREE.Mesh(earthGeometry, material);
scene.add(earth);
const earthClouds = new THREE.Mesh(earth_c_geometry, cloudMaterial);
scene.add(earthClouds);
const box = new THREE.Mesh(bbox, bboxMaterial);

scene.add(box);

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

function degtocord(deg) {
  const lat = deg.lat * (Math.PI / 180);
  const lon = deg.lon * (Math.PI / 180);
  return { lat, lon };
}

function convert(lat, lon, radius) {
  const { lat: latRad, lon: lonRad } = degtocord({ lat, lon });
  const x = radius * Math.cos(latRad) * Math.cos(lonRad);
  const y = radius * Math.cos(latRad) * Math.sin(lonRad);
  const z = radius * Math.sin(latRad);
  return new THREE.Vector3(x, y, z);
}

const position = convert(-10.333, -53.2, 1.01);
box.scale.set(0.1, 0.1, 0.1);
const normal = position.clone().normalize();

const offset = 0.09;

box.position.copy(position.add(normal.multiplyScalar(offset)));

box.quaternion.setFromUnitVectors(
  new THREE.Vector3(0, 1, 0),
  normal
);

earth.add(box);

//box.lookAt(0, 0, 0);
//box.rotateX(Math.PI); // Example: New Delhi coordinates
//box.position.copy(position);

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // rotate earth
  earth.rotation.y += 0.01;
  //box.rotation.y += 0.01;
  earthClouds.rotation.y -= 0.002;
  //earthAtom.rotation.y += 0.0011; 
  earth.rotation.z = 0.41;
  //earthAtom.rotation.z = 0.41;
  renderer.render(scene, camera);
}

animate();

// Resize handling
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});