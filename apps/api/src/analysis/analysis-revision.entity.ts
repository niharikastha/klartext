import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { AnalysisResult } from './analysis-result.entity'

@Entity('analysis_revisions')
export class AnalysisRevision {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  analysisResultId!: string

  @ManyToOne(() => AnalysisResult, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'analysisResultId' })
  analysisResult!: AnalysisResult

  @Column({ type: 'int' })
  revisionNumber!: number

  @Column({ type: 'text' })
  summary!: string

  @Column({ type: 'varchar' })
  documentType!: string

  @Column({ type: 'varchar' })
  riskLevel!: string

  @Column({ type: 'text', nullable: true })
  riskExplanation!: string | null

  @Column({ type: 'jsonb', nullable: true })
  extractedData!: Record<string, string> | null

  @Column({ type: 'text' })
  translatedText!: string

  @Column({ type: 'jsonb', nullable: true })
  actionItemsSnapshot!: Array<{
    title: string
    description: string
    deadline: string | null
    priority: string
    category: string
    completed: boolean
  }> | null

  @CreateDateColumn()
  createdAt!: Date
}
