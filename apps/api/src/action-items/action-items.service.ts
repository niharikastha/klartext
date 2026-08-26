import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ActionItem } from './action-item.entity'

export interface UpdateActionItemDto {
  title?: string
  description?: string
  deadline?: string | null
  priority?: string
  category?: string
}

export interface CreateActionItemDto {
  analysisResultId: string
  title: string
  description: string
  deadline?: string | null
  priority: string
  category: string
}

@Injectable()
export class ActionItemsService {
  constructor(
    @InjectRepository(ActionItem)
    private repo: Repository<ActionItem>,
  ) {}

  async complete(id: string): Promise<ActionItem> {
    const item = await this.repo.findOneBy({ id })
    if (!item) throw new NotFoundException()
    item.completed = true
    return this.repo.save(item)
  }

  async uncomplete(id: string): Promise<ActionItem> {
    const item = await this.repo.findOneBy({ id })
    if (!item) throw new NotFoundException()
    item.completed = false
    return this.repo.save(item)
  }

  async create(dto: CreateActionItemDto): Promise<ActionItem> {
    const item = this.repo.create({
      analysisResult: { id: dto.analysisResultId } as any,
      title: dto.title,
      description: dto.description,
      deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      priority: dto.priority,
      category: dto.category,
      completed: false,
    })
    return this.repo.save(item)
  }

  async remove(id: string): Promise<void> {
    const item = await this.repo.findOneBy({ id })
    if (!item) throw new NotFoundException()
    await this.repo.remove(item)
  }

  async update(id: string, dto: UpdateActionItemDto): Promise<ActionItem> {
    const item = await this.repo.findOneBy({ id })
    if (!item) throw new NotFoundException()
    if (dto.title !== undefined) item.title = dto.title
    if (dto.description !== undefined) item.description = dto.description
    if (dto.priority !== undefined) item.priority = dto.priority
    if (dto.category !== undefined) item.category = dto.category
    if ('deadline' in dto) item.deadline = dto.deadline ? new Date(dto.deadline) : (null as any)
    return this.repo.save(item)
  }

  async updateDeadline(id: string, deadline: string | null): Promise<ActionItem> {
    const item = await this.repo.findOneBy({ id })
    if (!item) throw new NotFoundException()
    item.deadline = deadline ? new Date(deadline) : (null as any)
    return this.repo.save(item)
  }
}
