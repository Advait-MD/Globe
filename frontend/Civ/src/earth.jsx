import {useEffect,useRef,useState} from "react";
import toast from "react-hot-toast";
import OrbitControl from "./orbitcontrol.jsx";
import { fetchNewsData, latestOnly, placeMarkers } from "./guardianfetch.jsx";
import Profile from "./profile.jsx";
import * as THREE from "three";

// A tap that moves less than this (in px) selects a marker; more is a drag.
const TAP_TOLERANCE = 6;

export default function World(){

    const mountRef = useRef(null);
    const popupRef = useRef(false);
    const refreshRef = useRef(null);
    const [selectedNews, setSelectedNews] = useState(null);
    const [showPopup, setShowPopup]= useState(false);
    const [newsStatus, setNewsStatus] = useState("loading"); // loading | ready | error
    const [newsError, setNewsError] = useState("");

    useEffect(() => { popupRef.current = showPopup;}, [showPopup]);

    useEffect(() => {

        let disposed = false;
        let frameId = null;

        // Camera, scene, material, mesh and stuff......
        const scene = new THREE.Scene();
        const camera =new THREE.PerspectiveCamera(75,window.innerWidth / window.innerHeight,0.1,5000);
        camera.position.z = 3;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        // Sharp on high-DPI phones without rendering 9x the pixels on a 3x screen.
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize( window.innerWidth, window.innerHeight );

        // texture and geometry for earth and markers
        const earthTexture = new THREE.TextureLoader().load("/graphics/earth.webp");
        // Colour textures are sRGB; without this three.js treats them as linear and they look washed out.
        earthTexture.colorSpace = THREE.SRGBColorSpace;
        const earthGeometry=new THREE.SphereGeometry(1,62,62);
        const markerGeometry =new THREE.SphereGeometry(0.04,16,16);

        // earth and marker material
        const earthMaterial =new THREE.MeshStandardMaterial({ map: earthTexture });
        const markerMaterial =new THREE.MeshStandardMaterial({color: 0xff0000 });

        const earth =new THREE.Mesh(earthGeometry, earthMaterial);

        scene.add(earth);

        // handling window resizes
        function handleResize(){

            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }

        window.addEventListener("resize", handleResize);


        // Lighting
        const light = new THREE.DirectionalLight(0xffffff,2);
        light.position.set(5,3,5);
        scene.add(light);
        const glow = new THREE.AmbientLight( 0x404040 );
        scene.add(glow);

        // Orbit Controls, listening on the canvas only
        const orbitControl = OrbitControl(camera, popupRef);
        orbitControl.init(renderer.domElement);

        // Stars in the sky for the earth specific
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

        // raycaster and some formulas of conversion
        const raycaster=new THREE.Raycaster();
        const mouse=new THREE.Vector2();

        const markers = [];

        // degree to radian conversion function
        function degToRad(lat, lon){
            return {
                lat:lat * Math.PI / 180,
                lon:lon * Math.PI / 180
            };
        }

        // lat and long to xyz conversion function
        function latLonToXYZ(lat,lon,radius){

            // Shifts longitudes so 0° lines up with Greenwich on this texture.
            const lonOffset = -0.0598;
            const x = radius * Math.cos(lat) * Math.cos(lon + lonOffset);
            const y = radius * Math.sin(lat);
            const z = radius * Math.cos(lat) * Math.sin(lon + lonOffset);

            return new THREE.Vector3(x,y,z);
        }

        // Only the newest request may draw markers: if the preference changes
        // while an older request is still in flight, the older one is discarded
        // instead of adding a second set of markers.
        const newsRequests = latestOnly();

        async function loadNews(){
            const isCurrent = newsRequests.begin();
            setNewsStatus("loading");
            try{
                const news = await fetchNewsData();
                if(disposed || !isCurrent()) return;
                const count = placeMarkers({news, earth, markers, markerGeometry, markerMaterial, degToRad, latLonToXYZ});
                setNewsStatus("ready");
                if(count === 0){
                    toast("No mappable locations in the latest stories");
                }
            }
            catch(error){
                if(disposed || !isCurrent()) return;
                setNewsError(error.message || "Could not load news");
                setNewsStatus("error");
            }
        }

        refreshRef.current = loadNews;
        loadNews();

        // A tap (not a drag) on a marker opens its story
        let pointerStart = null;

        function handlePointerDown(event){
            pointerStart = { x: event.clientX, y: event.clientY };
        }

        function handlePointerUp(event){

            if(!pointerStart || popupRef.current) return;
            const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
            pointerStart = null;
            if(moved > TAP_TOLERANCE) return;

            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y =-((event.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse,camera);

            const intersects = raycaster.intersectObjects(markers);

            if(intersects.length > 0){

                setSelectedNews(intersects[0].object.userData);
                setShowPopup(true);
            }
        }

        renderer.domElement.addEventListener("pointerdown", handlePointerDown);
        renderer.domElement.addEventListener("pointerup", handlePointerUp);

        function animate(){
            frameId = requestAnimationFrame(animate);
            if(!popupRef.current){
                earth.rotation.y += 0.002;
            }
            starsMid.rotation.z += 0.00022;
            orbitControl.update();
            renderer.render(scene,camera);
        }

        const mount = mountRef.current;
        mount?.appendChild(renderer.domElement);

        animate();

        return () => {
            disposed = true;
            newsRequests.cancel();
            refreshRef.current = null;
            cancelAnimationFrame(frameId);

            orbitControl.dispose();
            window.removeEventListener("resize", handleResize);
            renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
            renderer.domElement.removeEventListener("pointerup", handlePointerUp);

            // Free GPU memory: geometries, materials, textures, then the context itself.
            [earthGeometry, markerGeometry, starsFar.geometry, starsMid.geometry].forEach(g => g.dispose());
            [earthMaterial, markerMaterial, starsFar.material, starsMid.material].forEach(m => m.dispose());
            earthTexture.dispose();
            renderer.dispose();
            renderer.forceContextLoss();

            mount?.removeChild(renderer.domElement);
        };

    }, []);

    return(

        <div ref={mountRef} className="relative h-screen w-screen">

            <Profile onPreferenceSaved={() => refreshRef.current?.()} />

            {newsStatus !== "ready" && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 max-w-[90vw] bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-xl flex items-center gap-3 text-sm">
                    {newsStatus === "loading" ? (
                        <>
                            <span className="h-3 w-3 shrink-0 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                            <span>Fetching the latest news… the first load can take up to a minute while the server wakes up.</span>
                        </>
                    ) : (
                        <>
                            <span>{newsError}</span>
                            <button onClick={() => refreshRef.current?.()} className="bg-blue-600 hover:bg-blue-700 transition px-3 py-1 rounded-lg">
                                Retry
                            </button>
                        </>
                    )}
                </div>
            )}

            {showPopup && selectedNews && (

            <div onClick={() => setShowPopup(false)} className=" absolute inset-0 flex justify-center items-center bg-black/40 z-40">

                <div onClick={(e) => e.stopPropagation()} className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 w-[400px] max-w-[90vw] text-white flex flex-col gap-5 ">

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
