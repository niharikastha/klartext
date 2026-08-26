import { Controller, Get, Post, Put, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { TagsService } from './tags.service'

@ApiTags('tags')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tags')
export class TagsController {
  constructor(private tagsService: TagsService) {}

  @Get()
  getUserTags(@Request() req: any) {
    return this.tagsService.getUserTags(req.user.id)
  }

  @Post()
  createTag(@Request() req: any, @Body() body: { name: string; color?: string }) {
    return this.tagsService.createTag(req.user.id, body.name, body.color || '#6366f1')
  }

  @Patch(':id')
  updateTag(@Request() req: any, @Param('id') id: string, @Body() body: { name?: string; color?: string }) {
    return this.tagsService.updateTag(req.user.id, id, body.name, body.color)
  }

  @Delete(':id')
  deleteTag(@Request() req: any, @Param('id') id: string) {
    return this.tagsService.deleteTag(req.user.id, id)
  }

  @Get('document/:documentId')
  getDocumentTags(@Request() req: any, @Param('documentId') docId: string) {
    return this.tagsService.getDocumentTags(req.user.id, docId)
  }

  @Put('document/:documentId')
  setDocumentTags(@Request() req: any, @Param('documentId') docId: string, @Body() body: { tagIds: string[] }) {
    return this.tagsService.setDocumentTags(req.user.id, docId, body.tagIds || [])
  }
}
