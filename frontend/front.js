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

// TEXTURE, MATERIAL AND MESH

const textureLoader = new THREE.TextureLoader();

const earthGeometry = new THREE.SphereGeometry(1, 62, 62);
const markerGeometry = new THREE.SphereGeometry(0.04, 16, 16);

const earthMaterial = new THREE.MeshStandardMaterial({
  map: textureLoader.load('/graphics/earth pix2.png')
});
const markerMaterial = new THREE.MeshStandardMaterial({
  color: 0xff0000
});

const earth = new THREE.Mesh(earthGeometry, earthMaterial);

// LIGHTING

const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(5, 3, 5);
scene.add(light);

const glow =  new THREE.AmbientLight( 0x404040);

scene.add( glow );
scene.add(earth);

// ORBIT CONTROL IMPLEMENTATION

const orbitControl = {
  enabled: true,
  autoRotate: true,
  dampingFactor: 0.05,
  enabledDamping: true,
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

// COORDINATE FUNCTIONS

function degToRad(lat, lon) {
  return {
    lat: lat * Math.PI / 180,
    lon: lon * Math.PI / 180
  };
}

function latLonToXYZ(lat, lon, radius) {
  const lonOffset = -0.0598;

  const x = radius * Math.cos(lat) * Math.cos(lon + lonOffset);
  const y = radius * Math.sin(lat);
  const z = radius * Math.cos(lat) * Math.sin(lon + lonOffset);

  return new THREE.Vector3(x, y, z);
}

function showDialog(data) {
  const popup = document.getElementById("popup");

  popup.style.display = "block";

  popup.innerHTML = `
    <p style="font-size:14px;">${data.headline}</p>
    <a href="${data.url}" target="_blank" style="color:#4da6ff;">
      Read full article →
    </a>
  `;
}

// FETCH DATA AND PLOT

const markers = [];

fetch("http://127.0.0.1:8000")
  .then(res => res.json())
  .then(data => {

    const safeData = Array.isArray(data) ? data : [data];

    safeData.forEach(news => {
      console.log("ID:", news.id);
      console.log("HeadLine:", news.Headline);
      console.log("URL:", news.WebURL);

      const Locations = Array.isArray(news.Locations) ? news.Locations : [];

      Locations.forEach(lo => {


        const lat = parseFloat(lo.lat);
        const lon = parseFloat(lo.lon);

        if (isNaN(lat) || isNaN(lon)) return;

        const { lat: rLat, lon: rLon } = degToRad(lat, lon);
        const position = latLonToXYZ(rLat, rLon, 1);

        const normal = position.clone().normalize();
        const offset = 0.05;

        //  CREATE NEW MARKER PER LOCATION
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);

        marker.userData ={
          headline : news.Headline,
          url : news.WebURL
        }

        marker.position.copy(
          position.clone().add(normal.multiplyScalar(offset))
        );

        marker.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          normal
        );
        
        markers.push(marker);
        earth.add(marker);

        console.log("Placed:", lo.name);
      });

      console.log("------");
    });

  })
  .catch(err => console.error("Fetch error:", err));

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();  

window.addEventListener('pointerdown', (event) => {

  //event.stopPropagation();

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(markers);
  const popup = document.getElementById("popup");

  popup.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  if (intersects.length > 0) {
    showDialog(intersects[0].object.userData);
    //this line put the difference
  } else if (!popup.contains(event.target)) {
    popup.style.display = "none";
  }
});

// ANIMATION LOOP

function animate() {
  requestAnimationFrame(animate);

  earth.rotation.y += 0.002;
  
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