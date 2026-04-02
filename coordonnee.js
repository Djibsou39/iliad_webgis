import MousePosition from 'ol/control/MousePosition.js'
import { createStringXY } from 'ol/coordinate.js'
import { register } from 'ol/proj/proj4.js'
import { fromLonLat } from 'ol/proj.js'
import proj4 from 'proj4'

/////////////////////////////////////////////////////////////////
// Affichage des coordonnées de la souris en différents systèmes
/////////////////////////////////////////////////////////////////

// Définitions des projections pour la France et les territoires d'outre-mer
const projections = {
  // RGF93 Lambert 93 - France métropolitaine
  'EPSG:2154': "+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
  
  // UTM Zone 20 - Antilles françaises
  'EPSG:5490': "+proj=utm +zone=20 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs",
  
  // UTM Zone 22 - Guyane
  'EPSG:2972': "+proj=utm +zone=22 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs",
  
  // UTM Zone 38 Sud - Mayotte
  'EPSG:4471': "+proj=utm +zone=38 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs",
  
  // UTM Zone 40 Sud - Réunion
  'EPSG:2975': "+proj=utm +zone=40 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs",
  
  // UTM Zone 6 Sud - Polynésie française
  'EPSG:3297': "+proj=utm +zone=6 +south +ellps=GRS80 +towgs84=0.072,-0.507,-0.245,0.0183,-0.0003,0.007,-0.0093 +units=m +no_defs +type=crs"
}

// Enregistrement de toutes les projections dans proj4
Object.entries(projections).forEach(([code, definition]) => {
  proj4.defs(code, definition)
})

// Enregistrement des projections dans OpenLayers
register(proj4)

// Définition des zones de zoom par projection
const viewSettings = {
  'EPSG:5490': { center: [-61.5, 16.2], zoom: 9 },    // Antilles (Guadeloupe/Martinique)
  'EPSG:2972': { center: [-53.0, 4.0], zoom: 7 },     // Guyane
  'EPSG:4471': { center: [45.16, -12.83], zoom: 11 }, // Mayotte
  'EPSG:2975': { center: [55.5, -21.1], zoom: 10 },   // Réunion
  'EPSG:3297': { center: [-149.5, -17.6], zoom: 8 },  // Polynésie
  'EPSG:2154': { center: [2.35, 46.6], zoom: 6 }      // France métropolitaine
}

// Liste des projections disponibles dans le sélecteur
export const projectionOptions = [
  { value: 'EPSG:3857', label: 'Web Mercator' },
  { value: 'EPSG:4326', label: 'WGS84' },
  { value: 'EPSG:2154', label: 'Lambert 93 - France' },
  { value: 'EPSG:5490', label: 'UTM 20N - Antilles' },
  { value: 'EPSG:2972', label: 'UTM 22N - Guyane' },
  { value: 'EPSG:4471', label: 'UTM 38S - Mayotte' },
  { value: 'EPSG:2975', label: 'UTM 40S - Réunion' },
  { value: 'EPSG:3297', label: 'UTM 6S - Polynésie' },
]

/**
 * Remplit le sélecteur de projection avec les options définies dans projectionOptions
 * @param {HTMLSelectElement} selectEl
 */
function remplirSelectProjection(selectEl) {
  selectEl.innerHTML = ''
  projectionOptions.forEach(({ value, label }) => {
    const option = document.createElement('option')
    option.value = value
    option.textContent = label
    selectEl.appendChild(option)
  })
}

// Récupération de l'élément DOM pour l'affichage des coordonnées
const targetElement = document.querySelector(".affichage-coordonnee")
if (!targetElement) {
  console.warn("Élément .affichage-coordonnee introuvable dans le DOM")
}

// Création du contrôle MousePosition
export const mousePosition = new MousePosition({
  className: 'custom-mouse-position',
  projection: 'EPSG:3857', // Projection par défaut (Web Mercator)
  coordinateFormat: createStringXY(2), // Format avec 2 décimales
  target: targetElement,
  undefinedHTML: '&nbsp;' // Affichage quand la souris n'est pas sur la carte
})

// Fonction utilitaire pour mettre à jour le format d'affichage des coordonnées
function updateMouseFormat(selectedProjection) {
  try {
    // Pour EPSG:4326 (WGS84), on utilise le format lon/lat
    if (selectedProjection === 'EPSG:4326') {
      mousePosition.setProjection(selectedProjection)
      mousePosition.setCoordinateFormat((coord) => {
        return `Lon: ${coord[0].toFixed(6)}°, Lat: ${coord[1].toFixed(6)}°`
      })
    } 
    // Pour les autres projections, on transforme depuis EPSG:3857
    else if (proj4.defs(selectedProjection)) {
      mousePosition.setCoordinateFormat((coord) => {
        try {
          const coordTransform = proj4('EPSG:3857', selectedProjection, coord)
          // Format avec séparateur pour meilleure lisibilité
          return `X: ${coordTransform[0].toFixed(2)} m, Y: ${coordTransform[1].toFixed(2)} m`
        } catch (error) {
          console.error('Erreur de transformation de coordonnées:', error)
          return 'Erreur de transformation'
        }
      })
    } 
    // Pour EPSG:3857 (par défaut)
    else {
      mousePosition.setProjection('EPSG:3857')
      mousePosition.setCoordinateFormat(createStringXY(2))
    }
    
    console.log(`Projection changée vers: ${selectedProjection}`)
  } catch (error) {
    console.error('Erreur lors du changement de projection:', error)
  }
}

// Initialisation de la logique de projection avec zoom automatique
export const initProjectionLogic = (map) => {
  const projectionSelectionEl = document.querySelector(".projection")

  if (projectionSelectionEl) {
    // Remplir le sélecteur avec les options
    remplirSelectProjection(projectionSelectionEl)

    // Écouteur d'événement pour le changement de projection
    projectionSelectionEl.addEventListener("change", () => {
      const selectedProjection = projectionSelectionEl.value
      
      if (selectedProjection) {
        // Mise à jour du format d'affichage des coordonnées
        updateMouseFormat(selectedProjection)

        // Zoom automatique sur la zone correspondante
        const settings = viewSettings[selectedProjection]
        if (settings) {
          map.getView().animate({
            center: fromLonLat(settings.center), // Conversion Lon/Lat vers EPSG:3857
            zoom: settings.zoom,
            duration: 1000 // Animation fluide d'une seconde
          })
        }
      }
    })
  } else {
    console.warn("Élément .projection introuvable dans le DOM")
  }
}

// Export des projections définies pour usage externe si nécessaire
export { projections }