"use strict";
const EventEmitter = require('events').EventEmitter
const wppconnect = require('@wppconnect-team/wppconnect');
const { exec } = require('child_process')
const { promisify } = require('util')
wppconnect.defaultLogger.level = 'http'
wppconnect.defaultLogger.transports.forEach((t) => (t.silent = true))


module.exports = class WhatsApp extends EventEmitter {
   constructor(args = {}, options = {}) {
      super()
      this.setMaxListeners(9)
      this.args = args
      this.options = options
      this.connection = null
      this.listenerRegistry = new Map()
      this.create()
   }

   register(event, handler, maxCalls = 2, resetAfter = true) {
      if (!this.listenerRegistry.has(event)) {
         const listener = this._createListener(event, handler, maxCalls, resetAfter)
         this.listenerRegistry.set(event, { callCount: 0, resetAfter, handler, listener })
         this.on(event, listener)
      }
   }

   _createListener(event, handler, maxCalls, resetAfter) {
      return (...args) => {
         const registry = this.listenerRegistry.get(event)
         if (!registry) return

         if (registry.callCount < maxCalls) {
            registry.callCount++
            handler(...args)
         }

         if (registry.callCount >= maxCalls) {
            this.removeListener(event, registry.listener)
            if (resetAfter) {
               registry.callCount = 0
               const newListener = this._createListener(event, handler, maxCalls, resetAfter)
               registry.listener = newListener
               this.on(event, newListener)
            }
         }
      }
   }

   create = async () => {
      try {
         this.connection = await wppconnect.create({
            session: this.args?.session || 'session',
            ...(this.args?.number ? {
               phoneNumber: String(this.args.number),
               catchLinkCode: code => this.emit('connect', { attempts: null, qr: null, base64: null, code: code?.match(/.{1,4}/g).join('-') || code })
            } : {
               catchQR: (base64Qrimg, asciiQR, attempts, urlCode) => {
                  this.emit('connect', { attempts, qr: asciiQR, base64: base64Qrimg, code: null })
               }
            }),
            statusFind: (statusSession, session) => {
               this.emit('status', { statusSession, session })
            },
            headless: true,
            useChrome: false,
            devtools: false,
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
            puppeteerOptions: this.args?.puppeteer?.options || {},
            ...this.options
         })
      } catch (e) {
         this.emit('error', { message: e.message })
      }
   }
}