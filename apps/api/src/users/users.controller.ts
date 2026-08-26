import {
  Controller, Get, Patch, Post, Body, Request,
  UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { UsersService } from './users.service'

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async getMe(@Request() req: any) {
    const user = await this.usersService.findById(req.user.id)
    if (!user) return null
    const { password, resetPasswordToken, resetPasswordExpires, ...safe } = user
    return safe
  }

  @Patch('me')
  async updateMe(@Request() req: any, @Body() body: { name?: string; preferredLanguage?: string }) {
    const updated = await this.usersService.updateProfile(req.user.id, body)
    const { password, resetPasswordToken, resetPasswordExpires, ...safe } = updated
    return safe
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'avatars'),
        filename: (_req, file, cb) => {
          cb(null, `${uuidv4()}${extname(file.originalname)}`)
        },
      }),
      fileFilter: (_req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
        cb(null, allowed.includes(extname(file.originalname).toLowerCase()))
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    }),
  )
  async uploadAvatar(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    const avatarUrl = `/uploads/avatars/${file.filename}`
    const updated = await this.usersService.updateAvatar(req.user.id, avatarUrl)
    const { password, resetPasswordToken, resetPasswordExpires, ...safe } = updated
    return safe
  }

  @Post('me/password')
  async changePassword(@Request() req: any, @Body() body: { currentPassword: string; newPassword: string }) {
    await this.usersService.changePassword(req.user.id, body.currentPassword, body.newPassword)
    return { message: 'Password changed successfully' }
  }
}
