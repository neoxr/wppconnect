"use strict";
const EventEmitter = require('events').EventEmitter
const wppconnect = require('@wppconnect-team/wppconnect');
const { exec } = require('child_process')
const { promisify } = require('util')
// wppconnect.defaultLogger.level = 'info';
wppconnect.defaultLogger.transports.forEach((t) => (t.silent = true));


module.exports = class WhatsApp extends EventEmitter {
   constructor(args = {}, options = {}) {
      super()
      this.setMaxListeners(9)
      this.args = args
      this.options = options
      this.connection = null
   }
   
   create = async () => {
      try {
         this.connection = await wppconnect.create({
            session: this.args?.session || 'session',
            ...(this.args?.number ? { phoneNumber: String(this.args.number) } : {}),
            headless: true,
            devtools: false,
            useChrome: false,
            debug: false,
            browserArgs: this.args?.puppeteer?.args || [
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
         puppeteerOptions: this.args?.puppeteer?.opts || {},
         ...this.options
         })
      } catch (e) {
         this.emit('error', { message: e.message })
      }
   }
}