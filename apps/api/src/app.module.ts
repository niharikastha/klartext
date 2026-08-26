import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ThrottlerModule } from '@nestjs/throttler'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { DocumentsModule } from './documents/documents.module'
import { AnalysisModule } from './analysis/analysis.module'
import { ActionItemsModule } from './action-items/action-items.module'
import { TagsModule } from './tags/tags.module'
import { ChatModule } from './chat/chat.module'
import { CalendarModule } from './calendar/calendar.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('DATABASE_URL'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: process.env.NODE_ENV !== 'production',
        logging: process.env.NODE_ENV === 'development',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    DocumentsModule,
    AnalysisModule,
    ActionItemsModule,
    TagsModule,
    ChatModule,
    CalendarModule,
  ],
})
export class AppModule {}
