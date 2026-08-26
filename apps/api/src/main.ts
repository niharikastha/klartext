import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { join } from 'path'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  app.enableCors({ origin: process.env.FRONTEND_URL || 'http://localhost:3004' })
  app.useGlobalPipes(new ValidationPipe({ transform: true }))
  app.setGlobalPrefix('api')

  // Serve uploads (documents + avatars) as static files — no /api prefix
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' })

  const config = new DocumentBuilder()
    .setTitle('Klartext API')
    .setDescription('Immigrant Document Navigator API')
    .setVersion('1.0')
    .addBearerAuth()
    .build()

  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config))

  await app.listen(4002)
  console.log('Klartext API running on http://localhost:4002')
  console.log('Swagger docs: http://localhost:4002/api/docs')
}

bootstrap()
