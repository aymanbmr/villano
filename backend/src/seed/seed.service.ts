import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Category } from '../categories/category.entity.js';
import { Product } from '../products/product.entity.js';
import { UPLOADS_DIR } from '../config.js';
import { placeholderSvg, slugify } from './placeholder.js';

type SeedProduct = {
  name: string;
  price: number;
  stock: number;
  description?: string;
};

type SeedCategory = {
  name: string;
  icon: string;
  products: SeedProduct[];
};

// Sample menu so the caisse has something to show on first launch.
// Only inserted when the database is empty; safe to edit or delete later.
const SEED: SeedCategory[] = [
  {
    name: 'Boissons chaudes',
    icon: 'cup',
    products: [
      { name: 'Espresso', price: 12, stock: 120 },
      { name: 'Café crème', price: 15, stock: 120 },
      { name: 'Cappuccino', price: 18, stock: 80 },
      { name: 'Thé à la menthe', price: 10, stock: 150 },
      { name: 'Chocolat chaud', price: 20, stock: 40 },
    ],
  },
  {
    name: 'Boissons froides',
    icon: 'glass',
    products: [
      { name: "Jus d'orange", price: 20, stock: 30 },
      { name: "Jus d'avocat", price: 25, stock: 20 },
      { name: 'Coca-Cola 33cl', price: 12, stock: 48 },
      { name: 'Eau minérale 50cl', price: 7, stock: 60 },
      { name: 'Limonade maison', price: 18, stock: 4 },
    ],
  },
  {
    name: 'Petit-déjeuner',
    icon: 'croissant',
    products: [
      { name: 'Croissant', price: 6, stock: 25 },
      { name: 'Pain au chocolat', price: 7, stock: 20 },
      { name: 'Msemen', price: 8, stock: 30 },
      { name: 'Omelette', price: 25, stock: 15 },
    ],
  },
  {
    name: 'Plats',
    icon: 'cutlery',
    products: [
      { name: 'Tajine poulet', price: 55, stock: 10, description: 'Poulet, olives, citron confit' },
      { name: 'Pizza Margherita', price: 45, stock: 12 },
      { name: 'Sandwich poulet', price: 30, stock: 18 },
      { name: 'Tacos', price: 40, stock: 14 },
      { name: 'Frites', price: 15, stock: 40 },
    ],
  },
  {
    name: 'Desserts',
    icon: 'cake',
    products: [
      { name: 'Tiramisu', price: 25, stock: 8 },
      { name: 'Cheesecake', price: 28, stock: 6 },
      { name: 'Crêpe Nutella', price: 22, stock: 0 },
    ],
  },
];

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
  ) {}

  // Categories created before icons became SVG hold an emoji; map them once
  // so nothing renders as an empty box on machines without an emoji font.
  private static readonly LEGACY_ICONS: Record<string, string> = {
    "☕": "cup",
    "🥤": "glass",
    "🥐": "croissant",
    "🍽️": "cutlery",
    "🍽": "cutlery",
    "🍰": "cake",
    "🍕": "pizza",
    "🥪": "sandwich",
    "🍟": "fries",
    "🥗": "salad",
    "🍦": "icecream",
    "🍲": "bowl",
    "🍳": "egg",
    "🥖": "bread",
    "💧": "bottle",
    "🍵": "cup",
  };

  private async migrateLegacyIcons() {
    for (const category of await this.categories.find()) {
      const mapped = category.icon ? SeedService.LEGACY_ICONS[category.icon.trim()] : undefined;
      if (mapped) {
        category.icon = mapped;
        await this.categories.save(category);
      }
    }
  }

  async onModuleInit() {
    mkdirSync(join(UPLOADS_DIR, 'seed'), { recursive: true });
    await this.migrateLegacyIcons();
    if ((await this.categories.count()) > 0) return;

    this.logger.log('Empty database: inserting sample menu');
    let sortOrder = 0;
    for (const cat of SEED) {
      const category = await this.categories.save(
        this.categories.create({ name: cat.name, icon: cat.icon, sortOrder: sortOrder++ }),
      );
      for (const p of cat.products) {
        const imageUrl = this.writePlaceholderImage(p.name, category.id);
        await this.products.save(
          this.products.create({
            name: p.name,
            description: p.description ?? null,
            price: p.price,
            stock: p.stock,
            imageUrl,
            categoryId: category.id,
          }),
        );
      }
    }
  }

  // Generated cover image: a gradient with the product's initials. Drawn as
  // shapes and letters only, so it renders on machines without emoji fonts.
  private writePlaceholderImage(name: string, categoryId: number) {
    const slug = slugify(name);
    writeFileSync(join(UPLOADS_DIR, 'seed', slug + '.svg'), placeholderSvg(name, categoryId), 'utf8');
    return '/uploads/seed/' + slug + '.svg';
  }
}

