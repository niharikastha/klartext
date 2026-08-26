import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Document } from './document.entity'
import { AnalysisService } from '../analysis/analysis.service'

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private documentsRepository: Repository<Document>,
    private analysisService: AnalysisService,
  ) {}

  async upload(file: Express.Multer.File, userId: string, userLanguage = 'English'): Promise<Document> {
    const document = this.documentsRepository.create({
      userId,
      fileName: file.originalname,
      fileType: file.mimetype,
      filePath: file.path,
      fileSize: file.size,
      analysisStatus: 'pending',
    })

    const saved = await this.documentsRepository.save(document)

    // Fire-and-forget async analysis
    this.analysisService
      .analyzeDocument(saved.id, file.path, file.mimetype, userLanguage)
      .catch(err => console.error('Analysis error:', err))

    return saved
  }

  async findAllByUser(userId: string): Promise<Document[]> {
    return this.documentsRepository.find({
      where: { userId },
      relations: ['analysisResult', 'analysisResult.actionItems', 'tags'],
      order: { uploadedAt: 'DESC' },
    })
  }

  async findOne(id: string, userId: string): Promise<Document> {
    const doc = await this.documentsRepository.findOne({
      where: { id },
      relations: ['analysisResult', 'analysisResult.actionItems', 'tags'],
    })
    if (!doc) throw new NotFoundException('Document not found')
    if (doc.userId !== userId) throw new ForbiddenException()
    return doc
  }

  async remove(id: string, userId: string): Promise<void> {
    const doc = await this.findOne(id, userId)
    await this.documentsRepository.remove(doc)
  }
}
