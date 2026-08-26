import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { User } from '../users/user.entity'

export interface StoredMessage {
  role: 'user' | 'model'
  content: string
  createdAt: string
  refs?: Array<{ id: string; name: string; documentType: string; passage: string }>
}

@Entity('chat_sessions')
export class ChatSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  userId!: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User

  @Column({ default: 'New Chat' })
  title!: string

  @Column({ nullable: true, type: 'uuid' })
  documentId!: string | null

  @Column({ nullable: true, type: 'varchar' })
  documentName!: string | null

  @Column({ type: 'jsonb', default: '[]' })
  messages!: StoredMessage[]

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
