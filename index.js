const WhatsApp = require('./ev')

const { exec } = require('child_process')
const { promisify } = require('util')

const connect = async () => {
   const { stdout: chromiumPath } = await promisify(exec)('which chromium')

   const client = new WhatsApp({
      session: 'session',
      number: '6282258694977',
      puppeteer: {
         args: null,
         options: {
            executablePath: chromiumPath.trim()
         }
      }
   })

   client.register('error', ctx => console.log)

   client.register('connect', ctx => {
      console.log(ctx.qr)
   })

   client.register('status', ctx => console.log(ctx))
   client.register('message', async ctx => {
      await require('./handler')(client.connection, ctx)
   })
   // client.on('ack', ctx => console.log(ctx))
   client.register('ackError', ctx => console.log)
   client.register('incomingCall', ctx => console.log)
}

connect().catch(() => connect())