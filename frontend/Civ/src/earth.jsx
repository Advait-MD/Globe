import {useEffect,useRef,useState} from "react";
import OrbitControl from "./orbitcontrol.jsx";
import fetchNews from "./guardianfetch.jsx";
import Profile from "./profile.jsx";
import * as THREE from "three";

export default function World(){

    const mountRef = useRef(null);
    const popupRef = useRef(false);
    const [selectedNews, setSelectedNews] = useState(null);
    const [showPopup, setShowPopup]= useState(false);

    const username = localStorage.getItem("username");

    useEffect(() => { 
        popupRef.current = showPopup;
     }, [showPopup]);

    useEffect(() => {

     //Camera, scene, materal, mesh and stuff......   
        const scene = new THREE.Scene();
        const camera =new THREE.PerspectiveCamera(75,window.innerWidth / window.innerHeight,0.1,5000);
        camera.position.z = 3;
        const orbitControl = OrbitControl(camera, popupRef);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize( window.innerWidth, window.innerHeight );

        const textureLoader = new THREE.TextureLoader();
        const earthGeometry=new THREE.SphereGeometry(1,62,62);
        const markerGeometry =new THREE.SphereGeometry(0.04,16,16);

        const earthMaterial =new THREE.MeshStandardMaterial({map: textureLoader.load("/graphics/earth pix2.png") });

        const markerMaterial =new THREE.MeshStandardMaterial({color: 0xff0000 });

        const earth =new THREE.Mesh(earthGeometry, earthMaterial);

        scene.add(earth);
//Lighting
        const light = new THREE.DirectionalLight(0xffffff,2);
        light.position.set(5,3,5);
        scene.add(light);
        const glow = new THREE.AmbientLight( 0x404040 );
        scene.add(glow);
// Orbit Controls
        orbitControl.init();
// Stars in the sky        
        function createStarLayer(count,size,spread){

            const geo = new THREE.BufferGeometry();
            const pos = new Float32Array(count * 3);

            for(let i = 0; i < count * 3; i++){
               pos[i] = (Math.random() - 0.5)* spread;
            }

            geo.setAttribute("position", new THREE.BufferAttribute(pos,3));

            const mat = new THREE.PointsMaterial({color: 0xffffff,size: size,transparent: true});

            return new THREE.Points(geo,mat);
        }

        const starsFar=createStarLayer(4000,0.5,3000);
        const starsMid=createStarLayer(2000,1.2,1500);

        scene.add(starsFar);
        scene.add(starsMid);

//raycaster and some formulas of conversion       
        const raycaster=new THREE.Raycaster();
        const mouse=new THREE.Vector2();

        const markers = [];

        
        function degToRad(lat, lon){
            return {
                lat:lat * Math.PI / 180,
                lon:lon * Math.PI / 180
            };
        }

        function latLonToXYZ(lat,lon,radius){

            const lonOffset = -0.0598;
            const x = radius * Math.cos(lat) * Math.cos(lon + lonOffset);
            const y = radius * Math.sin(lat);
            const z = radius * Math.cos(lat) * Math.sin(lon + lonOffset);

            return new THREE.Vector3(x,y,z);
        }

       
        fetchNews({username, earth, markers, markerGeometry, markerMaterial, degToRad, latLonToXYZ});

//handels the touch on scene  
        function handlePointerDown(event){

            if(popupRef.current) return;
            if(window.profileOpen) return;

            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y =-(event.clientY / window.innerHeight) * 2 + 1;

            raycaster.setFromCamera(mouse,camera);

            const intersects = raycaster.intersectObjects(markers);

            if(intersects.length > 0){

                setSelectedNews(
                    intersects[0]
                    .object
                    .userData);
                setShowPopup(true);
            }
        }

        window.addEventListener("pointerdown", handlePointerDown);
       
        function animate(){
            requestAnimationFrame(animate);
            if(!popupRef.current){
                earth.rotation.y += 0.002;
            }
            starsMid.rotation.z += 0.00022;
            orbitControl.update();
            renderer.render(scene,camera);
        }

        animate();

        
        if(mountRef.current){
            mountRef.current.appendChild(renderer.domElement);
        }

        // makes earth refresh without throwing me to login page when news is updated
        window.refreshNews = () => fetchNews({username, earth, markers, markerGeometry, markerMaterial, degToRad, latLonToXYZ});

        
        return () => {

            window.removeEventListener("pointerdown",handlePointerDown);
            renderer.dispose();

            if(mountRef.current){
                mountRef.current.removeChild(renderer.domElement);
            }
        };

    }, []);

    return(

        <div ref={mountRef} className="relative h-screen w-screen">

            <Profile />

            {showPopup && selectedNews && (

            <div onClick={() => setShowPopup(false)} className=" absolute inset-0 flex justify-center items-center bg-black/40 z-40">

                <div onClick={(e) => e.stopPropagation()} className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 w-[400px] text-white flex flex-col gap-5 ">

                    <h1 className="text-xl font-bold">
                       {selectedNews.headline}
                    </h1>

                    <a href={selectedNews.url} target="_blank" rel="noopener noreferrer" className="bg-blue-600 hover:bg-blue-700 transition p-3 rounded-lg text-center">
                        Read Full Article
                    </a>

                    <button onClick={() => setShowPopup(false)} className="bg-red-600 hover:bg-red-700 transition p-3 rounded-lg">
                        Close
                    </button>

                </div>
            </div>
            )}
        </div>
    );
}