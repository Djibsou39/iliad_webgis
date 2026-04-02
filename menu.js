///////////////////////////////////////////////////////////////////////////////////////////
// Datalists du formulaire de recherche — alimentées depuis le GeoJSON local            //
// Fichier attendu : data/prescription_archeologique.geojson (à la racine du projet)   //
// Vite dev server : accès via server.fs.allow configuré dans vite_config.js            //
// GitHub Pages   : le dossier data/ est copié dans dist/ par le plugin de vite_config //
///////////////////////////////////////////////////////////////////////////////////////////

// --- Références aux éléments HTML du formulaire ---
const dataListRegionEl         = document.querySelector("#listeRegion")
const champRegionEl            = document.querySelector("#region")
const dataListCommuneEl        = document.querySelector("#listeCommunes")
const champCommuneEl           = document.querySelector("#commune")
const dataListCodeDeptEl       = document.querySelector("#listeDepartement")
const champCodeDeptEl          = document.querySelector("#departement")
const dataListCodeTrancheEl    = document.querySelector("#listeCodeTranche")
const champCodeTranche         = document.querySelector("#code-tranche")
const dataListRoElement        = document.querySelector("#listeRo")
const champNomRoEl             = document.querySelector("#ro")
const dataListOperateurElement = document.querySelector("#listeOperateur")
const champOperateurEl         = document.querySelector("#operateur")

// --- Mapping champ GeoJSON → éléments HTML ---
// champ : attribut réel du GeoJSON local (noms tronqués issus du shapefile)
const tableauParametresDesListesMenu = [
  { champ: "nom_reg",    element: champRegionEl,    datalistElement: dataListRegionEl        },
  { champ: "code_dept",  element: champCodeDeptEl,  datalistElement: dataListCodeDeptEl      },
  { champ: "nom_com",    element: champCommuneEl,   datalistElement: dataListCommuneEl       },
  { champ: "code_tranc", element: champCodeTranche, datalistElement: dataListCodeTrancheEl   },
  { champ: "ro",         element: champNomRoEl,     datalistElement: dataListRoElement       },
  { champ: "operateur",  element: champOperateurEl, datalistElement: dataListOperateurElement },
]

// --- Chemin vers le GeoJSON ---
// import.meta.env.BASE_URL = "/"               en dev local  (vite start)
//                          = "/iliad_project/" sur GitHub Pages (vite build)
const GEOJSON_URL = `${import.meta.env.BASE_URL}data/prescription_archeologique.geojson`

// --- Chargement unique du GeoJSON (cache en mémoire) ---
let featuresCache = null

async function chargerFeatures() {
  if (featuresCache) return featuresCache

  const rep = await fetch(GEOJSON_URL)

  if (!rep.ok) {
    throw new Error(
      `GeoJSON introuvable (HTTP ${rep.status}) : ${GEOJSON_URL}\n` +
      `→ Vérifier que le fichier existe à data/prescription_archeologique.geojson`
    )
  }

  // Garde-fou : Vite retourne du HTML sur les 404 en dev
  const contentType = rep.headers.get("content-type") || ""
  if (contentType.includes("text/html")) {
    throw new Error(
      `Le serveur a retourné une page HTML au lieu du GeoJSON.\n` +
      `→ Vérifier server.fs.allow dans vite_config.js et que le fichier existe.`
    )
  }

  const geojson = await rep.json()
  featuresCache = (geojson.features || []).map(f => f.properties || {})
  console.log(`menu.js — ${featuresCache.length} features chargées depuis ${GEOJSON_URL}`)
  return featuresCache
}

/**
 * Alimente une datalist avec les valeurs uniques d'un champ GeoJSON.
 * Filtrage en temps réel (startsWith, insensible à la casse).
 * Affichage de toutes les valeurs au focus avant toute saisie.
 */
function initialiserDatalist(champ, elementHtml, elementDatalist, toutesProps) {
  if (!elementHtml || !elementDatalist) return

  // Valeurs uniques non nulles, triées alphabétiquement
  const valeursUniques = [
    ...new Set(
      toutesProps
        .map(p => p[champ])
        .filter(v => v !== null && v !== undefined && String(v).trim() !== ""),
    ),
  ].sort((a, b) => String(a).localeCompare(String(b), "fr"))

  const rafraichir = () => {
    const saisie = elementHtml.value.trim().toLowerCase()
    const filtrees = saisie
      ? valeursUniques.filter(v => String(v).toLowerCase().startsWith(saisie))
      : valeursUniques

    elementDatalist.innerHTML = ""
    filtrees.forEach(val => {
      const opt = document.createElement("option")
      opt.value = String(val)
      elementDatalist.appendChild(opt)
    })
  }

  elementHtml.addEventListener("focus", rafraichir)
  elementHtml.addEventListener("input", rafraichir)
  rafraichir() // pré-remplir dès le chargement
}

// --- Point d'entrée ---
;(async () => {
  try {
    const toutesProps = await chargerFeatures()
    tableauParametresDesListesMenu.forEach(({ champ, element, datalistElement }) => {
      initialiserDatalist(champ, element, datalistElement, toutesProps)
    })
  } catch (err) {
    console.error("menu.js — Erreur chargement GeoJSON :", err.message)
  }
})()
