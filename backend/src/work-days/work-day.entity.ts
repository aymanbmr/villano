import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// A manually-controlled business day: opened by a cashier at the start of
// service, closed by hand at the end — even if work runs past midnight, the
// day stays open until someone closes it. Only one can be open at a time.
@Entity('work_days')
export class WorkDay {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  openedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  closedAt: Date | null;

  @Column()
  openedBy: string;

  @Column({ type: 'text', nullable: true })
  closedBy: string | null;
}
