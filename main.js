import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158/build/three.module.js';

// -----------------------------
// 🎬 SCENE SETUP
// -----------------------------

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// -----------------------------
// 🌍 EARTH
// -----------------------------

const earthGeometry = new THREE.SphereGeometry(1, 64, 64);
const markerGeometry = new THREE.SphereGeometry(0.04, 16, 16);

const textureLoader = new THREE.TextureLoader();
const earthTexture = textureLoader.load('earth nasa.jpg');

const earthMaterial = new THREE.MeshStandardMaterial({
  map: earthTexture
});

const markerMaterial = new THREE.MeshStandardMaterial({
  color: 0xff0000
});

const earth = new THREE.Mesh(earthGeometry, earthMaterial);
scene.add(earth);

// rotate to match texture
earth.rotation.y = -Math.PI / 2;

// -----------------------------
// 💡 LIGHTS
// -----------------------------

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 3, 5);
scene.add(light);

scene.add(new THREE.AmbientLight(0x333333));

// -----------------------------
// 🌐 COORDINATE FUNCTIONS
// -----------------------------

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

// -----------------------------
// 🌍 FETCH + PLOT DATA
// -----------------------------

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

        // 🔥 CREATE NEW MARKER PER LOCATION
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

// -----------------------------
// 🎯 RAYCAST DEBUG (optional)
// -----------------------------

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
  } else {
    popup.style.display = "none";
  }
});

// -----------------------------
// 🔄 ANIMATION
// -----------------------------

function animate() {
  requestAnimationFrame(animate);

  earth.rotation.y += 0.0009;

  renderer.render(scene, camera);
}

animate();

// This is the problem that not showing the popup

//window.addEventListener("pointerdown", (e) => {
  //if (!e.target.closest("#popup")) {
   // document.getElementById("popup").style.display = "none";
  //}
//});

// -----------------------------
// 📱 RESIZE
// -----------------------------

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});