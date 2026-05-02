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
const earth_layer = new THREE.SphereGeometry(1, 64, 64);
const earthMaterial = new THREE.MeshStandardMaterial({
  map: textureLoader.load('earth_pixel.png')
});
const earthLayerMaterial = new THREE.MeshStandardMaterial({
  transparent: true,
  opacity: 0.1,
});
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();  

// Orbit Control Implementation
const orbitControl = {
  enabled: true,
  autoRotate: true,
  autoRotateSpeed: 2,
  rotateSpeed: 1,
  zoomSpeed: 1.2,
  minDistance: 2,
  maxDistance: 100,
  minPolarAngle: 0,
  maxPolarAngle: Math.PI,
  
  // State
  distance: 3,
  theta: 0,
  phi: Math.PI / 2,
  targetTheta: 0,
  targetPhi: Math.PI / 2,
  targetDistance: 3,
  
  // Input tracking
  isDragging: false,
  previousMousePosition: { x: 0, y: 0 },
  
  init() {
    window.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    window.addEventListener('wheel', (e) => this.onMouseWheel(e), { passive: false });
    window.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: true });
    window.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: true });
    window.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: true });
  },
  
  onMouseDown(e) {
    if (!this.enabled) return;
    this.isDragging = true;
    this.previousMousePosition = { x: e.clientX, y: e.clientY };
  },
  
  onMouseMove(e) {
    if (!this.isDragging || !this.enabled) return;
    
    const deltaX = e.clientX - this.previousMousePosition.x;
    const deltaY = e.clientY - this.previousMousePosition.y;
    
    this.targetTheta -= deltaX * 0.01 * this.rotateSpeed;
    this.targetPhi += deltaY * 0.01 * this.rotateSpeed;
    
    // Clamp phi
    this.targetPhi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.targetPhi));
    
    this.previousMousePosition = { x: e.clientX, y: e.clientY };
  },
  
  onMouseUp() {
    this.isDragging = false;
  },
  
  onMouseWheel(e) {
    if (!this.enabled) return;
    e.preventDefault();
    
    const direction = e.deltaY > 0 ? 1 : -1;
    this.targetDistance *= Math.pow(this.zoomSpeed, direction * 0.1);
    this.targetDistance = Math.max(this.minDistance, Math.min(this.maxDistance, this.targetDistance));
  },
  
  onTouchStart(e) {
    if (e.touches.length === 1 && this.enabled) {
      this.isDragging = true;
      this.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  },
  
  onTouchMove(e) {
    if (e.touches.length === 1 && this.isDragging && this.enabled) {
      const deltaX = e.touches[0].clientX - this.previousMousePosition.x;
      const deltaY = e.touches[0].clientY - this.previousMousePosition.y;
      
      this.targetTheta -= deltaX * 0.01 * this.rotateSpeed;
      this.targetPhi += deltaY * 0.01 * this.rotateSpeed;
      
      this.targetPhi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.targetPhi));
      
      this.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  },
  
  onTouchEnd() {
    this.isDragging = false;
  },
  
  update() {
    if (!this.enabled) return;
    
    // Apply auto-rotation
    if (this.autoRotate && !this.isDragging) {
      this.targetTheta += (this.autoRotateSpeed * 0.02) * (Math.PI / 180);
    }
    
    // Smooth camera movement
    const easing = 0.1;
    this.theta += (this.targetTheta - this.theta) * easing;
    this.phi += (this.targetPhi - this.phi) * easing;
    this.distance += (this.targetDistance - this.distance) * easing;
    
    // Calculate camera position using spherical coordinates
    const x = this.distance * Math.sin(this.phi) * Math.cos(this.theta);
    const y = this.distance * Math.cos(this.phi);
    const z = this.distance * Math.sin(this.phi) * Math.sin(this.theta);
    
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
  }
};

orbitControl.init();

const earth = new THREE.Mesh(earthGeometry, earthMaterial);
scene.add(earth);

const earthLayer = new THREE.Mesh(earth_layer, earthLayerMaterial);
scene.add(earthLayer);

const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(5, 3, 5);
scene.add(light);

const glow =  new THREE.AmbientLight( 0x404040);
scene.add( glow );

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
  earthLayer.rotation.y += 0.002;

  stars.rotation.z += 0.00020;
  stars.rotation.y = 0.001;

  starsMid.rotation.z += 0.00022;
  starsMid.rotation.y += 0.001;
  
  starsFar.rotation.z += 0.00024;
  starsFar.rotation.y -= 0.001;

  // Update orbit control
  orbitControl.update();

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});