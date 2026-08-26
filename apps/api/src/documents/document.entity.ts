import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToOne, ManyToMany, JoinTable } from 'typeorm'
import { User } from '../users/user.entity'
import { AnalysisResult } from '../analysis/analysis-result.entity'
import { Tag } from '../tags/tag.entity'

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @ManyToOne(() => User, user => user.documents, { onDelete: 'CASCADE' })
  user!: User

  @Column()
  userId!: string

  @Column()
  fileName!: string

  @Column()
  fileType!: string

  @Column({ nullable: true })
  filePath!: string

  @Column({ nullable: true })
  fileSize!: number

  @Column({ default: 'pending' })
  analysisStatus!: string

  @OneToOne(() => AnalysisResult, result => result.document, { nullable: true })
  analysisResult!: AnalysisResult

  @ManyToMany(() => Tag, tag => tag.documents, { eager: false })
  @JoinTable({ name: 'document_tags' })
  tags!: Tag[]

  @CreateDateColumn()
  uploadedAt!: Date
}
