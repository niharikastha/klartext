import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm'
import { Document } from '../documents/document.entity'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ unique: true })
  email!: string

  @Column()
  password!: string

  @Column()
  name!: string

  @Column({ default: 'Germany' })
  targetCountry!: string

  @Column({ default: 'English' })
  nativeLanguage!: string

  @Column({ default: 'English' })
  preferredLanguage!: string

  @Column({ nullable: true, type: 'varchar' })
  avatarUrl!: string | null

  @Column({ nullable: true, type: 'varchar' })
  resetPasswordToken!: string | null

  @Column({ nullable: true, type: 'timestamp' })
  resetPasswordExpires!: Date | null

  @OneToMany(() => Document, doc => doc.user)
  documents!: Document[]

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
