import TileWMS from "ol/source/TileWMS.js"
import TileLayer from "ol/layer/Tile.js"
import TileGrid from "ol/tilegrid/TileGrid.js"
import OSM from "ol/source/OSM.js"
import proj4 from "proj4"
import { register } from "ol/proj/proj4.js"

proj4.defs(
  "EPSG:27582",
  "+proj=lcc +lat_1=45.89891888888889 +lat_2=47.69601444444444 " +
    "+lat_0=46.8 +lon_0=0 +x_0=600000 +y_0=2200000 " +
    "+ellps=clrk80ign +towgs84=-168,-60,320,0,0,0,0 +units=m +no_defs"
)
register(proj4)

//////////////////
//Affichage WMS//
/////////////////

function creerCoucheWMS(url, layer, title) {
  return new TileLayer({
    title: title,
    source: new TileWMS({
      url: url,
      params: {
        layers: layer,
      },
    }),
    visible: false,
  })
}

// cartes géologiques

export const orthoCoucheWMS = creerCoucheWMS(
  "https://data.geopf.fr/wms-r?",
  "ORTHOIMAGERY.ORTHOPHOTOS",
  "Orthophotos"
)

export const geolMartiniqueCoucheWMS = creerCoucheWMS(
  "http://geoservices.brgm.fr/geologie?",
  "GEOL_MART",
  "Géol Martinique"
)

export const geolGuyaneCoucheWMS = creerCoucheWMS(
  "http://geoservices.brgm.fr/geologie?",
  "GEOL_GUYTEST",
  "Géol Guyane"
)

export const geolGuadStanneCoucheWMS = creerCoucheWMS(
  "http://geoservices.brgm.fr/geologie?",
  "GEOL_GUAD_ANNE",
  "Géol Guadeloupe Ste Anne"
)
//////////////////
//geol metropole WMS-C, tilegrid necessaire car tuilé côté serveur//
//////////////////

const geolMetropoleWMSSource = new TileWMS({
  url: "http://geoservices.brgm.fr/WMS-C/?",
  params: {
    LAYERS: "GeologieJPG",
    TILED: true,
    FORMAT: "image/png",
  },
  tileGrid: new TileGrid({
    extent: [40428, 1600797, 1216896, 2698833.8],
    resolutions: [
      1056.633663, 528.3168317, 264.1584158, 132.0792079, 66.03960396,
      26.41584158, 13.229166668, 6.614583334, 2.645833334,
    ],
    origin: [40428, 2698833.8],
  }),
  projection: "EPSG:27582",
})

export const geolMetropoleCoucheWMS = new TileLayer({
  title: "Géol Métropole",
  source: geolMetropoleWMSSource,
  visible: false,
})

///////////////
//Parcellaire//
///////////////
export const parcellaireWMSCouche = creerCoucheWMS(
  "https://data.geopf.fr/wms-r?",
  "CADASTRALPARCELS.PARCELLAIRE_EXPRESS",
  "PCI Express"
)

//////////////
//Cartes IGN//
//////////////
export const planIgnWMSCouche = creerCoucheWMS(
  "https://data.geopf.fr/wms-r?",
  "GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2",
  "Carte IGN"
)

//////////////
// Plan OSM //
//////////////
export const osmCouche = new TileLayer({
  title: "Plan OSM",
  source: new OSM(),
  visible: true,
})