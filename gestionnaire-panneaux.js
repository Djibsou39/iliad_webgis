///////////////////////////////////////////////////////////////////////////////////////////
// Gestionnaire des panneaux latéraux optimisé - PANNEAU À GAUCHE                       //
// Gestion intelligente de l'ouverture/fermeture avec animations fluides               //
///////////////////////////////////////////////////////////////////////////////////////////

class GestionnairePanneaux {
  constructor(carte) {
    this.carte = carte
    this.sidebarPanel = document.getElementById("sidebar-panel")
    this.sidebarContent = document.getElementById("sidebar-content")
    this.mapContainer = document.getElementById("map-container")
    this.closePanelBtn = document.getElementById("close-panel-btn")
    this.toolbarIcons = document.querySelectorAll(".toolbar-icon")
    this.contentPanels = document.querySelectorAll(".content-panel")

    this.currentPanel = null
    this.isExpanded = false

    this.initialiser()
  }

  initialiser() {
    // Gestion des clics sur les icônes de la toolbar
    this.toolbarIcons.forEach(icon => {
      icon.addEventListener("click", e => this.gererClicIcone(e))
    })

    // Bouton de fermeture
    if (this.closePanelBtn) {
      this.closePanelBtn.addEventListener("click", () => this.fermerPanneau())
    }

    // Fermeture avec Escape
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && this.isExpanded) {
        this.fermerPanneau()
      }
    })

    // Gestion du redimensionnement
    window.addEventListener("resize", () => this.gererRedimensionnement())
  }

  /**
   * Gestion du clic sur une icône de la toolbar
   */
  gererClicIcone(evenement) {
    const icon = evenement.currentTarget
    const panelName = icon.dataset.panel

    if (!panelName) return

    // Si on clique sur le panneau déjà ouvert, on le ferme
    if (this.currentPanel === panelName && this.isExpanded) {
      this.fermerPanneau()
      return
    }

    // Si on quitte le panneau numérisation pour un autre, notifier la fermeture
    if (this.currentPanel === "edition" && panelName !== "edition") {
      this.emettreEvenement("numerisation-closed")
    }

    // Sinon, on ouvre le panneau correspondant
    this.ouvrirPanneau(panelName)
  }

  /**
   * Ouvre un panneau spécifique
   */
  ouvrirPanneau(panelName) {
    // Mise à jour de l'état
    this.currentPanel = panelName
    this.isExpanded = true

    // Ajout de la classe expanded
    this.sidebarPanel.classList.add("expanded")
    this.mapContainer.classList.add("retracted")

    // Mise à jour des icônes actives
    this.toolbarIcons.forEach(icon => {
      if (icon.dataset.panel === panelName) {
        icon.classList.add("active")
      } else {
        icon.classList.remove("active")
      }
    })

    // Affichage du panneau de contenu correspondant
    this.contentPanels.forEach(panel => {
      if (panel.dataset.panelContent === panelName) {
        panel.classList.add("active")
      } else {
        panel.classList.remove("active")
      }
    })

    // Mise à jour de la taille de la carte
    this.mettreAJourTailleCarte()

    // Événement personnalisé pour notifier l'ouverture
    this.emettreEvenement("panel-opened", { panel: panelName })
  }

  /**
   * Ferme le panneau actuellement ouvert
   */
  fermerPanneau() {
    // Notifier la fermeture d'un panneau spécifique avant de réinitialiser currentPanel
    if (this.currentPanel === "edition") {
      this.emettreEvenement("numerisation-closed")
    }

    // Mise à jour de l'état
    this.isExpanded = false
    this.currentPanel = null

    // Retrait de la classe expanded
    this.sidebarPanel.classList.remove("expanded")
    this.mapContainer.classList.remove("retracted")

    // Désactivation de toutes les icônes
    this.toolbarIcons.forEach(icon => {
      icon.classList.remove("active")
    })

    // Masquage de tous les panneaux de contenu
    this.contentPanels.forEach(panel => {
      panel.classList.remove("active")
    })

    // Mise à jour de la taille de la carte
    this.mettreAJourTailleCarte()

    // Événement personnalisé pour notifier la fermeture
    this.emettreEvenement("panel-closed")
  }

  /**
   * Met à jour la taille de la carte OpenLayers
   */
  mettreAJourTailleCarte() {
    if (this.carte) {
      // Délai pour attendre la fin de l'animation CSS
      setTimeout(() => {
        this.carte.updateSize()
      }, 350)
    }
  }

  /**
   * Gestion du redimensionnement de la fenêtre
   */
  gererRedimensionnement() {
    // Sur très petit mobile (< 360px), fermer le panneau si ouvert
    // pour éviter que le contenu déborde sur la carte
    if (window.innerWidth < 360 && this.isExpanded) {
      this.fermerPanneau()
    }

    // Mise à jour de la carte dans tous les cas
    this.mettreAJourTailleCarte()
  }

  /**
   * Méthode publique pour ouvrir un panneau spécifique
   */
  ouvrirPanneauPublic(panelName) {
    this.ouvrirPanneau(panelName)
  }

  /**
   * Méthode publique pour fermer le panneau
   */
  fermerPanneauPublic() {
    this.fermerPanneau()
  }

  /**
   * Vérifie si un panneau est ouvert
   */
  estOuvert() {
    return this.isExpanded
  }

  /**
   * Récupère le panneau actuellement ouvert
   */
  getPanneauCourant() {
    return this.currentPanel
  }

  /**
   * Émet un événement personnalisé
   */
  emettreEvenement(eventName, detail = {}) {
    const event = new CustomEvent(eventName, {
      detail: detail,
      bubbles: true,
    })
    document.dispatchEvent(event)
  }
}

// Export de la classe
export default GestionnairePanneaux