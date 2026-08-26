import { Controller, Post, Get, Delete, Param, Body, UseGuards, HttpException, HttpStatus, Res, Logger } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { AnalysisService } from './analysis.service'
import { DocumentAnalysisAgent } from './agents/document-analysis.agent'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AnalysisResult } from './analysis-result.entity'
import type { Response } from 'express'

@ApiTags('analysis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analysis')
export class AnalysisHttpController {
  private readonly logger = new Logger(AnalysisHttpController.name)

  constructor(
    private analysisService: AnalysisService,
    private analysisAgent: DocumentAnalysisAgent,
    @InjectRepository(AnalysisResult) private analysisRepository: Repository<AnalysisResult>,
  ) {}

  @Post(':id/retranslate')
  async retranslate(@Param('id') id: string, @Body() body: { language: string }) {
    try {
      return await this.analysisService.retranslate(id, body.language)
    } catch (err: any) {
      if (err?.isRateLimit) {
        throw new HttpException(
          { message: err.message, isRateLimit: true, retryAfter: err.retryAfter },
          HttpStatus.TOO_MANY_REQUESTS,
        )
      }
      throw err
    }
  }

  @Post(':id/reanalyze')
  async reanalyze(@Param('id') id: string, @Body() body: { language?: string }) {
    try {
      return await this.analysisService.reanalyze(id, body.language || 'English')
    } catch (err: any) {
      if (err?.isRateLimit) {
        throw new HttpException(
          { message: err.message, isRateLimit: true, retryAfter: err.retryAfter },
          HttpStatus.TOO_MANY_REQUESTS,
        )
      }
      throw err
    }
  }

  @Get(':id/translations')
  async getTranslations(@Param('id') id: string) {
    return this.analysisService.getTranslations(id)
  }

  @Delete(':id/translations/:language')
  async deleteTranslation(@Param('id') id: string, @Param('language') language: string) {
    await this.analysisService.deleteTranslation(id, decodeURIComponent(language))
    return { success: true }
  }

  @Get(':id/revisions')
  async getRevisions(@Param('id') id: string) {
    return this.analysisService.getRevisions(id)
  }

  @Post(':id/revisions/:revisionId/restore')
  async restoreRevision(@Param('id') id: string, @Param('revisionId') revisionId: string) {
    return this.analysisService.restoreRevision(id, revisionId)
  }

  @Post(':id/chat')
  async chat(
    @Param('id') id: string,
    @Body() body: { messages: Array<{ role: 'user' | 'model'; content: string }> },
    @Res() res: Response,
  ) {
    const analysis = await this.analysisRepository.findOne({ where: { id } })
    if (!analysis) {
      res.status(404).json({ message: 'Analysis not found' })
      return
    }
    const userMsg = body.messages?.[body.messages.length - 1]?.content?.slice(0, 80) ?? ''
    this.logger.log(`[Chat/doc] analysisId=${id} doc="${analysis.documentType}" turns=${body.messages?.length} msg="${userMsg}${userMsg.length >= 80 ? '…' : ''}"`)

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders()

    try {
      const stream = this.analysisAgent.chatStream(
        {
          rawText: analysis.rawText || '',
          translatedText: analysis.translatedText || '',
          summary: analysis.summary || '',
          documentType: analysis.documentType || '',
        },
        body.messages,
      )
      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`)
      }
      res.write('data: [DONE]\n\n')
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({ error: err?.message || 'Chat failed' })}\n\n`)
    } finally {
      res.end()
    }
  }
}
