import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const EMPLOYEE_ROLES = [
  'serveur',
  'caissier',
  'barman',
  'cuisinier',
  'menage',
  'manager',
] as const;
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ type: 'text' })
  role: EmployeeRole;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  // Monthly salary in DH
  @Column({ type: 'real', nullable: true })
  salary: number | null;

  @Column({ type: 'text', nullable: true })
  hireDate: string | null;

  // 4-6 digit code for a future login on the caisse
  @Column({ type: 'text', nullable: true })
  pin: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // Inactive = left the restaurant; kept for history instead of deleted
  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
