// Printed on every ticket header/footer. Edit to match the restaurant.
export const RESTAURANT = {
  name: 'Villano',
  subtitle: 'Café & Restaurant',
  address: 'Adresse du restaurant',
  phone: 'Tél : 05 00 00 00 00',
  footer: 'Merci de votre visite, à bientôt !',
};

// Gestion du stock : compteurs sur les produits, alertes de stock bas et
// blocage des produits épuisés. Mettre à true pour la réactiver — et passer
// STOCK_ENABLED=true dans backend/.env pour que le serveur suive.
export const SHOW_STOCK = false;

/**
 * L'application mobile n'est qu'une coque autour de ce site, et elle est faite
 * pour le gérant : carte, ventes, employés — pas la caisse, qui n'a rien à
 * faire sur un téléphone pendant le service.
 *
 * Elle se signale par son user agent plutôt que par l'adresse : un paramètre
 * dans l'URL se perdrait au premier rechargement de la coque, et la caisse
 * réapparaîtrait sans qu'on comprenne pourquoi.
 *
 * C'est un choix d'affichage, pas une barrière : le jeton du gérant ouvre
 * toutes les routes de l'API, ici comme ailleurs.
 */
export const IS_ADMIN_APP =
  typeof navigator !== 'undefined' && / VillanoAdmin\b/.test(navigator.userAgent);
