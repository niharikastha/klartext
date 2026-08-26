import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource } from 'typeorm'
import { AnalysisResult } from './analysis-result.entity'
import { ActionItem } from '../action-items/action-item.entity'
import { DocumentTranslation } from './document-translation.entity'
import { AnalysisRevision } from './analysis-revision.entity'
import { Document } from '../documents/document.entity'
import { DocumentAnalysisAgent } from './agents/document-analysis.agent'

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name)

  constructor(
    @InjectRepository(AnalysisResult)
    private analysisRepository: Repository<AnalysisResult>,
    @InjectRepository(ActionItem)
    private actionItemsRepository: Repository<ActionItem>,
    @InjectRepository(DocumentTranslation)
    private translationRepository: Repository<DocumentTranslation>,
    @InjectRepository(AnalysisRevision)
    private revisionRepository: Repository<AnalysisRevision>,
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    private analysisAgent: DocumentAnalysisAgent,
    private dataSource: DataSource,
  ) {}

  async analyzeDocument(documentId: string, filePath: string, fileType: string, userLanguage = 'English'): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      await queryRunner.manager.update('documents', { id: documentId }, { analysisStatus: 'processing' })

      const result = await this.analysisAgent.analyze({ filePath, fileType, userLanguage })

      const analysis = queryRunner.manager.create(AnalysisResult, {
        documentId,
        summary: result.summary,
        documentType: result.documentType,
        riskLevel: result.riskLevel,
        riskExplanation: result.riskExplanation,
        extractedData: result.extractedData,
        translatedText: result.translatedText,
        rawText: result.rawText,
      })

      const savedAnalysis = await queryRunner.manager.save(AnalysisResult, analysis)

      const actionItems = result.actionItems.map(item =>
        queryRunner.manager.create(ActionItem, {
          analysisResult: { id: savedAnalysis.id },
          title: item.title,
          description: item.description,
          deadline: item.deadline ? new Date(item.deadline) : undefined,
          priority: item.priority,
          category: item.category,
        }),
      )

      await queryRunner.manager.save(ActionItem, actionItems)
      await queryRunner.manager.update('documents', { id: documentId }, { analysisStatus: 'completed' })
      await queryRunner.commitTransaction()

      this.logger.log(`Analysis complete for document ${documentId}`)
    } catch (error) {
      await queryRunner.rollbackTransaction()
      await queryRunner.manager.update('documents', { id: documentId }, { analysisStatus: 'failed' })
      this.logger.error(`Analysis failed for document ${documentId}:`, error)
    } finally {
      await queryRunner.release()
    }
  }

  async reanalyze(analysisId: string, userLanguage = 'English') {
    const analysis = await this.analysisRepository.findOne({
      where: { id: analysisId },
      relations: ['actionItems'],
    })
    if (!analysis) throw new NotFoundException('Analysis result not found')

    const document = await this.documentRepository.findOne({ where: { id: analysis.documentId } })
    if (!document) throw new NotFoundException('Document not found')

    // Save current state as a revision before overwriting
    const revisionCount = await this.revisionRepository.count({ where: { analysisResultId: analysisId } })
    const revision = this.revisionRepository.create({
      analysisResultId: analysisId,
      revisionNumber: revisionCount + 1,
      summary: analysis.summary,
      documentType: analysis.documentType,
      riskLevel: analysis.riskLevel,
      riskExplanation: analysis.riskExplanation ?? null,
      extractedData: analysis.extractedData ?? null,
      translatedText: analysis.translatedText,
      actionItemsSnapshot: (analysis.actionItems || []).map(i => ({
        title: i.title,
        description: i.description,
        deadline: i.deadline ? i.deadline.toISOString() : null,
        priority: i.priority,
        category: i.category,
        completed: i.completed,
      })),
    })
    await this.revisionRepository.save(revision)

    // Re-run full analysis pipeline
    this.logger.log(`Re-analyzing document ${document.id} in ${userLanguage}`)
    const result = await this.analysisAgent.analyze({
      filePath: document.filePath,
      fileType: document.fileType,
      userLanguage,
    })

    // Update the AnalysisResult in-place
    await this.analysisRepository.update(analysisId, {
      summary: result.summary,
      documentType: result.documentType,
      riskLevel: result.riskLevel,
      riskExplanation: result.riskExplanation,
      extractedData: result.extractedData,
      translatedText: result.translatedText,
      rawText: result.rawText,
    })

    // Replace action items
    await this.actionItemsRepository.delete({ analysisResult: { id: analysisId } })
    const newActionItems = result.actionItems.map(item =>
      this.actionItemsRepository.create({
        analysisResult: { id: analysisId },
        title: item.title,
        description: item.description,
        deadline: item.deadline ? new Date(item.deadline) : undefined,
        priority: item.priority,
        category: item.category,
      }),
    )
    const savedItems = await this.actionItemsRepository.save(newActionItems)

    await this.documentRepository.update(document.id, { analysisStatus: 'completed' })

    return {
      ...analysis,
      summary: result.summary,
      documentType: result.documentType,
      riskLevel: result.riskLevel,
      riskExplanation: result.riskExplanation,
      extractedData: result.extractedData,
      translatedText: result.translatedText,
      actionItems: savedItems,
    }
  }

  async getRevisions(analysisId: string) {
    return this.revisionRepository.find({
      where: { analysisResultId: analysisId },
      order: { revisionNumber: 'DESC' },
    })
  }

  async restoreRevision(analysisId: string, revisionId: string) {
    const revision = await this.revisionRepository.findOne({ where: { id: revisionId, analysisResultId: analysisId } })
    if (!revision) throw new NotFoundException('Revision not found')

    const analysis = await this.analysisRepository.findOne({
      where: { id: analysisId },
      relations: ['actionItems'],
    })
    if (!analysis) throw new NotFoundException('Analysis result not found')

    // Save current as a new revision before restoring
    const revisionCount = await this.revisionRepository.count({ where: { analysisResultId: analysisId } })
    const snapshot = this.revisionRepository.create({
      analysisResultId: analysisId,
      revisionNumber: revisionCount + 1,
      summary: analysis.summary,
      documentType: analysis.documentType,
      riskLevel: analysis.riskLevel,
      riskExplanation: analysis.riskExplanation ?? null,
      extractedData: analysis.extractedData ?? null,
      translatedText: analysis.translatedText,
      actionItemsSnapshot: (analysis.actionItems || []).map(i => ({
        title: i.title,
        description: i.description,
        deadline: i.deadline ? i.deadline.toISOString() : null,
        priority: i.priority,
        category: i.category,
        completed: i.completed,
      })),
    })
    await this.revisionRepository.save(snapshot)

    // Restore revision data
    await this.analysisRepository.update(analysisId, {
      summary: revision.summary,
      documentType: revision.documentType,
      riskLevel: revision.riskLevel,
      riskExplanation: revision.riskExplanation ?? undefined,
      extractedData: revision.extractedData ?? undefined,
      translatedText: revision.translatedText,
    })

    // Replace action items from snapshot
    await this.actionItemsRepository.delete({ analysisResult: { id: analysisId } })
    const restoredItems: ActionItem[] = []
    if (revision.actionItemsSnapshot?.length) {
      const items = revision.actionItemsSnapshot.map(i =>
        this.actionItemsRepository.create({
          analysisResult: { id: analysisId },
          title: i.title,
          description: i.description,
          deadline: i.deadline ? new Date(i.deadline) : undefined,
          priority: i.priority,
          category: i.category,
          completed: i.completed,
        }),
      )
      restoredItems.push(...await this.actionItemsRepository.save(items))
    }

    return {
      ...analysis,
      summary: revision.summary,
      documentType: revision.documentType,
      riskLevel: revision.riskLevel,
      riskExplanation: revision.riskExplanation,
      extractedData: revision.extractedData,
      translatedText: revision.translatedText,
      actionItems: restoredItems,
    }
  }

  async retranslate(analysisId: string, language: string) {
    const analysis = await this.analysisRepository.findOne({ where: { id: analysisId } })
    if (!analysis) throw new NotFoundException('Analysis result not found')

    const existing = await this.translationRepository.findOne({
      where: { analysisResultId: analysisId, language },
    })
    if (existing) {
      return {
        summary: existing.summary,
        translatedText: existing.translatedText,
        documentType: existing.documentType ?? '',
        riskExplanation: existing.riskExplanation ?? '',
        extractedData: existing.extractedData ?? {},
        language,
      }
    }

    const sourceText = analysis.rawText || analysis.translatedText
    const result = await this.analysisAgent.retranslate(sourceText, language)

    const translation = this.translationRepository.create({
      analysisResultId: analysisId,
      language,
      summary: result.summary,
      translatedText: result.translatedText,
      riskExplanation: result.riskExplanation,
      documentType: result.documentType || null,
      extractedData: result.keyData || null,
    })
    await this.translationRepository.save(translation)

    return {
      summary: result.summary,
      translatedText: result.translatedText,
      documentType: result.documentType,
      riskExplanation: result.riskExplanation,
      extractedData: result.keyData,
      language,
    }
  }

  async getTranslations(analysisId: string): Promise<Record<string, any>> {
    const translations = await this.translationRepository.find({
      where: { analysisResultId: analysisId },
      order: { createdAt: 'ASC' },
    })

    const result: Record<string, any> = {}
    for (const t of translations) {
      result[t.language] = {
        summary: t.summary,
        translatedText: t.translatedText,
        riskExplanation: t.riskExplanation,
        documentType: t.documentType,
        extractedData: t.extractedData,
        language: t.language,
      }
    }
    return result
  }

  async deleteTranslation(analysisId: string, language: string): Promise<void> {
    await this.translationRepository.delete({ analysisResultId: analysisId, language })
  }
}
