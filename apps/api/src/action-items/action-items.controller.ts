import { Controller, Patch, Post, Delete, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ActionItemsService, CreateActionItemDto, UpdateActionItemDto } from './action-items.service'

@ApiTags('action-items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('action-items')
export class ActionItemsController {
  constructor(private readonly service: ActionItemsService) {}

  @Patch(':id/complete')
  complete(@Param('id') id: string) {
    return this.service.complete(id)
  }

  @Patch(':id/uncomplete')
  uncomplete(@Param('id') id: string) {
    return this.service.uncomplete(id)
  }

  @Post()
  create(@Body() dto: CreateActionItemDto) {
    return this.service.create(dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateActionItemDto) {
    return this.service.update(id, dto)
  }

  @Patch(':id/deadline')
  updateDeadline(@Param('id') id: string, @Body() body: { deadline: string | null }) {
    return this.service.updateDeadline(id, body.deadline)
  }
}
