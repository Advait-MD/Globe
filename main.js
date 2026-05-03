import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js';


fetch("http://127.0.0.1:8000")
  .then(res => {
    console.log("Response status:", res.status);
    return res.json();
  })
  .then(data => {
    
    console.log("Full response data:", data);
    data.forEach(news => {
      console.log("ID:", news.id);

      news.locations.forEach(loc => {
        console.log("Location:", loc.name);
        console.log("Lat:", loc.lat);
        console.log("Lon:", loc.lon);
      });

      console.log("------");
    });
   
  })
  .catch(err => {
    console.error("Error fetching news:", err);
  });
  
// Scene
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 3);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Geometry
const earthGeometry = new THREE.SphereGeometry(1, 64, 64);
const bboxGeometry = new THREE.SphereGeometry(0.05, 16, 16);

// Texture
const textureLoader = new THREE.TextureLoader();
const earthTexture = textureLoader.load('earth nasa.jpg');

// Materials
const earthMaterial = new THREE.MeshStandardMaterial({
  map: earthTexture
});

const bboxMaterial = new THREE.MeshStandardMaterial({
  color: 0xff0000
});

// Meshes
const earth = new THREE.Mesh(earthGeometry, earthMaterial);
scene.add(earth);

const box = new THREE.Mesh(bboxGeometry, bboxMaterial);
earth.add(box); // IMPORTANT: attach to earth

// Rotate Earth to match texture orientation
earth.rotation.y = -Math.PI/2;

// Lights
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 3, 5);
scene.add(light);

scene.add(new THREE.AmbientLight(0x333333));

// -----------------------------
// 🌍 Coordinate Conversion
// -----------------------------

function degToRad(lat, lon) {
  return {
    lat: lat * Math.PI / 180,
    lon: lon * Math.PI / 180
  };
}

// Correct for Three.js (Y is up)
function latLonToXYZ(lat, lon, radius) {

  const lonOffset = -0.0598;

  const x = radius * Math.cos(lat) * Math.cos(lon + lonOffset);
  const y = radius * Math.sin(lat);
  const z = radius * Math.cos(lat) * Math.sin(lon + lonOffset);

  return new THREE.Vector3(x, y, z);
}

// -----------------------------
// 📍 Place marker (New Delhi)
// -----------------------------

const { lat, lon } = degToRad(28.6139, 77.2088);

const position = latLonToXYZ(lat, lon, 1);

// push slightly above surface
const normal = position.clone().normalize();
const offset = 0.05;

box.position.copy(new THREE.Vector3(0.19435859243803824, 0.47890484319417903, 0.8560811227393484));

// orient marker outward
box.quaternion.setFromUnitVectors(
  new THREE.Vector3(0, 1, 0),
  normal
);

// -----------------------------
// 🎯 Raycaster (debug click)
// -----------------------------

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('click', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObject(earth);

  if (intersects.length > 0) {
    const point = intersects[0].point.clone().normalize();
    console.log("Clicked point (normalized):", point);
  }
});

// -----------------------------
// 🔄 Animation
// -----------------------------

function animate() {
  requestAnimationFrame(animate);

  earth.rotation.y += 0.005;

  renderer.render(scene, camera);
}

animate();

// -----------------------------
// 📱 Resize
// -----------------------------

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

