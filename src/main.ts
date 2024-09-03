import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ConfigService } from '@nestjs/config'
import { Logger, VersioningType } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { getLogLevels } from './config/logger.config'
import * as fs from 'fs'
import { WsAdapter } from './config/ws.adapter'

/**
 * Bootstraps the NestJS application, setting up configurations, middleware, and documentation.
 *
 * @returns {Promise<void>} - A promise that resolves when the application has started successfully.
 */
async function bootstrap(): Promise<void> {
  // Retrieve log levels based on environment configuration
  const logLevels = getLogLevels()

  // Create the NestJS application with custom logger levels
  const app = await NestFactory.create(AppModule, {
    logger: logLevels,
  })

  const configService = app.get(ConfigService)
  const logger = new Logger(bootstrap.name)

  // Set up WebSocket adapter
  app.useWebSocketAdapter(new WsAdapter(app) as any)

  // Enable URI versioning for API routes
  app.enableVersioning({
    type: VersioningType.URI,
  })

  /**
   * Documentation Builder
   * Set up Swagger for API documentation
   */
  const config = new DocumentBuilder()
    .setTitle('message-pickup-repository')
    .setDescription('API handle files via websocket')
    .setVersion('0.0.1')
    .addTag('message-pickup-repository')
    .build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('q', app, document)

  // Enable Cross-Origin Resource Sharing (CORS)
  app.enableCors()

  // Get the application port from configuration
  const PORT = configService.get('appConfig.appPort')

  // Start the application and listen on the specified port
  await app.listen(PORT)

  // Retrieve application name and version from package.json
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
  const appName = packageJson.name
  const appVersion = packageJson.version

  // Log the URL where the application is running
  logger.log(`Application (${appName} v${appVersion}) running on: ${await app.getUrl()} `)
}

// Start the application
bootstrap()
