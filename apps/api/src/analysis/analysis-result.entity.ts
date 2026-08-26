import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToOne, JoinColumn, OneToMany } from 'typeorm'
import { Document } from '../documents/document.entity'
import { ActionItem } from '../action-items/action-item.entity'

@Entity('analysis_results')
export class AnalysisResult {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @OneToOne(() => Document, doc => doc.analysisResult, { onDelete: 'CASCADE' })
  @JoinColumn()
  document!: Document

  @Column()
  documentId!: string

  @Column({ type: 'text' })
  summary!: string

  @Column({ nullable: true })
  documentType!: string

  @Column({ type: 'jsonb', nullable: true })
  extractedData!: Record<string, string>

  @Column({ default: 'low' })
  riskLevel!: string

  @Column({ type: 'text', nullable: true })
  riskExplanation!: string

  @Column({ type: 'text', nullable: true })
  translatedText!: string

  @Column({ type: 'text', nullable: true })
  rawText!: string

  @OneToMany(() => ActionItem, item => item.analysisResult, { cascade: true })
  actionItems!: ActionItem[]

  @CreateDateColumn()
  createdAt!: Date
}
