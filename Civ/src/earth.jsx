import { useEffect, useRef } from "react";
import Profile from "./profile.jsx";
import * as THREE from "three";

export default function World(){

    const mountRef = useRef(null);

    const username =
        localStorage.getItem("username");

    useEffect(() => {

        const scene = new THREE.Scene();

        const camera =
            new THREE.PerspectiveCamera(

                75,

                window.innerWidth /
                window.innerHeight,

                0.1,

                5000
            );

        camera.position.z = 3;

        const renderer =
            new THREE.WebGLRenderer({
                antialias: true
            });

        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );

        // EARTH

        const textureLoader =
            new THREE.TextureLoader();

        const earthGeometry =
            new THREE.SphereGeometry(
                1,
                62,
                62
            );

        const markerGeometry =
            new THREE.SphereGeometry(
                0.04,
                16,
                16
            );

        const earthMaterial =
            new THREE.MeshStandardMaterial({

                map: textureLoader.load(
                    "/graphics/earth pix2.png"
                )
            });

        const markerMaterial =
            new THREE.MeshStandardMaterial({

                color: 0xff0000
            });

        const earth =
            new THREE.Mesh(
                earthGeometry,
                earthMaterial
            );

        // LIGHTS

        const light =
            new THREE.DirectionalLight(
                0xffffff,
                2
            );

        light.position.set(5,3,5);

        scene.add(light);

        const glow =
            new THREE.AmbientLight(
                0x404040
            );

        scene.add(glow);

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

        // STARS

        function createStarLayer(
            count,
            size,
            spread
        ){

            const geo =
                new THREE.BufferGeometry();

            const pos =
                new Float32Array(count * 3);

            for(let i = 0; i < count * 3; i++){

                pos[i] =
                    (Math.random() - 0.5)
                    * spread;
            }

            geo.setAttribute(

                "position",

                new THREE.BufferAttribute(
                    pos,
                    3
                )
            );

            const mat =
                new THREE.PointsMaterial({

                    color: 0xffffff,

                    size: size,

                    transparent: true
                });

            return new THREE.Points(
                geo,
                mat
            );
        }

        const starsFar =
            createStarLayer(
                4000,
                0.5,
                3000
            );

        const starsMid =
            createStarLayer(
                2000,
                1.2,
                1500
            );

        scene.add(starsFar);
        scene.add(starsMid);

        // MARKERS ARRAY

        const markers = [];

        // COORDINATE FUNCTIONS

        function degToRad(lat, lon){

            return {

                lat:
                    lat * Math.PI / 180,

                lon:
                    lon * Math.PI / 180
            };
        }

        function latLonToXYZ(
            lat,
            lon,
            radius
        ){

            const lonOffset = -0.0598;

            const x =
                radius *
                Math.cos(lat) *
                Math.cos(lon + lonOffset);

            const y =
                radius *
                Math.sin(lat);

            const z =
                radius *
                Math.cos(lat) *
                Math.sin(lon + lonOffset);

            return new THREE.Vector3(
                x,
                y,
                z
            );
        }

        // FETCH NEWS

        async function fetchNews(){

            markers.forEach(marker => {

                earth.remove(marker);
            });

            markers.length = 0;

            try{

                const response = await fetch(
                    `http://127.0.0.1:8000/news/${username}`
                );

                const data =
                    await response.json();

                const safeData =
                    Array.isArray(data)
                    ? data
                    : [data];

                safeData.forEach(news => {

                    const Locations =
                        Array.isArray(news.Locations)
                        ? news.Locations
                        : [];

                    Locations.forEach(lo => {

                        const lat =
                            parseFloat(lo.lat);

                        const lon =
                            parseFloat(lo.lon);

                        if(
                            isNaN(lat) ||
                            isNaN(lon)
                        ) return;

                        const {
                            lat: rLat,
                            lon: rLon
                        } = degToRad(lat, lon);

                        const position =
                            latLonToXYZ(
                                rLat,
                                rLon,
                                1
                            );

                        const normal =
                            position.clone()
                            .normalize();

                        const marker =
                            new THREE.Mesh(
                                markerGeometry,
                                markerMaterial
                            );

                        marker.userData = {

                            headline:
                                news.Headline,

                            url:
                                news.WebURL
                        };

                        marker.position.copy(

                            position.clone().add(

                                normal.multiplyScalar(
                                    0.05
                                )
                            )
                        );

                        marker.quaternion
                        .setFromUnitVectors(

                            new THREE.Vector3(
                                0,
                                1,
                                0
                            ),

                            normal
                        );

                        markers.push(marker);

                        earth.add(marker);
                    });
                });

            }

            catch(error){

                console.log(error);
            }
        }

        fetchNews();

        // ANIMATION

        function animate(){

            requestAnimationFrame(
                animate
            );

            earth.rotation.y += 0.002;

            starsMid.rotation.z += 0.00022;

            renderer.render(
                scene,
                camera
            );
        }

        animate();

        if(mountRef.current){

            mountRef.current.appendChild(
                renderer.domElement
            );
        }

        // MAKE FUNCTION GLOBAL

        window.refreshNews = fetchNews;

        // CLEANUP

        return () => {

            renderer.dispose();

            if(mountRef.current){

                mountRef.current.removeChild(
                    renderer.domElement
                );
            }
        };

    }, []);

    return(

        <div
            ref={mountRef}
            className="
                relative
                h-screen
                w-screen
            "
        >

            <Profile />

        </div>
    );
}