import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CalendarEvent } from './calendar-event.entity'
import { CalendarService } from './calendar.service'
import { CalendarController } from './calendar.controller'

@Module({
  imports: [TypeOrmModule.forFeature([CalendarEvent])],
  providers: [CalendarService],
  controllers: [CalendarController],
})
export class CalendarModule {}
