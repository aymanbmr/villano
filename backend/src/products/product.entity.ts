import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../categories/category.entity.js';
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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
