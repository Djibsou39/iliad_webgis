// Gestion de la légende et des onglets du panneau Couches

/**
 * Initialise les onglets Couches / Légende dans le panneau de gestion des couches
 */
export function initCouchesTabs() {
  const tabs = document.querySelectorAll(".couches-tab")
  const contents = document.querySelectorAll(".couches-tab-content")

  if (!tabs.length) {
    console.warn("Onglets du panneau couches introuvables")
    return
  }

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetId = tab.dataset.tab

      tabs.forEach(t => t.classList.remove("active"))
      tab.classList.add("active")

      contents.forEach(c => c.classList.remove("active"))
      const targetContent = document.getElementById(targetId)
      if (targetContent) {
        targetContent.classList.add("active")
      }

      // Rafraîchir la légende à chaque ouverture de l'onglet
      if (targetId === "tab-legende") {
        rafraichirLegende()
      }
    })
  })

  console.log("Onglets Couches/Légende initialisés")
}

// Ancienne fonction conservée pour compatibilité (ne fait plus rien)
export function initLegendToggle() {}

// ─────────────────────────────────────────────────────────────────────────────
// LÉGENDE DYNAMIQUE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Définition visuelle de chaque couche connue.
 * La clé correspond EXACTEMENT au title OL de la couche.
 * type: 'polygon' | 'line' | 'point'  | 'cluster'
 */
const STYLES_LEGENDE = {
  // ── Opérations archéologiques ──────────────────────────────────────────────
  Diagnostics: {
    label: "Diagnostics",
    type: "polygon",
    stroke: "rgba(0,220,100,1)",
    fill: "rgba(0,255,0,0.3)",
    strokeWidth: 2,
  },
  Fouilles: {
    label: "Fouilles",
    type: "polygon",
    stroke: "rgba(102,2,255,1)",
    fill: "rgba(180,80,255,0.2)",
    strokeWidth: 2,
  },
  "Autres opérations": {
    label: "Autres opérations",
    type: "polygon",
    stroke: "rgb(170,170,170)",
    fill: "rgba(170,170,170,0.5)",
    strokeWidth: 2,
  },
  Clusters: {
    label: "Clusters d'opérations",
    type: "cluster",
    color: "rgb(168,137,230)",
  },
  Recherche: {
    label: "Fouilles",
    type: "polygon",
    stroke: "rgb(255, 1, 1)",
    fill: "rgb(170,170,170)",
    strokeWidth: 2,
  },
  // ── Sécurité ───────────────────────────────────────────────────────────────
  // Titres exacts définis dans securite.js
  "bombes 1ere GM": {
    label: "Bombes 1ère GM",
    type: "point",
    stroke: "#000000",
    fill: "#cc0000",
    radius: 6,
  },
  "bombes 2eme GM": {
    label: "Bombes 2ème GM",
    type: "point",
    stroke: "#000000",
    fill: "#e67e22",
    radius: 6,
  },
  // styleIconeBasol() → icône PNG orange sur fond jaune pâle → point orange
  "sites pollués": {
    label: "Sites pollués (points)",
    type: "point",
    stroke: "rgba(200,100,0,1)",
    fill: "rgba(255,145,0,0.7)",
    radius: 6,
  },
  // stylePolyBasol() → fill orange, stroke rouge
  "surface site pollué": {
    label: "Sites pollués (polygones)",
    type: "polygon",
    stroke: "red",
    fill: "rgba(255,145,0,0.3)",
    strokeWidth: 1,
  },
  // styleIconeBasol() — même icône que Basol points
  "établissements pollueurs": {
    label: "Établissements pollueurs",
    type: "point",
    stroke: "rgba(200,100,0,1)",
    fill: "rgba(255,145,0,0.7)",
    radius: 6,
  },
  // WMS rendu serveur — représenté par une ligne (réseau linéaire)
  "Canalisations gaz": {
    label: "Canalisations gaz",
    type: "polygon",
    stroke: "#7aaed6",
    fill: "rgba(168,200,232,0.8)",
    strokeWidth: 1,
  },
  // WMS rendu serveur — représenté par un polygone générique
  "Chlordécone Martinique": {
    label: ["Chlordécone Martinique", "Chlordécone Guadeloupe"],
    type: "multiclass",
    classes: [
      {
        fill: "#1a5c1a",
        stroke: "#4c4d4c00",
        label: "Élevages et toutes cultures végétales",
      },
      {
        fill: "#0FF038",
        stroke: "#4c4d4c00",
        label: "Toutes cultures végétales",
      },
      {
        fill: "#DECF21",
        stroke: "#49494700",
        label: "Cultures sauf racines, cives, poireaux",
      },
      {
        fill: "#E76318",
        stroke: "#4c4d4c00",
        label: "Fruits, maraîchages sans contact avec le sol",
      },
    ],
  },

  // Alias — même définition que 'Chlordécone Martinique' (objet partagé)
  get "Chlordécone Guadeloupe"() {
    return this["Chlordécone Martinique"]
  },

  // ── Fonds de carte ─────────────────────────────────────────────────────────
  // Note : le groupe 'Fonds de carte' est dans GROUPES_EXCLUS.
  // Ces couches n'apparaissent pas dans la légende dynamique.

  // ── Natura 2000 / ZNIEFF ───────────────────────────────────────────────────
  // WMS rendus côté serveur — représentés par des polygones
  // Titres exacts définis dans fonds_de_carte_natura.js
  // ZNIEFF type 1 : vert vif plein (voir capture znieff1 metropole)
  znieff1: {
    label: "ZNIEFF type 1",
    type: "polygon",
    stroke: "#005a0f",
    fill: "#018714",
    strokeWidth: 1,
  },
  // ZNIEFF type 2 : vert clair pastel (voir capture znieff2 metropole)
  znieff2: {
    label: "ZNIEFF type 2",
    type: "polygon",
    stroke: "#5a875a",
    fill: "#8acd86",
    strokeWidth: 1,
  },

  // 'znieff1 St Pierre et Miq.': {
  //   label: 'ZNIEFF type 1 (St-Pierre-et-Miq.)',
  //   type: 'polygon',
  //   stroke: '#005a0f',
  //   fill: '#018714',
  //   strokeWidth: 1,
  // },
  // 'znieff1 St Barth.': {
  //   label: 'ZNIEFF type 1 (St-Barth.)',
  //   type: 'polygon',
  //   stroke: '#005a0f',
  //   fill: '#018714',
  //   strokeWidth: 1,
  // },
  // 'znieff1 guadeloupe': {
  //   label: 'ZNIEFF type 1 (Guadeloupe)',
  //   type: 'polygon',
  //   stroke: '#005a0f',
  //   fill: '#018714',
  //   strokeWidth: 1,
  // },
  // 'znieff1 guyane': {
  //   label: 'ZNIEFF type 1 (Guyane)',
  //   type: 'polygon',
  //   stroke: '#005a0f',
  //   fill: '#018714',
  //   strokeWidth: 1,
  // },
  // 'znieff2 guyane': {
  //   label: 'ZNIEFF type 2 (Guyane)',
  //   type: 'polygon',
  //   stroke: '#5a875a',
  //   fill: '#8acd86',
  //   strokeWidth: 1,
  // },
  // 'znieff maf': {
  //   label: 'ZNIEFF (St-Martin / St-Barth.)',
  //   type: 'polygon',
  //   stroke: '#005a0f',
  //   fill: '#018714',
  //   strokeWidth: 1,
  // },
  // 'znieff1 Martinique': {
  //   label: 'ZNIEFF type 1 (Martinique)',
  //   type: 'polygon',
  //   stroke: '#005a0f',
  //   fill: '#018714',
  //   strokeWidth: 1,
  // },
  // 'znieff2 Martinique': {
  //   label: 'ZNIEFF type 2 (Martinique)',
  //   type: 'polygon',
  //   stroke: '#5a875a',
  //   fill: '#8acd86',
  //   strokeWidth: 1,
  // },
  // 'znieff1 Mayotte': {
  //   label: 'ZNIEFF type 1 (Mayotte)',
  //   type: 'polygon',
  //   stroke: '#005a0f',
  //   fill: '#018714',
  //   strokeWidth: 1,
  // },
  // 'znieff2 Mayotte': {
  //   label: 'ZNIEFF type 2 (Mayotte)',
  //   type: 'polygon',
  //   stroke: '#5a875a',
  //   fill: '#8acd86',
  //   strokeWidth: 1,
  // },
  // 'znieff1 Réunion': {
  //   label: 'ZNIEFF type 1 (Réunion)',
  //   type: 'polygon',
  //   stroke: '#005a0f',
  //   fill: '#018714',
  //   strokeWidth: 1,
  // },
  // 'znieff2 Réunion': {
  //   label: 'ZNIEFF type 2 (Réunion)',
  //   type: 'polygon',
  //   stroke: '#5a875a',
  //   fill: '#8acd86',
  //   strokeWidth: 1,
  // },
}

/** Référence à l'instance Map OpenLayers, injectée via initLegendeDynamique() */
let _map = null

/** WeakSet pour éviter les doublons d'observers sur les couches */
const _observers = new WeakSet()

/**
 * Initialise la légende dynamique.
 * À appeler UNE FOIS depuis main.js après la création de la carte :
 *
 *   import { initLegendeDynamique } from './gestion-legende.js';
 *   initLegendeDynamique(map);
 *
 * @param {import('ol').Map} map - Instance de la carte OpenLayers
 */
export function initLegendeDynamique(map) {
  _map = map

  // Écouter l'ajout/suppression de couches au niveau racine
  map.getLayers().on(["add", "remove"], () => {
    _attacherObserversVisibilite()
    rafraichirLegende()
  })

  // Attacher les observers sur les couches déjà présentes
  _attacherObserversVisibilite()

  // Premier rendu
  rafraichirLegende()

  console.log("Légende dynamique initialisée")
}

/**
 * Parcourt récursivement toutes les couches et attache un écouteur
 * 'change:visible' sur chacune si pas déjà fait.
 */
function _attacherObserversVisibilite() {
  if (!_map) return

  const parcourir = collection => {
    collection.forEach(item => {
      if (!_observers.has(item)) {
        item.on("change:visible", rafraichirLegende)
        _observers.add(item)
      }
      if (item.getLayers) {
        item.getLayers().on(["add", "remove"], () => {
          _attacherObserversVisibilite()
          rafraichirLegende()
        })
        parcourir(item.getLayers().getArray())
      }
    })
  }

  parcourir(_map.getLayers().getArray())
}

/**
 * Groupes exclus de la légende dynamique (fonds raster, pas de symbologie).
 */
const GROUPES_EXCLUS = new Set(["Fonds de carte", "Edition"])

/**
 * Titres de couches individuelles exclues de la légende (ex: clusters visuels).
 */
const COUCHES_EXCLUES = new Set(["Clusters"])

/**
 * Retourne toutes les couches visibles (hors groupes exclus) avec leur groupe parent.
 * @returns {Array<{couche: Layer, groupe: LayerGroup|null}>}
 */
function _getCouchesVisibles() {
  if (!_map) return []
  const resultats = []

  const parcourir = (collection, groupeParent = null) => {
    collection.forEach(item => {
      if (item.getLayers) {
        // Ignorer complètement les groupes de la liste d'exclusion
        const titreGroupe = item.get("title") || ""
        if (GROUPES_EXCLUS.has(titreGroupe)) return
        parcourir(item.getLayers().getArray(), item)
      } else {
        if (
          item.getVisible() &&
          item.get("displayInLayerSwitcher") !== false &&
          !COUCHES_EXCLUES.has(item.get("title") || "")
        ) {
          resultats.push({ couche: item, groupe: groupeParent })
        }
      }
    })
  }

  parcourir(_map.getLayers().getArray())
  return resultats
}

/**
 * Génère le SVG ou l'icône du symbole pour une entrée de légende.
 * @param {object|null} def - Définition visuelle (STYLES_LEGENDE)
 * @returns {string} HTML
 */
function _genererSymbole(def) {
  if (!def) {
    return `<svg width="28" height="18" viewBox="0 0 28 18">
      <rect x="2" y="3" width="24" height="12" rx="2"
        fill="rgba(150,150,150,0.3)" stroke="#999" stroke-width="1.5"/>
    </svg>`
  }

  switch (def.type) {
    case "polygon": {
      const dash = def.strokeDash
        ? `stroke-dasharray="${def.strokeDash.join(" ")}"`
        : ""
      return `<svg width="28" height="18" viewBox="0 0 28 18">
        <rect x="2" y="3" width="24" height="12" rx="2"
          fill="${def.fill}" stroke="${def.stroke}"
          stroke-width="${def.strokeWidth || 2}" ${dash}/>
      </svg>`
    }
    case "line": {
      const dash = def.strokeDash
        ? `stroke-dasharray="${def.strokeDash.join(" ")}"`
        : ""
      return `<svg width="28" height="18" viewBox="0 0 28 18">
        <line x1="2" y1="9" x2="26" y2="9"
          stroke="${def.stroke}" stroke-width="${def.strokeWidth || 2}" ${dash}/>
      </svg>`
    }
    case "point": {
      const r = def.radius || 6
      return `<svg width="28" height="18" viewBox="0 0 28 18">
        <circle cx="14" cy="9" r="${r}"
          fill="${def.fill}" stroke="${def.stroke}" stroke-width="1.5"/>
      </svg>`
    }
    case "multiclass": {
      // Retourne le symbole de la première classe (l'affichage multi-lignes
      // est géré dans rafraichirLegende directement)
      return `<svg width="28" height="18" viewBox="0 0 28 18">
        <rect x="2" y="3" width="24" height="12" rx="2"
          fill="${def.classes[0].fill}" stroke="${def.classes[0].stroke}"
          stroke-width="1"/>
      </svg>`
    }
    case "cluster": {
      return `<svg width="28" height="18" viewBox="0 0 28 18">
        <circle cx="14" cy="9" r="7"
          fill="${def.color}" stroke="#333" stroke-width="1"/>
        <text x="14" y="13" text-anchor="middle"
          font-size="8" fill="white" font-family="sans-serif">n</text>
      </svg>`
    }
    default:
      return `<svg width="28" height="18" viewBox="0 0 28 18">
        <rect x="2" y="3" width="24" height="12" rx="2"
          fill="rgba(150,150,150,0.3)" stroke="#999" stroke-width="1.5"/>
      </svg>`
  }
}

/**
 * Regroupe les couches visibles par nom de groupe parent.
 * @param {Array} couchesVisibles
 * @returns {Map<string, Layer[]>}
 */
function _regrouperParGroupe(couchesVisibles) {
  const groupes = new Map()
  couchesVisibles.forEach(({ couche, groupe }) => {
    const nom = groupe ? groupe.get("title") || "Autres" : "Autres"
    if (!groupes.has(nom)) groupes.set(nom, [])
    groupes.get(nom).push(couche)
  })
  return groupes
}

/**
 * Met à jour le contenu HTML de l'onglet Légende en fonction
 * des couches actuellement visibles sur la carte.
 * Peut être appelée depuis l'extérieur pour forcer un rafraîchissement.
 */
/**
 * Bloc statique "Rapport Rendu" — affiché uniquement si une couche du groupe "Opération" est active.
 */
const LEGENDE_STATIQUE_HTML = `
  <div class="legend-group legend-group--statique">
    <div class="legend-group-title">
      <i class="fa-solid fa-file-circle-check"></i>
      Statut
    </div>
    <div class="legend-group-items">
      <div class="legend-item">
        <span class="legend-symbol">
          <span class="rapport-rendu-symbol"></span>
        </span>
        <span class="legend-label">Rapport Rendu</span>
      </div>
    </div>
  </div>`

/**
 * Vérifie si au moins une couche du groupe "Opération" est visible.
 * @returns {boolean}
 */
function _uneOperationActive() {
  if (!_map) return false

  let actif = false

  const parcourir = collection => {
    collection.forEach(item => {
      if (item.getLayers) {
        const titreGroupe = item.get("title") || ""
        if (titreGroupe === "Opérations") {
          // Vérifier si au moins une couche enfant est visible
          item
            .getLayers()
            .getArray()
            .forEach(couche => {
              if (!couche.getLayers && couche.getVisible()) {
                actif = true
              }
            })
        } else {
          parcourir(item.getLayers().getArray())
        }
      }
    })
  }

  parcourir(_map.getLayers().getArray())
  return actif
}

export function rafraichirLegende() {
  const container = document.getElementById("legend-container")
  if (!container) return

  const couchesVisibles = _getCouchesVisibles()
  let html = '<div class="legend-content">'

  if (couchesVisibles.length === 0) {
    html += `
      <p class="legend-empty">
        <i class="fa-solid fa-eye-slash" style="margin-right:6px;opacity:0.5"></i>
        Aucune couche active.<br>
        <small>Cochez des couches dans l'onglet <strong>Couches</strong>.</small>
      </p>`
  } else {
    const groupes = _regrouperParGroupe(couchesVisibles)

    groupes.forEach((couches, nomGroupe) => {
      html += `
        <div class="legend-group">
          <div class="legend-group-title">
            <i class="fa-solid fa-layer-group"></i>
            ${nomGroupe}
          </div>
          <div class="legend-group-items">`

      // Dédupliquer les couches multiclass partageant la même définition (alias getter)
      const defsDejaAffichees = new Set()
      couches.forEach(couche => {
        const titre = couche.get("title") || "Couche sans titre"
        //si la couche est une couche de résultat de recherche,
        // on utilise la clé "Recherche" pour trouver sa définition dans STYLES_LEGENDE,
        // sinon on utilise son titre
        const cleLegende = couche.get("isRechercheLayer") ? "Recherche" : titre
        const def = STYLES_LEGENDE[cleLegende]

        // Cas multiclass : afficher le titre de la couche + une ligne par classe
        if (def && def.type === "multiclass") {
          if (defsDejaAffichees.has(def)) return // alias déjà rendu → on saute
          defsDejaAffichees.add(def)

          // Si plusieurs couches du groupe partagent cette def → label générique
          const couches_liees_chlord = couches.filter(
            c => STYLES_LEGENDE[c.get("title")] === def,
          )
          const labelMulti =
            couches_liees_chlord.length > 1 ? "Chlordécone" : titre

          html += `
            <div class="legend-item legend-item--group-title">
              <span class="legend-label legend-label--couche">${labelMulti}</span>
            </div>`
          def.classes.forEach(cls => {
            const symbole = `<svg width="28" height="18" viewBox="0 0 28 18">
              <rect x="2" y="3" width="24" height="12" rx="2"
                fill="${cls.fill}" stroke="${cls.stroke}" stroke-width="1"/>
            </svg>`
            html += `
            <div class="legend-item legend-item--subclass">
              <span class="legend-symbol">${symbole}</span>
              <span class="legend-label">${cls.label}</span>
            </div>`
          })
          return
        }

        const label = couche.get("isRechercheLayer")
          ? titre.replace(/;$/, "")
          : def
            ? def.label
            : titre
        const symbole = _genererSymbole(def)

        html += `
            <div class="legend-item">
              <span class="legend-symbol">${symbole}</span>
              <span class="legend-label">${label}</span>
            </div>`
      })

      html += `
          </div>
        </div>`
    })
  }

  // Bloc "Rapport Rendu" — affiché uniquement si au moins une couche du groupe "Opération" est active
  if (_uneOperationActive()) {
    html += LEGENDE_STATIQUE_HTML
  }

  html += "</div>"
  container.innerHTML = html
}

// initCouchesTabs est appelé depuis main.js après initialisation de la carte.
