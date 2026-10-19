import { NestFactory } from '@nestjs/core';
import { Repository } from 'typeorm';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from '../app.module.js';
import { Category } from '../categories/category.entity.js';
import { Product } from '../products/product.entity.js';
import { UPLOADS_DIR } from '../config.js';
import { placeholderSvg, slugify } from '../seed/placeholder.js';

// Importe la vraie carte Villano (PDF "Carte déjeuner") à la place du menu de
// démo : vide categories/products puis recrée tout, avec une image générée
// (dégradé + initiales) pour chaque produit.
//
//   npm run import:menu

type MenuProduct = { name: string; price: number; description?: string };
type MenuCategory = { name: string; icon: string; products: MenuProduct[] };

const MENU: MenuCategory[] = [
  {
    name: 'Entrées froides',
    icon: 'salad',
    products: [
      { name: 'Salade César', price: 50, description: 'Salade romaine, croûtons grillés, poulet tenders, tomate cerise, parmesan, sauce César' },
      { name: 'Trio gambas', price: 65, description: 'Quinoa, mousseline, avocat, mangue, gambas' },
      { name: 'Tartare de saumon', price: 65, description: 'Avocat, mangue, saumon fumé' },
      { name: 'Villano', price: 60, description: 'Légumes grillés, mozzarella salade, pêche, crevette panée, noix, sauce pesto' },
      { name: 'Salpicón', price: 70, description: 'Crevette, calamar, avocat, surimi, tomate cerise' },
    ],
  },
  {
    name: 'Entrées chaudes',
    icon: 'bowl',
    products: [
      { name: 'Mac and cheese classic', price: 42 },
      { name: 'Cassolette di gambas', price: 50 },
      { name: 'Pil-pil', price: 50 },
      { name: 'Gratin de fruits de mer', price: 55 },
    ],
  },
  {
    name: 'Pizzas',
    icon: 'pizza',
    products: [
      { name: 'Pizza Margarita', price: 45, description: "Sauce tomate, mozzarella, basilic, huile d'olive" },
      { name: 'Pizza Tonno', price: 50, description: 'Sauce tomate, thon, oignon, olives noires, poivron, origan' },
      { name: 'Pizza Fruits de mer', price: 65, description: "Sauce tomate, mozzarella, crevette, calamar, moules, huile d'olive, origan" },
      { name: 'Pizza Pepperoni', price: 55, description: 'Sauce tomate, mozzarella, pepperoni' },
      { name: 'Pizza Végétarienne', price: 45, description: "Sauce tomate, mozzarella, aubergine, courgette, tomate cerise, champignon, poivron, olives noires, origan, huile d'olive" },
      { name: 'Pizza Villano', price: 70, description: "Sauce tomate, mozzarella, pepperoni, viande hachée, poivron, dinde fumée, olives noires, origan, huile d'olive" },
      { name: 'Pizza 4 Saisons', price: 65 },
      { name: 'Pizza Alfredo', price: 55, description: 'Sauce blanche, poulet rôti, champignons de Paris, olives noires' },
      { name: 'Pizza 4 Fromages', price: 50, description: 'Mozzarella, bleu, fromage rouge, parmesan' },
      { name: 'Pizza Truffe', price: 60, description: 'Crème de truffe, mozzarella, champignons de Paris, olives noires' },
      { name: 'Pizza Saumon', price: 70, description: 'Sauce blanche, saumon, tomate cerise, courgette, parmesan' },
      { name: 'Pizza Prosciutto', price: 55, description: 'Sauce blanche, mozzarella, jambon, champignons, olives noires, parmesan' },
    ],
  },
  {
    name: 'Pâtes',
    icon: 'cutlery',
    products: [
      { name: 'Tartufo', price: 50, description: 'Champignons de Paris, crème de truffe à base de sauce blanche, basilic, parmesan' },
      { name: 'Bolognaise', price: 70, description: 'Sauce bolognaise aromatisée aux herbes, basilic, parmesan' },
      { name: 'Alfredo', price: 60, description: 'Poulet, champignons de Paris, tomate cerise, épinards, sauce blanche, parmesan' },
      { name: 'Scampi rosa', price: 65, description: 'Crevettes grises, tomate cerise, basilic, sauce rose, parmesan' },
      { name: 'Frutti di mare', price: 80, description: 'Crevette, calamar, tomate cerise, champignons de Paris, basilic, épinards, sauce blanche, parmesan' },
    ],
  },
  {
    name: 'Risottos',
    icon: 'bowl',
    products: [
      { name: 'Risotto poulet', price: 50 },
      { name: 'Risotto fruits de mer', price: 60 },
      { name: 'Risotto champignons', price: 45 },
    ],
  },
  {
    name: 'Grillades',
    icon: 'cutlery',
    products: [
      { name: 'Brochette de poulet', price: 65 },
      { name: 'Brochette de viande hachée', price: 65 },
      { name: 'Cordon bleu', price: 70 },
      { name: 'Pavé de saumon grillé à la plancha', price: 80 },
      { name: 'Filet de bœuf (200 g)', price: 80 },
    ],
  },
  {
    name: 'Émincés & Escalope',
    icon: 'plate',
    products: [
      { name: 'Émincés de poulet', price: 75, description: 'Servi au choix : sauce champignon, pâtes, riz, légumes sautés ou frites' },
      { name: 'Émincés de bœuf', price: 80, description: 'Servi au choix : sauce champignon, pâtes, riz, légumes sautés ou frites' },
      { name: 'Escalope de poulet gratinée', price: 80, description: 'Servi au choix : sauce champignon, pâtes, riz, légumes sautés ou frites' },
    ],
  },
  {
    name: 'Burgers',
    icon: 'sandwich',
    products: [
      { name: 'Burger chorizo', price: 55, description: 'Viande hachée, dinde fumée, cheddar, sauce burger' },
      { name: 'Burger classique', price: 45, description: 'Viande hachée, cheddar, salade, tomate' },
      { name: 'Cheese burger', price: 40 },
      { name: 'Big américaine', price: 60, description: '2 steaks hachés, cheddar, salade, tomate, oignon' },
      { name: 'Chicken burger', price: 60, description: 'Poulet tenders, cheddar, salade, tomate, oignon' },
    ],
  },
  {
    name: 'Sandwichs',
    icon: 'sandwich',
    products: [
      { name: 'Poulet crispy', price: 40, description: 'Tenders, cheddar, tomate, sauce au choix' },
      { name: 'Poulet curry', price: 38, description: 'Poulet curry, cheddar, tomate' },
      { name: 'Double steak', price: 42 },
      { name: 'Calamarito', price: 42 },
      { name: 'Villano', price: 48, description: 'Viande hachée, poulet, jambon' },
    ],
  },
  {
    name: 'Tacos',
    icon: 'sandwich',
    products: [
      { name: 'Tacos Villano', price: 50, description: 'Dinde, viande hachée, merguez, dinde fumée' },
      { name: 'Tacos dinde', price: 39 },
      { name: 'Tacos crispy', price: 42, description: 'Poulet tenders' },
      { name: 'Tacos viande hachée', price: 45 },
      { name: 'Tacos kebab', price: 42 },
    ],
  },
  {
    name: 'Crêpes sucrées',
    icon: 'cake',
    products: [
      { name: 'Crêpe nature', price: 14 },
      { name: 'Crêpe Nutella', price: 23 },
      { name: 'Crêpe Nutella banane', price: 27 },
      { name: 'Crêpe Nutella amande', price: 27 },
      { name: 'Crêpe crème pistache', price: 25 },
      { name: 'Crêpe kunafa pistache', price: 45 },
      { name: 'Crêpe lotus', price: 40 },
    ],
  },
  {
    name: 'Crêpes salées',
    icon: 'plate',
    products: [
      { name: 'Crêpe fromage', price: 25 },
      { name: 'Crêpe charcuterie', price: 30 },
      { name: 'Crêpe viande hachée', price: 32 },
      { name: 'Crêpe poulet', price: 30 },
      { name: 'Crêpe fruits de mer', price: 45 },
    ],
  },
  {
    name: 'Mojitos',
    icon: 'glass',
    products: [
      { name: 'Mojito bleu', price: 27 },
      { name: 'Mojito fraise', price: 27 },
      { name: 'Mojito fruits rouges', price: 27 },
      { name: 'Mojito classique', price: 25 },
      { name: 'Mojito passion', price: 27 },
      { name: 'Mojito grenadine', price: 27 },
      { name: 'Mojito Villano', price: 30 },
    ],
  },
  {
    name: 'Boissons froides',
    icon: 'glass',
    products: [
      { name: 'Limonade', price: 14 },
      { name: 'Boisson énergisante', price: 25 },
      { name: 'Eau 33 cl', price: 3 },
      { name: 'Eau 50 cl', price: 6 },
      { name: 'Eau 1,5 L', price: 12 },
    ],
  },
  {
    name: 'Jus détox',
    icon: 'glass',
    products: [
      { name: 'Jus détox banane', price: 22 },
      { name: 'Jus détox carotte', price: 18 },
      { name: 'Jus détox betterave', price: 18 },
      { name: 'Jus détox citron', price: 20 },
      { name: 'Jus détox ananas', price: 25 },
      { name: 'Jus détox fraise', price: 25 },
      { name: 'Supplément gingembre', price: 8 },
    ],
  },
  {
    name: 'Jus',
    icon: 'glass',
    products: [
      { name: 'Jus orange', price: 20 },
      { name: 'Jus banane', price: 20 },
      { name: 'Jus citron', price: 20 },
      { name: 'Jus ananas', price: 22 },
      { name: 'Jus fraise', price: 22 },
      { name: 'Jus panaché', price: 25 },
      { name: 'Jus pêche', price: 22 },
      { name: 'Jus mangue', price: 25 },
      { name: 'Jus fruits rouges', price: 38 },
      { name: 'Jus Zaazaa', price: 40 },
      { name: 'Jus Dragon', price: 35 },
    ],
  },
  {
    name: 'Boissons chaudes',
    icon: 'cup',
    products: [
      { name: 'Café noir', price: 14 },
      { name: 'Café au lait', price: 14 },
      { name: 'Café crème', price: 14 },
      { name: 'Lait frais', price: 12 },
      { name: 'Café Nespresso', price: 20 },
      { name: 'Café cappuccino', price: 23 },
      { name: 'Chocolat fondu', price: 25 },
      { name: 'Chocolat viennois', price: 25 },
      { name: 'Thé à la menthe', price: 14 },
      { name: 'Lait chaud', price: 12 },
      { name: 'Lait au chocolat', price: 14 },
      { name: 'Lait verveine', price: 14 },
    ],
  },
  {
    name: 'Milk-shakes',
    icon: 'glass',
    products: [
      { name: 'Milk-shake fraise', price: 25 },
      { name: 'Milk-shake Oreo', price: 25 },
      { name: 'Milk-shake Nutella', price: 30 },
    ],
  },
  {
    name: 'Desserts',
    icon: 'cake',
    products: [
      { name: 'Tarte au citron', price: 23 },
      { name: 'Cheese cake', price: 23 },
      { name: 'Tranche', price: 22 },
      { name: 'Salade de fruits', price: 25 },
    ],
  },
  {
    name: 'Smoothies',
    icon: 'glass',
    products: [
      { name: 'Smoothie exotique', price: 27, description: 'Orange, ananas, purée de banane, miel' },
      { name: 'Smoothie fraise banane', price: 27, description: 'Fraise, banane, orange' },
      { name: 'Smoothie fraise ananas', price: 28, description: 'Fraise, ananas, orange' },
      { name: 'Smoothie mangue pistache', price: 30, description: 'Mangue, pistache, banane' },
      { name: 'Smoothie tropical', price: 30, description: 'Ananas, mangue, pêche' },
    ],
  },
];

const DEFAULT_STOCK = 100;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const categories: Repository<Category> = app.get('CategoryRepository');
  const products: Repository<Product> = app.get('ProductRepository');

  const existingProducts = await products.count();
  const existingCategories = await categories.count();
  console.log(`Menu actuel : ${existingCategories} catégorie(s), ${existingProducts} produit(s) — tout sera remplacé.`);

  await products.clear();
  await categories.clear();

  mkdirSync(join(UPLOADS_DIR, 'seed'), { recursive: true });

  let sortOrder = 0;
  let count = 0;
  for (const cat of MENU) {
    const category = await categories.save(
      categories.create({ name: cat.name, icon: cat.icon, sortOrder: sortOrder++ }),
    );
    for (const p of cat.products) {
      const slug = slugify(`${p.name}-${category.name}`);
      writeFileSync(join(UPLOADS_DIR, 'seed', slug + '.svg'), placeholderSvg(p.name, category.id), 'utf8');
      await products.save(
        products.create({
          name: p.name,
          description: p.description ?? null,
          price: p.price,
          stock: DEFAULT_STOCK,
          imageUrl: '/uploads/seed/' + slug + '.svg',
          categoryId: category.id,
        }),
      );
      count++;
    }
  }

  console.log(`Importé : ${MENU.length} catégories, ${count} produits.`);
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
