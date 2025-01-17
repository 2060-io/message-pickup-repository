import { Injectable, Logger } from '@nestjs/common'
import * as apn from 'apn'
import { ConfigService } from '@nestjs/config'
import * as fs from 'fs'

@Injectable()
export class ApnNotificationSender {
  private apnProvider: apn.Provider | null = null
  private isDataOnly: boolean
  private keyPath: string

  /**
   * Constructor to initialize the APN Notification Sender.
   * Attempts to initialize the APN provider with the configuration from a file.
   * If the initialization fails, the application continues running with a null provider.
   *
   * @param {ConfigService} configService - Service to access application configuration.
   */
  public constructor(private readonly configService: ConfigService) {
    try {
      const apnConfig = this.getApnConfig()

      if (!apnConfig) {
        throw new Error('The APNs configuration is empty or undefined.')
      }

      /// key path file key .p8
      this.keyPath = this.configService.get('appConfig.apnsPathKey')

      // Verify file path exist
      if (!fs.existsSync(this.keyPath)) {
        throw new Error(`Key file not found at: ${this.keyPath}`)
      }

      // Attempt to initialize the APN provider
      this.apnProvider = new apn.Provider({
        token: {
          key: fs.readFileSync(this.keyPath),
          keyId: apnConfig.keyId,
          teamId: apnConfig.teamId,
        },
        production: apnConfig.production,
      })

      Logger.debug('APN Provider initialized successfully.')
    } catch (error) {
      // Log the error and allow the application to continue running
      Logger.error('Failed to initialize APN Provider:', error)
      this.apnProvider = null // Set to null to indicate failure
    }

    // Determine if notifications should be data-only based on environment variable
    this.isDataOnly = this.configService.get('appConfig.notificationDataOnly') === 'true'
  }

  /**
   * Sends a push notification to a specific device using Apple Push Notification Service (APNs).
   * If the APN provider is not initialized, the method logs a warning and skips sending the notification.
   *
   * @param {string} deviceToken - The device token registered with APNs.
   * @param {string} messageId - The message ID generated by the Cloud-Agent addMessage method.
   * @returns {Promise<{ success: boolean, result?: any, message?: string, error?: any }>}
   * - An object indicating the success or failure of the notification sending process.
   */
  public async sendPushNotification(deviceToken: string, messageId: string) {
    if (!this.apnProvider) {
      Logger.warn('APN Provider is not initialized. Skipping push notification.')
      return { success: false, message: 'APN Provider not initialized' }
    }

    try {
      Logger.debug(`[sendPushNotification] ** initialize to token: ${deviceToken} *** messageId: ${messageId} **`)

      // Create the notification payload
      const notification = new apn.Notification({
        payload: {
          message_id: messageId,
          '@type': 'https://didcomm.org/push-notifications-apns',
        },
        topic: this.configService.get('appConfig.apnsTopic'), // APNs topic (usually the app's bundle identifier)
      })

      // Add alert if the notification is not data-only
      if (!this.isDataOnly) {
        notification.alert = {
          title: 'Hologram',
          body: 'You have new messages',
        }
      }

      // Send the notification via APNs
      const result = await this.apnProvider.send(notification, deviceToken)

      if (result.sent.length > 0) {
        Logger.debug(`[sendPushNotification] Message sent successfully to ${result.sent.length} device(s)`)
        return { success: true, result }
      } else {
        Logger.error(`[sendPushNotification] Failed to send notification to ${result.failed.length} device(s)`)
        return { success: false, result }
      }
    } catch (error) {
      Logger.error('[sendPushNotification] Error sending notification:', error)
      return { success: false, message: 'Error sending notification', error }
    }
  }

  /**
   * Reads and parses the APNs configuration from a JSON file.
   * The configuration includes the key, keyId, teamId, and environment (production/sandbox).
   *
   * @returns {any | null} - The parsed APNs configuration, or null if the file could not be read.
   */
  private getApnConfig(): any | null {
    try {
      const apnConfigPath = this.configService.get('appConfig.apnConfigFile')
      Logger.debug(`[getApnConfig] APNs config file path: ${apnConfigPath}`)

      // Check if the APNs configuration file exists
      if (!fs.existsSync(apnConfigPath)) {
        Logger.error(`[getApnConfig] APNs config file not found at path: ${apnConfigPath}`)
        return null
      }

      // Read and parse the APNs configuration file
      const apnConfig = JSON.parse(fs.readFileSync(apnConfigPath, 'utf8'))
      if (apnConfig) {
        Logger.debug(`[getApnConfig] APNs config read successfully`)
      }

      return apnConfig
    } catch (error) {
      Logger.error('Error reading APNs config file:', error.message)
      return null
    }
  }
}
