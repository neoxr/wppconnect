import 'dotenv/config'
import fs from 'fs'

export { default as WhatsApp } from './WppConnect/connection'
export { default as Function } from './Utils/functions'

import WhatsApp from './WppConnect/connection'
import Function from './Utils/functions'

const Config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'))
const NeoxrApi = require('@neoxr/api')
const Version = require('../package.json')?.version

class Component {
   private Config: typeof Config
   private WhatsApp: typeof WhatsApp
   private Function: typeof Function
   private NeoxrApi: typeof NeoxrApi
   private Version: string

   constructor() {
      this.Config = Config
      this.WhatsApp = WhatsApp
      this.Function = Function
      this.NeoxrApi = NeoxrApi
      this.Version = Version
   }
}

export { Component }