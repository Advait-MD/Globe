import * as THREE from 'three';

export default async function fetchNews({username, earth, markers, markerGeometry, markerMaterial, degToRad, latLonToXYZ})

{ 
    markers.forEach(marker => {
                     earth.remove(marker);
                });
    
                markers.length = 0;
    
                try{
                    const response =await fetch(`http://127.0.0.1:8000/news/${username}`);
                    const data =await response.json();
                    const safeData = Array.isArray(data)?data:[data];
    
                    safeData.forEach(news => {
    
                        const Locations = Array.isArray(news.Locations)? news.Locations : [];
    
                        Locations.forEach(lo => {
    
                            const lat = parseFloat(lo.lat);
    
                            const lon = parseFloat(lo.lon);
    
                            if(isNaN(lat) || isNaN(lon)) 
                                return;
    
                            const { lat: rLat, lon: rLon} = degToRad(lat, lon);
                            const position = latLonToXYZ( rLat, rLon,1 );
                            const normal = position.clone() .normalize();
    
                            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    
                            marker.userData = {headline: news.Headline,url:news.WebURL};
                            marker.position.copy(position.clone().add(normal.multiplyScalar(0.05)));
                            marker.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);
                            markers.push(marker);
    
                            earth.add(marker);
                        });
                    });
    
                }
    
                catch(error){
                 console.log(error);
                }
}            
    