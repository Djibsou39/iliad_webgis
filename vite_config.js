import { copyFileSync, mkdirSync, readdirSync, statSync } from "fs"
import { join } from "path"

/**
 * Plugin Vite inline : copie récursivement un dossier source vers dist/ au build.
 * Permet de servir des fichiers statiques depuis un dossier hors de public/.
 * 
 * @param {string} src  - Dossier source relatif à la racine du projet (ex: "data")
 * @param {string} dest - Dossier destination dans dist/ (ex: "data")
 */
function copierDossierStatique(src, dest) {
  return {
    name: "copier-dossier-statique",
    closeBundle() {
      const copierRecursivement = (source, destination) => {
        mkdirSync(destination, { recursive: true })
        for (const fichier of readdirSync(source)) {
          const cheminSrc  = join(source, fichier)
          const cheminDest = join(destination, fichier)
          if (statSync(cheminSrc).isDirectory()) {
            copierRecursivement(cheminSrc, cheminDest)
          } else {
            copyFileSync(cheminSrc, cheminDest)
          }
        }
      }
      copierRecursivement(src, join("dist", dest))
      console.log(`✓ Dossier copié : ${src} → dist/${dest}`)
    },
  }
}

export default {
  base: '/iliad_webgis/', // ← nom exact de votre repo GitHub

  plugins: [
    // Copie le dossier data/ vers dist/data/ lors du build
    copierDossierStatique("data", "data"),
  ],

  server: {
    fs: {
      // Autorise Vite dev server à servir les fichiers depuis la racine du projet
      // → permet de fetch ./data/... en développement local
      allow: ["."],
    },
  },

  build: {
    sourcemap: true,
  },
}
