import VectorSource from "ol/source/Vector.js"
import VectorLayer from "ol/layer/Vector.js"
import GeoJSON from "ol/format/GeoJSON.js"
import { bbox as bboxStrategy } from "ol/loadingstrategy.js"
import { Circle, Style, Stroke, Fill, Text } from "ol/style.js"
import Icon from "ol/style/Icon.js"
import TileLayer from "ol/layer/Tile.js"
import TileWMS from "ol/source/TileWMS.js"
import proj4 from "proj4"
import { register } from "ol/proj/proj4.js"

// Enregistrement de EPSG:32620 (WGS84 UTM zone 20N - Guadeloupe / Antilles)
proj4.defs(
  "EPSG:32620",
  "+proj=utm +zone=20 +datum=WGS84 +units=m +no_defs +type=crs"
)
register(proj4)

function creerCoucheWFS(
  titre,
  sourceWFS,
  style,
  champ_etiquette = "nom_etablissement"
) {
  return new VectorLayer({
    title: titre,
    source: sourceWFS,
    style: (f, resolution) => [
      style,
      styleTextBasol(f, champ_etiquette, resolution),
    ],
    visible: false,
  })
}

// TileLayer découpe le WMS en tuiles côté client donc, tiled: true est à l'adresse du serveur
// qui optimisera la réponse en tuiles s'il y a du cache tuilé ;
// mais ol/source/ImageWMS et ol/layer/ImageWMS avec chargement en bloc :
// projection : si le serveur WMS n'accepte pas EPSG:3857, on passe la projection native
// OpenLayers reprojetera les tuiles reçues vers la projection de la carte
function creerWMSCouche(url, layer, code_epsg, nomCouche, projection = null) {
  return new TileLayer({
    opacity: 0.7,
    source: new TileWMS({
      url: url,
      params: {
        SERVICE: "WMS",
        VERSION: "1.3.0",
        LAYERS: layer,
        // TILED: true, // utile si le serveur supporte le TILED et a du cache pour tuiles
        FORMAT: "image/png",
        CRS: `EPSG:${code_epsg}`, // scr d'origine
      },
      serverType: "mapserver",
      gutter: 25,
      ...(projection ? { projection } : {}),
    }),
    visible: false,
    title: nomCouche,
  })
}

export const bombes2gmWMSCouche = creerWMSCouche(
  "http://caviar.inrap.fr/cgi-bin/mapserv.exe?MAP=C:/ms4w/Apache/site/mapfile/vue_prescription_pgts_wfs.map&",
  "2eme_guerre_mondiale",
  4326,
  "bombes 2eme GM"
)

export const bombes1gmWMSCouche = creerWMSCouche(
  "http://caviar.inrap.fr/cgi-bin/mapserv.exe?MAP=C:/ms4w/Apache/site/mapfile/vue_prescription_pgts_wfs.map&",
  "1ere_guerre_mondiale",
  3857,
  "bombes 1ere GM"
)

export const gazWmsCouche = creerWMSCouche(
  "http://georisques.gouv.fr/services?",
  "C_GAZ",
  3857,
  "Canalisations gaz"
)

export const ChlordeconeMartiniqueWMSCouche = creerWMSCouche(
  "http://datacarto.geomartinique.fr/wms?",
  "pref_chlordecone_analyse_sol_v2_s_972",
  3857,
  "Chlordécone Martinique"
)

export const ChlordeconeGuadeloupeWMSCouche = creerWMSCouche(
  "https://datacarto.karugeo.fr/map/l_chld_carte_dyn_971?",
  "layer31",
  32620,
  "Chlordécone Guadeloupe",
  "EPSG:32620"  // projection native du serveur Karugeo - OL reproject vers EPSG:3857
)

function styleTextBasol(f, nomChamp, resolution) {
  const valeurChamp = f.get(nomChamp)
  return new Style({
    text:
      resolution < 3
        ? new Text({
            overflow: true,
            offsetY: 30,
            font: "12px Arial",
            textBaseline: "bottom",
            stroke: new Stroke({
              color: "black",
              width: 3,
            }),
            fill: new Fill({
              color: "rgba(255, 223, 135, 1)",
            }),
            text: valeurChamp || "inconnu",
          })
        : undefined,
  })
}

function stylePolyBasol() {
  return new Style({
    fill: new Fill({
      color: "rgba(255, 145, 0, 0.3)",
    }),
    stroke: new Stroke({
      color: "red",
      width: 1,
    }),
  })
}

function styleIconeBasol() {
  return new Style({
    image: new Icon({
      src: iconeBasol,
      scale: 0.5,
      color: "rgba(255, 255, 0, .2)",
    }),
  })
}

const basolSourceWFSPolygon = new VectorSource({
  format: new GeoJSON(),
  loader: function (extent, resolution, projection) {
    const url =
      `http://georisques.gouv.fr/services?SERVICE=WFS&VERSION=2.0.0` +
      `&REQUEST=GetFeature&typename=SSP_INSTR_GE_POLYGONE&SRSNAME=EPSG:3857` +
      `&outputformat=geojson&bbox=${extent.join(",")},EPSG:3857`

    fetch(url)
      .then(async reponse => {
        // transformation de la réponse avec text() pour traiter les erreurs WFS
        const text = await reponse.text()
        // Cas 1 : erreur HTTP (404, 500…)
        if (!reponse.ok) {
          throw new Error(text)
        }
        // Cas 2 : erreur WFS = ExceptionReport XML
        if (text.includes("<ows:ExceptionReport")) {
          const parser = new DOMParser()
          const xml = parser.parseFromString(text, "application/xml")
          const exceptionText = xml.querySelector(
            "ows\\:ExceptionText"
          )?.textContent
          throw new Error(exceptionText ?? "erreur inconnue")
        }
        // Cas 3 : réponse GeoJSON valide, on reforme un json
        return JSON.parse(text)
      })
      .then(featuresCollection => {
        const features = basolSourceWFSPolygon
          .getFormat()
          .readFeatures(featuresCollection)
        // attribution de la propriété id de chaque feature comme id unique
        // du jeu de données pour éviter les doublons
        features.forEach(f => {
          const id = f.get("id")
          f.setId(id)
        })
        basolSourceWFSPolygon.addFeatures(features)
      })
      .catch(e => {
        console.log("catch:", e.message)
      })
  },
  strategy: bboxStrategy,
})

const iconeBasol =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADoAAAA1CAMAAAAnMwjPAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAJGUExURQAAAP+Xl/8gIP8AAP8MDP9QUP9bW/9nZ/9ra/9RUf+amv+Ghv86Ov9jY/9kZP+zs/8kJP9AQP9GRv8cHP+Hh/8LC/+iov+oqP8ODv93d/8QEP9fX/9tbf8EBP8ZGf+trf+wsP9MTP94eP+Jif88PP8vL/89Pf8sLP8DA/+UlP+dnf8GBv9JSeulpb+GhqNycsOJifOrq/9XV/8UFP+Dg/+lpZ9wcDAhIQQDA19DQ+eiov+rq/8REf9zc/9iYvuwsFc9PRALC7eAgP9wcG9OTseMjP+Bgc+RkSgcHP84OP8yMmdISLN+fv87O/8wMP+jo4NcXP+fn/9LSyAWFmhJSf8YGP97exgYGAQEBAwMDBQUFHhUVP9/f/8ICP9qakw1NaOjo////+Pj4yAgIERERPPz8/v7+2tra6t4eP8fH5NnZygoKIeHh7e3twwICPetrSQZGX9/f7Ozs+vr6/80NP81NaNzc4ODg8vLyxwcHDQ0NF9fXwgGBv+bm9OUlAgICM/PzzgnJ/9UVHR0dFA4OCQkJGBgYFxcXHdUVP+Li39ZWUcyMv9cXP9TU/8hIRQODkQvL0AtLWRGRnNRURgREUs1NVQ7O/9ycpdqapttbYdfX1M6OmxLSzsqKq97e9+dnRwUFO+oqFg9Pf9OTv9ISEgyMv+MjFxAQOOfn1tAQP9lZf8oKI9lZf+TkzwqKsuOjv9ZWWNGRv8tLf9ERMuPj2dJSf+Ojqd1df8qKruDg/9DQ084OP+Pj2tLS/8nJ/8WFv9vbwAAAF+iCagAAADCdFJOU/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8A0qfZNgAAAAlwSFlzAAAXEQAAFxEByibzPwAABB1JREFUSEuVlulDVFUYxg88BArJGaKRRAcnyxwlRgZIRwGnUTYzTULTLLTRIKKaNtMWRTErI1vINVqtLCpaLbW9+c96zznPwJ3tw/w+eO/7nvfH8Z51VKogJaUou4Hv+SislsNSwTCXguo8YH5l1Y3AAiZyKKgC1VqoBpjIoZDqQ40xtb4JtUxlU0C9Gf6FTq27BYuYzKKAWo/FztR6CQJMZpFfXYCGpTR10Idbmc4kvxrAMorCbQVGKq96O5ZTs9yBFWzIIK+K0EpallWNKGGLl3xqKe40RlN49ermiHlrQSubvORR2+C/S+s1a5Uhum691u0d6GSjhzxqGTbo2N1WNMQ3ar0p3wTlquVoCOoueoZot9Y+5O6hXBXo0b1Rapa+mK7KM0E56mbco/UWSuRerbdiGwtmyVbvQ6hE6z46ZLvWlY3oZ0mabLUW98tsDNAhOyQ1HztZkiZLfQD+Oqkzve7abawH98g/D0lKplDDLCJZ6iD2Spnep9Qjif0HlHp0aPgxpUZMbi8GWUQy1RY8HjRlo+qJRCLxpFJPJRJDKvm0yQVrUc4yR6YKtJkqHXvmgKjPKvVcIvG86rI53ZM1QRnqQbzgqvQhdXj4xT0v7X55/9ArR5qYXI4aFlq86lGEKlk1Zobo2PHD5jHOnF4ZyujWq+7ECRbpiHFeTQzvksdJ5swR52OpwaMuQoeZGEfvSaVee/2NYyp+SrYOWejHmywWPOoglrDEMDZh18VbE4wtp1HPYmFOfRvv2Ikhh94deW9y8v0zZxhblrZiHsu9KlDFAkuTOhcOh0fi5xk7Lng27qy6AlvZTC7ajTcwxpB4Nm5aLUHjKrY27fjAPi+K2WfHKDY6ZTOCZ+Om1Va0sFFWofowZl6aP5qwq2H9x0qZp2Vu41LtREc72/Qn0ptzHZ/KPoryXTZuKL1xqQawiU1anzLf+NnUJRd1f26+2ZxP5Iv01efUL+Fjg3yqlB6R6mSXfGfvpPk7wmW2ysb1c+M6FfiKDVpf2nc+HNm4JSldfW3Egane6W/icsak+RZlVrLqd+l72ENk5qzpbVKOtCyCDe5HglG/R2M/0x5GpV+lfviRoYdlbl0YtR4/MTlH97ic+zOXRf6Z4+XhF1xxagVaZ+9hR+zX38Q5J5O6Ji6DnfN/vmrXhagBXGDKcW3cDHB0xgbTZqSSa6fs8TRLjblxVeoKrjPhmJZa6aqZYWzCruV1DB1y4x4VFbjKhCNi+lS/MxLs1J5hQE7Iga4O4g+GaSLhSZW0V7JDFuafclFmUNeBv1QAGZe/Zfrva3yzzGz3rGhyGtsUkN5sRVEJqFrv75wi8ENVm/u0ePpDMCO8gWERtP8Dn5LFhOsVVUXRs/hfWcaymv5zP7eLQ85js/xTnZtLi6OmLZVK/Q8y0To0Go7cfwAAAABJRU5ErkJggg=="

const basolSourceWFSpoint = new VectorSource({
  format: new GeoJSON(),
  url: extent => {
    return (
      `http://georisques.gouv.fr/services?SERVICE=WFS&VERSION=2.0.0` +
      `&REQUEST=GetFeature&typename=SSP_INSTR_GE_POINT&SRSNAME=EPSG:3857` +
      `&outputformat=geojson&bbox=${extent.join(",")},EPSG:3857`
    )
  },
  strategy: bboxStrategy,
})

const etablissementsPollueursSource = new VectorSource({
  format: new GeoJSON(),
  url: function (extent) {
    return (
      "https://georisques.gouv.fr/services?SERVICE=WFS&VERSION=1.1.0&" +
      "REQUEST=getFeature&typename=ETABLISSEMENTS_POLLUEURS" +
      `&SRSNAME=EPSG:3857&outputformat=geojson&bbox=${extent.join(
        ","
      )},EPSG:3857`
    )
  },
  strategy: bboxStrategy,
})

export const basolCoucheWFS = creerCoucheWFS(
  "sites pollués",
  basolSourceWFSpoint,
  styleIconeBasol()
)

export const etablissementsPollueursCoucheWFS = creerCoucheWFS(
  "établissements pollueurs",
  etablissementsPollueursSource,
  styleIconeBasol(),
  "nom"
)

export const basolCoucheWFSPolygon = creerCoucheWFS(
  "surface site pollué",
  basolSourceWFSPolygon,
  stylePolyBasol()
)