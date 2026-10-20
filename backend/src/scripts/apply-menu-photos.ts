import { NestFactory } from '@nestjs/core';
import { Repository } from 'typeorm';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from '../app.module.js';
import { Product } from '../products/product.entity.js';
import { UPLOADS_DIR } from '../config.js';

// Pose sur les produits du petit déjeuner les vraies photos des plats, celles
// de la carte « Petit déjeuner & brunch ».
//
//   npm run apply:menu-photos
//
// Différence avec apply:stock-photos : celui-là met UNE photo générique par
// catégorie, prise sur une banque d'images. Ici ce sont les plats de Villano,
// photographiés pour la carte, et une photo par produit.
//
// Les fichiers sont versionnés dans backend/menu-photos/ et recopiés vers
// uploads/ au passage. Les photos génériques, elles, ne le sont pas : il y en
// avait trop et elles n'appartenaient pas au café. Ici le lot est petit et
// c'est le nôtre, donc autant qu'il suive le code — sans quoi il faudrait le
// transférer à la main sur chaque serveur, et on finirait par l'oublier.
//
// Relançable sans dégât : les fichiers sont simplement réécrits.

const SOURCE = join(process.cwd(), 'menu-photos');
const DESTINATION = join(UPLOADS_DIR, 'menu');

/** Nom du produit -> fichier. Les plats absents gardent leur image générée. */
const PHOTO_BY_PRODUCT: Record<string, string> = {
  Français: 'francais.jpg',
  'Casa Barata': 'casa-barata.jpg',
  'Croque Monsieur': 'croque-monsieur.jpg',
  'Croque Madame': 'croque-madame.jpg',
  Marocain: 'marocain.jpg',
  "Côte d'Azur": 'cote-azur.jpg',
  Chakchouka: 'chakchouka.jpg',
  Vitalité: 'vitalite.jpg',
};

/** Comparaison des noms sans accents ni ponctuation, comme à l'import. */
const cle = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

async function main() {
  if (!existsSync(SOURCE)) {
    console.error(`Dossier introuvable : ${SOURCE}`);
    console.error('Lancez ce script depuis backend/, après un git pull.');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const products: Repository<Product> = app.get('ProductRepository');

  mkdirSync(DESTINATION, { recursive: true });

  const tous = await products.find();
  let posees = 0;
  const sansProduit: string[] = [];

  for (const [nomProduit, fichier] of Object.entries(PHOTO_BY_PRODUCT)) {
    const source = join(SOURCE, fichier);
    if (!existsSync(source)) {
      console.log(`Photo manquante : ${fichier}, ignorée.`);
      continue;
    }
    const produit = tous.find((p) => cle(p.name) === cle(nomProduit));
    if (!produit) {
      sansProduit.push(nomProduit);
      continue;
    }
    copyFileSync(source, join(DESTINATION, fichier));
    produit.imageUrl = '/uploads/menu/' + fichier;
    await products.save(produit);
    posees++;
    console.log(`${produit.name} -> ${fichier}`);
  }

  console.log(`\n${posees} photo(s) posée(s).`);
  if (sansProduit.length > 0) {
    console.log(
      `Produit absent de la carte pour : ${sansProduit.join(', ')}. ` +
        'Lancez d\'abord npm run import:petit-dejeuner.',
    );
  }
  console.log(
    'Les plats sans photo de la carte gardent leur image générée ; ' +
      'vous pouvez en poser une depuis Admin -> Menu, en modifiant le produit.',
  );
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
