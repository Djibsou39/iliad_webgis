import TileLayer from "ol/layer/Tile.js"
import TileWMS from "ol/source/TileWMS.js"
import ImageWMS from "ol/source/ImageWMS.js"
import ImageLayer from "ol/layer/Image.js"


/* =====================================================
   URL de mapfile pour les fonds de carte Natura 2000
===================================================== */

// const url =
//   "http://caviar.inrap.fr/cgi-bin/mapserv.exe?MAP=C:/ms4w/Apache/site/mapfile/fond_iliad_natura.map&"

// function creerCoucheWMS(titre, layer) {
//   return new ImageLayer({
//     title: titre,
//     source: new ImageWMS({
//       projection: "EPSG:3857",
//       params: {
//         LAYERS: layer,
//       },
//       url: url,
//     }),
//     visible: false,
//   })
// }


// export const coucheWMSSpmznieff1 = creerCoucheWMS(
//   "znieff1 St Pierre et Miq.",
//   "znieff1_st_pierre_miquelon"
// )

// export const coucheWMSBlmznieff1 = creerCoucheWMS(
//   "znieff1 St Barth.",
//   "blm_znieff1"
// )

// export const coucheWMSGlpznieff1 = creerCoucheWMS(
//   "znieff1 guadeloupe",
//   "glp_znieff1"
// )

// export const coucheWMSGufznieff1 = creerCoucheWMS(
//   "znieff1 guyane",
//   "guf_znieff1"
// )

// export const coucheWMSGufznieff2 = creerCoucheWMS(
//   "znieff2 guyane",
//   "guf_znieff2"
// )

// export const coucheWMSMafznieff1 = creerCoucheWMS("znieff maf", "maf_znieff1")
// export const coucheWMSMtqznieff1 = creerCoucheWMS(
//   "znieff1 Martinique",
//   "mtq_znieff1"
// )
// export const coucheWMSMtqznieff2 = creerCoucheWMS(
//   "znieff2 Martinique",
//   "mtq_znieff2"
// )
// export const coucheWMSMytznieff1 = creerCoucheWMS(
//   "znieff1 Mayotte",
//   "myt_znieff1"
// )
// export const coucheWMSMytznieff2 = creerCoucheWMS(
//   "znieff2 Mayotte",
//   "myt_znieff2"
// )
// export const coucheWMSReuznieff1 = creerCoucheWMS(
//   "znieff1 Réunion",
//   "reu_znieff1"
// )
// export const coucheWMSReuznieff2 = creerCoucheWMS(
//   "znieff2 Réunion",
//   "reu_znieff2"
// )



/* ========================================================================
   URL de base de la Géoplateforme pour les fonds de carte ZNIEFF métropole
=========================================================================== */

const geoplatformeWmsUrl = "https://data.geopf.fr/wms-v/ows?"

/**
 * Crée une couche WMS depuis la Géoplateforme
 * @param {string} titre - Titre affiché dans le layer switcher
 * @param {string} layerName - Nom de la couche sur la Géoplateforme
 * @returns {TileLayer} Couche configurée
 */
function creerCoucheWMSGeoplateforme(titre, layerName) {
  return new TileLayer({
    title: titre,
    source: new TileWMS({
      url: geoplatformeWmsUrl,
      params: {
        LAYERS: layerName,
        VERSION: "1.3.0",
        FORMAT: "image/png",
        TRANSPARENT: true,
      },
      projection: "EPSG:3857",
    }),
    visible: false,
  })
}

// Export des couches ZNIEFF
export const coucheWMSznieff1 = creerCoucheWMSGeoplateforme(
  "znieff1",
  "Patrinat_ZNIEFF1_France"
)



export const coucheWMSznieff2 = creerCoucheWMSGeoplateforme(
  "znieff2",
  "Patrinat_ZNIEFF2_France"
)

