import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { PrinterId } from './printing.service.js';

// A ticket waiting for the local relay to pick up and send to the printer it
// cannot reach itself (the server is hosted away from the café's network).
// host/port are a snapshot of the printer's address at the time the ticket
// was queued: the relay only ever has to connect and send, never configure.
@Entity('print_jobs')
export class PrintJob {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  printerId: PrinterId;

  @Column({ type: 'text' })
  host: string;

  @Column()
  port: number;

  // Raw ESC/POS bytes, base64-encoded for storage as text
  @Column({ type: 'text' })
  payload: string;

  @CreateDateColumn()
  createdAt: Date;
}
