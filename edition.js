/**
 * edition.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Module de numérisation enrichi inspiré du contrôle ol.control.Drawing du
 * plugin GpPluginOpenLayers (Géoportail pour OpenLayers).
 *
 * Fonctionnalités :
 *   • Dessin Polygone / Ligne / Point / Texte (marqueur étiqueté)
 *   • Outil "Trou" (DrawHole) pour percer un polygone existant
 *   • Modification des géométries existantes (Modify + Snap)
 *   • Suppression au clic
 *   • Sélecteur couleur contour + couleur remplissage + opacité + épaisseur
 *   • Mesure surface/longueur en temps réel (étiquette sur la géométrie)
 *   • Export KML / GeoJSON
 *   • Import KML / GeoJSON (glisser-déposer ou sélection fichier)
 *
 * API publique inchangée — main.js continue d'appeler :
 *   import * as edition from "./edition.js";
 *   edition.toggleModeEdition(map);
 * ─────────────────────────────────────────────────────────────────────────────
 */

import Draw      from "ol/interaction/Draw.js";
import Modify    from "ol/interaction/Modify.js";
import Select    from "ol/interaction/Select.js";
import Snap      from "ol/interaction/Snap.js";
import VectorSource from "ol/source/Vector.js";
import VectorLayer  from "ol/layer/Vector.js";
import { click } from "ol/events/condition.js";
import { Circle as CircleStyle, Style, Stroke, Fill, Text } from "ol/style.js";
import { LinearRing, MultiPolygon } from "ol/geom.js";
import KML     from "ol/format/KML.js";
import GeoJSON from "ol/format/GeoJSON.js";

// Référence au groupe Edition (injectée via setGroupeEdition depuis main.js)
let _groupeEdition = null;
export function setGroupeEdition(groupe) { _groupeEdition = groupe; }

// ─────────────────────────────────────────────────────────────────────────────
// ÉTAT INTERNE
// ─────────────────────────────────────────────────────────────────────────────

let draw         = null;
let modify       = null;
let select       = null;
let snap         = null;
let clickHandler = null;

let outilCourant = null; // 'polygon'|'line'|'point'|'texte'|'hole'|'modify'|'delete'|null

// Piles Undo / Redo — chaque entrée est une feature OL
const _undoPile = [];
const _redoPile = [];

export let source          = null;
export let vectorLayerTemp = null;

let styleCourant = {
  strokeColor: '#e63946',
  fillColor:   'rgba(230,57,70,0.25)',
  strokeWidth: 2,
};

let _map = null;

// Éléments DOM (peuplés dans toggleModeEdition)
let elInfoText     = null;
let elStrokeColor  = null;
let elFillColor    = null;
let elFillOpacity  = null;
let elStrokeWidth  = null;
let elInputFile    = null;
let elDropZone     = null;
let elBtnExportKml = null;
let elBtnExportGj  = null;
let elBtnClearAll  = null;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — COULEURS
// ─────────────────────────────────────────────────────────────────────────────

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function syncFillColor() {
  if (!elFillColor || !elFillOpacity) return;
  styleCourant.fillColor = hexToRgba(elFillColor.value, parseFloat(elFillOpacity.value) / 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — STYLES OL
// ─────────────────────────────────────────────────────────────────────────────

function creerStyle(geomType, mesure, selectionne = false, styleOverride = null) {
  const src = styleOverride || styleCourant;
  const strokeColor = selectionne ? '#ff8800' : src.strokeColor;
  const fillColor   = selectionne ? 'rgba(255,136,0,0.15)' : src.fillColor;
  const width       = selectionne ? (src.strokeWidth + 1) : src.strokeWidth;
  const lineDash    = selectionne ? [6, 3] : undefined;

  let textLabel = '';
  if (mesure !== null && mesure !== undefined) {
    textLabel = geomType === 'Polygon'    ? `${mesure.toFixed(0)} m\u00B2`
              : geomType === 'LineString' ? `${mesure.toFixed(0)} m`
              : '';
  }

  return new Style({
    stroke: new Stroke({ color: strokeColor, width, lineDash }),
    fill:   new Fill({ color: fillColor }),
    image:  new CircleStyle({
      radius: 6,
      fill:   new Fill({ color: strokeColor }),
      stroke: new Stroke({ color: '#ffffff', width: 2 }),
    }),
    text: textLabel ? new Text({
      font:         'bold 13px Arial, sans-serif',
      text:          textLabel,
      fill:          new Fill({ color: selectionne ? '#ff8800' : '#ffffff' }),
      stroke:        new Stroke({ color: '#000000', width: 3 }),
      overflow:      true,
      textAlign:     'center',
      textBaseline:  'middle',
    }) : undefined,
  });
}

function styleFunctionCouche(feature) {
  const geomType = feature.getGeometry().getType();
  const label    = feature.get('_label');

  // Lire le style propre à cette feature (sauvegardé au drawend)
  // ou tomber sur le style courant du panneau si absent.
  const styleFeature = {
    strokeColor: feature.get('_strokeColor') || styleCourant.strokeColor,
    fillColor:   feature.get('_fillColor')   || styleCourant.fillColor,
    strokeWidth: feature.get('_strokeWidth') ?? styleCourant.strokeWidth,
  };

  if (label) {
    return new Style({
      text: new Text({
        font:    'bold 14px Arial, sans-serif',
        text:    label,
        fill:    new Fill({ color: styleFeature.strokeColor }),
        stroke:  new Stroke({ color: '#ffffff', width: 3 }),
        offsetY: -18,
      }),
    });
  }
  return creerStyle(geomType, _calculerMesure(feature, geomType), false, styleFeature);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — MESURES
// ─────────────────────────────────────────────────────────────────────────────

function _calculerMesure(feature, geomType) {
  if (geomType === 'Polygon'      ) return feature.getGeometry().getArea();
  if (geomType === 'MultiPolygon' ) return feature.getGeometry().getArea();
  if (geomType === 'LineString'   ) return feature.getGeometry().getLength();
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// COUCHE VECTORIELLE
// ─────────────────────────────────────────────────────────────────────────────

function _assurerCouche(map) {
  // Vérifier si la couche est déjà dans le groupe Edition ou sur la carte
  if (vectorLayerTemp) {
    const dansGroupe = _groupeEdition &&
      _groupeEdition.getLayers().getArray().includes(vectorLayerTemp);
    const dansCarte = map.getLayers().getArray().includes(vectorLayerTemp);
    if (dansGroupe || dansCarte) return;
  }

  // Conserver la source existante si elle contient déjà des features
  if (!source) source = new VectorSource();

  vectorLayerTemp = new VectorLayer({
    title:          'Numérisation',
    source,
    style:          styleFunctionCouche,
    zIndex:         500,
    isEditionLayer: true,
  });

  // Placer la couche dans le groupe Edition si disponible, sinon directement sur la carte
  if (_groupeEdition) {
    _groupeEdition.getLayers().push(vectorLayerTemp);
  } else {
    map.addLayer(vectorLayerTemp);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NETTOYAGE DES INTERACTIONS
// ─────────────────────────────────────────────────────────────────────────────

function _nettoyerInteractions(map) {
  [draw, modify, select, snap].forEach(i => { if (i) map.removeInteraction(i); });
  draw = modify = select = snap = null;
  if (clickHandler) { map.un('click', clickHandler); clickHandler = null; }
  _detacherStyleListeners();
  _rebranquerControlesGlobaux();
}

// Rebrancher les contrôles du panneau sur le style global (hors sélection)
function _rebranquerControlesGlobaux() {
  if (elStrokeColor) {
    elStrokeColor.value = styleCourant.strokeColor;
  }
  if (elFillColor) {
    // Extraire la couleur hex depuis fillColor
    const hexMatch = styleCourant.fillColor.match(/#([0-9a-fA-F]{6})/);
    if (hexMatch) elFillColor.value = '#' + hexMatch[1];
  }
  if (elFillOpacity) {
    const alphaMatch = styleCourant.fillColor.match(/rgba?\([^)]*,\s*([\d.]+)\)/);
    const alpha = alphaMatch ? Math.round(parseFloat(alphaMatch[1]) * 100) : 25;
    elFillOpacity.value = String(alpha);
    const lbl = document.getElementById('num-fill-opacity-val');
    if (lbl) lbl.textContent = alpha + '%';
  }
  if (elStrokeWidth) {
    elStrokeWidth.value = String(styleCourant.strokeWidth);
    const lbl = document.getElementById('num-stroke-width-val');
    if (lbl) lbl.textContent = styleCourant.strokeWidth + ' px';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE CONTEXTUEL
// ─────────────────────────────────────────────────────────────────────────────

function _setInfo(msg) {
  if (elInfoText) elInfoText.innerHTML = msg;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODES
// ─────────────────────────────────────────────────────────────────────────────

function _activerDessin(map, geomType) {
  _nettoyerInteractions(map);
  _assurerCouche(map);

  draw = new Draw({ source, type: geomType });
  snap = new Snap({ source });
  map.addInteraction(draw);
  map.addInteraction(snap);

  draw.on('drawstart', (e) => {
    const sketch = e.feature;
    sketch.getGeometry().on('change', () => {
      sketch.setStyle(creerStyle(
        sketch.getGeometry().getType(),
        _calculerMesure(sketch, sketch.getGeometry().getType()),
      ));
    });
  });

  draw.on('drawend', (e) => {
    const f = e.feature;
    f.set('_strokeColor', styleCourant.strokeColor);
    f.set('_fillColor',   styleCourant.fillColor);
    f.set('_strokeWidth', styleCourant.strokeWidth);
    _undoPile.push(f);
    _redoPile.length = 0;
  });

  const typeLabel = geomType === 'Polygon' ? 'polygone'
                  : geomType === 'LineString' ? 'ligne' : 'point';
  _setInfo(
    `<i class="fa-solid fa-pencil" style="margin-right:5px"></i>` +
    `<strong>Dessin ${typeLabel} :</strong> Cliquez pour poser des sommets. ` +
    `<strong>Double-clic</strong> pour terminer.`
  );
}

function _activerDessinTexte(map) {
  _nettoyerInteractions(map);
  _assurerCouche(map);

  draw = new Draw({ source, type: 'Point' });
  map.addInteraction(draw);

  draw.on('drawend', (e) => {
    const pixel = _map.getPixelFromCoordinate(e.feature.getGeometry().getCoordinates());
    _ouvrirModaleTexte(pixel, (label) => {
      if (label && label.trim()) {
        e.feature.set('_label', label.trim());
        _undoPile.push(e.feature);
        _redoPile.length = 0;
      } else {
        setTimeout(() => source.removeFeature(e.feature), 0);
      }
    });
  });

  _setInfo(
    `<i class="fa-solid fa-font" style="margin-right:5px"></i>` +
    `<strong>Texte :</strong> Cliquez sur la carte pour positionner le label.`
  );
}

/**
 * Ouvre la modale de saisie texte positionnée au pixel cliqué sur la carte.
 * @param {number[]} pixel  [x, y] en coordonnées écran
 * @param {function} callback  appelé avec la valeur saisie (ou null si annulé)
 */
function _ouvrirModaleTexte(pixel, callback) {
  const overlay   = document.getElementById('num-modal-texte');
  const modal     = overlay?.querySelector('.num-modal');
  const input     = document.getElementById('num-modal-input');
  const btnOk     = document.getElementById('num-modal-ok');
  const btnCancel = document.getElementById('num-modal-cancel');
  if (!overlay || !input) { callback(null); return; }

  // Positionner la modale au pixel cliqué (décalage pour ne pas masquer le point)
  if (pixel && modal) {
    const mapEl   = _map.getTargetElement();
    const mapRect = mapEl.getBoundingClientRect();
    const OFFSET  = 12; // px de décalage par rapport au point

    let left = mapRect.left + pixel[0] + OFFSET;
    let top  = mapRect.top  + pixel[1] + OFFSET;

    // Empêcher le débordement hors de la fenêtre (largeur modale ~320px, hauteur ~160px)
    if (left + 320 > window.innerWidth)  left = mapRect.left + pixel[0] - 320 - OFFSET;
    if (top  + 160 > window.innerHeight) top  = mapRect.top  + pixel[1] - 160 - OFFSET;

    modal.style.position = 'absolute';
    modal.style.left     = `${Math.max(8, left)}px`;
    modal.style.top      = `${Math.max(8, top)}px`;
    modal.style.margin   = '0';
  }

  input.value = '';
  overlay.classList.add('visible');
  setTimeout(() => input.focus(), 50);

  function _valider() {
    _fermer();
    callback(input.value);
  }
  function _annuler() {
    _fermer();
    callback(null);
  }
  function _fermer() {
    overlay.classList.remove('visible');
    if (modal) { modal.style.left = ''; modal.style.top = ''; }
    btnOk.removeEventListener('click', _valider);
    btnCancel.removeEventListener('click', _annuler);
    overlay.removeEventListener('keydown', _keyHandler);
  }
  function _keyHandler(e) {
    if (e.key === 'Enter')  { e.preventDefault(); _valider(); }
    if (e.key === 'Escape') { e.preventDefault(); _annuler(); }
  }

  btnOk.addEventListener('click', _valider);
  btnCancel.addEventListener('click', _annuler);
  overlay.addEventListener('keydown', _keyHandler);
}

function _activerTrou(map) {
  _nettoyerInteractions(map);
  _assurerCouche(map);

  if (!source || source.getFeatures().length === 0) {
    _setInfo(
      `<i class="fa-solid fa-triangle-exclamation" style="color:#e67e22;margin-right:5px"></i>` +
      `Aucun polygone disponible. Dessinez d'abord un polygone.`
    );
    return;
  }

  let featureCible = null;
  let polygonCible = null;
  let polygonIndex = false;

  const sourceTrou = new VectorSource();
  draw = new Draw({ source: sourceTrou, type: 'Polygon' });
  map.addInteraction(draw);

  draw.on('drawstart', (evt) => {
    const coord = evt.feature.getGeometry().getCoordinates()[0][0];
    const pixel = map.getPixelFromCoordinate(coord);
    featureCible = null;

    map.forEachFeatureAtPixel(pixel, (f, l) => {
      if (l !== vectorLayerTemp) return;
      const geom = f.getGeometry();
      if (geom.getType() === 'Polygon' && geom.intersectsCoordinate(coord)) {
        polygonIndex = false; polygonCible = geom; featureCible = f;
      } else if (geom.getType() === 'MultiPolygon') {
        const polys = geom.getPolygons();
        for (let i = 0; i < polys.length; i++) {
          if (polys[i].intersectsCoordinate(coord)) {
            polygonIndex = i; polygonCible = polys[i]; featureCible = f; break;
          }
        }
      }
    }, { hitTolerance: 8 });

    if (!featureCible) {
      draw.setActive(false);
      _setInfo(
        `<i class="fa-solid fa-triangle-exclamation" style="color:#e67e22;margin-right:5px"></i>` +
        `Cliquez \u00E0 <strong>l'int\u00E9rieur</strong> d'un polygone existant pour y percer un trou.`
      );
      setTimeout(() => draw && draw.setActive(true), 150);
    }
  });

  draw.on('drawend', (evt) => {
    if (!featureCible || !polygonCible) return;
    const coords = evt.feature.getGeometry().getCoordinates()[0];
    if (coords.length < 4) return;
    const ring = new LinearRing(coords);

    if (polygonIndex !== false) {
      const geom  = featureCible.getGeometry();
      const newMP = new MultiPolygon([]);
      const polys = geom.getPolygons();
      for (let i = 0; i < polys.length; i++) {
        const p = polys[i].clone();
        if (i === polygonIndex) p.appendLinearRing(ring);
        newMP.appendPolygon(p);
      }
      featureCible.setGeometry(newMP);
    } else {
      polygonCible.appendLinearRing(ring);
    }
    featureCible = polygonCible = null;
  });

  _setInfo(
    `<i class="fa-solid fa-circle-notch" style="margin-right:5px"></i>` +
    `<strong>Trou :</strong> Cliquez \u00E0 l'int\u00E9rieur d'un polygone et tracez le contour. ` +
    `<strong>Double-clic</strong> pour valider.`
  );
}

// Référence à la feature actuellement sélectionnée pour la modification de style
let _featureSelectionnee = null;

// Listeners de style attachés pendant une session modify (à retirer au nettoyage)
let _styleListeners = [];

function _detacherStyleListeners() {
  _styleListeners.forEach(({ el, type, fn }) => el.removeEventListener(type, fn));
  _styleListeners = [];
  _featureSelectionnee = null;
}

function _attacherStyleListeners(feature) {
  _detacherStyleListeners();
  _featureSelectionnee = feature;

  // Mettre à jour les contrôles du panneau avec le style de la feature
  const sc = feature.get('_strokeColor') || styleCourant.strokeColor;
  const sw = feature.get('_strokeWidth') ?? styleCourant.strokeWidth;
  // Extraire la couleur hex du fillColor (qui peut être rgba)
  const fc = feature.get('_fillColor') || styleCourant.fillColor;
  const hexMatch = fc.match(/#([0-9a-fA-F]{6})/);

  if (elStrokeColor) elStrokeColor.value = sc;
  if (elStrokeWidth) {
    elStrokeWidth.value = String(sw);
    const lbl = document.getElementById('num-stroke-width-val');
    if (lbl) lbl.textContent = sw + ' px';
  }
  if (elFillColor && hexMatch) elFillColor.value = '#' + hexMatch[1];
  if (elFillOpacity) {
    const alphaMatch = fc.match(/rgba?\([^)]*,\s*([\d.]+)\)/);
    const alpha = alphaMatch ? Math.round(parseFloat(alphaMatch[1]) * 100) : 25;
    elFillOpacity.value = String(alpha);
    const lbl = document.getElementById('num-fill-opacity-val');
    if (lbl) lbl.textContent = alpha + '%';
  }

  // Appliquer les changements de style à la feature sélectionnée
  function appliquerStyleFeature() {
    if (!_featureSelectionnee) return;
    syncFillColor(); // met à jour styleCourant
    _featureSelectionnee.set('_strokeColor', styleCourant.strokeColor);
    _featureSelectionnee.set('_fillColor',   styleCourant.fillColor);
    _featureSelectionnee.set('_strokeWidth', styleCourant.strokeWidth);
    _featureSelectionnee.setStyle(undefined); // force recalcul via styleFunctionCouche
    vectorLayerTemp?.changed();
  }

  const handlers = [
    { el: elStrokeColor, type: 'input', fn: () => { styleCourant.strokeColor = elStrokeColor.value; appliquerStyleFeature(); } },
    { el: elFillColor,   type: 'input', fn: () => { appliquerStyleFeature(); } },
    { el: elFillOpacity, type: 'input', fn: () => { appliquerStyleFeature(); } },
    { el: elStrokeWidth, type: 'input', fn: () => { styleCourant.strokeWidth = parseInt(elStrokeWidth.value, 10) || 2; appliquerStyleFeature(); } },
  ].filter(h => h.el);

  handlers.forEach(({ el, type, fn }) => el.addEventListener(type, fn));
  _styleListeners = handlers;
}

function _activerModification(map) {
  _nettoyerInteractions(map);
  _assurerCouche(map);

  select = new Select({
    condition:    click,
    layers:       [vectorLayerTemp],
    style:        (f) => creerStyle(
      f.getGeometry().getType(),
      _calculerMesure(f, f.getGeometry().getType()),
      true,
      { strokeColor: f.get('_strokeColor') || styleCourant.strokeColor,
        fillColor:   f.get('_fillColor')   || styleCourant.fillColor,
        strokeWidth: f.get('_strokeWidth') ?? styleCourant.strokeWidth }
    ),
    hitTolerance: 7,
  });
  map.addInteraction(select);

  modify = new Modify({ features: select.getFeatures() });
  snap   = new Snap({ source });
  map.addInteraction(modify);
  map.addInteraction(snap);

  // Quand une feature est sélectionnée → brancher les contrôles de style sur elle
  select.on('select', (e) => {
    if (e.selected.length > 0) {
      _attacherStyleListeners(e.selected[0]);
      _setInfo(
        `<i class="fa-solid fa-palette" style="margin-right:5px;color:#ff8800"></i>` +
        `<strong>Objet sélectionné</strong> — modifiez la géométrie ou le style (couleurs, épaisseur) dans le panneau.`
      );
    } else {
      _detacherStyleListeners();
      // Rebrancher les contrôles sur le style courant global
      _rebranquerControlesGlobaux();
      _setInfo(
        `<i class="fa-solid fa-vector-square" style="margin-right:5px"></i>` +
        `<strong>Modifier :</strong> Cliquez sur une géométrie ` +
        `<span style="color:#ff8800;font-weight:bold">(orange)</span>, ` +
        `faites glisser un sommet ou changez son style.`
      );
    }
    e.deselected.forEach(f => f.setStyle(undefined));
  });

  modify.on('modifystart', (e) => {
    e.features.getArray().forEach(f => {
      f.getGeometry().on('change', () => {
        f.setStyle(creerStyle(f.getGeometry().getType(), _calculerMesure(f, f.getGeometry().getType()), true));
      });
    });
  });
  modify.on('modifyend', (e) => { e.features.getArray().forEach(f => f.setStyle(undefined)); });

  _setInfo(
    `<i class="fa-solid fa-vector-square" style="margin-right:5px"></i>` +
    `<strong>Modifier :</strong> Cliquez sur une géométrie ` +
    `<span style="color:#ff8800;font-weight:bold">(orange)</span>, ` +
    `faites glisser un sommet ou changez son style. Cliquez ailleurs pour désélectionner.`
  );
}

function _activerSuppression(map) {
  _nettoyerInteractions(map);
  clickHandler = (e) => {
    map.forEachFeatureAtPixel(e.pixel, (f, layer) => {
      if (layer === vectorLayerTemp) source.removeFeature(f);
    }, { hitTolerance: 7 });
  };
  map.on('click', clickHandler);
  _setInfo(
    `<i class="fa-solid fa-trash" style="margin-right:5px;color:#e26161"></i>` +
    `<strong>Supprimer :</strong> Cliquez sur une g\u00E9om\u00E9trie pour la supprimer.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT / EXPORT
// ─────────────────────────────────────────────────────────────────────────────

function _exporterKml() {
  if (!source || source.getFeatures().length === 0) { alert('Aucune géométrie à exporter.'); return; }
  const str = new KML({ extractStyles: false }).writeFeatures(source.getFeatures(), {
    dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857',
  });
  _telecharger(str, 'numerisation.kml', 'application/vnd.google-earth.kml+xml');
}

function _exporterGeoJSON() {
  if (!source || source.getFeatures().length === 0) { alert('Aucune géométrie à exporter.'); return; }
  const str = new GeoJSON().writeFeatures(source.getFeatures(), {
    dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857',
  });
  _telecharger(str, 'numerisation.geojson', 'application/geo+json');
}

function _importerFichier(file) {
  if (!file) return;
  _assurerCouche(_map);
  const reader = new FileReader();
  reader.onload = (evt) => {
    const content = evt.target.result;
    const nom     = file.name.toLowerCase();
    let features  = [];
    try {
      if (nom.endsWith('.kml')) {
        features = new KML({ extractStyles: false }).readFeatures(content, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
      } else if (nom.endsWith('.geojson') || nom.endsWith('.json')) {
        features = new GeoJSON().readFeatures(content, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
      } else {
        alert('Format non pris en charge. Utilisez KML ou GeoJSON.'); return;
      }
      source.addFeatures(features);
      if (features.length > 0) {
        _map.getView().fit(source.getExtent(), { padding: [40,40,40,40], duration: 500, maxZoom: 18 });
        _setInfo(
          `<i class="fa-solid fa-check" style="color:#2ecc71;margin-right:5px"></i>` +
          `<strong>${features.length} objet(s) importé(s)</strong> depuis <em>${file.name}</em>.`
        );
      }
    } catch (err) {
      console.error('Erreur import:', err);
      alert(`Impossible de lire le fichier : ${err.message}`);
    }
  };
  reader.readAsText(file);
}

function _telecharger(contenu, nomFichier, type) {
  const blob = new Blob([contenu], { type });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: nomFichier });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// UNDO / REDO
// ─────────────────────────────────────────────────────────────────────────────

function _undo() {
  if (!source || _undoPile.length === 0) return;
  const f = _undoPile.pop();
  source.removeFeature(f);
  _redoPile.push(f);
  _setInfo(
    `<i class="fa-solid fa-rotate-left" style="margin-right:5px;color:#3498db"></i>` +
    `Dernier objet annulé. <strong>${_undoPile.length}</strong> objet(s) dans l'historique.`
  );
}

function _redo() {
  if (!source || _redoPile.length === 0) return;
  const f = _redoPile.pop();
  source.addFeature(f);
  _undoPile.push(f);
  _setInfo(
    `<i class="fa-solid fa-rotate-right" style="margin-right:5px;color:#27ae60"></i>` +
    `Objet rétabli. <strong>${_undoPile.length}</strong> objet(s) dans l'historique.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GESTION DES BOUTONS
// ─────────────────────────────────────────────────────────────────────────────

function _desactiverTousOutils() {
  document.querySelectorAll('.num-tool').forEach(b => b.classList.remove('actif'));
  outilCourant = null;
}

function _gererBoutonOutil(map, bouton, outil) {
  bouton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (outilCourant === outil) {
      _desactiverTousOutils();
      _nettoyerInteractions(map);
      _setInfo(`<i class="fa-solid fa-hand-pointer" style="margin-right:5px;opacity:.6"></i>Sélectionnez un outil pour commencer.`);
      return;
    }

    _desactiverTousOutils();
    bouton.classList.add('actif');
    outilCourant = outil;

    switch (outil) {
      case 'polygon': _activerDessin(map, 'Polygon');    break;
      case 'line':    _activerDessin(map, 'LineString'); break;
      case 'point':   _activerDessin(map, 'Point');      break;
      case 'texte':   _activerDessinTexte(map);          break;
      case 'hole':    _activerTrou(map);                 break;
      case 'modify':  _activerModification(map);         break;
      case 'delete':  _activerSuppression(map);          break;
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT PUBLIC — API identique à l'ancienne edition.js
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialise tous les outils de numérisation.
 * Appelé depuis main.js : edition.toggleModeEdition(map)
 * @param {import('ol').Map} map
 */
export function toggleModeEdition(map) {
  _map = map;

  elInfoText    = document.querySelector('.num-info-text');
  elStrokeColor = document.getElementById('num-stroke-color');
  elFillColor   = document.getElementById('num-fill-color');
  elFillOpacity = document.getElementById('num-fill-opacity');
  elStrokeWidth = document.getElementById('num-stroke-width');
  elInputFile   = document.getElementById('num-import-file');
  elDropZone    = document.getElementById('num-drop-zone');
  elBtnExportKml = document.getElementById('num-btn-export-kml');
  elBtnExportGj  = document.getElementById('num-btn-export-gj');
  elBtnClearAll  = document.getElementById('num-btn-clear');

  const outilsDef = [
    { sel: '.num-tool-polygon', outil: 'polygon' },
    { sel: '.num-tool-line',    outil: 'line'    },
    { sel: '.num-tool-point',   outil: 'point'   },
    { sel: '.num-tool-texte',   outil: 'texte'   },
    { sel: '.num-tool-hole',    outil: 'hole'    },
    { sel: '.num-tool-modify',  outil: 'modify'  },
    { sel: '.num-tool-delete',  outil: 'delete'  },
  ];
  outilsDef.forEach(({ sel, outil }) => {
    const btn = document.querySelector(sel);
    if (btn) _gererBoutonOutil(map, btn, outil);
  });

  if (elStrokeColor) {
    elStrokeColor.value = styleCourant.strokeColor;
    elStrokeColor.addEventListener('input', () => {
      styleCourant.strokeColor = elStrokeColor.value;
      if (!_featureSelectionnee) { syncFillColor(); vectorLayerTemp?.changed(); }
    });
  }
  if (elFillColor) {
    elFillColor.value = '#e63946';
    elFillColor.addEventListener('input', () => {
      if (!_featureSelectionnee) { syncFillColor(); vectorLayerTemp?.changed(); }
    });
  }
  if (elFillOpacity) {
    elFillOpacity.addEventListener('input', () => {
      if (!_featureSelectionnee) {
        syncFillColor();
        const lbl = document.getElementById('num-fill-opacity-val');
        if (lbl) lbl.textContent = elFillOpacity.value + '%';
        vectorLayerTemp?.changed();
      }
    });
  }
  if (elStrokeWidth) {
    elStrokeWidth.value = String(styleCourant.strokeWidth);
    elStrokeWidth.addEventListener('input', () => {
      if (!_featureSelectionnee) {
        styleCourant.strokeWidth = parseInt(elStrokeWidth.value, 10) || 2;
        const lbl = document.getElementById('num-stroke-width-val');
        if (lbl) lbl.textContent = elStrokeWidth.value + ' px';
        vectorLayerTemp?.changed();
      }
    });
  }

  if (elInputFile) {
    elInputFile.addEventListener('change', (e) => { _importerFichier(e.target.files[0]); e.target.value = ''; });
  }
  if (elDropZone) {
    elDropZone.addEventListener('dragover',  (e) => { e.preventDefault(); elDropZone.classList.add('dragover'); });
    elDropZone.addEventListener('dragleave', ()  => { elDropZone.classList.remove('dragover'); });
    elDropZone.addEventListener('drop',      (e) => { e.preventDefault(); elDropZone.classList.remove('dragover'); _importerFichier(e.dataTransfer.files[0]); });
    elDropZone.addEventListener('click',     ()  => { if (elInputFile) elInputFile.click(); });
  }

  if (elBtnExportKml) elBtnExportKml.addEventListener('click', _exporterKml);
  if (elBtnExportGj)  elBtnExportGj.addEventListener('click',  _exporterGeoJSON);

  // ── Raccourcis clavier Ctrl+Z / Ctrl+Y (liés une seule fois) ────────────────
  if (!document._numKeysBound) {
    document._numKeysBound = true;
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); _undo(); }
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); _redo(); }
    });
  }


  if (elBtnClearAll) {
    elBtnClearAll.addEventListener('click', () => {
      if (!source || source.getFeatures().length === 0) return;
      if (!confirm('Supprimer toutes les géométries de la numérisation ?')) return;
      source.clear();
      _undoPile.length = 0;
      _redoPile.length = 0;
      _setInfo(`<i class="fa-solid fa-check" style="color:#2ecc71;margin-right:5px"></i>Toutes les géométries ont été supprimées.`);
    });
  }

  // Accordéon des sections repliables du panneau.
  // Utilise la classe CSS .is-open sur le body (display:none → display:flex)
  // plutôt que l'attribut HTML hidden, qui est écrasé par display:flex du CSS.
  // Délégation sur document pour être robuste quel que soit l'ordre d'init.
  if (!document._numCollapseBound) {
    document._numCollapseBound = true;
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.num-collapse-btn');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const body = document.getElementById(btn.dataset.target);
      if (!body) return;
      const isOpen = body.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(isOpen));
    });
  }

  // Désactiver tous les outils quand le panneau est fermé
  document.addEventListener('numerisation-closed', () => {
    _desactiverTousOutils();
    _nettoyerInteractions(map);
    _setInfo(`<i class="fa-solid fa-hand-pointer" style="margin-right:5px;opacity:.6"></i>Sélectionnez un outil pour commencer.`);
  });

  console.log('Numérisation (edition.js) initialisée');
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPATIBILITÉ ASCENDANTE — main.js accède encore à ces noms
// Les getters pointent vers les nouveaux boutons DOM après init.
// ─────────────────────────────────────────────────────────────────────────────

/** Exporte la couche de numérisation en KML (appelable depuis main.js) */
export function exporterKml() { _exporterKml(); }

/** Retourne true si n'importe quel outil de dessin/suppression est actif */
export function estOutilActif() {
  return outilCourant !== null;
}

/** Getters DOM — compatibles avec les .classList.contains('actif') de main.js */
export const symbolPolygon = { get classList() { return document.querySelector('.num-tool-polygon')?.classList ?? _fakeClassList; } };
export const symbolLine    = { get classList() { return document.querySelector('.num-tool-line')?.classList ?? _fakeClassList; } };
export const symbolModify  = { get classList() { return document.querySelector('.num-tool-modify')?.classList ?? _fakeClassList; } };
export const symbolCross   = { get classList() { return document.querySelector('.num-tool-delete')?.classList ?? _fakeClassList; } };

const _fakeClassList = { contains: () => false, remove: () => {}, add: () => {} };