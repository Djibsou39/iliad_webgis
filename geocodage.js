import Point from "ol/geom/Point.js"

// Sélection des éléments du DOM
const frmGeocodageEL = document.querySelector(".geocodage")
const resultatGeocodageEL = document.querySelector(".resultat-geocodage")
const containerGeocodageEL = document.querySelector(".geocodage-container")
const btnRechercheLieu = document.querySelector(".symbol-lieu")

let tableauResultatGeocodage = []

/**
 * Fonction asynchrone pour interroger l'API de géocodage
 * @param {string} adresse 
 */
async function chercherAdresse(adresse) {
  try {
    const response = await fetch(
      `https://data.geopf.fr/geocodage/search?q=${adresse}&`
    )
    if (!response.ok) {
      throw new Error("HTTP error :" + response.status)
    }
    const donnees = await response.json()
    
    const adresses = donnees.features
    let html = ""
    tableauResultatGeocodage = [] // Réinitialisation du tableau

    adresses.forEach(adresse => {
      // Stockage des résultats pour usage ultérieur lors du clic
      tableauResultatGeocodage.push({
        coord: adresse.geometry.coordinates,
        id: adresse.properties.id,
      })

      // Construction de la liste HTML
      html += `
      <li data-id="${adresse.properties.id}" style="cursor: pointer; padding: 5px; border-bottom: 1px solid #eee;">
        ${adresse.properties.label}
      </li>                 
      `
    })
    console.log("Résultats géocodage:", tableauResultatGeocodage)
    return html
  } catch (erreur) {
    console.error("ERREUR lors du géocodage:", erreur)
    return `<li style="color:red">Veuillez saisir une adresse</li>`
  }
}

// Gestionnaire de soumission du formulaire
if (frmGeocodageEL) {
  frmGeocodageEL.addEventListener("submit", async e => {
    e.preventDefault()

    const frmGeocodageDonnees = new FormData(frmGeocodageEL)
    let adresse = frmGeocodageDonnees.get("adresse")
    
    // Affichage d'un état de chargement
    if(resultatGeocodageEL) resultatGeocodageEL.innerHTML = "<em>Recherche en cours...</em>"

    const html = await chercherAdresse(adresse)
    
    if (resultatGeocodageEL && html) {
      resultatGeocodageEL.innerHTML = `<ul>${html}</ul>`
    } else if (resultatGeocodageEL) {
      resultatGeocodageEL.innerHTML = "Aucun résultat trouvé."
    }
  })
}

/**
 * Centre la carte sur l'élément cliqué dans la liste
 * @param {Event} e 
 * @param {import("ol/Map").default} map 
 */
function centrerSurResultatGeocodage(e, map) {
  // On vérifie si le clic est sur un LI ou un enfant du LI
  const target = e.target.closest('li')
  if (!target) return

  const idClique = target.dataset.id
  console.log("ID cliqué:", idClique)

  if (idClique) {
    const tableauResultatGeocodageFiltre = tableauResultatGeocodage.filter(
      ele => ele.id == idClique
    )

    if (tableauResultatGeocodageFiltre.length > 0) {
      const coord = tableauResultatGeocodageFiltre[0].coord
      
      // Transformation des coordonnées (Lon/Lat vers Web Mercator) et zoom
      const geometry = new Point(coord).transform("EPSG:4326", "EPSG:3857")
      
      map.getView().fit(geometry, {
        padding: [100, 100, 100, 100],
        duration: 500,
        maxZoom: 19,
      })
    }
  }
}

/**
 * Fonction exportée appelée depuis main.js pour activer l'écouteur sur les résultats
 * @param {import("ol/Map").default} carte 
 */
export function centrerSurResultatGeocodageEvenement(carte) {
  if (resultatGeocodageEL) {
    resultatGeocodageEL.addEventListener("click", e => {
      centrerSurResultatGeocodage(e, carte)
    })
  } else {
    console.warn("Élément .resultat-geocodage introuvable")
  }
}

/////////////////////////////////////////////////
//affichage du formulaire de recherche de lieu://
/////////////////////////////////////////////////
if (btnRechercheLieu && containerGeocodageEL) {
  btnRechercheLieu.addEventListener("click", e => {
    // Bascule de l'affichage
    const isHidden = containerGeocodageEL.style.display === "none" || containerGeocodageEL.style.display === ""
    containerGeocodageEL.style.display = isHidden ? "flex" : "none"
    
    // Réinitialiser les résultats à l'ouverture/fermeture si désiré
    // resultatGeocodageEL.innerHTML = "" 
  })
}