import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Tag } from './tag.entity'
import { TagsService } from './tags.service'
import { TagsController } from './tags.controller'
import { Document } from '../documents/document.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Tag, Document])],
  providers: [TagsService],
  controllers: [TagsController],
  exports: [TagsService],
})
export class TagsModule {}
