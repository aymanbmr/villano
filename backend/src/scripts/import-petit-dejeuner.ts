import { NestFactory } from '@nestjs/core';
import { Repository } from 'typeorm';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from '../app.module.js';
import { Category } from '../categories/category.entity.js';
import { Product } from '../products/product.entity.js';
import { UPLOADS_DIR } from '../config.js';
import { placeholderSvg, slugify } from '../seed/placeholder.js';

// Ajoute la carte « Petit déjeuner & brunch » à celle qui est déjà en place.
//
//   npm run import:petit-dejeuner
//
// Contrairement à import:menu, ce script n'EFFACE RIEN : il complète. La carte
// du déjeuner est déjà importée et le café tourne dessus — la vider pour
// ajouter les petits déjeuners emporterait aussi les photos et les réglages
// faits depuis. Le script peut donc être relancé sans dégât : une catégorie
// déjà présente est réutilisée, un produit déjà présent est laissé tel quel.
//
// Les deux catégories sont placées en tête, le petit déjeuner étant le premier
// service de la journée. Les catégories existantes sont décalées d'autant.

type MenuProduct = { name: string; price: number; description?: string };
type MenuCategory = { name: string; icon: string; products: MenuProduct[] };

const ACCOMPAGNEMENT =
  "Servi avec jus d'orange, boisson chaude, yaourt et eau minérale";

const MENU: MenuCategory[] = [
  {
    name: 'Petit déjeuner',
    icon: 'egg',
    products: [
      {
        name: 'Français',
        price: 32,
        description: `2 viennoiseries, 2 pancakes au Nutella banane. ${ACCOMPAGNEMENT}`,
      },
      {
        name: 'Casa Barata',
        price: 42,
        description: `2 œufs en omelette, toast au fromage gratiné, dinde fumée, salami, fromage blanc, potatoes, olives noires, huile d'olive. ${ACCOMPAGNEMENT}`,
      },
      {
        name: 'British',
        price: 42,
        description: `2 œufs au plat, saucisse, croquettes de pommes de terre, tomate, olives noires, huile d'olive, 2 pancakes au Nutella. ${ACCOMPAGNEMENT}`,
      },
      {
        name: 'Marocain',
        price: 40,
        description: `2 œufs au khlii fassi, accompagnés d'une baghrir à l'amlou, fruits secs, olives noires, huile d'olive. ${ACCOMPAGNEMENT}`,
      },
      {
        name: 'Croque Monsieur',
        price: 42,
        description: `3 toasts garnis de cheddar et de jambon, surmontés d'une omelette au fromage, olives noires, huile d'olive. ${ACCOMPAGNEMENT}`,
      },
      {
        name: 'Croque Madame',
        price: 42,
        description: `4 toasts, cheddar, jambon, 2 œufs au plat, fromage rouge, olives noires, huile d'olive. ${ACCOMPAGNEMENT}`,
      },
      {
        name: "Côte d'Azur",
        price: 48,
        description: `2 croissants farcis (fromage, laitue, jambon, œufs), pancakes Nutella banane, 3 croquettes de pomme de terre. ${ACCOMPAGNEMENT}`,
      },
      {
        name: 'Tartine Maison Villano',
        price: 39,
        description: `3 tartines à la sauce tomate, fromage rouge et thon, omelette, 3 croquettes de pomme de terre et sauce verte. ${ACCOMPAGNEMENT}`,
      },
      {
        name: 'Pomme rösti',
        price: 48,
        description: `2 pommes rösti garnies de fromage blanc, salami et œuf poché, olives noires, bol de yaourt aux fruits. ${ACCOMPAGNEMENT}`,
      },
      {
        name: 'Traditionnel',
        price: 36,
        description: `Harcha, msemen, baghrir, toast au fromage gratiné, olives noires, huile d'olive, fromage blanc, miel, confiture, beurre, amlou. ${ACCOMPAGNEMENT}`,
      },
      {
        name: 'Amsterdam',
        price: 37,
        description: `Deux toasts grillés, fromage blanc, omelette charcuterie, olives noires, huile d'olive. ${ACCOMPAGNEMENT}`,
      },
      {
        name: 'Chakchouka',
        price: 37,
        description: `Mqila sauce tomate, 2 œufs, fromage râpé, olives noires, huile d'olive, accompagnée d'un yaourt aux fruits. ${ACCOMPAGNEMENT}`,
      },
      // Deux prix pour une même carte : deux produits, la caisse n'ayant pas
      // de variantes. Le serveur choisit la ligne, pas une option.
      {
        name: 'Omelette nature ou poivron',
        price: 25,
        description: `Au choix : nature ou poivron. ${ACCOMPAGNEMENT}`,
      },
      {
        name: 'Omelette charcuterie, fromage rouge, champignons ou crevettes',
        price: 35,
        description: `Au choix : charcuterie, fromage rouge, champignons ou crevettes. ${ACCOMPAGNEMENT}`,
      },
      {
        name: 'Menu kids',
        price: 28,
        description: 'Pour les petits : pancake Nutella, cornflakes, lait froid, yaourt',
      },
    ],
  },
  {
    name: 'Brunch',
    icon: 'plate',
    products: [
      {
        name: 'Villano',
        price: 56,
        description:
          "La signature : 2 tartines, la 1ère garnie de fromage, œuf et crevettes grillées, la 2ème de guacamole, saumon fumé et œuf. Potatoes. Servi avec pain cake Nutella ou amlou, fruits secs et jus cocktail",
      },
      {
        name: 'Brunch à partager',
        price: 98,
        description:
          "Pour 2 personnes : 4 œufs, 2 mini viennoiseries, merguez, 2 pancakes Nutella banane, 2 salades de fruits, fromage blanc, olives noires, huile d'olive, 2 toasts doubles grillés au fromage et jambon, potatoes, 2 yaourts",
      },
      {
        name: 'Vitalité',
        price: 56,
        description:
          'Pain aux céréales, guacamole et saumon fumé, fromage blanc, 2 œufs, potatoes, bol de yaourt',
      },
    ],
  },
];

const DEFAULT_STOCK = 100;

/**
 * Clé de comparaison des noms : sans accents, sans ponctuation, sans casse.
 *
 * « Petit-déjeuner » et « Petit déjeuner » sont la même catégorie pour un
 * cafetier, pas pour une égalité de chaînes. Sans cela le script créait un
 * doublon à côté de celle qui existait déjà, et la carte se retrouvait coupée
 * en deux onglets presque identiques.
 */
const cle = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const categories: Repository<Category> = app.get('CategoryRepository');
  const products: Repository<Product> = app.get('ProductRepository');

  console.log(
    `Carte actuelle : ${await categories.count()} catégorie(s), ${await products.count()} produit(s). Rien ne sera supprimé.`,
  );

  mkdirSync(join(UPLOADS_DIR, 'seed'), { recursive: true });

  const toutes = await categories.find();
  const trouver = (nom: string) => toutes.find((c) => cle(c.name) === cle(nom));

  // Les nouvelles catégories passent devant : on décale celles déjà en place
  // du nombre qu'on ajoute, plutôt que de toutes les renuméroter.
  const aCreer = MENU.filter((cat) => !trouver(cat.name)).length;
  if (aCreer > 0) {
    for (const existante of toutes) {
      existante.sortOrder += aCreer;
      await categories.save(existante);
    }
  }

  let rang = 0;
  let ajoutes = 0;
  let deja = 0;

  for (const cat of MENU) {
    let category = trouver(cat.name) ?? null;
    if (category) {
      // Déjà là : on la remonte en tête sans toucher à son icône, que
      // quelqu'un a peut-être choisie.
      category.sortOrder = rang;
      category = await categories.save(category);
      console.log(`Catégorie « ${category.name} » déjà présente, remontée en tête.`);
    } else {
      category = await categories.save(
        categories.create({ name: cat.name, icon: cat.icon, sortOrder: rang }),
      );
      console.log(`Catégorie « ${cat.name} » créée.`);
    }
    rang++;

    for (const p of cat.products) {
      // Un produit du même nom dans la même catégorie est le même produit :
      // on ne l'écrase pas, son prix a pu être corrigé depuis l'admin.
      const dansLaCategorie = await products.findBy({ categoryId: category.id });
      if (dansLaCategorie.some((existant) => cle(existant.name) === cle(p.name))) {
        deja++;
        continue;
      }
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
      ajoutes++;
    }
  }

  console.log(`\n${ajoutes} produit(s) ajouté(s), ${deja} déjà présent(s).`);
  console.log('Ordre des catégories : Petit déjeuner, Brunch, puis les autres.');
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
