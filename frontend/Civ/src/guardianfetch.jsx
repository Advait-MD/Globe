import * as THREE from 'three';
import { authFetch, errorMessage } from './api.js';

// "Latest request wins": each call to begin() returns an isCurrent() check
// that turns false as soon as a newer request starts (or cancel() is called).
// Used so a slow, older /news response can't add a second set of markers.
export function latestOnly(){
    let latest = 0;
    return {
        begin(){
            const mine = ++latest;
            return () => mine === latest;
        },
        cancel(){
            latest++;
        },
    };
}

// Fetch the signed-in user's located news from the backend.
// Throws with a readable message so the globe can show it.
export async function fetchNewsData(){
    const response = await authFetch("/news");
    const data = await response.json().catch(() => null);
    if(!response.ok){
        throw new Error(errorMessage(data, "Could not load news"));
    }
    return Array.isArray(data) ? data : [];
}

// Replace the markers on the globe with one per (article, location).
// Returns how many markers were placed.
export function placeMarkers({news, earth, markers, markerGeometry, markerMaterial, degToRad, latLonToXYZ}){

    markers.forEach(marker => earth.remove(marker));
    markers.length = 0;

    news.forEach(item => {
        // location fetching and array response check
        const locations = Array.isArray(item.Locations) ? item.Locations : [];

        locations.forEach(lo => {

            const lat = parseFloat(lo.lat);
            const lon = parseFloat(lo.lon);
            if(isNaN(lat) || isNaN(lon))
                return;

            // lat long to xyz conversion
            const { lat: rLat, lon: rLon } = degToRad(lat, lon);
            const position = latLonToXYZ(rLat, rLon, 1);
            const normal = position.clone().normalize();

            // marker forming and adding to the earth, carrying its headline and url
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            marker.userData = { headline: item.Headline, url: item.WebURL };
            marker.position.copy(position.clone().add(normal.multiplyScalar(0.05)));
            marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
            markers.push(marker);

            earth.add(marker);
        });
    });

    return markers.length;
}
