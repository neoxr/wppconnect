const WhatsApp = require('./ev')

const { exec } = require('child_process')
const { promisify } = require('util')

const connect = async () => {
   const { stdout: chromiumPath } = await promisify(exec)('which chromium')

   const client = new WhatsApp({
      session: 'session',
      // number: 6282258694977,
      puppeteer: {
         args: null,
         options: {
            executablePath: chromiumPath.trim()
         }
      }
   })

   client.register('error', ctx => console.log)

   client.register('status', ctx => console.log)

   client.register('connect', data => {
      console.log(data.qr)
   })
}

connect().catch(() => connect())