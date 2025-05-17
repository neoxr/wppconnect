import { EventEmitter } from 'events'
import { create, defaultLogger, CreateConfig, Whatsapp } from '@wppconnect-team/wppconnect'

type ListenerRegistryItem = {
   callCount: number
   resetAfter: boolean
   handler: (...args: any[]) => void
   listener: (...args: any[]) => void
}

export default class WhatsApp extends EventEmitter {
   args: any
   options: Partial<CreateConfig>
   ev: Whatsapp | null
   listenerRegistry: Map<string, ListenerRegistryItem>

   constructor(args: any = {}, options: Partial<CreateConfig> = {}) {
      super()
      this.setMaxListeners(9)
      this.args = args
      this.options = options
      this.ev = null
      this.listenerRegistry = new Map()
      this.init()
   }

   register(event: string, handler: (...args: any[]) => void, maxCalls = 2, resetAfter = true) {
      if (!this.listenerRegistry.has(event)) {
         const listener = this._createListener(event, handler, maxCalls, resetAfter)
         this.listenerRegistry.set(event, { callCount: 0, resetAfter, handler, listener })
         this.on(event, listener)
      }
   }

   private _createListener(
      event: string,
      handler: (...args: any[]) => void,
      maxCalls: number,
      resetAfter: boolean
   ): (...args: any[]) => void {
      return (...args: any[]) => {
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

   init = async () => {
      if (this.args?.logger === 'silent') {
         defaultLogger.transports.forEach(t => (t.silent = true))
      } else {
         defaultLogger.level = this.args?.logger
      }

      await this.create()
   }

   create = async () => {
      try {
         this.ev = await create({
            session: this.args?.session || 'session',
            ...(this.args?.number ? {
               phoneNumber: String(this.args.number),
               catchLinkCode: code => {
                  this.emit('connect', {
                     attempts: null,
                     qr: null,
                     base64: null,
                     code: code?.match(/.{1,4}/g)?.join('-') || code
                  })
               }
            } : {
               catchQR: (base64Qrimg, asciiQR, attempts) => {
                  this.emit('connect', {
                     attempts,
                     qr: asciiQR,
                     base64: base64Qrimg,
                     code: null
                  })
               }
            }),
            statusFind: (statusSession, session) => {
               if (statusSession === 'serverClose') {
                  this.emit('status', { status: statusSession, session })
                  this.create()
               }
               this.emit('status', { status: statusSession, session })
            },
            headless: true,
            useChrome: false,
            devtools: false,
            debug: false,
            browserArgs:
               this.args?.puppeteer?.args || [
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

         if (!this.ev) return

         this.ev.onMessage(message => {
            this.emit('message', message)
         })

         this.ev.onAck(message => {
            this.emit('ack', message)
         })
      } catch (e: any) {
         this.emit('error', { message: e.message })
      }
   }
}
