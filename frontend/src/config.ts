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
