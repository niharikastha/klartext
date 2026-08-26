import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request, Res, Logger } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ChatService } from './chat.service'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AnalysisResult } from '../analysis/analysis-result.entity'
import { Document } from '../documents/document.entity'
import { ActionItem } from '../action-items/action-item.entity'
import { DocumentAnalysisAgent } from '../analysis/agents/document-analysis.agent'
import type { Response } from 'express'

// ─── Tool definitions ────────────────────────────────────────────────────────

const CHAT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'list_my_documents',
      description: 'List all documents uploaded by the user: document ID, file name, document type, analysis status (completed/processing/failed), a brief summary, risk level, and upload date. Always call this first when the user asks about a specific document by name so you can get its ID.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_my_action_items',
      description: "List action items extracted from the user's documents. Each item includes title, description, deadline, priority (low/medium/high/urgent), completion status, and the document it came from.",
      parameters: {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            enum: ['all', 'pending', 'completed'],
            description: 'Filter by completion status. Defaults to "all".',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_documents',
      description: "Search across all user's documents by keyword or phrase. Use when the user asks about a specific topic, wants to find documents mentioning something, or asks 'do I have anything about X'.",
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Keywords or phrase to search for in document content and summaries.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_document_details',
      description: 'Get full details of a specific document: complete summary, all extracted key data fields (employer, salary, dates, etc.), risk explanation, and all action items with deadlines. Use when the user asks about a specific document by name or wants more detail.',
      parameters: {
        type: 'object',
        properties: {
          document_id: {
            type: 'string',
            description: 'The document ID obtained from list_my_documents.',
          },
        },
        required: ['document_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_full_document_text',
      description: "Get the full translated text of a specific document. Use ONLY when the user explicitly asks to read, see, or translate the full document content. Optionally translate to a different language by specifying it.",
      parameters: {
        type: 'object',
        properties: {
          document_id: {
            type: 'string',
            description: 'The document ID obtained from list_my_documents.',
          },
          language: {
            type: 'string',
            description: "Target language for translation, e.g. 'Hindi', 'French', 'Arabic'. Omit or use 'English' for the default English translation.",
          },
        },
        required: ['document_id'],
      },
    },
  },
]

const TOOL_LABELS: Record<string, string> = {
  list_my_documents: 'Looking up your documents',
  list_my_action_items: 'Checking your action items',
  search_documents: 'Searching your documents',
  get_document_details: 'Reading document details',
  get_full_document_text: 'Fetching document text',
}

// ─── System prompt builders ───────────────────────────────────────────────────

function buildSystemPrompt(analysisContext: AnalysisResult | null, hasTools: boolean): string {
  const toolNote = hasTools
    ? `\n\nTOOL USE RULES — follow these strictly:
- ONLY call a tool when the user is asking about documents or files THEY HAVE ALREADY UPLOADED to this app.
- NEVER call a tool for general knowledge questions, even if they mention "documents", "visa", "Germany", "moving", or anything similar. Those are knowledge questions — answer them directly from your training.
- Examples that DO use tools: "show my documents", "what deadlines do I have?", "search my files for rental contract", "translate my Mietvertrag to Hindi"
- Examples that do NOT use tools: "what documents do I need to move to Germany?", "how does Anmeldung work?", "what is a Steuerbescheid?", "how do I apply for a visa?" — answer these from your own knowledge.
- Available tools (only when rule above applies): list_my_documents, list_my_action_items, search_documents, get_document_details, get_full_document_text`
    : ''

  if (analysisContext) {
    return `You are a helpful AI assistant. You have full context of the following uploaded document and can answer questions about it:

Document type: ${analysisContext.documentType}
Summary: ${analysisContext.summary}
Full translation: ${analysisContext.translatedText}
Original text: ${analysisContext.rawText || '(not available)'}

You can also answer any general question the user asks — German bureaucracy, immigration processes, coding, science, or anything else. You are not limited to this document.${toolNote}`
  }

  return `You are a helpful AI assistant. Answer any question the user asks — German immigration, bureaucracy, visa processes, coding, science, general advice, or anything else. You have broad general knowledge and should use it freely.

Only use tools when the user asks about documents or files they have personally uploaded to this app. For all general knowledge questions, answer directly without calling any tool.
Be concise, practical, and friendly.${toolNote}`
}

// ─── Controller ───────────────────────────────────────────────────────────────

@ApiTags('chat-sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat-sessions')
export class ChatController {
  private readonly logger = new Logger(ChatController.name)

  constructor(
    private chatService: ChatService,
    private analysisAgent: DocumentAnalysisAgent,
    @InjectRepository(AnalysisResult) private analysisRepo: Repository<AnalysisResult>,
    @InjectRepository(Document) private docRepo: Repository<Document>,
    @InjectRepository(ActionItem) private actionItemRepo: Repository<ActionItem>,
  ) {}

  @Get()
  list(@Request() req: any) {
    return this.chatService.listSessions(req.user.id)
  }

  @Post()
  create(@Request() req: any, @Body() body: { documentId?: string; documentName?: string; title?: string }) {
    return this.chatService.createSession(req.user.id, body)
  }

  @Get(':id')
  get(@Param('id') id: string, @Request() req: any) {
    return this.chatService.getSession(id, req.user.id)
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { documentId?: string | null; documentName?: string | null; title?: string },
  ) {
    return this.chatService.updateSession(id, req.user.id, body)
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Request() req: any) {
    await this.chatService.deleteSession(id, req.user.id)
    return { success: true }
  }

  // ─── Tool executor ────────────────────────────────────────────────────────────

  private async executeToolCall(userId: string, toolName: string, args: any, refs?: Map<string, any>): Promise<string> {
    if (toolName === 'list_my_documents') {
      const docs = await this.docRepo.find({
        where: { userId },
        relations: ['analysisResult'],
        order: { uploadedAt: 'DESC' },
      })
      const result = docs.map(d => ({
        id: d.id,
        name: d.fileName,
        type: d.analysisResult?.documentType || 'Unknown',
        status: d.analysisStatus,
        summary: d.analysisResult?.summary?.slice(0, 200) || null,
        riskLevel: d.analysisResult?.riskLevel || null,
        uploadedAt: d.uploadedAt,
      }))
      return JSON.stringify(result)
    }

    if (toolName === 'list_my_action_items') {
      const filter: string = args?.filter || 'all'
      const docs = await this.docRepo.find({
        where: { userId },
        relations: ['analysisResult', 'analysisResult.actionItems'],
        order: { uploadedAt: 'DESC' },
      })
      const items: any[] = []
      for (const doc of docs) {
        for (const item of doc.analysisResult?.actionItems || []) {
          if (filter === 'pending' && item.completed) continue
          if (filter === 'completed' && !item.completed) continue
          items.push({
            title: item.title,
            description: item.description,
            deadline: item.deadline || null,
            priority: item.priority,
            category: item.category,
            completed: item.completed,
            document: doc.fileName,
          })
        }
      }
      items.sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0
        if (!a.deadline) return 1
        if (!b.deadline) return -1
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      })
      return JSON.stringify(items)
    }

    if (toolName === 'search_documents') {
      const query: string = args?.query || ''
      if (!query.trim()) return JSON.stringify([])
      const docs = await this.docRepo
        .createQueryBuilder('doc')
        .innerJoinAndSelect('doc.analysisResult', 'ar')
        .where('doc.userId = :userId', { userId })
        .andWhere(
          '(ar.translatedText ILIKE :q OR ar.summary ILIKE :q OR ar.documentType ILIKE :q)',
          { q: `%${query}%` },
        )
        .orderBy('doc.uploadedAt', 'DESC')
        .limit(5)
        .getMany()
      const result = docs.map(d => ({
        id: d.id,
        name: d.fileName,
        type: d.analysisResult?.documentType || 'Unknown',
        summary: d.analysisResult?.summary?.slice(0, 300) || null,
        riskLevel: d.analysisResult?.riskLevel || null,
      }))
      if (refs) {
        for (const d of docs) {
          refs.set(d.id, {
            id: d.id,
            name: d.fileName,
            documentType: d.analysisResult?.documentType || 'Unknown',
            passage: d.analysisResult?.translatedText?.slice(0, 500) || d.analysisResult?.summary || '',
          })
        }
      }
      return JSON.stringify(result.length ? result : { message: 'No documents matched that search.' })
    }

    if (toolName === 'get_document_details') {
      const documentId: string = args?.document_id
      if (!documentId) return JSON.stringify({ error: 'document_id is required' })
      const doc = await this.docRepo.findOne({
        where: { id: documentId, userId },
        relations: ['analysisResult', 'analysisResult.actionItems'],
      })
      if (!doc) return JSON.stringify({ error: 'Document not found' })
      if (refs) {
        refs.set(doc.id, {
          id: doc.id,
          name: doc.fileName,
          documentType: doc.analysisResult?.documentType || 'Unknown',
          passage: doc.analysisResult?.summary || '',
        })
      }
      const ar = doc.analysisResult
      return JSON.stringify({
        id: doc.id,
        name: doc.fileName,
        type: ar?.documentType || 'Unknown',
        summary: ar?.summary || null,
        riskLevel: ar?.riskLevel || null,
        riskExplanation: ar?.riskExplanation || null,
        extractedData: ar?.extractedData || {},
        actionItems: (ar?.actionItems || []).map(i => ({
          title: i.title,
          description: i.description,
          deadline: i.deadline || null,
          priority: i.priority,
          category: i.category,
          completed: i.completed,
        })),
      })
    }

    if (toolName === 'get_full_document_text') {
      const documentId: string = args?.document_id
      const language: string = args?.language || 'English'
      if (!documentId) return JSON.stringify({ error: 'document_id is required' })
      const doc = await this.docRepo.findOne({ where: { id: documentId, userId } })
      if (!doc) return JSON.stringify({ error: 'Document not found' })
      const ar = await this.analysisRepo.findOne({ where: { documentId } })
      if (!ar) return JSON.stringify({ error: 'Document has not been analysed yet' })
      if (refs && doc) {
        refs.set(doc.id, {
          id: doc.id,
          name: doc.fileName,
          documentType: ar.documentType || 'Unknown',
          passage: ar.translatedText?.slice(0, 500) || '',
        })
      }

      if (language.toLowerCase() === 'english') {
        return JSON.stringify({ language: 'English', translatedText: ar.translatedText })
      }

      this.logger.log(`[Chat] get_full_document_text: retranslating doc=${documentId} to ${language}`)
      const result = await this.analysisAgent.retranslate(ar.rawText || ar.translatedText, language)
      return JSON.stringify({ language, translatedText: result.translatedText })
    }

    return JSON.stringify({ error: `Unknown tool: ${toolName}` })
  }

  // ─── sendMessage ──────────────────────────────────────────────────────────────

  @Post(':id/messages')
  async sendMessage(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { message: string },
    @Res() res: Response,
  ) {
    const userId = req.user.id
    const startMs = Date.now()
    const session = await this.chatService.getSession(id, userId)
    const msgPreview = `"${body.message?.slice(0, 80)}${(body.message?.length ?? 0) >= 80 ? '…' : ''}"`
    this.logger.log(`[Chat] ▶ START session=${id} user=${userId} docId=${session.documentId ?? 'none'} turns=${session.messages.length} msg=${msgPreview}`)

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    let analysisContext: AnalysisResult | null = null
    if (session.documentId) {
      analysisContext = await this.analysisRepo.findOne({ where: { documentId: session.documentId } })
      this.logger.log(`[Chat] doc context loaded: type="${analysisContext?.documentType ?? 'unknown'}" docId=${session.documentId}`)
    } else {
      this.logger.log(`[Chat] no doc context — general chat mode`)
    }

    const historyMessages = [
      ...session.messages.map(m => ({ role: m.role as 'user' | 'model', content: m.content })),
      { role: 'user' as const, content: body.message },
    ]

    let fullResponse = ''
    const accessedRefs = new Map<string, any>()

    try {
      // ── Groq path with tool calling ──────────────────────────────────────────
      if (this.analysisAgent.isGroqChat) {
        const systemPrompt = buildSystemPrompt(analysisContext, true)
        this.logger.log(`[Chat] provider=groq model=${this.analysisAgent['groqModel']} context=${analysisContext ? 'document' : 'general'}`)

        let groqMessages: any[] = historyMessages.map(m => ({
          role: m.role === 'model' ? 'assistant' : 'user',
          content: m.content,
        }))
        const MAX_ROUNDS = 4
        let totalToolCalls = 0

        for (let round = 0; round < MAX_ROUNDS; round++) {
          this.logger.log(`[Chat] tool-round ${round + 1}/${MAX_ROUNDS} — calling AI for tool decision`)
          const response = await this.analysisAgent.runToolRound(systemPrompt, groqMessages, CHAT_TOOLS)
          const choice = response.choices[0]

          if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls?.length) {
            this.logger.log(`[Chat] tool-round ${round + 1} → finish_reason="${choice.finish_reason}" — no more tool calls, proceeding to stream`)
            break
          }

          const toolNames = choice.message.tool_calls.map((tc: any) => tc.function.name).join(', ')
          this.logger.log(`[Chat] tool-round ${round + 1} → AI wants ${choice.message.tool_calls.length} tool(s): [${toolNames}]`)

          groqMessages.push({
            role: 'assistant',
            content: choice.message.content ?? '',
            tool_calls: choice.message.tool_calls,
          })

          for (const toolCall of choice.message.tool_calls) {
            const toolName: string = toolCall.function.name
            const label = TOOL_LABELS[toolName] || toolName
            totalToolCalls++

            res.write(`data: ${JSON.stringify({ type: 'tool_use', tool: toolName, label })}\n\n`)

            let args: any = {}
            try { args = JSON.parse(toolCall.function.arguments) } catch {}

            const argsPreview = JSON.stringify(args).slice(0, 120)
            this.logger.log(`[Chat] ⚙ executing tool="${toolName}" args=${argsPreview}`)

            const toolStart = Date.now()
            const result = await this.executeToolCall(userId, toolName, args, accessedRefs)
            const toolMs = Date.now() - toolStart

            // Log result summary without dumping the full payload
            let resultSummary: string
            try {
              const parsed = JSON.parse(result)
              if (Array.isArray(parsed)) {
                resultSummary = `array[${parsed.length}]`
              } else if (parsed.error) {
                resultSummary = `error: ${parsed.error}`
              } else {
                const keys = Object.keys(parsed).slice(0, 5).join(', ')
                resultSummary = `object{${keys}}`
              }
            } catch {
              resultSummary = `${result.length} chars`
            }
            this.logger.log(`[Chat] ✓ tool="${toolName}" result=${resultSummary} took=${toolMs}ms`)

            groqMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolName,
              content: result,
            })
          }
        }

        this.logger.log(`[Chat] ▷ streaming response — totalToolCalls=${totalToolCalls} refs=${accessedRefs.size} msgHistory=${groqMessages.length}`)
        for await (const chunk of this.analysisAgent.chatStreamFromGroqMessages(systemPrompt, groqMessages)) {
          fullResponse += chunk
          res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`)
        }
        this.logger.log(`[Chat] ✓ stream complete — responseChars=${fullResponse.length} took=${Date.now() - startMs}ms`)

        if (accessedRefs.size > 0) {
          this.logger.log(`[Chat] emitting ${accessedRefs.size} document reference(s): [${Array.from(accessedRefs.values()).map(r => r.name).join(', ')}]`)
          res.write(`data: ${JSON.stringify({ type: 'references', refs: Array.from(accessedRefs.values()) })}\n\n`)
        }

      } else {
        // ── Gemini / mock fallback ────────────────────────────────────────────
        const systemPrompt = buildSystemPrompt(analysisContext, false)
        this.logger.log(`[Chat] provider=${this.analysisAgent['mockMode'] ? 'mock' : 'gemini'} context=${analysisContext ? 'document' : 'general'}`)
        this.logger.log(`[Chat] ▷ streaming response (no tool calling)`)

        const context = analysisContext
          ? {
              rawText: analysisContext.rawText || '',
              translatedText: analysisContext.translatedText || '',
              summary: analysisContext.summary || '',
              documentType: analysisContext.documentType || '',
            }
          : {
              rawText: '',
              translatedText: '',
              summary: systemPrompt,
              documentType: 'General',
            }

        for await (const chunk of this.analysisAgent.chatStream(context, historyMessages)) {
          fullResponse += chunk
          res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`)
        }
        this.logger.log(`[Chat] ✓ stream complete — responseChars=${fullResponse.length} took=${Date.now() - startMs}ms`)
      }

      res.write('data: [DONE]\n\n')
    } catch (err: any) {
      this.logger.error(`[Chat] ✗ ERROR session=${id} took=${Date.now() - startMs}ms — ${err?.message}`)
      res.write(`data: ${JSON.stringify({ error: err?.message || 'Chat failed' })}\n\n`)
    } finally {
      res.end()
      const now = new Date().toISOString()
      const refs = accessedRefs.size > 0 ? Array.from(accessedRefs.values()) : undefined
      await this.chatService.appendMessages(id, userId, [
        { role: 'user', content: body.message, createdAt: now },
        { role: 'model', content: fullResponse, createdAt: now, refs },
      ])
    }
  }

  // ─── follow-ups ───────────────────────────────────────────────────────────────

  @Post(':id/follow-ups')
  async getFollowUps(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { message: string },
  ): Promise<string[]> {
    const userId = req.user.id
    const session = await this.chatService.getSession(id, userId)
    const lastMessages = session.messages.slice(-6)

    const systemPrompt = 'You are a helpful assistant. Based on the conversation so far, suggest 3 short follow-up questions the user might want to ask next. Return ONLY a JSON array of 3 strings, nothing else. Each question should be concise (under 12 words). Example: ["What is the deadline?", "What documents do I need?", "What happens if I miss it?"]'

    const messages: any[] = [
      ...lastMessages.map((m: any) => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.content })),
    ]
    // Guard against race condition: appendMessages may not have committed yet.
    // Ensure the triggering user message is present so we always have context.
    if (body.message) {
      const alreadyPresent = messages.some(m => m.role === 'user' && m.content === body.message)
      if (!alreadyPresent) messages.push({ role: 'user', content: body.message })
    }
    if (!messages.length) return []

    try {
      const response = await this.analysisAgent.runToolRound(systemPrompt, messages, [])
      const content = response.choices[0]?.message?.content || '[]'
      const clean = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      const parsed = JSON.parse(clean)
      return Array.isArray(parsed) ? parsed.slice(0, 3) : []
    } catch {
      return []
    }
  }
}
