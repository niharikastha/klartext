import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, CreateDateColumn } from 'typeorm'
import { Document } from '../documents/document.entity'

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  userId!: string

  @Column()
  name!: string

  @Column({ default: '#6366f1' })
  color!: string

  @ManyToMany(() => Document, doc => doc.tags)
  documents!: Document[]

  @CreateDateColumn()
  createdAt!: Date
}
