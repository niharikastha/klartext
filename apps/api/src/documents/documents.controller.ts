import {
  Controller, Post, Get, Param, Delete,
  UseGuards, UseInterceptors, UploadedFile,
  Request, HttpCode, HttpStatus,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { DocumentsService } from './documents.service'
import { UsersService } from '../users/users.service'

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly usersService: UsersService,
  ) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    const user = await this.usersService.findById(req.user.id)
    const userLanguage = user?.preferredLanguage || 'English'
    return this.documentsService.upload(file, req.user.id, userLanguage)
  }

  @Get()
  async findAll(@Request() req: any) {
    return this.documentsService.findAllByUser(req.user.id)
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.documentsService.findOne(id, req.user.id)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.documentsService.remove(id, req.user.id)
  }
}
