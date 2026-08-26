import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CalendarService } from './calendar.service'

@UseGuards(JwtAuthGuard)
@Controller('calendar-events')
export class CalendarController {
  constructor(private calendarService: CalendarService) {}

  @Get()
  list(
    @Request() req: any,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    const s = start || '2000-01-01'
    const e = end || '2099-12-31'
    return this.calendarService.listEvents(req.user.id, s, e)
  }

  @Post()
  create(
    @Request() req: any,
    @Body() body: { title: string; description?: string; date: string; color?: string },
  ) {
    return this.calendarService.createEvent(req.user.id, body)
  }

  @Patch(':id')
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { title?: string; description?: string; date?: string; color?: string },
  ) {
    return this.calendarService.updateEvent(req.user.id, id, body)
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.calendarService.deleteEvent(req.user.id, id)
  }
}
