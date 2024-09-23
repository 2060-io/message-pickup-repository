import { MessagePickupRepositoryClient } from '../lib/MessagePickupRepositoryClient'
import { Logger } from '@nestjs/common'

const logger = new Logger('WebSocketTestScript')

;(async () => {
  logger.log(`*** Begin testing *** \n`)
  const client = new MessagePickupRepositoryClient('ws://localhost:3100')
  await client.connect()

  client.messageReceived((data) => {
    logger.debug(`*** [messageReceive] listener: ${JSON.stringify(data, null, 2)}  ****:`)
  })

  const connectionId_1 = '8df6b644-0206-4d50-aade-a565d5c82683'
  const connectionId_2 = '8df6b644-0206-4d50-aade-a565d5c82690'

  // Variables
  const addMessageToQueue = {
    connectionId: connectionId_1,
    recipientDids: ['HBstN9Dusi7vJzuQ99fCmnvvrcKPAprCknp6XKmgHkc0'],
    liveSession: false,
    payload: {
      protected:
        'eyJlbmMiOiJ4Y2hhY2hhMjBwb2x5MTMwNV9pZXRmIiwidHlwIjoiSldNLzEuMCIsImFsZyI6IkF1dGhjcnlwdCIsInJlY2lwaWVudHMiOlt7ImVuY3J5cHRlZF9rZXkiOiJIVllhOTczZTJHUXZXeHJXNWh4MXBfRVNxUGE0U29lY3hGY3UtR3VQSWdLLWtQNGxXQmtsNHpnVkJTb3NuUlZKIiwiaGVhZGVyIjp7ImtpZCI6Ijl3bmEyb1NQNVdpMnBZVHpyZVp3NXdOVko4TENhZ0Zrc0hHTHk4MTdOZU5DIiwic2VuZGVyIjoiX2o2S196cmFVVkhYSTRzU3IzcVNaTDM0TXM2Z3V0WTlhTkcwRU5KWFVIVkludTBpNEo1UEwwU1FsUFlzS1NucGwwOE8yNER1ZFI0TnloTjhpRmc5VWtaMGkyblhZTjVPMDhBQlVrM1NneGt2VTItcXBuNnBPSm1wQWd3IiwiaXYiOiJzWS1sVEl4UU5XcU52aUlnVFRRcS16QkhaYkhRR0FMRCJ9fV19',
      ciphertext:
        'gZXkcmxhfC-xFZbfgZTdLi5su_NtifQEqL7UseGxf743icIfw8m1vFZ5FJLJpYXWcxeKK9grLwAcIfjkuG4jwAUEKZ6OgcTNgsIQtNqi8ipw6v-Nws2V-v9Fa4WzWHga4rtmSLW9pWISMozJNT9HLNWleF6NPExeLCeyAEA-3UHlLmaaopzzSoMuqmKfUIpPByT_Mqe1YrfR4nExTmVMr1MUihSaTxDeHolSz1DheXTFC9t8pkM',
      iv: 'K5acqcmJh5N-fPAO',
      tag: 'H4vn2kTqwej52tGiUOA7OQ',
    },
  }

  const liveSession = {
    connectionId: connectionId_1,
    sessionId: 'session-1',
    instance: 'cloud-agent-0',
  }

  const liveSession1 = {
    connectionId: connectionId_2,
    sessionId: 'session-2',
    instance: 'cloud-agent-1',
  }

  try {
    // Live Session test
    logger.log(`*** begin addLiveSession test ***\n`)

    const [addLiveSession, addLiveSession1] = await Promise.all([
      client.addLiveSession(liveSession),
      client.addLiveSession(liveSession1),
    ])

    logger.log(`*** begin addLiveSession test: ${addLiveSession}, ${addLiveSession1} ***`)

    await new Promise((resolve) => setTimeout(resolve, 5000))

    // AddMessage Test
    logger.log(`\n *** begin AddMessage test ***\n`)
    const randomCount = Math.floor(Math.random() * 20) + 1
    const randomCount1 = Math.floor(Math.random() * 20) + 1

    logger.log(`Number of messages to add: client-1: ${randomCount}, client-2 :${randomCount1}`)

    for (let i = 1; i <= randomCount; i++) {
      const addMessage = await client.addMessage(addMessageToQueue)
      logger.log(`client-1 AddMessage test ${i} / ${randomCount} -- ${JSON.stringify(addMessage)}`)
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))

    addMessageToQueue.connectionId = connectionId_2
    addMessageToQueue.recipientDids = ['HBstN9Dusi7vJzuQ99fCmnvvrcKPAprCknp6XKmgHk89']
    for (let i = 1; i <= randomCount1; i++) {
      const addMessage1 = await client.addMessage(addMessageToQueue)
      logger.log(`client-2 AddMessage test ${i} / ${randomCount1} -- ${JSON.stringify(addMessage1)}`)
    }

    logger.log(`\n *** End AddMessage test ***\n`)

    await new Promise((resolve) => setTimeout(resolve, 5000))

    // Message count test
    logger.log(`*** Begin getAvailableMessageCount test ***\n`)
    const [countMessages, countMessages1] = await Promise.all([
      client.getAvailableMessageCount({ connectionId: connectionId_1 }),
      client.getAvailableMessageCount({ connectionId: connectionId_2 }),
    ])

    logger.log(`client-2 CountMessages: ${countMessages} - client-2 CountMessages: ${countMessages1}`)

    logger.log(`\n *** End getAvailableMessageCount test ***\n`)

    await new Promise((resolve) => setTimeout(resolve, 5000))

    //takefromQueue
    logger.log(`*** Begin takeFromQueue test ***\n`)
    const [getMessage, getMessage1] = await Promise.all([
      client.takeFromQueue({
        connectionId: '8df6b644-0206-4d50-aade-a565d5c82683',
        limit: countMessages,
        deleteMessages: false,
        recipientDid: 'HBstN9Dusi7vJzuQ99fCmnvvrcKPAprCknp6XKmgHkc0',
      }),
      client.takeFromQueue({
        connectionId: '8df6b644-0206-4d50-aade-a565d5c82690',
        limit: countMessages1,
        deleteMessages: false,
        recipientDid: 'HBstN9Dusi7vJzuQ99fCmnvvrcKPAprCknp6XKmgHk89',
      }),
    ])
    logger.log(`client_1 GetMessage: ${JSON.stringify(getMessage.length, null, 2)}`)
    logger.log(`client_2 GetMessage: ${JSON.stringify(getMessage1.length, null, 2)}`)

    logger.log(`\n *** End takeFromQueue test ***\n`)

    await new Promise((resolve) => setTimeout(resolve, 5000))

    // Remove messages
    logger.log(`*** Begin takeFromQueue test ***\n`)
    const messageIds = getMessage.map((message) => message.id)
    const messageIds1 = getMessage1.map((message1) => message1.id)

    logger.log(`client-1 messageIds: ${messageIds}\n`)
    logger.log(`client-2 messageIds1: ${messageIds1}\n`)

    const [removeMessages] = await Promise.all([
      await client.removeMessages({ connectionId: connectionId_1, messageIds }),
    ])

    await new Promise((resolve) => setTimeout(resolve, 2000))

    const [removeAllMessages] = await Promise.all([
      await client.removeAllMessages({
        connectionId: connectionId_2,
        recipientDid: 'HBstN9Dusi7vJzuQ99fCmnvvrcKPAprCknp6XKmgHk89',
      }),
    ])

    logger.log(`client-1 RemoveMessages: ${JSON.stringify(removeMessages, null, 2)}`)
    logger.log(`client-2 RemoveAllMessages: ${JSON.stringify(removeAllMessages, null, 2)}`)

    logger.log(`\n *** End takeFromQueue test ***\n`)
    await new Promise((resolve) => setTimeout(resolve, 5000))

    // Eliminar sesiones en vivo
    logger.log(`*** Begin removeLiveSession test ***\n`)
    const removeSession = await client.removeLiveSession({
      connectionId: connectionId_1,
    })
    const removeSession1 = await client.removeLiveSession({
      connectionId: connectionId_2,
    })
    logger.log(`RemoveLiveSession client-1: ${removeSession} -- client-2: ${removeSession1}`)
    logger.log(`\n *** End removeLiveSession test ***\n`)
  } catch (error) {
    logger.error(`Error in WebSocket test script: ${error.message}`)
  } finally {
    await client.disconnect()
    logger.log(`\n *** End testing ***\n`)
    process.exit(0)
  }
})()
