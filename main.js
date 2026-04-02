/* =====================================================
   APPLICATION CARTOGRAPHIQUE - MAIN.JS
   
   Description: Point d'entrée principal de l'application
   Gère l'initialisation de la carte OpenLayers et toutes
   les interactions utilisateur avec les couches vectorielles
   et les opérations archéologiques.
===================================================== */

/* =====================================================
   SECTION 1: IMPORTS DES MODULES
===================================================== */

// --- Modules locaux de l'application ---
import * as fonds from "./fonds_de_carte.js";
import * as natura from "./fonds_de_carte_natura.js";
import * as edition from "./edition.js";
import * as securite from "./securite.js";
import * as geocodage from "./geocodage.js";
import * as coordonnee from "./coordonnee.js";
import {
  // initLegendToggle,
  initCouchesTabs,
  initLegendeDynamique,
} from "./gestion-legende.js";
import GestionnairePanneaux from "./gestionnaire-panneaux.js";
import { initEchelleNumerique } from "./echelle-numerique.js";

// --- Modules OpenLayers pour la cartographie ---
import { Map, View } from "ol";
import VectorLayer from "ol/layer/Vector.js";
import LayerGroup from "ol/layer/Group.js";
import OSM from "ol/source/OSM.js";
import VectorSource from "ol/source/Vector.js";
import Cluster from "ol/source/Cluster.js";
import GeoJSON from "ol/format/GeoJSON.js";
import KML from "ol/format/KML.js";
import { Circle, Style, Stroke, Fill, Text } from "ol/style.js";
import proj4 from "proj4";
import { register } from "ol/proj/proj4.js";
import AnimatedCluster from "ol-ext/layer/AnimatedCluster.js";
import { defaults as defaultControls } from "ol/control";

/* =====================================================
   SECTION 2: CONSTANTES ET ÉLÉMENTS DOM
===================================================== */

// --- Références aux éléments HTML ---
const frmRechercheEl = document.querySelector(".frm-recherche");
const popupGaucheEl = document.querySelector("#popup");
let exportBtn = null; // Sera créé dynamiquement dans le popup-nav

// --- Références tableau résultats ---
const tableauResultatsEl = document.querySelector("#tableau-resultats");
const tableauResultatsContenuEl = document.querySelector(
  "#tableau-resultats-contenu",
);
const tableauResultatsCountEl = document.querySelector(
  "#tableau-resultats-count",
);
const btnFermerTableau = document.querySelector("#btn-fermer-tableau");

// --- Variable globale pour stocker la feature sélectionnée ---
let featureCourante = null;

// --- Variables pour la navigation entre features superposées ---
let featuresEnCours = [];
let indexFeatureCourante = 0;

// --- Tableau pour stocker toutes les couches de résultats de recherche ---
let couchesRecherche = [];

// --- Propriétés à afficher dans le popup ---
// Clés = attributs réels du GeoJSON local (noms tronqués issus du shapefile)
const tabProprietesOperation = [
  { key: "code_tranc", label: "Code :" },
  { key: "nomope", label: "Nom :" },
  { key: "typope", label: "Type :" },
  { key: "ro", label: "Resp. Opération :" },
  { key: "surface", label: "Surface :" },
  { key: "etude_geop", label: "Géophysique :" },
  { key: "date_deb_t", label: "Début terrain :" },
  { key: "date_fin_t", label: "Fin terrain :" },
  { key: "statut_con", label: "Statut contrat :" },
  { key: "statut_ope", label: "Statut opération :" },
  { key: "operateur", label: "Opérateur :" },
  { key: "notice_rap", label: "Rapport :" },
  { key: "numprescr", label: "N° prescription :" },
  { key: "date_presc", label: "Date prescription :" },
  { key: "prescripte", label: "Prescripteur :" },
  { key: "code_dept", label: "Département :" },
  { key: "nom_com", label: "Commune :" },
];

/* =====================================================
   SECTION 3: CONFIGURATION DE LA PROJECTION
===================================================== */

// --- Définition de la projection Lambert 93 (EPSG:2154) ---
proj4.defs(
  "EPSG:2154",
  "+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 " +
    "+x_0=700000 +y_0=6600000 +ellps=GRS80 +units=m +no_defs",
);
register(proj4);

/* =====================================================
   SECTION 4: CRÉATION DES GROUPES DE COUCHES
===================================================== */

// --- Groupe 1: Fonds de carte ---
const groupeFondsCarte = new LayerGroup({
  title: "Fonds de carte",
  layers: [
    fonds.osmCouche,
    fonds.planIgnWMSCouche,
    fonds.parcellaireWMSCouche,
    fonds.orthoCoucheWMS,
    fonds.geolGuyaneCoucheWMS,
    fonds.geolMartiniqueCoucheWMS,
    fonds.geolGuadStanneCoucheWMS,
    fonds.geolMetropoleCoucheWMS,
  ],
});

// --- Groupe 2: Natura 2000 (zones naturelles protégées) ---
const groupeNatura = new LayerGroup({
  title: "Natura 2000",
  layers: [
    natura.coucheWMSznieff1,
    natura.coucheWMSznieff2,
    // natura.coucheWMSSpmznieff1,
    // natura.coucheWMSBlmznieff1,
    // natura.coucheWMSGlpznieff1,
    // natura.coucheWMSGufznieff1,
    // natura.coucheWMSGufznieff2,
    // natura.coucheWMSMafznieff1,
    // natura.coucheWMSMtqznieff1,
    // natura.coucheWMSMtqznieff2,
    // natura.coucheWMSMytznieff1,
    // natura.coucheWMSMytznieff2,
    // natura.coucheWMSReuznieff1,
    // natura.coucheWMSReuznieff2,
  ],
});

// --- Groupe 3: Sécurité (risques et pollutions) ---
const groupeSecurite = new LayerGroup({
  title: "Sécurité",
  layers: [
    securite.gazWmsCouche,
    securite.basolCoucheWFS,
    securite.basolCoucheWFSPolygon,
    securite.etablissementsPollueursCoucheWFS,
    securite.bombes1gmWMSCouche,
    securite.bombes2gmWMSCouche,
    securite.ChlordeconeMartiniqueWMSCouche,
    securite.ChlordeconeGuadeloupeWMSCouche,
  ],
});

// --- Groupe 4: Opérations archéologiques (initialement vide) ---
const groupeOperations = new LayerGroup({
  title: "Opérations",
  layers: [],
  fold: "open",
});

// --- Groupe 5: Edition (initialement vide) stocke la numérisation---
export const groupeEdition = new LayerGroup({
  title: "Edition",
  layers: [],
});

/* =====================================================
   SECTION 5: INITIALISATION DE LA CARTE OPENLAYERS
===================================================== */

// --- Création de l'instance principale de la carte ---
const map = new Map({
  target: "map", // ID de l'élément HTML conteneur
  controls: defaultControls({ zoom: false }), // Désactive les boutons de zoom par défaut
  rendererOptions: {
    willReadFrequently: true, // Optimisation pour les lectures fréquentes du canvas
  },
  layers: [
    // Couche de base OpenStreetMap (masquée, remplacée par osmCouche dans le groupe Fonds de carte)
    // new TileLayer({
    //   title: "OSM",
    //   source: new OSM(),
    //   visible: false,
    //   displayInLayerSwitcher: false,
    // }),
    // Groupes de couches thématiques
    groupeFondsCarte,
    groupeNatura,
    groupeSecurite,
    groupeOperations,
    groupeEdition,
  ],
  view: new View({
    center: [261846, 6250564], // Paris en EPSG:3857
    zoom: 10,
  }),
});

// --- Ajout du contrôle de position de la souris ---
map.getControls().extend([coordonnee.mousePosition]);

/* =====================================================
   SECTION 5b: SYNCHRONISATION URL ↔ VUE CARTE
===================================================== */

/**
 * Lit les paramètres z/x/y depuis le hash de l'URL
 * et centre la carte sur ces coordonnées.
 */
function lireHashURL() {
  const hash = window.location.hash.replace("#", "");
  if (!hash) return;

  const params = Object.fromEntries(hash.split("/").map((p) => p.split("=")));

  const zoom = parseFloat(params.z);
  const x = parseFloat(params.x);
  const y = parseFloat(params.y);

  if (!isNaN(zoom) && !isNaN(x) && !isNaN(y)) {
    map.getView().setCenter([x, y]);
    map.getView().setZoom(zoom);
  }
}

/**
 * Met à jour le hash de l'URL avec le zoom et centre actuels.
 * Appelé à chaque mouvement de la carte.
 */
function ecrireHashURL() {
  const view = map.getView();
  const zoom = view.getZoom().toFixed(2);
  const [x, y] = view.getCenter().map((c) => c.toFixed(2));

  // Ne pas déclencher l'événement hashchange
  const newHash = `#z=${zoom}/x=${x}/y=${y}`;
  history.replaceState(null, "", newHash);
}

// Appliquer le hash de l'URL au chargement
lireHashURL();

// Mettre à jour le hash lors de chaque mouvement de la carte
map.getView().on("change", ecrireHashURL);

// Si l'utilisateur navigue avec Précédent/Suivant du navigateur
window.addEventListener("hashchange", lireHashURL);

/* =====================================================
   SECTION 6: INITIALISATION DES OUTILS DE LA CARTE
===================================================== */

// --- Échelle numérique ---
initEchelleNumerique(map);

// --- Logique de changement de projection avec zoom automatique ---
coordonnee.initProjectionLogic(map);

// --- Gestionnaire des panneaux latéraux ---
const gestionnairePanneaux = new GestionnairePanneaux(map);

// --- Activation du mode édition ---
edition.toggleModeEdition(map);

// --- Injecter le groupe Edition dans le module edition pour y placer la couche numérisée ---
edition.setGroupeEdition(groupeEdition);

// --- Centrage sur les résultats de géocodage ---
geocodage.centrerSurResultatGeocodageEvenement(map);

// --- Légende dynamique : réagit aux changements de visibilité des couches ---
initLegendeDynamique(map);

/* =====================================================
   SECTION 7: DÉFINITION DES STYLES DE COUCHES
===================================================== */

// --- Style pour les diagnostics archéologiques (vert) ---
const styleDiagnostic = () =>
  new Style({
    stroke: new Stroke({ color: "rgba(0,220,100,1)", width: 2 }),
    fill: new Fill({ color: "rgba(0,255,0,0.3)" }),
  });

// --- Style pour les fouilles archéologiques (violet) ---
const styleFouilles = () =>
  new Style({
    stroke: new Stroke({ color: "rgba(102,2,255,1)", width: 2 }),
    fill: new Fill({ color: "rgba(180,80,255,0.2)" }),
  });

// --- Style pour les autres types d'opérations (gris) ---
const styleAutre = () =>
  new Style({
    stroke: new Stroke({ color: "rgb(170,170,170)", width: 2 }),
    fill: new Fill({ color: "rgba(170,170,170,0.5)" }),
  });

// --- Seuil de zoom : étiquettes visibles uniquement à partir de zoom ~15 ---
const ZOOM_SEUIL_ETIQUETTES = 15;

// --- Style pour les étiquettes (code_tranc) ---
const styleEtiquette = (feature, resolution) => {
  const code = feature.get("code_tranc");
  if (!code) return null;

  const zoom = Math.log2(156543.03392804103 / resolution);
  if (zoom < ZOOM_SEUIL_ETIQUETTES) return null;

  const isRapportRendu = feature.get("statut_ope") === "Rapport Rendu";

  const textStyle = {
    text: code,
    font: "bold 12px Arial",
    fill: new Fill({ color: "#333" }),
    stroke: new Stroke({ color: "white", width: 3 }),
    overflow: true,
    declutterMode: "declutter",
  };

  if (isRapportRendu) {
    textStyle.backgroundFill = new Fill({ color: "rgba(255,255,255,0.0)" });
    textStyle.backgroundStroke = new Stroke({
      color: "red",
      width: 2,
      lineDash: [3, 5],
    });
    textStyle.padding = [2, 4, 2, 4];
  }

  return new Style({ text: new Text(textStyle) });
};

// --- Utilitaire : tableau de styles sans null ---
const avecEtiquette = (baseStyle, feature, resolution) => {
  const etiquette = styleEtiquette(feature, resolution);
  return etiquette ? [baseStyle, etiquette] : [baseStyle];
};

/* =====================================================
   SECTION 8: SOURCES ET COUCHES VECTEUR (GeoJSON local)
===================================================== */

// --- Format GeoJSON : projection source explicite EPSG:3857 ---
// Les fichiers locaux sont déjà en EPSG:3857 (même SRS que la carte).
const formatGeoJSON = new GeoJSON({
  dataProjection: "EPSG:3857",
  featureProjection: "EPSG:3857",
});

// --- Source des prescriptions archéologiques ---
const prescriptionSource = new VectorSource({
  format: formatGeoJSON,
  url: `${import.meta.env.BASE_URL}data/prescription_archeologique.geojson`,
});

// --- Couche 1: Diagnostics ---
const coucheDiagnostic = new VectorLayer({
  title: "Diagnostics",
  source: prescriptionSource,
  style: (f, resolution) =>
    ["Diagnostic", "Evaluation", "Sauvetage"].includes(f.get("typope"))
      ? avecEtiquette(styleDiagnostic(), f, resolution)
      : null,
  visible: true,
  zIndex: 10,
  declutter: true,
});

// --- Couche 2: Fouilles ---
const coucheFouilles = new VectorLayer({
  title: "Fouilles",
  source: prescriptionSource,
  style: (f, resolution) =>
    f.get("typope") === "Fouilles"
      ? avecEtiquette(styleFouilles(), f, resolution)
      : null,
  visible: true,
  zIndex: 10,
  declutter: true,
});

// --- Couche 3: Autres opérations ---
const coucheAutres = new VectorLayer({
  title: "Autres opérations",
  source: prescriptionSource,
  style: (f, resolution) =>
    !["Fouilles", "Diagnostic", "Evaluation", "Sauvetage"].includes(
      f.get("typope"),
    )
      ? avecEtiquette(styleAutre(), f, resolution)
      : null,
  visible: true,
  zIndex: 10,
  declutter: true,
});

/* =====================================================
   SECTION 9: CLUSTERING DES OPÉRATIONS
===================================================== */

// --- Source des centroïdes des prescriptions (GeoJSON local EPSG:3857) ---
const centroidePrescriptionSource = new VectorSource({
  format: formatGeoJSON,
  url: `${import.meta.env.BASE_URL}data/prescription_centroide.geojson`,
});

// --- Source de clustering ---
const clusterOperationSource = new Cluster({
  distance: 28, // Distance de regroupement en pixels
  minDistance: 3, // Distance minimale entre clusters
  source: centroidePrescriptionSource,
});

// --- Couche de cluster animée ---
const clusterCouche = new AnimatedCluster({
  source: clusterOperationSource,
  title: "Clusters",
  animationDuration: 1000,
  visible: true,
  zIndex: 100,
  minResolution: 15,
  style: function (f) {
    const nombre = f.get("features").length;

    // --- Gradient de couleur selon le nombre de features ---
    function couleurCluster(nb) {
      // Couleur de départ (peu de features) : rgb(168, 137, 230) - violet clair
      // Couleur d'arrivée (beaucoup de features) : rgb(177, 160, 204) - violet foncé
      const max = 40; // Seuil au-delà duquel la couleur est à son maximum
      const t = Math.min(nb / max, 1); // Ratio entre 0 et 1

      const r = Math.round(168 + t * (80 - 168)); // 168 → 80
      const g = Math.round(137 + t * (30 - 137)); // 137 → 30
      const b = Math.round(230 + t * (160 - 230)); // 230 → 160

      return `rgb(${r}, ${g}, ${b})`;
    }

    // --- Taille de la police selon le nombre ---
    function calculerTaillePolice(nb) {
      if (nb < 10) return "14";
      if (nb < 100) return "12";
      if (nb < 1000) return "10";
      return "8";
    }

    const tailleFontCluster = calculerTaillePolice(nombre);

    return new Style({
      text: new Text({
        text: nombre.toString(),
        font: `${tailleFontCluster}px sans-serif`,
        fill: new Fill({
          color: "snow",
        }),
      }),
      image: new Circle({
        radius: 12,
        stroke: new Stroke({
          color: "black",
        }),
        fill: new Fill({
          color: couleurCluster(nombre),
        }),
      }),
    });
  },
});

/* =====================================================
   SECTION 10: AJOUT DES COUCHES À LA CARTE
===================================================== */

// --- Ajout des couches vectorielles au groupe Opérations -> ajoute sur la carte---
groupeOperations.getLayers().push(coucheAutres);
groupeOperations.getLayers().push(coucheDiagnostic);
groupeOperations.getLayers().push(coucheFouilles);

// --- Ajout du cluster directement à la carte ---
map.addLayer(clusterCouche);

// --- Initialisation du gestionnaire de couches avec délai ---
setTimeout(() => {
  initGestionnaireCouches();
  initCouchesTabs();
}, 100);

// /* =====================================================
// SECTION 10b: MASQUAGE DES COUCHES CLUSTERS & OPERATIONS AU DÉZOOM
// =====================================================
// ===================================================== */
const SeuilResolution = 60;

map.on("moveend", () => {
  //resolution sup à 60 = zoom éloigné, clusters visibles, opérations masquées
  if (map.getView().getResolution() > SeuilResolution) {
    groupeOperations.setVisible(false);
    clusterCouche.setVisible(true);
    //resolution inf à 60 = zoom rapproché, clusters masqués, opérations visibles
  } else {
    groupeOperations.setVisible(true);
    clusterCouche.setVisible(false);
  }
});

/* =====================================================
   SECTION 11: GESTIONNAIRE DE COUCHES PERSONNALISÉ
===================================================== */

/**
 * Initialise l'interface de gestion des couches (layer switcher)
 * Crée une arborescence interactive avec groupes et couches
 */
function initGestionnaireCouches() {
  const conteneurCouches = document.getElementById("custom-layer-switcher");
  if (!conteneurCouches) return;

  //let currentOpenGroup = null

  /**
   * Crée l'interface HTML complète du gestionnaire de couches.
   * Nettoie les anciens listeners OpenLayers avant de reconstruire.
   */
  function creerInterfaceCouches() {
    // Déclencher le nettoyage des listeners OL sur les anciens éléments
    conteneurCouches.querySelectorAll(".layer-item").forEach((el) => {
      el.dispatchEvent(new Event("remove-listener"));
    });
    conteneurCouches.innerHTML = "";

    // --- Parcours de toutes les couches de la carte ---
    map.getLayers().forEach((layer) => {
      // Ignorer les couches marquées comme non affichables
      if (layer.get("displayInLayerSwitcher") === false) return;

      // --- Traitement des groupes de couches ---
      if (layer.getLayers) {
        const groupDiv = document.createElement("div");
        groupDiv.className = "layer-group";

        const groupTitle = layer.get("title") || "Sans titre";
        const isOperationsGroup = groupTitle === "Opérations";
        const isEditionGroup = groupTitle === "Edition";
        // Le groupe Edition s'ouvre automatiquement s'il contient des couches
        const editionAvecCouches =
          isEditionGroup && layer.getLayers().getLength() > 0;

        // --- En-tête du groupe ---
        const groupHeader = document.createElement("div");
        groupHeader.className = "layer-group-header";

        // Checkbox pour activer/désactiver tout le groupe
        const groupCheckbox = document.createElement("input");
        groupCheckbox.type = "checkbox";
        groupCheckbox.className = "group-checkbox";
        groupCheckbox.checked = true;

        // Titre du groupe
        const titleSpan = document.createElement("span");
        titleSpan.className = "group-title";
        titleSpan.textContent = groupTitle;

        // Icône de toggle (expand/collapse)
        const toggleSpan = document.createElement("span");
        toggleSpan.className = "group-toggle";

        groupHeader.appendChild(groupCheckbox);
        groupHeader.appendChild(titleSpan);
        groupHeader.appendChild(toggleSpan);

        // --- Conteneur des couches du groupe ---
        const layersContainer = document.createElement("div");
        layersContainer.className = "layer-group-items";

        // Le groupe Opérations est ouvert par défaut ; le groupe Edition s'ouvre s'il a des couches
        if (!isOperationsGroup && !editionAvecCouches) {
          layersContainer.classList.add("collapsed");
        } else {
          groupHeader.classList.add("expanded");
        }

        // --- Gestion du clic sur l'en-tête (expand/collapse) ---
        groupHeader.addEventListener("click", (e) => {
          // Si clic sur la checkbox, ne pas gérer le toggle
          if (e.target === groupCheckbox) {
            return;
          }

          const isCurrentlyOpen =
            !layersContainer.classList.contains("collapsed");

          // Fermer tous les autres groupes
          document
            .querySelectorAll(".layer-group-items")
            .forEach((container) => {
              if (container !== layersContainer) {
                container.classList.add("collapsed");
              }
            });

          document.querySelectorAll(".layer-group-header").forEach((header) => {
            if (header !== groupHeader) {
              header.classList.remove("expanded");
            }
          });

          // Toggle le groupe actuel
          if (isCurrentlyOpen) {
            layersContainer.classList.add("collapsed");
            groupHeader.classList.remove("expanded");
          } else {
            layersContainer.classList.remove("collapsed");
            groupHeader.classList.add("expanded");
          }
        });

        // --- Gestion de la checkbox du groupe ---
        groupCheckbox.addEventListener("change", (e) => {
          e.stopPropagation();
          const isChecked = groupCheckbox.checked;

          // Activer/désactiver toutes les couches du groupe
          layer.getLayers().forEach((couche) => {
            couche.setVisible(isChecked);
          });

          // Synchroniser les checkboxes des couches individuelles
          layersContainer
            .querySelectorAll('input[type="checkbox"]')
            .forEach((cb) => {
              cb.checked = isChecked;
            });

          map.render();
        });

        // --- Ajout des couches individuelles ---
        layer.getLayers().forEach((couche) => {
          const layerItem = creerElementCouche(couche, groupCheckbox);
          if (layerItem) layersContainer.appendChild(layerItem);
        });

        groupDiv.appendChild(groupHeader);
        groupDiv.appendChild(layersContainer);

        // Masquer le groupe Edition s'il ne contient aucune couche
        if (isEditionGroup && layer.getLayers().getLength() === 0) {
          groupDiv.style.display = "none";
        }

        conteneurCouches.appendChild(groupDiv);
      }
    });
  }

  /**
   * Crée un élément HTML pour une couche individuelle
   * @param {Layer} couche - La couche OpenLayers
   * @param {HTMLInputElement} groupCheckbox - Checkbox du groupe parent
   * @returns {HTMLElement|null} - L'élément HTML créé
   */
  function creerElementCouche(couche, groupCheckbox) {
    if (couche.get("displayInLayerSwitcher") === false) return null;

    const layerDiv = document.createElement("div");
    layerDiv.className = "layer-item";

    // --- Checkbox de visibilité ---
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = couche.getVisible();
    checkbox.id = `layer-${couche.ol_uid}`;

    // --- Label du nom de la couche ---
    const label = document.createElement("label");
    label.htmlFor = checkbox.id;
    label.textContent = couche.get("title") || "Sans titre";

    // --- Container pour les contrôles ---
    const controlsContainer = document.createElement("div");
    controlsContainer.className = "layer-controls";

    // --- Contrôle d'opacité (slider) ---
    const opacityContainer = document.createElement("div");
    opacityContainer.className = "opacity-control";

    const opacityLabel = document.createElement("span");
    opacityLabel.className = "opacity-label";
    opacityLabel.textContent = "Opacité:";

    const opacitySlider = document.createElement("input");
    opacitySlider.type = "range";
    opacitySlider.min = "0";
    opacitySlider.max = "100";
    opacitySlider.value = Math.round((couche.getOpacity() || 1) * 100);
    opacitySlider.className = "opacity-slider";
    opacitySlider.title = `Opacité: ${opacitySlider.value}%`;

    const opacityValue = document.createElement("span");
    opacityValue.className = "opacity-value";
    opacityValue.textContent = `${opacitySlider.value}%`;

    // --- Événement de modification de l'opacité ---
    opacitySlider.addEventListener("input", (e) => {
      const value = parseInt(e.target.value);
      couche.setOpacity(value / 100);
      opacityValue.textContent = `${value}%`;
      opacitySlider.title = `Opacité: ${value}%`;
      map.render();
    });

    opacityContainer.appendChild(opacityLabel);
    opacityContainer.appendChild(opacitySlider);
    opacityContainer.appendChild(opacityValue);

    // --- Événement de changement de visibilité ---
    checkbox.addEventListener("change", () => {
      couche.setVisible(checkbox.checked);

      // Vérifier l'état de toutes les couches du groupe
      const parent = layerDiv.parentElement;
      const allCheckboxes = parent.querySelectorAll(
        '.layer-item input[type="checkbox"]',
      );
      const allChecked = Array.from(allCheckboxes).every((cb) => cb.checked);
      const anyChecked = Array.from(allCheckboxes).some((cb) => cb.checked);

      // Mettre à jour la checkbox du groupe
      if (groupCheckbox) {
        groupCheckbox.checked = allChecked;
        groupCheckbox.indeterminate = !allChecked && anyChecked;
      }

      map.render();
    });

    // --- Synchronisation bidirectionnelle de la visibilité ---
    // On stocke la clé du listener pour pouvoir le retirer si besoin
    const onVisibleChange = () => {
      checkbox.checked = couche.getVisible();
      // Mettre à jour l'état indeterminate du groupe
      if (groupCheckbox) {
        const parent = layerDiv.parentElement;
        if (parent) {
          const allCheckboxes = parent.querySelectorAll(
            '.layer-item input[type="checkbox"]',
          );
          const allChecked = Array.from(allCheckboxes).every(
            (cb) => cb.checked,
          );
          const anyChecked = Array.from(allCheckboxes).some((cb) => cb.checked);
          groupCheckbox.checked = allChecked;
          groupCheckbox.indeterminate = !allChecked && anyChecked;
        }
      }
    };
    couche.on("change:visible", onVisibleChange);
    // Nettoyage du listener quand l'élément est retiré du DOM
    layerDiv.addEventListener("remove-listener", () => {
      couche.un("change:visible", onVisibleChange);
    });

    // --- Assemblage de l'élément ---
    const firstDiv = document.createElement("div");
    firstDiv.appendChild(checkbox);
    firstDiv.appendChild(label);

    layerDiv.appendChild(firstDiv);
    layerDiv.appendChild(opacityContainer);

    // --- Boutons d'action pour les couches de recherche (sous l'opacité) ---
    if (couche.get("isRechercheLayer")) {
      const actionsDiv = document.createElement("div");
      actionsDiv.className = "layer-recherche-actions";

      // Bouton afficher/masquer le tableau
      const tableBtn = document.createElement("button");
      tableBtn.className = "layer-table-btn";
      tableBtn.title = "Ouvrir la table des attributs";
      tableBtn.innerHTML = '<i class="fa-solid fa-table"></i>';
      tableBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const features = couche.getSource().getFeatures();
        if (tableauResultatsEl.classList.contains("hidden")) {
          afficherTableauResultats(features);
        } else {
          tableauResultatsEl.classList.add("hidden");
        }
      });

      // Bouton supprimer la sélection
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "layer-delete-btn";
      deleteBtn.title = "Supprimer cette sélection";
      deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (groupeOperations.getLayers())
          groupeOperations.getLayers().remove(couche);
        if (groupeEdition.getLayers()) groupeEdition.getLayers().remove(couche);

        const idx = couchesRecherche.indexOf(couche);
        if (idx !== -1) couchesRecherche.splice(idx, 1);
        tableauResultatsEl?.classList.add("hidden");
      });

      actionsDiv.appendChild(tableBtn);
      actionsDiv.appendChild(deleteBtn);
      layerDiv.appendChild(actionsDiv);
    }

    // --- Boutons d'action pour la couche de numérisation (Edition) ---
    if (couche.get("isEditionLayer")) {
      const actionsDiv = document.createElement("div");
      actionsDiv.className = "layer-recherche-actions";

      // Bouton Export KML
      const kmlBtn = document.createElement("button");
      kmlBtn.className = "layer-table-btn";
      kmlBtn.title = "Exporter en KML";
      kmlBtn.innerHTML = '<i class="fa-solid fa-file-export"></i> KML';
      kmlBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        edition.exporterKml();
      });

      // Bouton Supprimer la couche numérisée
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "layer-delete-btn";
      deleteBtn.title = "Supprimer la couche de numérisation";
      deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!confirm("Supprimer toutes les géométries numérisées ?")) return;
        if (groupeEdition.getLayers()) groupeEdition.getLayers().remove(couche);
      });

      actionsDiv.appendChild(kmlBtn);
      actionsDiv.appendChild(deleteBtn);
      layerDiv.appendChild(actionsDiv);
    }

    return layerDiv;
  }

  // --- Création initiale de l'interface ---
  creerInterfaceCouches();

  // --- Réactualisation automatique lors de l'ajout/suppression de couches ---
  map.getLayers().on("add", () => creerInterfaceCouches());
  map.getLayers().on("remove", () => creerInterfaceCouches());

  // --- Réactualisation lors des changements dans le groupe Opérations ---
  groupeOperations.getLayers().on("add", () => creerInterfaceCouches());
  groupeOperations.getLayers().on("remove", () => creerInterfaceCouches());

  // --- Réactualisation lors des changements dans le groupe Edition ---
  groupeEdition.getLayers().on("add", () => creerInterfaceCouches());
  groupeEdition.getLayers().on("remove", () => creerInterfaceCouches());
}

/* =====================================================
   SECTION 12: LÉGENDE PERSONNALISÉE
===================================================== */

/**
 * Initialise la légende de la carte
 * Affiche les symboles et leur signification
 */
// function initLegende() {
//   const legendContainer = document.getElementById("legend-container")
//   if (!legendContainer) return

//   const legendHTML = `

//     <div class="legend-content">
//       <div class="legend-item">
//         <div class="legend-symbol">
//         <div class="legend-box rapport-rendu-symbol"></div>
//       </div>
//       <div class="legend-label">Rapport rendu</div>
//       </div>
//     </div>
//   `

//   legendContainer.innerHTML = legendHTML
// }

// // Délai pour s'assurer que le DOM est prêt
// setTimeout(() => initLegende(), 500)

/* =====================================================
   SECTION 13: INTERACTION CARTE -> POPUP
===================================================== */

/**
 * Gestion du clic sur la carte
 * Affiche les informations de la feature cliquée
 */
// --- Désactivation des outils de dessin à la fermeture du panel numérisation ---
document.addEventListener("numerisation-closed", () => {
  const boutons = [
    edition.symbolPolygon,
    edition.symbolLine,
    edition.symbolModify,
    edition.symbolCross,
  ];
  // Cliquer sur le bouton actif pour déclencher la désactivation propre (nettoie les interactions)
  const boutonActif = boutons.find((b) => b && b.classList.contains("actif"));
  if (boutonActif) {
    boutonActif.click();
  }
});

map.on("singleclick", (e) => {
  // --- Ne pas traiter le clic si un outil de numérisation est actif ---
  if (edition.estOutilActif()) return;

  // --- Vérifier si on a cliqué sur un cluster ---
  const clusterFeature = map.forEachFeatureAtPixel(
    e.pixel,
    (feature, layer) => {
      if (layer === clusterCouche) {
        return feature;
      }
    },
    { hitTolerance: 5 },
  );

  // --- Traitement du clic sur un cluster ---
  if (clusterFeature) {
    const features = clusterFeature.get("features");

    // Si plusieurs features: zoomer sur le cluster
    if (features && features.length > 1) {
      const extent = clusterFeature.getGeometry().getExtent();
      map.getView().fit(extent, {
        duration: 500,
        padding: [50, 50, 50, 50],
        maxZoom: map.getView().getZoom() + 2,
      });
      return;
    }

    // Si une seule feature: afficher le popup
    if (features && features.length === 1) {
      renderPopup(features[0]);
      return;
    }
  }

  // --- Recherche des features au pixel cliqué (hors couche numérisation) ---
  const features = map.getFeaturesAtPixel(e.pixel, {
    hitTolerance: 5,
    layerFilter: (layer) => layer !== edition.vectorLayerTemp,
  });

  // Si aucune feature: réinitialiser le popup
  if (!features || !features.length) return resetPopup();

  // Stocker toutes les features superposées et afficher la première
  featuresEnCours = features;
  indexFeatureCourante = 0;
  renderPopup(features[0], features.length, 0);
});

/* =====================================================
   SECTION 14: GESTION DU POPUP
===================================================== */

/**
 * Affiche les informations d'une feature dans le popup
 * @param {Feature} feature - La feature à afficher
 * @param {number}  total   - Nombre total de features superposées
 * @param {number}  index   - Index de la feature courante
 */
function renderPopup(feature, total = 1, index = 0) {
  if (!popupGaucheEl) return;

  featureCourante = feature;

  // --- Bouton export KML (toujours présent dans la nav) ---
  const exportBtnHtml = `<button class="popup-nav-export" id="popup-export-kml" title="Exporter en KML">
    <img src="/symbols/export_file1.png" alt="export KML" /> Exporter
  </button>`;

  // --- Barre de navigation ---
  let navHtml = "";
  if (total > 1) {
    navHtml = `
      <div class="popup-nav">
        <button class="popup-nav-btn" id="popup-prev" ${index === 0 ? "disabled" : ""} title="Précédent">&#8592;</button>
        <span class="popup-nav-label">${index + 1} / ${total}</span>
        <button class="popup-nav-btn" id="popup-next" ${index === total - 1 ? "disabled" : ""} title="Suivant">&#8594;</button>
        ${exportBtnHtml}
      </div>`;
  } else {
    navHtml = `
      <div class="popup-nav popup-nav--single">
        ${exportBtnHtml}
      </div>`;
  }

  // --- Construction du tableau HTML ---
  // tabProprietesOperation est un tableau d'objets {key, label}
  // label et clé sont colocalisés : aucun risque de désynchronisation
  let html = navHtml + "<table class='tableauEl'>";

  tabProprietesOperation.forEach(({ key, label }) => {
    const v = feature.get(key);
    if (!v) return; // Ignorer les propriétés vides

    // Cas spécial pour les liens Dolia
    html +=
      key === "notice_rap"
        ? `<tr><td class="attr-label">${label}</td><td><a href="${v}" target="_blank">Lien Dolia</a></td></tr>`
        : `<tr><td class="attr-label">${label}</td><td>${v}</td></tr>`;
  });

  html += "</table>";
  popupGaucheEl.innerHTML = html;

  // --- Liaison des boutons de navigation ---
  if (total > 1) {
    document.getElementById("popup-prev")?.addEventListener("click", () => {
      if (indexFeatureCourante > 0) {
        indexFeatureCourante--;
        renderPopup(
          featuresEnCours[indexFeatureCourante],
          featuresEnCours.length,
          indexFeatureCourante,
        );
      }
    });
    document.getElementById("popup-next")?.addEventListener("click", () => {
      if (indexFeatureCourante < featuresEnCours.length - 1) {
        indexFeatureCourante++;
        renderPopup(
          featuresEnCours[indexFeatureCourante],
          featuresEnCours.length,
          indexFeatureCourante,
        );
      }
    });
  }

  // --- Liaison du bouton export KML dynamique ---
  exportBtn = document.getElementById("popup-export-kml");
  exportBtn?.addEventListener("click", exportKml);

  // --- Ouverture du panneau de sélection ---
  gestionnairePanneaux.ouvrirPanneauPublic("selection");
}

/**
 * Réinitialise le popup à son état par défaut
 */
function resetPopup() {
  if (popupGaucheEl) {
    popupGaucheEl.innerHTML =
      "<p class='popup-placeholder'>Cliquez sur une emprise pour afficher ses informations</p>";
  }

  exportBtn = null;
  featureCourante = null;
  featuresEnCours = [];
  indexFeatureCourante = 0;
}

/* =====================================================
   SECTION 15: EXPORT KML
===================================================== */

/**
 * Exporte la feature sélectionnée au format KML
 */
function exportKml() {
  if (!featureCourante) return;

  // --- Conversion de la feature en KML ---
  const kml = new KML();
  const content = kml.writeFeatures([featureCourante], {
    featureProjection: "EPSG:3857",
    dataProjection: "EPSG:4326",
  });

  // --- Création du blob et téléchargement ---
  const blob = new Blob([content], {
    type: "application/vnd.google-earth.kml+xml",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${featureCourante.get("code_tranc") || "export"}.kml`;
  a.click();
  URL.revokeObjectURL(url);
}

/* =====================================================
   SECTION 16: CONTRÔLES DE ZOOM
===================================================== */

/**
 * Gestion des boutons de zoom personnalisés
 */
const zoomInBtn = document.getElementById("zoom-in");
const zoomOutBtn = document.getElementById("zoom-out");

if (zoomInBtn && zoomOutBtn) {
  // --- Bouton Zoom In ---
  zoomInBtn.addEventListener("click", () => {
    const view = map.getView();
    const currentZoom = view.getZoom();
    view.animate({
      zoom: currentZoom + 1,
      duration: 250,
    });
  });

  // --- Bouton Zoom Out ---
  zoomOutBtn.addEventListener("click", () => {
    const view = map.getView();
    const currentZoom = view.getZoom();
    view.animate({
      zoom: currentZoom - 1,
      duration: 250,
    });
  });
}

/* =====================================================
   SECTION 17: RECHERCHE D'OPÉRATIONS
===================================================== */

/**
 * Style pour les résultats de recherche (contour rouge)
 */
function requeteStyle() {
  return new Style({
    stroke: new Stroke({
      color: "red",
      width: 3,
    }),
    fill: new Fill({
      color: "rgba(100, 100, 100, 0.2)",
    }),
  });
}

/**
 * Recherche multicritère locale sur les features de prescriptionSource.
 * Filtre en mémoire — aucune requête réseau.
 */
async function rechercheOperation() {
  const frmRechercheDonnee = new FormData(frmRechercheEl);

  const criteres = {};
  let criterePourSwitcher = "";

  for (const [clef, val] of frmRechercheDonnee.entries()) {
    const v = val.trim();
    if (v) {
      criteres[clef] = v;
      criterePourSwitcher += `${v}; `;
    }
  }

  if (Object.keys(criteres).length === 0) {
    console.warn("Aucun critère de recherche saisi");
    return;
  }

  frmRechercheEl.classList.add("searching");
  const btnSubmit = frmRechercheEl.querySelector('button[type="submit"]');
  const originalBtnText = btnSubmit?.textContent ?? "";
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Recherche...";
  }

  try {
    // Attendre que le GeoJSON soit chargé
    await new Promise((resolve, reject) => {
      if (prescriptionSource.getState() === "ready") {
        resolve();
        return;
      }
      const onchange = () => {
        const state = prescriptionSource.getState();
        if (state === "ready") {
          prescriptionSource.un("change", onchange);
          resolve();
        }
        if (state === "error") {
          prescriptionSource.un("change", onchange);
          reject(new Error("Chargement GeoJSON échoué"));
        }
      };
      prescriptionSource.on("change", onchange);
    });

    // Filtre en mémoire
    const resultats = prescriptionSource.getFeatures().filter((feature) =>
      Object.entries(criteres).every(([clef, val]) => {
        const featureVal = feature.get(clef);
        if (featureVal === undefined || featureVal === null) return false;
        const fStr = String(featureVal).toLowerCase();
        const cStr = val.toLowerCase();
        if (clef === "date_deb_t") return fStr >= cStr;
        if (clef === "date_fin_t") return fStr <= cStr;
        return fStr.includes(cStr);
      }),
    );

    console.log(`${resultats.length} résultat(s) trouvé(s)`);

    if (resultats.length === 0) {
      afficherTableauResultats([]);
    } else {
      const operationSource = new VectorSource({ features: resultats });
      const operationCouche = new VectorLayer({
        source: operationSource,
        style: (feature, resolution) => {
          const etiquette = styleEtiquette(feature, resolution);
          return etiquette ? [requeteStyle(), etiquette] : [requeteStyle()];
        },
        title: criterePourSwitcher.replace(/; $/, ""),
        zIndex: 100,
        declutter: true,
      });

      operationCouche.set("isRechercheLayer", true);
      couchesRecherche.push(operationCouche);
      groupeOperations.getLayers().push(operationCouche);

      map
        .getView()
        .fit(operationSource.getExtent(), {
          padding: [300, 300, 300, 300],
          duration: 500,
        });
      afficherTableauResultats(resultats);
    }
  } catch (error) {
    console.error("Erreur de recherche:", error.message);
  } finally {
    frmRechercheEl.classList.remove("searching");
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = originalBtnText;
    }
  }
}

/* =====================================================
   SECTION 18: ÉVÉNEMENTS DU FORMULAIRE DE RECHERCHE
===================================================== */

/**
 * Affiche le tableau des résultats dans le panneau dédié
 * @param {Array} features - Features OpenLayers à afficher
 */
function afficherTableauResultats(features) {
  if (!tableauResultatsEl || !tableauResultatsContenuEl) return;

  if (!features || features.length === 0) {
    tableauResultatsContenuEl.innerHTML = `<p class="tableau-vide">Aucun résultat trouvé pour cette recherche.</p>`;
    tableauResultatsCountEl.textContent = "(0 résultat)";
    //tableauResultatsEl.classList.remove("hidden")

    // Adapter la position du footer
    //ajusterFooter()
    //return
  }

  const entetes = {
    code_tranc: "Code tranche",
    nomope: "Nom opération",
    typope: "Type",
    ro: "R.O.",
    surface: "Surface (m²)",
    date_deb_t: "Début terrain",
    date_fin_t: "Fin terrain",
    statut_con: "Statut contractuel",
    statut_ope: "Statut opérationnel",
    operateur: "Opérateur",
    code_dept: "Dpt",
    nom_com: "Commune",
    numprescr: "N° prescription",
    prescripte: "Prescripteur",
    notice_rap: "Dolia",
  };

  const colonnes = Object.keys(entetes);

  // Construction de l'en-tête
  let html = `<table class="tableau-data">
    <thead>
      <tr>${colonnes.map((c) => `<th title="${entetes[c]}">${entetes[c]}</th>`).join("")}</tr>
    </thead>
    <tbody>`;

  // Lignes de données
  features.forEach((feature) => {
    html += "<tr>";
    colonnes.forEach((col) => {
      const val = feature.get(col);
      if (col === "notice_rap" && val) {
        html += `<td><a href="${val}" target="_blank">Voir</a></td>`;
      } else {
        html += `<td title="${val || ""}">${val !== undefined && val !== null ? val : "—"}</td>`;
      }
    });
    html += "</tr>";
  });

  html += "</tbody></table>";
  tableauResultatsContenuEl.innerHTML = html;
  tableauResultatsCountEl.textContent = `(${features.length} résultat${features.length > 1 ? "s" : ""})`;
  tableauResultatsEl.classList.remove("hidden");

  ajusterFooter();
}

/**
 * Adapte la position du footer selon la visibilité du tableau
 */
function ajusterFooter() {
  const footer = document.querySelector(".app-footer");
  if (!footer || !tableauResultatsEl) return;
  // Le tableau se positionne toujours au-dessus du footer
  tableauResultatsEl.style.bottom = `${footer.offsetHeight}px`;
}

//Fermeture du tableau
if (btnFermerTableau) {
  btnFermerTableau.addEventListener("click", () => {
    tableauResultatsEl?.classList.add("hidden");
  });
}

if (frmRechercheEl) {
  // --- Soumission du formulaire ---
  frmRechercheEl.addEventListener("submit", (e) => {
    e.preventDefault();
    rechercheOperation();
  });

  // --- Réinitialisation du formulaire ---
  const resetBtn = frmRechercheEl.querySelector('input[type="reset"]');
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      // Réinitialiser tous les datalists
      const datalists = frmRechercheEl.querySelectorAll("datalist");
      datalists.forEach((dl) => {
        dl.innerHTML = "";
      });

      console.log("Formulaire réinitialisé");
    });
  }
} else {
  console.warn("Formulaire de recherche introuvable");
}

/* =====================================================
   SECTION 19: DEBUG DÉVELOPPEMENT
===================================================== */

// --- Exposition des objets globaux en mode développement ---
if (import.meta?.env?.DEV) {
  window.map = map;
  window.gestionnairePanneaux = gestionnairePanneaux;
  window.clusterCouche = clusterCouche;
}
