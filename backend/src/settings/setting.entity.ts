import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// Small key/value store for things the manager configures from the admin
// screens (printer addresses, restaurant details…), so nobody has to edit a
// file on the caisse PC.
@Entity('settings')
export class Setting {
  @PrimaryColumn({ type: 'text' })
  key: string;

  @Column({ type: 'text' })
  value: string; // JSON

  @UpdateDateColumn()
  updatedAt: Date;
}
