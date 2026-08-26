import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcryptjs'
import * as crypto from 'crypto'
import { UsersService } from '../users/users.service'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../users/user.entity'

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  private get jwtSecret() {
    return this.configService.get('JWT_SECRET') || 'klartext-dev-secret'
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email)
    if (user && await bcrypt.compare(password, user.password)) {
      const { password: _, ...result } = user
      return result
    }
    return null
  }

  private issueTokens(user: { id: string; email: string }) {
    const payload = { sub: user.id, email: user.email }
    const access_token = this.jwtService.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: '15m',
    })
    const refresh_token = this.jwtService.sign(
      { ...payload, type: 'refresh' },
      { secret: this.jwtSecret, expiresIn: '7d' },
    )
    return { access_token, refresh_token }
  }

  async login(user: any) {
    const tokens = this.issueTokens(user)
    return {
      ...tokens,
      user: { id: user.id, name: user.name, email: user.email, preferredLanguage: user.preferredLanguage || 'English' },
    }
  }

  async register(name: string, email: string, password: string) {
    const hashed = await bcrypt.hash(password, 10)
    const user = await this.usersService.create({ name, email, password: hashed })
    return this.login(user)
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, { secret: this.jwtSecret })
      if (payload.type !== 'refresh') throw new Error('Not a refresh token')
      const user = await this.usersService.findById(payload.sub)
      if (!user) throw new Error('User not found')
      const tokens = this.issueTokens(user)
      return { ...tokens, user: { id: user.id, name: user.name, email: user.email } }
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token')
    }
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email)
    if (!user) {
      // Don't reveal whether email exists
      return { message: 'If that email is registered, a reset link has been sent.' }
    }
    const token = crypto.randomBytes(32).toString('hex')
    const hashed = crypto.createHash('sha256').update(token).digest('hex')
    user.resetPasswordToken = hashed
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    await this.usersRepository.save(user)
    // In production this would send an email. For development, return the token.
    const resetUrl = `http://localhost:3004/reset-password?token=${token}`
    return { message: 'Reset link generated.', resetUrl }
  }

  async resetPassword(token: string, newPassword: string) {
    const hashed = crypto.createHash('sha256').update(token).digest('hex')
    const user = await this.usersRepository.findOne({
      where: { resetPasswordToken: hashed },
    })
    if (!user || !user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
      throw new BadRequestException('Reset token is invalid or has expired')
    }
    user.password = await bcrypt.hash(newPassword, 10)
    user.resetPasswordToken = null
    user.resetPasswordExpires = null
    await this.usersRepository.save(user)
    return { message: 'Password reset successfully' }
  }
}
