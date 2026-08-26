import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ActionItem } from './action-item.entity'
import { ActionItemsController } from './action-items.controller'
import { ActionItemsService } from './action-items.service'

@Module({
  imports: [TypeOrmModule.forFeature([ActionItem])],
  controllers: [ActionItemsController],
  providers: [ActionItemsService],
  exports: [TypeOrmModule],
})
export class ActionItemsModule {}
