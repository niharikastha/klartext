import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AnalysisResult } from './analysis-result.entity'
import { ActionItem } from '../action-items/action-item.entity'
import { DocumentTranslation } from './document-translation.entity'
import { AnalysisRevision } from './analysis-revision.entity'
import { Document } from '../documents/document.entity'
import { AnalysisService } from './analysis.service'
import { AnalysisController } from './analysis.controller'
import { AnalysisHttpController } from './analysis-http.controller'
import { DocumentAnalysisAgent } from './agents/document-analysis.agent'

@Module({
  imports: [TypeOrmModule.forFeature([AnalysisResult, ActionItem, DocumentTranslation, AnalysisRevision, Document])],
  providers: [AnalysisService, DocumentAnalysisAgent],
  controllers: [AnalysisController, AnalysisHttpController],
  exports: [AnalysisService],
})
export class AnalysisModule {}
