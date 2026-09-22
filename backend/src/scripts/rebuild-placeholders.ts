import { NestFactory } from '@nestjs/core';
import { Repository } from 'typeorm';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from '../app.module.js';
import { Product } from '../products/product.entity.js';
import { UPLOADS_DIR } from '../config.js';
import { placeholderSvg, slugify } from '../seed/placeholder.js';

// Rewrites the generated product images without emoji (older Windows machines
// have no emoji font and show empty boxes). Real photos uploaded by the
// manager are left untouched.
//   npm run fix:images
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const products: Repository<Product> = app.get('ProductRepository');
  const dir = join(UPLOADS_DIR, 'seed');
  mkdirSync(dir, { recursive: true });

  let done = 0;
  for (const product of await products.find()) {
    if (!product.imageUrl?.startsWith('/uploads/seed/')) continue; // uploaded photo
    const slug = slugify(product.name);
    writeFileSync(join(dir, `${slug}.svg`), placeholderSvg(product.name, product.categoryId ?? 0), 'utf8');
    if (product.imageUrl !== `/uploads/seed/${slug}.svg`) {
      product.imageUrl = `/uploads/seed/${slug}.svg`;
      await products.save(product);
    }
    done++;
  }
  console.log(`${done} image(s) de démonstration régénérées sans emoji.`);
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
