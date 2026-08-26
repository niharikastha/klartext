import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ChatSession, StoredMessage } from './chat-session.entity'

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatSession)
    private sessionRepo: Repository<ChatSession>,
  ) {}

  async listSessions(userId: string) {
    return this.sessionRepo.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
      select: ['id', 'title', 'documentId', 'documentName', 'updatedAt', 'createdAt'],
    })
  }

  async createSession(userId: string, dto: { documentId?: string; documentName?: string; title?: string }) {
    const session = this.sessionRepo.create({
      userId,
      title: dto.title || (dto.documentName ? `Chat about ${dto.documentName}` : 'New Chat'),
      documentId: dto.documentId || null,
      documentName: dto.documentName || null,
      messages: [],
    })
    return this.sessionRepo.save(session)
  }

  async getSession(id: string, userId: string) {
    const session = await this.sessionRepo.findOne({ where: { id, userId } })
    if (!session) throw new NotFoundException('Session not found')
    return session
  }

  async updateSession(id: string, userId: string, updates: Partial<Pick<ChatSession, 'title' | 'documentId' | 'documentName'>>) {
    await this.sessionRepo.update({ id, userId }, updates)
    return this.getSession(id, userId)
  }

  async deleteSession(id: string, userId: string) {
    await this.sessionRepo.delete({ id, userId })
  }

  async appendMessages(id: string, userId: string, newMessages: StoredMessage[]) {
    const session = await this.getSession(id, userId)
    session.messages = [...session.messages, ...newMessages]
    if (session.title === 'New Chat' && newMessages.some(m => m.role === 'user')) {
      const first = newMessages.find(m => m.role === 'user')
      if (first) {
        session.title = first.content.slice(0, 50) + (first.content.length > 50 ? '…' : '')
      }
    }
    return this.sessionRepo.save(session)
  }
}
