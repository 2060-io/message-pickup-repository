import { registerAs } from '@nestjs/config'

/**
 * Configuration for the application, including ports, database URIs, and service URLs.
 *
 * @returns {object} - An object containing the configuration settings for the application.
 */
export default registerAs('appConfig', () => ({
  /**
   * The port number on which the application will run.
   * Defaults to 3500 if APP_PORT is not set in the environment variables.
   * @type {number}
   */
  appPort: parseInt(process.env.APP_PORT, 10) || 3500,

  /**
   * The port number on which the WebSocket server will run.
   * Defaults to 3100 if WS_PORT is not set in the environment variables.
   * @type {number}
   */
  wsPort: parseInt(process.env.WS_PORT, 10) || 3100,

  /**
   * The base URL for the push notification service.
   * Retrieved from the FCM_SERVICE_BASE_URL environment variable.
   * @type {string | undefined}
   */
  pushNotificationUrl: process.env.FCM_SERVICE_BASE_URL,

  /**
   * The MongoDB URI for connecting to the database.
   * Defaults to a local MongoDB instance if MONGODB_URI is not set in the environment variables.
   * @type {string}
   */
  mongoDbUri: process.env.MONGODB_URI || 'mongodb://cloud-agent:cloud-agent@localhost:27017/MessagePickupRepository',

  /**
   * Defines the Redis mode, which can be 'single' or 'cluster'.
   * Defaults to 'single' if REDIS_TYPE is not set in the environment variables.
   * @type {string}
   */
  redisType: process.env.REDIS_TYPE || 'single',

  /**
   * A comma-separated list of Redis nodes in 'host:port' format, used in cluster mode.
   * Only relevant if REDIS_TYPE is set to 'cluster'.
   * @type {string | undefined}
   */
  redisNodes: process.env.REDIS_NODES,

  /**
   * The NAT mapping for Redis nodes, defined in 'externalAddress:host:port' format.
   * Useful for Redis cluster configurations with external IP mappings.
   * @type {string | undefined}
   */
  redisNatmap: process.env.REDIS_NATMAP,
  /**
   * The Redis database URL for connecting to the Redis server Single Mode.
   * Defaults to a specified local Redis instance if REDIS_URL is not set in the environment variables.
   * @type {string}
   */
  redisDbUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  /**
   *Allows set threshold time to execute messagePersist module on milisecond
   */
  thresholdTimestamp: parseInt(process.env.THRESHOLD_TIMESTAMP) || 60000,
}))
