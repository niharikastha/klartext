import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity('calendar_events')
export class CalendarEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  userId!: string

  @Column()
  title!: string

  @Column({ type: 'text', nullable: true })
  description!: string | null

  @Column({ type: 'date' })
  date!: string

  @Column({ type: 'varchar', default: '#6366f1' })
  color!: string

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
