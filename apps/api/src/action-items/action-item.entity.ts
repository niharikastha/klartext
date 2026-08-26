import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm'
import { AnalysisResult } from '../analysis/analysis-result.entity'

@Entity('action_items')
export class ActionItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @ManyToOne(() => AnalysisResult, result => result.actionItems, { onDelete: 'CASCADE' })
  analysisResult!: AnalysisResult

  @Column()
  title!: string

  @Column({ type: 'text' })
  description!: string

  @Column({ nullable: true, type: 'timestamp' })
  deadline!: Date

  @Column({ default: 'medium' })
  priority!: string

  @Column({ default: false })
  completed!: boolean

  @Column({ default: 'other' })
  category!: string

  @CreateDateColumn()
  createdAt!: Date
}
