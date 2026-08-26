import { Injectable, ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from './user.entity'
import * as bcrypt from 'bcryptjs'

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } })
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } })
  }

  async create(data: { name: string; email: string; password: string }): Promise<User> {
    const existing = await this.findByEmail(data.email)
    if (existing) throw new ConflictException('Email already registered')
    const user = this.usersRepository.create(data)
    return this.usersRepository.save(user)
  }

  async updateProfile(id: string, data: { name?: string; preferredLanguage?: string }): Promise<User> {
    await this.usersRepository.update(id, data)
    return this.usersRepository.findOne({ where: { id } }) as Promise<User>
  }

  async updateAvatar(id: string, avatarUrl: string): Promise<User> {
    await this.usersRepository.update(id, { avatarUrl })
    return this.usersRepository.findOne({ where: { id } }) as Promise<User>
  }

  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id } })
    if (!user) throw new UnauthorizedException()
    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) throw new BadRequestException('Current password is incorrect')
    if (newPassword.length < 8) throw new BadRequestException('New password must be at least 8 characters')
    user.password = await bcrypt.hash(newPassword, 10)
    await this.usersRepository.save(user)
  }
}
