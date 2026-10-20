import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { MONEY } from '../database.js';

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

  // Facultatif : au café on connaît souvent l'employé par son seul prénom, et
  // exiger un nom de famille obligeait à inventer quelque chose.
  @Column({ default: '' })
  lastName: string;

  @Column({ type: 'text' })
  role: EmployeeRole;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  // Monthly salary in DH
  @Column({ type: MONEY, nullable: true })
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

/**
 * Le nom affiché sur un ticket ou dans une liste. Le nom de famille étant
 * facultatif, un simple `${firstName} ${lastName}` laissait une espace en trop
 * derrière le prénom — visible sur le ticket, juste assez pour qu'on la
 * remarque sans comprendre d'où elle vient.
 */
export const employeeName = (e: { firstName: string; lastName?: string | null }) =>
  `${e.firstName} ${e.lastName ?? ''}`.trim();
