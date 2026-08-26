import { Controller, Patch, Param, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ActionItem } from '../action-items/action-item.entity'

@ApiTags('action-items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('action-items')
export class AnalysisController {
  constructor(
    @InjectRepository(ActionItem)
    private actionItemsRepository: Repository<ActionItem>,
  ) {}

  @Patch(':id/complete')
  async markComplete(@Param('id') id: string) {
    await this.actionItemsRepository.update(id, { completed: true })
    return { success: true }
  }
}
