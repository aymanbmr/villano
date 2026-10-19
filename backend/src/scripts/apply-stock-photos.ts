import { NestFactory } from '@nestjs/core';
import { Repository } from 'typeorm';
import { Category } from '../categories/category.entity.js';
import { Product } from '../products/product.entity.js';
import { AppModule } from '../app.module.js';

// Applique une photo libre de droits (Pexels) par catégorie, en attendant de
// vraies photos des plats — voir uploads/stock/. Une seule photo par
// catégorie, pas une par produit : représentative du type de plat, pas du
// plat exact.
//
//   npm run apply:stock-photos

const PHOTO_BY_CATEGORY: Record<string, string> = {
  'Entrées froides': 'entrees-froides.jpg',
  'Entrées chaudes': 'entrees-chaudes.jpg',
  Pizzas: 'pizzas.jpg',
  Pâtes: 'pates.jpg',
  Risottos: 'risottos.jpg',
  Grillades: 'grillades.jpg',
  'Émincés & Escalope': 'emince-escalope.jpg',
  Burgers: 'burgers.jpg',
  Sandwichs: 'sandwichs.jpg',
  Tacos: 'tacos.jpg',
  'Crêpes sucrées': 'crepes-sucrees.jpg',
  'Crêpes salées': 'crepes-salees.jpg',
  Mojitos: 'mojitos.jpg',
  'Boissons froides': 'boissons-froides.jpg',
  'Jus détox': 'jus-detox.jpg',
  Jus: 'jus.jpg',
  'Boissons chaudes': 'boissons-chaudes.jpg',
  'Milk-shakes': 'milkshakes.jpg',
  Desserts: 'desserts.jpg',
  Smoothies: 'smoothies.jpg',
};

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const categories: Repository<Category> = app.get('CategoryRepository');
  const products: Repository<Product> = app.get('ProductRepository');

  let updated = 0;
  let skipped = 0;
  for (const category of await categories.find()) {
    const file = PHOTO_BY_CATEGORY[category.name];
    if (!file) {
      skipped++;
      console.log(`Pas de photo prévue pour "${category.name}", inchangé.`);
      continue;
    }
    const result = await products
      .createQueryBuilder()
      .update(Product)
      .set({ imageUrl: '/uploads/stock/' + file })
      .where('categoryId = :id', { id: category.id })
      .execute();
    updated += result.affected ?? 0;
    console.log(`${category.name} : ${result.affected ?? 0} produit(s) -> ${file}`);
  }

  console.log(`\n${updated} produit(s) mis à jour, ${skipped} catégorie(s) sans photo prévue.`);
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
