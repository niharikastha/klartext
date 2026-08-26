import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ChatSession } from './chat-session.entity'
import { AnalysisResult } from '../analysis/analysis-result.entity'
import { Document } from '../documents/document.entity'
import { ActionItem } from '../action-items/action-item.entity'
import { ChatService } from './chat.service'
import { ChatController } from './chat.controller'
import { DocumentAnalysisAgent } from '../analysis/agents/document-analysis.agent'

@Module({
  imports: [TypeOrmModule.forFeature([ChatSession, AnalysisResult, Document, ActionItem])],
  providers: [ChatService, DocumentAnalysisAgent],
  controllers: [ChatController],
})
export class ChatModule {}
