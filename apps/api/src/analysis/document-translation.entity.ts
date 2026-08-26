import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm'
import { AnalysisResult } from './analysis-result.entity'

@Entity('document_translations')
export class DocumentTranslation {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  analysisResultId!: string

  @ManyToOne(() => AnalysisResult, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'analysisResultId' })
  analysisResult!: AnalysisResult

  @Column()
  language!: string

  @Column('text')
  summary!: string

  @Column('text')
  translatedText!: string

  @Column({ type: 'text', nullable: true })
  riskExplanation!: string | null

  @Column({ nullable: true, type: 'varchar' })
  documentType!: string | null

  @Column({ type: 'jsonb', nullable: true })
  extractedData!: Record<string, string> | null

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
