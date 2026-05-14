function degToRad(lat, lon) {
  const latRad = lat * Math.PI / 180;
  const lonRad = lon * Math.PI / 180;
  return {latRad, lonRad};
  }

const {latRad, lonRad} = degToRad(28.6139, 77.2088);
console.log(latRad, lonRad);

function latLonToXYZ(latRad, lonRad, radius) {
  const x = radius * Math.cos(latRad) * Math.cos(lonRad);
  const y = radius * Math.cos(latRad) * Math.sin(lonRad);
  const z = radius * Math.sin(latRad);
  return {x, y, z};
}

const {x, y, z} = latLonToXYZ(latRad, lonRad, 1);
console.log(x, y, z);