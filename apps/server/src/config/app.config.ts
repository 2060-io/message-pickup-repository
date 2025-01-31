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
   * The Redis database URL for connecting to the Redis server in single mode.
   * Defaults to a specified local Redis instance if REDIS_URL is not set in the environment variables.
   * @type {string}
   */
  redisDbUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  /**
   * The threshold time (in milliseconds) to execute the message persistence module.
   * Defaults to 60000 milliseconds if THRESHOLD_TIMESTAMP is not set in the environment variables.
   * @type {number}
   */
  thresholdTimestamp: parseInt(process.env.THRESHOLD_TIMESTAMP, 10) || 60000,

  /**
   * The file path to the Firebase configuration JSON file.
   * Defaults to './test/firebase-cfg.json' if FIREBASE_CFG_FILE is not set in the environment variables.
   * @type {string}
   */
  firebaseCfgFile: process.env.FIREBASE_CFG_FILE || './test/firebase-cfg.json',

  /**
   * The file path to the APNs configuration JSON file.
   * Defaults to './test/apns-cfg.json' if APNS_CFG_FILE is not set in the environment variables.
   * @type {string}
   */
  apnConfigFile: process.env.APNS_CFG_FILE || './test/apns-cfg.json',

  /**
   * The file path to the APNs authentication key.
   * Defaults to './test/apns-authkey.p8' if APNS_PATH_KEY is not set in the environment variables.
   * @type {string}
   */
  apnsPathKey: process.env.APNS_PATH_KEY || './test/apns-authkey.p8',

  /**
   * The APNs topic, usually the app's bundle identifier.
   * Defaults to 'default' if APNS_TOPIC is not set in the environment variables.
   * @type {string}
   */
  apnsTopic: process.env.APNS_TOPIC || 'default',

  /**
   * Indicates if the notification should be sent as data-only.
   * Defaults to false if NOTIFICATION_DATA_ONLY is not set in the environment variables.
   * @type {boolean}
   */
  notificationDataOnly: Boolean(process.env.NOTIFICATION_DATA_ONLY) || false,
}))
