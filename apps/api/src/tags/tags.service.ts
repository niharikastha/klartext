import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { Tag } from './tag.entity'
import { Document } from '../documents/document.entity'

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag) private tagRepository: Repository<Tag>,
    @InjectRepository(Document) private documentRepository: Repository<Document>,
  ) {}

  getUserTags(userId: string): Promise<Tag[]> {
    return this.tagRepository.find({ where: { userId }, order: { name: 'ASC' } })
  }

  createTag(userId: string, name: string, color: string): Promise<Tag> {
    const tag = this.tagRepository.create({ userId, name: name.trim(), color })
    return this.tagRepository.save(tag)
  }

  async updateTag(userId: string, tagId: string, name?: string, color?: string): Promise<Tag> {
    const tag = await this.tagRepository.findOne({ where: { id: tagId, userId } })
    if (!tag) throw new NotFoundException('Tag not found')
    if (name !== undefined) tag.name = name.trim()
    if (color !== undefined) tag.color = color
    return this.tagRepository.save(tag)
  }

  async deleteTag(userId: string, tagId: string): Promise<void> {
    const tag = await this.tagRepository.findOne({ where: { id: tagId, userId } })
    if (!tag) throw new NotFoundException('Tag not found')
    await this.tagRepository.remove(tag)
  }

  async setDocumentTags(userId: string, documentId: string, tagIds: string[]): Promise<Tag[]> {
    const doc = await this.documentRepository.findOne({
      where: { id: documentId, userId },
      relations: ['tags'],
    })
    if (!doc) throw new NotFoundException('Document not found')

    const tags = tagIds.length > 0
      ? (await this.tagRepository.find({ where: { id: In(tagIds) } })).filter(t => t.userId === userId)
      : []

    doc.tags = tags
    await this.documentRepository.save(doc)
    return tags
  }

  async getDocumentTags(userId: string, documentId: string): Promise<Tag[]> {
    const doc = await this.documentRepository.findOne({
      where: { id: documentId, userId },
      relations: ['tags'],
    })
    if (!doc) throw new NotFoundException('Document not found')
    return doc.tags || []
  }
}
