/**
 * Module de gestion de l'échelle numérique sélectionnable
 * Remplace l'échelle graphique par une liste de zooms avec ratios d'échelle
 */

// Liste des niveaux de zoom avec leurs rapports d'échelle
// Plage: 1:500 à 1:1,000,000 (optimisé pour géophysique)
export const scaleOptions = [
  { zoom: 9, ratio: "1:1000000" },
  { zoom: 10, ratio: "1:500000" },
  { zoom: 11, ratio: "1:250000" },
  { zoom: 12, ratio: "1:150000" },
  { zoom: 13, ratio: "1:70000" },
  { zoom: 14, ratio: "1:35000" },
  { zoom: 15, ratio: "1:15000" },
  { zoom: 16, ratio: "1:8000" },
  { zoom: 17, ratio: "1:4000" },
  { zoom: 18, ratio: "1:2000" },
  { zoom: 19, ratio: "1:1000" },
  { zoom: 20, ratio: "1:500" },
];

/**
 * Initialise le sélecteur d'échelle numérique
 * @param {import("ol/Map").default} map - La carte OpenLayers
 */
export function initEchelleNumerique(map) {
  const selectEchelle = document.querySelector(".echelle-select");
  const containerEchelle = document.querySelector(".echelle-container");

  if (!selectEchelle || !containerEchelle) {
    console.warn("Éléments d'échelle numérique non trouvés dans le DOM");
    return;
  }

  // Remplir le sélecteur avec les options
  remplirSelectEchelle(selectEchelle);

  // Initialiser la valeur du sélecteur selon le zoom initial
  mettreAJourSelect(map.getView().getZoom(), selectEchelle);

  // Écouteur de changement de sélection
  selectEchelle.addEventListener("change", (e) => {
    const zoomSelecte = parseInt(e.target.value);
    const view = map.getView();
    view.animate({
      zoom: zoomSelecte,
      duration: 500,
    });
  });

  // Écouteur de changement de zoom de la carte
  map.getView().on("change:resolution", () => {
    const zoomActuel = Math.round(map.getView().getZoom());
    mettreAJourSelect(zoomActuel, selectEchelle);
  });
}

/**
 * Remplit le sélecteur avec les options d'échelle
 * @param {HTMLSelectElement} selectEchelle
 */
function remplirSelectEchelle(selectEchelle) {
  selectEchelle.innerHTML = "";

  scaleOptions.forEach((option) => {
    const optionEl = document.createElement("option");
    optionEl.value = option.zoom;
    optionEl.textContent = option.ratio;
    selectEchelle.appendChild(optionEl);
  });
}

/**
 * Met à jour la valeur du sélecteur selon le zoom actuel
 * @param {number} zoomActuel
 * @param {HTMLSelectElement} selectEchelle
 */
function mettreAJourSelect(zoomActuel, selectEchelle) {
  const zoomArrondi = Math.round(zoomActuel);
  const optionExistante = scaleOptions.find((opt) => opt.zoom === zoomArrondi);

  if (optionExistante && selectEchelle.value !== String(zoomArrondi)) {
    selectEchelle.value = zoomArrondi;
  }
}