import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, Between } from 'typeorm'
import { CalendarEvent } from './calendar-event.entity'

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(CalendarEvent)
    private repo: Repository<CalendarEvent>,
  ) {}

  listEvents(userId: string, start: string, end: string) {
    return this.repo.find({
      where: { userId, date: Between(start, end) },
      order: { date: 'ASC' },
    })
  }

  createEvent(userId: string, dto: { title: string; description?: string; date: string; color?: string }) {
    const event = this.repo.create({
      userId,
      title: dto.title,
      description: dto.description ?? null,
      date: dto.date,
      color: dto.color ?? '#6366f1',
    })
    return this.repo.save(event)
  }

  async updateEvent(userId: string, id: string, dto: { title?: string; description?: string; date?: string; color?: string }) {
    const event = await this.repo.findOne({ where: { id, userId } })
    if (!event) throw new NotFoundException('Event not found')
    if (dto.title !== undefined) event.title = dto.title
    if (dto.description !== undefined) event.description = dto.description ?? null
    if (dto.date !== undefined) event.date = dto.date
    if (dto.color !== undefined) event.color = dto.color
    return this.repo.save(event)
  }

  async deleteEvent(userId: string, id: string) {
    const event = await this.repo.findOne({ where: { id, userId } })
    if (!event) throw new NotFoundException('Event not found')
    return this.repo.remove(event)
  }
}
