import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category, type Station } from '../categories/category.entity.js';
import { MONEY } from '../database.js';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Stored as a real number (e.g. 25.5 DH)
  @Column({ type: MONEY })
  price: number;

  @Column({ type: 'integer', default: 0 })
  stock: number;

  // Below this value the caisse shows a "low stock" warning
  @Column({ type: 'integer', default: 5 })
  lowStockThreshold: number;

  // Relative URL served by the backend, e.g. /uploads/abc.jpg
  @Column({ type: 'text', nullable: true })
  imageUrl: string | null;

  // Lets a manager hide an item from the caisse without deleting it
  @Column({ default: true })
  isAvailable: boolean;

  @ManyToOne(() => Category, { eager: true, onDelete: 'SET NULL', nullable: true })
  category: Category | null;

  @Column({ type: 'integer', nullable: true })
  categoryId: number | null;

  // Exception à la station de la catégorie. Le thé à la menthe est une boisson
  // chaude, mais il se prépare en cuisine : son bon doit y partir sans qu'on
  // déplace toute la catégorie au passage.
  //
  // null = pas d'exception, le produit suit sa catégorie. C'est le cas de la
  // quasi-totalité des produits, d'où la colonne nullable plutôt qu'une valeur
  // par défaut qui figerait un choix.
  @Column({ type: 'text', nullable: true })
  station: Station | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/**
 * Où part le bon de cette ligne de commande : l'exception du produit si elle
 * existe, sinon la station de sa catégorie, sinon la cuisine.
 *
 * Le défaut est la cuisine et non le bar : un plat oublié affame un client,
 * une boisson oubliée le fait patienter.
 */
export const stationOf = (product: {
  station?: Station | null;
  category?: { station?: Station | null } | null;
}): Station => product.station ?? product.category?.station ?? 'kitchen';
