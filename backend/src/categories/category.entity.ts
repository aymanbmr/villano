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

  // Which printer an order line for this category goes to automatically:
  // food to the kitchen, drinks to the bar.
  @Column({ type: 'text', default: 'kitchen' })
  station: 'kitchen' | 'bar';
}
