import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js';
              
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
document.body.appendChild(renderer.domElement);

const textureLoader = new THREE.TextureLoader();

const earthGeometry = new THREE.SphereGeometry(1, 64, 64);
const earthMaterial = new THREE.MeshStandardMaterial({
  map: textureLoader.load('earth_pixel.png')
});

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

const earth = new THREE.Mesh(earthGeometry, earthMaterial);
scene.add(earth);

const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(5, 3, 5);
scene.add(light);

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

  earth.rotation.y += 0.002;

  stars.rotation.z += 0.00020;
  stars.rotation.y = 0.001;

  starsMid.rotation.z += 0.00022;
  starsMid.rotation.y += 0.001;
  
  starsFar.rotation.z += 0.00024;
  starsFar.rotation.y -= 0.001;

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});