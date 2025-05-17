const wppconnect = require('@wppconnect-team/wppconnect');
const { exec } = require('child_process')
const { promisify } = require('util')
// wppconnect.defaultLogger.level = 'info';
wppconnect.defaultLogger.transports.forEach((t) => (t.silent = true));

const connect = async () => {
   const { stdout: chromiumPath } = await promisify(exec)('which chromium')
   wppconnect
      .create({
         session: 'sessionName',
         phoneNumber: '6282258694977',
         catchLinkCode: (str) => console.log('Code: ' + str),
         statusFind: (statusSession, session) => {
            console.log('Status Session: ', statusSession); //return isLogged || notLogged || browserClose || qrReadSuccess || qrReadFail || autocloseCalled || desconnectedMobile || deleteToken
            //Create session wss return "serverClose" case server for close
            console.log('Session name: ', session);
         },
         headless: true,
         devtools: false,
         useChrome: false,
         debug: false,
         browserArgs: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-cache',
            '--disk-cache-size=0',
            '--disable-application-cache',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-infobars',
            '--disable-extensions',
            '--disable-default-apps',
            '--disable-background-networking',
            '--disable-sync',
            '--disable-translate'
         ],
         puppeteerOptions: {
            executablePath: chromiumPath.trim()
         },
      })
      .then((client) => start(client))
      .catch((error) => console.log(error))

   function start(client) {
      client.onMessage((message) => {
         console.log({ message })
         if (message.body === 'Hello') {
            client
               .sendText(message.from, 'Hello, how I may help you?', {
                  quotedMsg: message.id
               })
               .then((result) => {
                  // console.log('Result: ', result); //return object success
               })
               .catch((erro) => {
                  console.error('Error when sending: ', erro); //return object error
               });
         }
      });
   }
}

connect()