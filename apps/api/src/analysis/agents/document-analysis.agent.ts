import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Groq from 'groq-sdk'
import * as fs from 'fs'

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 2000): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      const msg: string = err?.message || ''
      const is503 = msg.includes('503') || msg.includes('Service Unavailable')
      const is429 = msg.includes('429') || msg.includes('Too Many Requests')

      if (is429) {
        const match = msg.match(/retry in ([\d.]+)s/i)
        const waitSec = match ? Math.ceil(parseFloat(match[1])) : 60
        if (waitSec <= 65 && attempt < retries) {
          await new Promise(r => setTimeout(r, waitSec * 1000))
          continue
        }
        throw Object.assign(new Error(`Gemini rate limit reached. Please wait ${waitSec} seconds and try again.`), { isRateLimit: true, retryAfter: waitSec })
      }

      if (is503 && attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs * 2 ** attempt))
        continue
      }
      throw err
    }
  }
  throw new Error('Unreachable')
}

export interface DocumentAnalysisInput {
  filePath: string
  fileType: string
  userLanguage: string
}

export interface AnalyzedDocument {
  summary: string
  documentType: string
  riskLevel: 'low' | 'medium' | 'high'
  riskExplanation: string
  extractedData: Record<string, string>
  translatedText: string
  rawText: string
  actionItems: Array<{
    title: string
    description: string
    deadline?: string
    priority: 'low' | 'medium' | 'high' | 'urgent'
    category: 'deadline' | 'document' | 'payment' | 'appointment' | 'other'
  }>
}

export interface RetranslateResult {
  summary: string
  translatedText: string
  documentType: string
  riskExplanation: string
  keyData: Record<string, string>
}

@Injectable()
export class DocumentAnalysisAgent {
  private readonly logger = new Logger(DocumentAnalysisAgent.name)
  private genAI: GoogleGenerativeAI
  private groq: Groq
  private groqModel: string
  private mockMode: boolean
  private useGroqForAnalysis: boolean
  private useGroqForChat: boolean

  constructor(private configService: ConfigService) {
    this.genAI = new GoogleGenerativeAI(this.configService.get('GEMINI_API_KEY') || '')
    this.groq = new Groq({ apiKey: this.configService.get('GROQ_API_KEY') || '' })
    this.groqModel = this.configService.get('GROQ_MODEL') || 'qwen/qwen3.6-27b'
    this.mockMode = this.configService.get('MOCK_AI') === 'true'

    const provider = (this.configService.get('AI_PROVIDER') || '').toLowerCase()
    this.useGroqForAnalysis = provider === 'groq'
    // empty = default mode: gemini for analysis, groq for chat
    this.useGroqForChat = provider === 'groq' || provider === ''

    if (this.mockMode) {
      this.logger.warn('[MOCK MODE] AI calls disabled — returning canned responses')
    } else {
      this.logger.log(`AI provider: analysis=${this.useGroqForAnalysis ? 'groq' : 'gemini'}, chat=${this.useGroqForChat ? 'groq' : 'gemini'}, groqModel=${this.groqModel}`)
    }
  }

  // ─── PUBLIC: analyze ────────────────────────────────────────────────────────

  async analyze(input: DocumentAnalysisInput): Promise<AnalyzedDocument> {
    if (this.mockMode) {
      this.logger.log('[MOCK] analyze() — returning mock document')
      await new Promise(r => setTimeout(r, 400))
      return {
        summary: '[MOCK] This is a mock employment contract. The employer is TechSolutions GmbH and the employee starts on January 1, 2026 with a salary of €4,500/month.',
        documentType: 'Arbeitsvertrag (Employment Contract)',
        riskLevel: 'medium',
        riskExplanation: '[MOCK] Missing the document submission deadline may delay your work permit processing.',
        extractedData: { Employer: 'TechSolutions GmbH', Salary: '€4,500/month', 'Start Date': '2026-01-01', Location: 'Berlin' },
        translatedText: '[MOCK] Employment Contract — TechSolutions GmbH agrees to employ the above person starting January 1, 2026. Monthly gross salary: €4,500. Working hours: 40 hrs/week. Notice period: 3 months.',
        rawText: '[MOCK] Raw German text would appear here.',
        actionItems: [
          { title: 'Submit signed contract to HR', description: 'Send both signed copies to hr@techsolutions.de by August 25, 2026.', deadline: '2026-08-25', priority: 'urgent', category: 'document' },
          { title: 'Provide bank IBAN', description: 'Send your German bank IBAN to HR for salary transfer.', deadline: undefined, priority: 'high', category: 'document' },
          { title: 'Submit Tax ID (Steuer-ID)', description: 'Provide your Steueridentifikationsnummer to the HR department.', deadline: undefined, priority: 'medium', category: 'document' },
        ],
      }
    }

    if (this.useGroqForAnalysis) {
      this.logger.log(`[Groq] Starting 4-agent pipeline for ${input.fileType}`)
      const extracted = await this.agent1_extractGroq(input)
      const classified = await this.agent2_classifyGroq(extracted, input.userLanguage)
      const actionItems = await this.agent3_extractActionsGroq(classified)
      const risk = this.agent4_assessRisk(actionItems)
      return {
        summary: classified.summary,
        documentType: classified.documentType,
        riskLevel: risk,
        riskExplanation: classified.riskExplanation,
        extractedData: classified.keyData,
        translatedText: classified.translation,
        rawText: extracted,
        actionItems,
      }
    }

    this.logger.log(`[Gemini] Starting 4-agent pipeline for ${input.fileType}`)
    const extracted = await this.agent1_extract(input)
    const classified = await this.agent2_classify(extracted, input.userLanguage)
    const actionItems = await this.agent3_extractActions(classified)
    const risk = this.agent4_assessRisk(actionItems)

    return {
      summary: classified.summary,
      documentType: classified.documentType,
      riskLevel: risk,
      riskExplanation: classified.riskExplanation,
      extractedData: classified.keyData,
      translatedText: classified.translation,
      rawText: extracted,
      actionItems,
    }
  }

  // ─── PUBLIC: retranslate ─────────────────────────────────────────────────────

  async retranslate(rawText: string, language: string): Promise<RetranslateResult> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] retranslate() — ${language}`)
      await new Promise(r => setTimeout(r, 300))
      return {
        summary: `[MOCK ${language}] This employment contract outlines your job at TechSolutions GmbH starting January 2026 with a salary of €4,500/month.`,
        translatedText: `[MOCK ${language}] Employment Contract translation — TechSolutions GmbH, salary €4,500/month, 40hrs/week, 3-month notice period.`,
        documentType: 'Arbeitsvertrag',
        riskExplanation: `[MOCK ${language}] Missing submission deadlines could delay your work permit.`,
        keyData: { Employer: 'TechSolutions GmbH', Salary: '€4,500/month' },
      }
    }

    if (this.useGroqForChat) {
      this.logger.log(`[Groq] Retranslating to ${language}`)
      return this.retranslateGroq(rawText, language)
    }

    this.logger.log(`[Gemini] Retranslating document to ${language}`)
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: { responseMimeType: 'application/json' },
    })

    const trimmed = rawText.length > 6000 ? rawText.slice(0, 6000) + '\n[truncated]' : rawText
    const prompt = `You are a translation assistant for German documents.

Translate the following German document text into ${language}. Be accurate and clear — the reader is an immigrant who needs to understand what this document requires of them.

Return JSON with exactly this shape:
{
  "summary": "2-3 sentence plain-language summary in ${language}",
  "translatedText": "full translation of the document in ${language}",
  "riskExplanation": "1-2 sentences on what happens if the recipient ignores this document"
}

Document text:
${trimmed}`

    const result = await withRetry(() => model.generateContent(prompt))
    const parsed = JSON.parse(result.response.text())
    return {
      summary: parsed.summary,
      translatedText: parsed.translatedText,
      documentType: '',
      riskExplanation: parsed.riskExplanation,
      keyData: {},
    }
  }

  // ─── PUBLIC: chatStream ──────────────────────────────────────────────────────

  async *chatStream(
    context: { rawText: string; translatedText: string; summary: string; documentType: string },
    messages: Array<{ role: 'user' | 'model'; content: string }>,
  ): AsyncGenerator<string> {
    const userMsg = messages[messages.length - 1]?.content?.slice(0, 80) ?? ''

    if (this.mockMode) {
      this.logger.log('[MOCK] chatStream() — streaming canned reply')
      const reply = `[MOCK AI response to: "${userMsg}"]\n\nThis is a **mock response** because \`MOCK_AI=true\` is set.\n\nIn production, AI would answer based on:\n- Document type: **${context.documentType || 'General'}**\n- ${context.summary ? `Summary: ${context.summary.slice(0, 80)}…` : 'No document context'}\n\nTo disable mock mode, set \`MOCK_AI=false\` in your \`.env\` file and restart the server.`
      const words = reply.split(' ')
      for (const word of words) {
        await new Promise(r => setTimeout(r, 30))
        yield word + ' '
      }
      return
    }

    if (this.useGroqForChat) {
      this.logger.log(`[Groq] chatStream — doc="${context.documentType}" turns=${messages.length} msg="${userMsg}${userMsg.length >= 80 ? '…' : ''}"`)
      yield* this.chatStreamGroq(context, messages)
      return
    }

    this.logger.log(`[Gemini] chatStream — doc="${context.documentType}" turns=${messages.length} msg="${userMsg}${userMsg.length >= 80 ? '…' : ''}"`)

    const model = this.genAI.getGenerativeModel({ model: 'gemini-3.6-flash' })

    const systemContext = `You are a helpful document assistant for an immigrant navigating German bureaucracy.
You have full context of the following document:

Document type: ${context.documentType}
Summary: ${context.summary}
Full translation: ${context.translatedText}
Original text: ${context.rawText || '(not available)'}

Answer questions about this document clearly and helpfully in English. You can:
- Explain what the document means
- Explain consequences of ignoring deadlines or requirements
- List what documents the user needs to bring
- Explain processes step by step
- Translate specific parts
- Suggest next steps

Be concise, practical, and reassuring. If you're unsure about something, say so.`

    const history = messages.slice(0, -1).map(m => ({
      role: m.role,
      parts: [{ text: m.content }],
    }))

    const lastMessage = messages[messages.length - 1]

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemContext }] },
        { role: 'model', parts: [{ text: "I understand. I have full context of this document and I'm ready to answer your questions about it." }] },
        ...history,
      ],
    })

    let result: Awaited<ReturnType<typeof chat.sendMessageStream>>
    try {
      result = await chat.sendMessageStream(lastMessage.content)
    } catch (err: any) {
      const msg: string = err?.message || ''
      if (msg.includes('429') || msg.includes('Too Many Requests')) {
        const match = msg.match(/retry in ([\d.]+)s/i)
        const waitSec = match ? Math.ceil(parseFloat(match[1])) : 60
        this.logger.warn(`[Gemini] chatStream rate-limited — retry in ${waitSec}s`)
        throw Object.assign(
          new Error(`Gemini rate limit reached. Please wait ${waitSec} seconds and try again.`),
          { isRateLimit: true, retryAfter: waitSec },
        )
      }
      throw err
    }
    let totalChars = 0
    for await (const chunk of result.stream) {
      const text = chunk.text()
      if (text) { totalChars += text.length; yield text }
    }
    this.logger.log(`[Gemini] chatStream complete — ${totalChars} chars streamed`)
  }

  // ─── PUBLIC: tool-calling helpers ────────────────────────────────────────────

  get isGroqChat(): boolean { return this.useGroqForChat }

  async runToolRound(
    systemPrompt: string,
    messages: any[],
    tools: any[],
  ): Promise<any> {
    return this.groq.chat.completions.create({
      model: this.groqModel,
      messages: [{ role: 'system', content: systemPrompt }, ...messages] as any,
      tools,
      tool_choice: 'auto',
      max_tokens: 1024,
    })
  }

  async *chatStreamFromGroqMessages(systemPrompt: string, messages: any[]): AsyncGenerator<string> {
    const stream = await this.groq.chat.completions.create({
      model: this.groqModel,
      messages: [{ role: 'system', content: systemPrompt }, ...messages] as any,
      stream: true,
      max_tokens: 4096,
    })

    let totalChars = 0
    let inThink = false
    let pending = ''

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || ''
      if (!text) continue
      pending += text

      let out = ''
      while (pending.length > 0) {
        if (inThink) {
          const end = pending.indexOf('</think>')
          if (end === -1) break
          inThink = false
          pending = pending.slice(end + 8).replace(/^\s+/, '')
        } else {
          const start = pending.indexOf('<think>')
          if (start === -1) { out += pending; pending = ''; break }
          if (start > 0) { out += pending.slice(0, start) }
          inThink = true
          pending = pending.slice(start + 7)
        }
      }
      if (out) { totalChars += out.length; yield out }
    }

    if (!inThink && pending) { totalChars += pending.length; yield pending }
    this.logger.log(`[Groq] chatStreamFromMessages complete — ${totalChars} chars`)
  }

  // ─── GEMINI: Agent 1 — extract text ─────────────────────────────────────────

  private async agent1_extract(input: DocumentAnalysisInput): Promise<string> {
    this.logger.log('[Gemini] Agent 1/4: Extracting document content')

    if (input.fileType === 'application/pdf') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse = require('pdf-parse')
      const fileBuffer = fs.readFileSync(input.filePath)
      const data = await pdfParse(fileBuffer)
      return data.text as string
    }

    if (input.fileType.startsWith('image/')) {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-3.6-flash' })
      const base64 = fs.readFileSync(input.filePath).toString('base64')
      const result = await withRetry(() => model.generateContent([
        { inlineData: { mimeType: input.fileType as any, data: base64 } },
        'You are a document OCR specialist. Extract ALL text from this document exactly as it appears. Return only the extracted text, nothing else.',
      ]))
      return result.response.text()
    }

    return fs.readFileSync(input.filePath, 'utf-8')
  }

  // ─── GEMINI: Agent 2 — classify & translate ──────────────────────────────────

  private async agent2_classify(
    rawText: string,
    userLanguage: string,
  ): Promise<{ summary: string; documentType: string; keyData: Record<string, string>; translation: string; riskExplanation: string }> {
    this.logger.log('[Gemini] Agent 2/4: Classifying and translating')

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: { responseMimeType: 'application/json' },
    })

    const prompt = this.classifyPrompt(rawText, userLanguage)
    const result = await withRetry(() => model.generateContent(prompt))
    return JSON.parse(result.response.text())
  }

  // ─── GEMINI: Agent 3 — extract actions ──────────────────────────────────────

  private async agent3_extractActions(classified: {
    documentType: string
    keyData: Record<string, string>
    translation: string
  }) {
    this.logger.log('[Gemini] Agent 3/4: Extracting action items')

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: { responseMimeType: 'application/json' },
    })

    const prompt = this.actionsPrompt(classified)
    const result = await withRetry(() => model.generateContent(prompt))
    const parsed = JSON.parse(result.response.text())
    return parsed.actionItems || []
  }

  // ─── GROQ: Agent 1 — extract text ───────────────────────────────────────────

  private async agent1_extractGroq(input: DocumentAnalysisInput): Promise<string> {
    this.logger.log('[Groq] Agent 1/4: Extracting document content')

    const isImage = input.fileType.startsWith('image/')
    const isPdf = input.fileType === 'application/pdf'

    if (isPdf) {
      // Groq doesn't support PDFs natively — use pdf-parse for text extraction
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse = require('pdf-parse')
      const fileBuffer = fs.readFileSync(input.filePath)
      const data = await pdfParse(fileBuffer)
      return data.text as string
    }

    if (isImage) {
      const fileBuffer = fs.readFileSync(input.filePath)
      const base64 = fileBuffer.toString('base64')

      const response = await this.groq.chat.completions.create({
        model: 'llama-3.2-11b-vision-preview',
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${input.fileType};base64,${base64}` } },
            { type: 'text', text: 'You are a document OCR specialist. Extract ALL text from this document exactly as it appears. Return only the extracted text, nothing else.' },
          ] as any,
        }],
        max_tokens: 2048,
      })
      return response.choices[0].message.content || ''
    }

    return fs.readFileSync(input.filePath, 'utf-8')
  }

  // ─── GROQ: Agent 2 — classify & translate ───────────────────────────────────

  private async agent2_classifyGroq(
    rawText: string,
    userLanguage: string,
  ): Promise<{ summary: string; documentType: string; keyData: Record<string, string>; translation: string; riskExplanation: string }> {
    this.logger.log('[Groq] Agent 2/4: Classifying and translating')

    const response = await this.groq.chat.completions.create({
      model: this.groqModel,
      messages: [{ role: 'user', content: this.classifyPrompt(rawText, userLanguage) }],
      response_format: { type: 'json_object' },
      max_tokens: 4096,
    })
    return JSON.parse(response.choices[0].message.content || '{}')
  }

  // ─── GROQ: Agent 3 — extract actions ────────────────────────────────────────

  private async agent3_extractActionsGroq(classified: {
    documentType: string
    keyData: Record<string, string>
    translation: string
  }) {
    this.logger.log('[Groq] Agent 3/4: Extracting action items')

    const response = await this.groq.chat.completions.create({
      model: this.groqModel,
      messages: [{ role: 'user', content: this.actionsPrompt(classified) }],
      response_format: { type: 'json_object' },
      max_tokens: 2048,
    })
    const parsed = JSON.parse(response.choices[0].message.content || '{}')
    return parsed.actionItems || []
  }

  // ─── GROQ: retranslate ───────────────────────────────────────────────────────

  private async retranslateGroq(rawText: string, language: string): Promise<RetranslateResult> {
    const trimmed = rawText.length > 6000 ? rawText.slice(0, 6000) + '\n[truncated]' : rawText

    const prompt = `You are a translation assistant for German documents.
Translate the following document text into ${language}. Be accurate and clear.

Return valid JSON with exactly this shape:
{
  "summary": "2-3 sentence plain-language summary in ${language}",
  "translatedText": "full translation of the document in ${language}",
  "riskExplanation": "1-2 sentences on what happens if the recipient ignores this document"
}

Document text:
${trimmed}`

    const response = await this.groq.chat.completions.create({
      model: this.groqModel,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 2048,
    })

    const parsed = JSON.parse(response.choices[0].message.content || '{}')
    return {
      summary: parsed.summary || '',
      translatedText: parsed.translatedText || '',
      documentType: '',
      riskExplanation: parsed.riskExplanation || '',
      keyData: {},
    }
  }

  // ─── GROQ: chatStream ────────────────────────────────────────────────────────

  private async *chatStreamGroq(
    context: { rawText: string; translatedText: string; summary: string; documentType: string },
    messages: Array<{ role: 'user' | 'model'; content: string }>,
  ): AsyncGenerator<string> {
    const systemPrompt = `You are a helpful document assistant for an immigrant navigating German bureaucracy.
You have full context of the following document:

Document type: ${context.documentType}
Summary: ${context.summary}
Full translation: ${context.translatedText}
Original text: ${context.rawText || '(not available)'}

Answer questions about this document clearly and helpfully in English. You can:
- Explain what the document means
- Explain consequences of ignoring deadlines or requirements
- List what documents the user needs to bring
- Explain processes step by step
- Translate specific parts
- Suggest next steps

Be concise, practical, and reassuring. If you're unsure about something, say so.`

    const groqMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: (m.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.content,
      })),
    ]

    const stream = await this.groq.chat.completions.create({
      model: this.groqModel,
      messages: groqMessages,
      stream: true,
      max_tokens: 4096,
    })

    let totalChars = 0
    let inThink = false
    let pending = ''

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || ''
      if (!text) continue
      pending += text

      let out = ''
      while (pending.length > 0) {
        if (inThink) {
          const end = pending.indexOf('</think>')
          if (end === -1) break
          inThink = false
          pending = pending.slice(end + 8).replace(/^\s+/, '')
        } else {
          const start = pending.indexOf('<think>')
          if (start === -1) { out += pending; pending = ''; break }
          if (start > 0) { out += pending.slice(0, start) }
          inThink = true
          pending = pending.slice(start + 7)
        }
      }
      if (out) { totalChars += out.length; yield out }
    }

    if (!inThink && pending) { totalChars += pending.length; yield pending }
    this.logger.log(`[Groq] chatStream complete — ${totalChars} chars streamed`)
  }

  // ─── SHARED: prompt templates ────────────────────────────────────────────────

  private classifyPrompt(rawText: string, userLanguage: string): string {
    return `You are an expert in German bureaucratic and legal documents for immigrants.

Classify the document into one of these types:
- Mietvertrag (Rental Contract)
- Aufenthaltstitel (Residence Permit)
- Anmeldung (City Registration)
- Steuerbescheid (Tax Notice)
- Krankenversicherung (Health Insurance)
- Arbeitsvertrag (Employment Contract)
- Behördenschreiben (Official Government Letter)
- Kontoauszug (Bank Statement)
- Andere (Other)

Return JSON with exactly this shape:
{
  "documentType": "...",
  "summary": "2-3 sentence plain English explanation of what this document is and why it matters for an immigrant",
  "keyData": { "field": "value" },
  "translation": "full plain English translation",
  "riskExplanation": "1-2 sentences explaining what could go wrong if the recipient ignores or mishandles this document — e.g. visa status, fines, legal consequences. If low-risk, say so."
}

Translate and classify this German document for a ${userLanguage} speaker:

${rawText}`
  }

  private actionsPrompt(classified: { documentType: string; keyData: Record<string, string>; translation: string }): string {
    return `You are an immigration advisor. Extract every required action from this document.

For each action identify:
- title: short action title
- description: clear English instruction of exactly what to do
- deadline: ISO 8601 date string if a deadline is mentioned, otherwise null
- priority: "urgent" (deadline within 7 days or legal consequence), "high" (14 days or financial), "medium" (30 days), "low" (no deadline)
- category: "deadline" | "document" | "payment" | "appointment" | "other"

Return JSON: { "actionItems": [...] }

Document type: ${classified.documentType}
Key data: ${JSON.stringify(classified.keyData)}

Document content:
${classified.translation}`
  }

  // ─── Agent 4: Deterministic risk scoring (no LLM call) ───────────────────────

  private agent4_assessRisk(actionItems: Array<{ priority: string; deadline?: string }>): 'low' | 'medium' | 'high' {
    this.logger.log('Agent 4/4: Assessing risk level')

    const hasUrgent = actionItems.some(i => i.priority === 'urgent')
    const hasImminent = actionItems.some(i => {
      if (!i.deadline) return false
      const days = (new Date(i.deadline).getTime() - Date.now()) / 86_400_000
      return days <= 14
    })
    const highCount = actionItems.filter(i => i.priority === 'high').length

    if (hasUrgent || hasImminent) return 'high'
    if (highCount >= 2) return 'medium'
    return 'low'
  }
}
