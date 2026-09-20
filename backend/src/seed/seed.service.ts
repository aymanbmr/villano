import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Category } from '../categories/category.entity.js';
import { Product } from '../products/product.entity.js';
import { UPLOADS_DIR } from '../config.js';

type SeedProduct = {
  name: string;
  price: number;
  stock: number;
  emoji: string;
  description?: string;
};

type SeedCategory = {
  name: string;
  icon: string;
  colors: [string, string];
  products: SeedProduct[];
};

// Sample menu so the caisse has something to show on first launch.
// Only inserted when the database is empty; safe to edit or delete later.
const SEED: SeedCategory[] = [
  {
    name: 'Boissons chaudes',
    icon: '☕',
    colors: ['#6f4e37', '#c69c6d'],
    products: [
      { name: 'Espresso', price: 12, stock: 120, emoji: '☕' },
      { name: 'Café crème', price: 15, stock: 120, emoji: '🥛' },
      { name: 'Cappuccino', price: 18, stock: 80, emoji: '☕' },
      { name: 'Thé à la menthe', price: 10, stock: 150, emoji: '🍵' },
      { name: 'Chocolat chaud', price: 20, stock: 40, emoji: '🍫' },
    ],
  },
  {
    name: 'Boissons froides',
    icon: '🥤',
    colors: ['#0f766e', '#5eead4'],
    products: [
      { name: "Jus d'orange", price: 20, stock: 30, emoji: '🍊' },
      { name: "Jus d'avocat", price: 25, stock: 20, emoji: '🥑' },
      { name: 'Coca-Cola 33cl', price: 12, stock: 48, emoji: '🥤' },
      { name: 'Eau minérale 50cl', price: 7, stock: 60, emoji: '💧' },
      { name: 'Limonade maison', price: 18, stock: 4, emoji: '🍋' },
    ],
  },
  {
    name: 'Petit-déjeuner',
    icon: '🥐',
    colors: ['#b45309', '#fcd34d'],
    products: [
      { name: 'Croissant', price: 6, stock: 25, emoji: '🥐' },
      { name: 'Pain au chocolat', price: 7, stock: 20, emoji: '🥐' },
      { name: 'Msemen', price: 8, stock: 30, emoji: '🫓' },
      { name: 'Omelette', price: 25, stock: 15, emoji: '🍳' },
    ],
  },
  {
    name: 'Plats',
    icon: '🍽️',
    colors: ['#9f1239', '#fb7185'],
    products: [
      { name: 'Tajine poulet', price: 55, stock: 10, emoji: '🍲', description: 'Poulet, olives, citron confit' },
      { name: 'Pizza Margherita', price: 45, stock: 12, emoji: '🍕' },
      { name: 'Sandwich poulet', price: 30, stock: 18, emoji: '🥪' },
      { name: 'Tacos', price: 40, stock: 14, emoji: '🌯' },
      { name: 'Frites', price: 15, stock: 40, emoji: '🍟' },
    ],
  },
  {
    name: 'Desserts',
    icon: '🍰',
    colors: ['#7e22ce', '#f0abfc'],
    products: [
      { name: 'Tiramisu', price: 25, stock: 8, emoji: '🍰' },
      { name: 'Cheesecake', price: 28, stock: 6, emoji: '🍰' },
      { name: 'Crêpe Nutella', price: 22, stock: 0, emoji: '🥞' },
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

  async onModuleInit() {
    mkdirSync(join(UPLOADS_DIR, 'seed'), { recursive: true });
    if ((await this.categories.count()) > 0) return;

    this.logger.log('Empty database: inserting sample menu');
    let sortOrder = 0;
    for (const cat of SEED) {
      const category = await this.categories.save(
        this.categories.create({ name: cat.name, icon: cat.icon, sortOrder: sortOrder++ }),
      );
      for (const p of cat.products) {
        const imageUrl = this.writePlaceholderImage(p, cat.colors);
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

  // Generates a simple SVG "photo" so the menu has pictures out of the box.
  // Real photos can replace them via POST /products/:id/image.
  private writePlaceholderImage(p: SeedProduct, [from, to]: [string, string]) {
    const slug = p.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450" viewBox="0 0 600 450">',
      '  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">',
      `    <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>`,
      '  </linearGradient></defs>',
      '  <rect width="600" height="450" fill="url(#g)"/>',
      '  <circle cx="300" cy="200" r="120" fill="rgba(255,255,255,0.18)"/>',
      `  <text x="300" y="250" font-size="150" text-anchor="middle">${p.emoji}</text>`,
      `  <text x="300" y="400" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="700" fill="#fff" text-anchor="middle">${escapeXml(p.name)}</text>`,
      '</svg>',
    ].join('\n');
    writeFileSync(join(UPLOADS_DIR, 'seed', slug + '.svg'), svg, 'utf8');
    return '/uploads/seed/' + slug + '.svg';
  }
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
