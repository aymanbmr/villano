import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  // Emoji or short label shown on the category tab in the caisse
  @Column({ type: 'text', nullable: true })
  icon: string | null;

  @Column({ default: 0 })
  sortOrder: number;
}
