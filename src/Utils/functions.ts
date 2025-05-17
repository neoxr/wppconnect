import axios from 'axios'
import fetch from 'node-fetch'
import fs from 'fs'
import mime from 'mime-types'
import chalk from 'chalk'
import path from 'path'
import { fromBuffer } from 'file-type'
import moment from 'moment-timezone'
import NodeID3 from 'node-id3'
import chokidar from 'chokidar'
import stream from 'stream'
import ffmpeg from 'fluent-ffmpeg'

const listeners = new Map()
const watchers = new Map()

moment.tz.setDefault(process.env.TZ)

class Function {
   delay = (time: number) => new Promise(res => setTimeout(res, time))

   isUrl = (url: string): boolean => {
      try {
         new URL(url)
         return true
      } catch (e) {
         return false
      }
   }

   fetchJson = async (url: string, options: any = {}): Promise<any> => {
      try {
         const result = await (await axios.get(url, {
            ...options
         })).data
         return result
      } catch (e) {
         return {
            status: false,
            msg: e.message
         }
      }
   }

   fetchBuffer = async (file: string | Buffer, options: any = {}): Promise<Buffer | { status: boolean, msg: string }> => {
      try {
         if (Buffer.isBuffer(file)) {
            // Jika file adalah Buffer, langsung kembalikan
            return file
         } else if (this.isUrl(file)) {
            // Jika file adalah URL, lakukan fetch
            const buffer = await (await axios.get(file, {
               responseType: "arraybuffer",
               ...options
            })).data
            return buffer
         } else {
            // Jika file adalah path (string), baca file dari sistem
            const buffer = fs.readFileSync(file)
            return buffer
         }
      } catch (e) {
         return {
            status: false,
            msg: e.message
         }
      }
   }

   fetchAsBuffer = (source: string): Promise<Buffer | null> => new Promise(async resolve => {
      try {
         if (this.isUrl(source)) {
            const buffer = await (await fetch(source)).buffer()
            resolve(buffer)
         } else {
            const buffer = fs.readFileSync(source)
            resolve(buffer)
         }
      } catch (e) {
         resolve(null)
      }
   })

   fetchAsJSON = (source: string): Promise<any> => new Promise(async resolve => {
      try {
         const result = await (await fetch(source)).json()
         resolve(result)
      } catch (e) {
         resolve(null)
      }
   })

   fetchAsText = (source: string): Promise<string | null> => new Promise(async resolve => {
      try {
         const result = await (await fetch(source)).text()
         resolve(result)
      } catch (e) {
         resolve(null)
      }
   })

   fetchAsBlob = (source: string): Promise<Blob | null> => new Promise(async resolve => {
      try {
         const result = await (await fetch(source)).blob()
         resolve(result)
      } catch (e) {
         resolve(null)
      }
   })

   parseCookie = async (file: string, options: any = {}): Promise<any> => {
      return new Promise(async (resolve, reject) => {
         try {
            let cookie = await (await axios.get(file, {
               responseType: "arraybuffer",
               headers: options
            })).headers['set-cookie']
            resolve(cookie)
         } catch (e) {
            return {
               status: false,
               msg: e.message
            }
         }
      })
   }

   toMp3 = (inputFile: string): Promise<Buffer> => new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      ffmpeg(inputFile)
         .audioCodec('libmp3lame')
         .audioBitrate('128k')
         .outputFormat('mp3')
         .noVideo()
         .outputOptions(['-preset ultrafast'])
         .on('error', (err) => { })
         .on('end', () => {
            resolve(Buffer.concat(chunks))
         })
         .pipe()
         .on('data', (chunk) => chunks.push(chunk))
         .on('error', (err) => { })
   })

   metaAudio = (source: string | Buffer, tags: any = {}): Promise<any> => new Promise(async (resolve) => {
      try {
         const buffer = Buffer.isBuffer(source) ? source : await this.fetchAsBuffer(source)
         const { status, file, mime } = await this.getFile(buffer!)

         if (!status) {
            return resolve({
               status: false,
               msg: 'File not found'
            })
         }

         if (!/(audio|video)/.test(mime)) {
            return resolve({
               status: true,
               file
            })
         }

         let isFile: Buffer
         if (/video/.test(mime)) {
            isFile = await this.toMp3(file)
         } else {
            isFile = fs.readFileSync(file)
         }

         NodeID3.write(tags, isFile, (e: any, buffer) => {
            if (e instanceof Error) {
               resolve({
                  status: false,
                  msg: e.message
               })
               return
            }

            fs.writeFileSync(file, buffer)
            resolve({
               status: true,
               file
            })
         })
      } catch (e: any) {
         resolve({
            status: false,
            msg: e.message
         })
      }
   })

   texted = (type: string, text: string): string => {
      switch (type) {
         case 'bold':
            return '*' + text + '*'
         case 'italic':
            return '_' + text + '_'
         case 'monospace':
            return '```' + text + '```'
         default:
            return text
      }
   }

   example = (isPrefix: string, command: string, args: string): string => {
      return `• ${this.texted('bold', 'Example')} : ${isPrefix + command} ${args}`
   }

   igFixed = (url: string): string => {
      let count = url.split('/')
      if (count.length == 7) {
         let username = count[3]
         let destruct = this.removeItem(count, username)
         return destruct.map(v => v).join('/')
      } else return url
   }

   ttFixed = (url: string): string => {
      if (!url.match(/(tiktok.com\/t\/)/g)) return url
      let id = url.split('/t/')[1]
      return 'https://vm.tiktok.com/' + id
   }

   toTime = (ms: number): string => {
      let h = Math.floor(ms / 3600000)
      let m = Math.floor(ms / 60000) % 60
      let s = Math.floor(ms / 1000) % 60
      return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':')
   }

   readTime = (ms: number): { days: number, hours: number, minutes: number, seconds: number } => {
      const days = Math.floor(ms / (24 * 60 * 60 * 1000))
      const daysms = ms % (24 * 60 * 60 * 1000)
      const hours = Math.floor(daysms / (60 * 60 * 1000))
      const hoursms = ms % (60 * 60 * 1000)
      const minutes = Math.floor(hoursms / (60 * 1000))
      const minutesms = ms % (60 * 1000)
      const sec = Math.floor(minutesms / 1000)
      const format = [days, hours, minutes, sec].map(v => v.toString().padStart(2, '0'))
      return {
         days: Number(format[0]),
         hours: Number(format[1]),
         minutes: Number(format[2]),
         seconds: Number(format[3])
      }
   }

   filename = (extension: string): string => {
      return `${Math.floor(Math.random() * 10000)}.${extension}`
   }

   uuid = (): string => {
      var dt = (new Date).getTime()
      var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
         var r = (dt + Math.random() * 16) % 16 | 0
         var y = Math.floor(dt / 16)
         return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16)
      })
      return uuid
   }

   random = (list: any[]): any => {
      return list[Math.floor(Math.random() * list.length)]
   }

   randomInt = (min: number, max: number): number => {
      min = Math.ceil(min)
      max = Math.floor(max)
      return Math.floor(Math.random() * (max - min + 1)) + min
   }

   formatter = (integer: number): string => {
      let numb = parseInt(integer.toString())
      return Number(numb).toLocaleString().replace(/,/g, '.')
   }

   formatNumber = (integer: number): string => {
      let numb = parseInt(integer.toString())
      return Number(numb).toLocaleString().replace(/,/g, '.')
   }

   h2k = (integer: number): string => {
      let numb = parseInt(integer.toString())
      return new Intl.NumberFormat('en-US', {
         notation: 'compact'
      }).format(numb)
   }

   formatSize = (size: number): string => {
      function round(value: number, precision: number): number {
         var multiplier = Math.pow(10, precision || 0)
         return Math.round(value * multiplier) / multiplier
      }
      var megaByte = 1024 * 1024
      var gigaByte = 1024 * megaByte
      var teraByte = 1024 * gigaByte
      if (size < 1024) {
         return size + ' B'
      } else if (size < megaByte) {
         return round(size / 1024, 1) + ' KB'
      } else if (size < gigaByte) {
         return round(size / megaByte, 1) + ' MB'
      } else if (size < teraByte) {
         return round(size / gigaByte, 1) + ' GB'
      } else {
         return round(size / teraByte, 1) + ' TB'
      }
      return ''
   }

   getSize = async (str: string | number): Promise<string> => {
      if (!isNaN(Number(str))) return this.formatSize(Number(str))
      let header = await (await axios.get(str.toString())).headers
      return this.formatSize(Number(header?.['content-length'] || 0))
   }

   getFile = async (source: string | Buffer, filename?: string, options?: any): Promise<any> => {
      try {
         if (Buffer.isBuffer(source)) {
            let ext: string | undefined, mime: string | undefined
            try {
               const bufferResult = await fromBuffer(source)
               mime = bufferResult?.mime
               ext = bufferResult?.ext
            } catch (error) {
               console.error('Error extracting MIME type or extension from buffer:', error)
               const fallbackExtension = filename ? filename.split('.').pop() : 'txt'
               mime = require('mime-types').lookup(fallbackExtension) || 'application/octet-stream'
               ext = require('mime-types').extension(mime) || fallbackExtension || 'txt'
            }

            if (!ext) ext = 'txt'
            if (!mime) mime = 'application/octet-stream'

            const extension = filename ? filename.split('.')[filename.split('.').length - 1] : ext
            const size = Buffer.byteLength(source)
            const filepath = 'temp/' + (this.uuid() + '.' + ext)
            const file = fs.writeFileSync(filepath, source)
            const name = filename || path.basename(filepath)
            return new Promise(resolve => {
               const data = {
                  status: true,
                  file: filepath,
                  filename: name,
                  mime: mime,
                  extension: ext,
                  size: this.formatSize(size),
                  bytes: size
               }
               return resolve(data)
            })
         } else if (source.startsWith('./') || source.startsWith('/')) {
            const mime = require('mime-types').lookup(filename ? filename.split('.')[filename.split('.').length - 1] : source.split('.')[source.split('.').length - 1])
            const ext = require('mime-types').extension(mime)
            const extension = filename ? filename.split('.')[filename.split('.').length - 1] : ext
            const size = fs.statSync(source).size
            const name = filename || path.basename(source)
            return new Promise(resolve => {
               const data = {
                  status: true,
                  file: source,
                  filename: name,
                  mime: mime,
                  extension: ext,
                  size: this.formatSize(size),
                  bytes: size
               }
               return resolve(data)
            })
         } else {
            return new Promise(async resolve => {
               try {
                  const Miniget = require('miniget')
                  const res = new Miniget(source, {
                     headers: {
                        "Accept": "*/*",
                        "Cache-Control": "no-cache",
                        "Connection": "Keep-Alive",
                        "Dnt": "1",
                        "Referrer-Policy": "strict-origin-when-cross-origin",
                        "sec-ch-ua": '"Chromium";v="107", "Not=A?Brand";v="24"',
                        "sec-ch-ua-platform": "Android",
                        "sec-fetch-dest": "empty",
                        "sec-fetch-mode": "cors",
                        "sec-fetch-site": "same-origin",
                        "Pragma": "no-cache",
                        "Priority": "u=1, i",
                        "User-Agent": "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
                        "Upgrade-Insecure-Requests": "1",
                        "X-Requested-With": "XMLHttpRequest",
                        ...options
                     }
                  })

                  res.on('error', (err) => {
                     resolve({
                        status: false,
                        msg: `[${err.statusCode}] : Error while getting file`
                     })
                  })

                  res.on('response', (response) => {
                     if (response?.statusCode !== 200) {
                        resolve({
                           status: false,
                           msg: `[${response.statusCode}] : Error while getting file`
                        })
                        return
                     }
                     const extension = filename ? filename.split('.')[filename.split('.').length - 1] : mime.extension(response.headers['content-type'])
                     const file = fs.createWriteStream(`temp/${this.uuid() + '.' + extension}`)
                     const name = filename || path.basename(file.path?.toString())
                     const transformStream = new stream.Transform({
                        transform(chunk, encoding, callback) {
                           callback(null, chunk)
                        }
                     })
                     res.pipe(transformStream).pipe(file)
                     file.on('finish', () => {
                        const data = {
                           status: true,
                           file: file.path,
                           filename: name,
                           mime: mime.lookup(file.path),
                           extension: extension,
                           size: this.formatSize(response.headers['content-length'] ? response.headers['content-length'] : 0),
                           bytes: response.headers['content-length'] ? parseInt(response.headers['content-length']) : 0,
                           headers: response.headers
                        }
                        resolve(data)
                     })
                        .on('error', (error) => {
                           resolve({
                              status: false,
                              msg: `Error when getting the file`
                           })
                        })
                  })
               } catch (e) {
                  return {
                     status: false,
                     msg: e.message
                  }
               }
            })
         }
      } catch (e) {
         return {
            status: false,
            msg: e.message
         }
      }
   }

   color = (text: string, color: string = 'green'): string => {
      return chalk?.[color]?.bold(text)
   }

   mtype = (data: any): string => {
      function replaceAll(str: string): string {
         let res = str.replace(new RegExp('```', 'g'), '')
            .replace(new RegExp('_', 'g'), '')
            .replace(new RegExp(/[*]/, 'g'), '')
         return res
      }
      let type = (typeof data.text !== 'object') ? replaceAll(data.text) : ''
      return type
   }

   sizeLimit = (str: string, max: number): { oversize: boolean } => {
      let data
      if (str.match('G') || str.match('GB') || str.match('T') || str.match('TB')) return data = {
         oversize: true
      }
      if (str.match('M') || str.match('MB')) {
         let first = str.replace(/MB|M|G|T/g, '').trim()
         if (isNaN(Number(first))) return data = {
            oversize: true
         }
         if (Number(first) > max) return data = {
            oversize: true
         }
         return data = {
            oversize: false
         }
      } else {
         return data = {
            oversize: false
         }
      }
   }

   generateLink = (text: string): string[] | null => {
      let regex = /(https?:\/\/(?:www\.|(?!www))[^\s\.]+\.[^\s]{2,}|www\.[^\s]+\.[^\s]{2,})/gi
      return text.match(regex)
   }

   debounce = (func: (message: string) => void, delay: number): (message: string) => void => {
      let timeout: ReturnType<typeof setTimeout>
      return (message: string) => {
         clearTimeout(timeout)
         timeout = setTimeout(() => func(message), delay)
      }
   }

   reload = (file: string, delay: number = 1000): void => {
      if (path.resolve(file) === __filename) {
         console.log(
            chalk.redBright.bold('[ SKIP ]'),
            chalk.blueBright(moment(Date.now()).format('DD/MM/YY HH:mm:ss')),
            chalk.green.bold('File cannot reload itself: ' + path.basename(file))
         )
         return
      }

      if (listeners.has(file)) {
         listeners.get(file).close()
         listeners.delete(file)
      }

      const watcher = chokidar.watch(file, { persistent: true, usePolling: false })

      const debouncedReload = this.debounce(() => {
         console.log(
            chalk.redBright.bold('[ UPDATE ]'),
            chalk.blueBright(moment(Date.now()).format('DD/MM/YYYY HH:mm:ss')),
            chalk.green.bold('~ ' + path.basename(file))
         )
         delete require.cache[require.resolve(file)]
         require(file)
      }, delay)

      watcher.on('change', debouncedReload)

      listeners.set(file, watcher)
   }

   updateFile = (file: string): void => {
      if (watchers.has(file)) {
         watchers.get(file).close()
         watchers.delete(file)
      }

      const watcher = fs.watch(file, (eventType) => {
         if (eventType === 'change') {
            console.log(
               chalk.redBright.bold('[ UPDATE ]'),
               chalk.blueBright(moment(Date.now()).format('DD/MM/YYYY HH:mm:ss')),
               chalk.green.bold('~ ' + path.basename(file))
            )
            delete require.cache[require.resolve(file)]
            require(file)
         }
      })

      watchers.set(file, watcher)

      process.on('exit', () => {
         watcher.close()
         watchers.delete(file)
      })
   }

   jsonFormat = (obj: any): string => {
      try {
         let print = (obj && (obj.constructor.name == 'Object' || obj.constructor.name == 'Array')) ? require('util').format(JSON.stringify(obj, null, 2)) : require('util').format(obj)
         return print
      } catch {
         return require('util').format(obj)
      }
   }

   ucword = (str: string): string => {
      return (str + '').replace(/^([a-z])|\s+([a-z])/g, function ($1) {
         return $1.toUpperCase()
      })
   }

   arrayJoin = (arr: any[]): any[] => {
      var construct = []
      for (var i = 0; i < arr.length; i++) construct = construct.concat(arr[i])
      return construct
   }

   removeItem = (arr: any[], value: any): any[] => {
      let index = arr.indexOf(value)
      if (index > -1) arr.splice(index, 1)
      return arr
   }

   hitstat = (cmd: string, who: string, options: any = {}): void => {
      if (/bot|help|menu|stat|hitstat|hitdaily/.test(cmd)) return
      if (typeof global.db == 'undefined') return
      if (options?.findJid) {
         let statistic = options?.hostJid
            ? global.db.statistic
            : options.findJid.bot(options.clientJid)
               ? options.findJid.bot(options.clientJid)?.data?.statistic
               : global.db.statistic

         if (!statistic[cmd]) {
            statistic[cmd] = {
               hitstat: 1,
               today: 1,
               lasthit: Date.now() * 1,
               sender: who.split('@')[0]
            }
         } else {
            statistic[cmd].hitstat += 1
            statistic[cmd].today += 1
            statistic[cmd].lasthit = Date.now() * 1
            statistic[cmd].sender = who.split('@')[0]
         }
      } else {
         global.db.statistic = global.db.statistic ? global.db.statistic : {}
         if (!global.db.statistic[cmd]) {
            global.db.statistic[cmd] = {
               hitstat: 1,
               today: 1,
               lasthit: Date.now() * 1,
               sender: who.split('@')[0]
            }
         } else {
            global.db.statistic[cmd].hitstat += 1
            global.db.statistic[cmd].today += 1
            global.db.statistic[cmd].lasthit = Date.now() * 1
            global.db.statistic[cmd].sender = who.split('@')[0]
         }
      }
   }

   socmed = (url: string): boolean => {
      const regex = [
         /^(?:https?:\/\/(web\.|www\.|m\.)?(facebook|fb)\.(com|watch)\S+)?$/,
         /^(?:https?:\/\/)?(?:www\.)?(?:instagram\.com\/)(?:tv\/|p\/|reel\/)(?:\S+)?$/,
         /^(?:https?:\/\/)?(?:www\.)?(?:instagram\.com\/)(?:stories\/)(?:\S+)?$/,
         /^(?:https?:\/\/)?(?:www\.)?(?:instagram\.com\/)(?:s\/)(?:\S+)?$/,
         /^(?:https?:\/\/)?(?:www\.)?(?:mediafire\.com\/)(?:\S+)?$/,
         /pin(?:terest)?(?:\.it|\.com)/,
         /^(?:https?:\/\/)?(?:www\.|vt\.|vm\.|t\.)?(?:tiktok\.com\/)(?:\S+)?$/,
         /http(?:s)?:\/\/(?:www\.|mobile\.)?twitter\.com\/([a-zA-Z0-9_]+)/,
         /^(?:https?:\/\/)?(?:www\.|m\.|music\.)?youtu\.?be(?:\.com)?\/?.*(?:watch|embed)?(?:.*v=|v\/|\/)([\w\-_]+)\&?/,
         /^(?:https?:\/\/)?(?:podcasts\.)?(?:google\.com\/)(?:feed\/)(?:\S+)?$/
      ]
      return regex.some(v => /tiktok/.test(url) ? url.match(v) && !/tiktoklite/gis.test(url) : url.match(v))
   }

   matcher = (string: string, array: any[], options: any): any[] => {
      function levenshtein(value: string, other: string, insensitive: boolean): number {
         var cache: number[] = []
         var codes: number[] = []
         var length
         var lengthOther
         var code
         var result
         var distance
         var distanceOther
         var index
         var indexOther

         if (value === other) {
            return 0
         }

         length = value.length
         lengthOther = other.length

         if (length === 0) {
            return lengthOther
         }

         if (lengthOther === 0) {
            return length
         }

         if (insensitive) {
            value = value.toLowerCase()
            other = other.toLowerCase()
         }

         index = 0

         while (index < length) {
            codes[index] = value.charCodeAt(index)
            cache[index] = ++index
         }

         indexOther = 0

         while (indexOther < lengthOther) {
            code = other.charCodeAt(indexOther)
            result = distance = indexOther++
            index = -1

            while (++index < length) {
               distanceOther = code === codes[index] ? distance : distance + 1
               distance = cache[index]
               cache[index] = result =
                  distance > result ?
                     distanceOther > result ?
                        result + 1 :
                        distanceOther :
                     distanceOther > distance ?
                        distance + 1 :
                        distanceOther
            }
         }
         return result
      }

      function similarity(a: string, b: string, options: any): string {
         var left = a || ''
         var right = b || ''
         var insensitive = !(options || {}).sensitive
         var longest = Math.max(left.length, right.length)
         return ((longest === 0 ? 1 : (longest - levenshtein(left, right, insensitive)) / longest * 100)).toFixed(1)
      }

      let data: { string: string, accuracy: string }[] = []
      // let isArray = array.constructor.name == 'Array' ? array : ([array] || [])
      let isArray = Array.isArray(array) ? array : [array]
      isArray.map(v => data.push({
         string: v,
         accuracy: similarity(string, v, null)
      }))
      return data
   }

   toDate = (ms: number): string => {
      let temp = ms
      let days = Math.floor(ms / (24 * 60 * 60 * 1000))
      let daysms = ms % (24 * 60 * 60 * 1000)
      let hours = Math.floor((daysms) / (60 * 60 * 1000))
      let hoursms = ms % (60 * 60 * 1000)
      let minutes = Math.floor((hoursms) / (60 * 1000))
      let minutesms = ms % (60 * 1000)
      let sec = Math.floor((minutesms) / 1000)
      if (days == 0 && hours == 0 && minutes == 0) {
         return "Recently"
      } else {
         return days + "D " + hours + "H " + minutes + "M"
      }
   }

   timeFormat = (value: number): string => {
      let hours: any, minutes: any, seconds: any
      const sec = parseInt(value.toString(), 10)
      hours = Math.floor(sec / 3600)
      minutes = Math.floor((sec - (hours * 3600)) / 60)
      seconds = sec - (hours * 3600) - (minutes * 60)
      if (hours < 10) hours = '0' + hours
      if (minutes < 10) minutes = '0' + minutes
      if (seconds < 10) seconds = '0' + seconds
      if (hours == parseInt('00')) return minutes + ':' + seconds
      return hours + ':' + minutes + ':' + seconds
   }

   switcher = (status: boolean, isTrue: string, isFalse: string): string => {
      return (status) ? this.texted('bold', isTrue) : this.texted('bold', isFalse)
   }

   makeId = (length: number): string => {
      var result = ''
      var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      var charactersLength = characters.length
      for (var i = 0; i < length; i++) {
         result += characters.charAt(Math.floor(Math.random() * charactersLength))
      }
      return result
   }

   timeReverse = (duration: number): string => {
      // let milliseconds = parseInt((duration % 1000) / 100)
      let seconds = Math.floor((duration / 1000) % 60)
      let minutes = Math.floor((duration / (1000 * 60)) % 60)
      let hours = Math.floor((duration / (1000 * 60 * 60)) % 24)
      let days = Math.floor(duration / (24 * 60 * 60 * 1000))
      let hoursF = (hours < 10) ? "0" + hours : hours
      let minutesF = (minutes < 10) ? "0" + minutes : minutes
      // let secondsF = (seconds < 10) ? "0" + seconds : seconds
      let daysF = (days < 10) ? "0" + days : days
      return daysF + "D " + hoursF + "H " + minutesF + "M"
   }

   greeting = (): string => {
      let time = parseInt(moment.tz(process.env.TZ || 'Asia/Jakarta').format('HH'))
      let res = `Don't forget to sleep`
      if (time >= 3) res = `Good Evening`
      if (time > 6) res = `Good Morning`
      if (time >= 11) res = `Good Afternoon`
      if (time >= 18) res = `Good Night`
      return res
   }

   jsonRandom = (file: string): any => {
      try {
         const fileContent = fs.readFileSync(file, 'utf-8')
         const json = JSON.parse(fileContent)

         if (!Array.isArray(json)) {
            throw new Error('JSON file is not an array')
         }

         return json[Math.floor(Math.random() * json.length)]
      } catch (e) {
         console.error(e)
         return null // atau kembalikan nilai default
      }
   }

   level = (xp: number, multiplier: number = 5): [number, number, number, number] => {
      var XPAsli = xp
      var level = 1
      while (xp > 1) {
         xp /= multiplier
         if (xp < 1) {
            level == level
         } else {
            level += 1
         }
      }
      var XPLevel = 1
      while (XPAsli >= XPLevel) {
         XPLevel = XPLevel + XPLevel
      }
      var sisaXP = XPLevel - XPAsli
      if (sisaXP == 0) sisaXP = XPLevel + XPLevel
      let kurang = XPLevel - sisaXP
      return [level, XPLevel, sisaXP, kurang]
   }

   leveling = (xp: number, multiplier: number, def: number = 87200): any => {
      const xpLevel1 = def * Number(multiplier)
      let currentLevel = (xp <= xpLevel1) ? 1 : Math.floor(xp / xpLevel1)
      let nextLevel = currentLevel + 1
      let xpToLevelUp = xpLevel1 * nextLevel
      let remainingXp = xpToLevelUp - xp
      let result = {
         currentXp: xp,
         currentLevel: currentLevel,
         nextLevel: nextLevel,
         xpToLevelUp: xpToLevelUp,
         remainingXp: remainingXp,
      }
      return result
   }

   role = (level: number): string => {
      let roles = '-'
      if (level <= 2) {
         roles = 'Newbie ㋡'
      } else if (level <= 4) {
         roles = 'Beginner Grade 1 ⚊¹'
      } else if (level <= 6) {
         roles = 'Beginner Grade 2 ⚊²'
      } else if (level <= 8) {
         roles = 'Beginner Grade 3 ⚊³'
      } else if (level <= 10) {
         roles = 'Beginner Grade 4 ⚊⁴'
      } else if (level <= 12) {
         roles = 'Private Grade 1 ⚌¹'
      } else if (level <= 14) {
         roles = 'Private Grade 2 ⚌²'
      } else if (level <= 16) {
         roles = 'Private Grade 3 ⚌³'
      } else if (level <= 18) {
         roles = 'Private Grade 4 ⚌⁴'
      } else if (level <= 20) {
         roles = 'Private Grade 5 ⚌⁵'
      } else if (level <= 22) {
         roles = 'Corporal Grade 1 ☰¹'
      } else if (level <= 24) {
         roles = 'Corporal Grade 2 ☰²'
      } else if (level <= 26) {
         roles = 'Corporal Grade 3 ☰³'
      } else if (level <= 28) {
         roles = 'Corporal Grade 4 ☰⁴'
      } else if (level <= 30) {
         roles = 'Corporal Grade 5 ☰⁵'
      } else if (level <= 32) {
         roles = 'Sergeant Grade 1 ≣¹'
      } else if (level <= 34) {
         roles = 'Sergeant Grade 2 ≣²'
      } else if (level <= 36) {
         roles = 'Sergeant Grade 3 ≣³'
      } else if (level <= 38) {
         roles = 'Sergeant Grade 4 ≣⁴'
      } else if (level <= 40) {
         roles = 'Sergeant Grade 5 ≣⁵'
      } else if (level <= 42) {
         roles = 'Staff Grade 1 ﹀¹'
      } else if (level <= 44) {
         roles = 'Staff Grade 2 ﹀²'
      } else if (level <= 46) {
         roles = 'Staff Grade 3 ﹀³'
      } else if (level <= 48) {
         roles = 'Staff Grade 4 ﹀⁴'
      } else if (level <= 50) {
         roles = 'Staff Grade 5 ﹀⁵'
      } else if (level <= 52) {
         roles = 'Sergeant Grade 1 ︾¹'
      } else if (level <= 54) {
         roles = 'Sergeant Grade 2 ︾²'
      } else if (level <= 56) {
         roles = 'Sergeant Grade 3 ︾³'
      } else if (level <= 58) {
         roles = 'Sergeant Grade 4 ︾⁴'
      } else if (level <= 60) {
         roles = 'Sergeant Grade 5 ︾⁵'
      } else if (level <= 62) {
         roles = '2nd Lt. Grade 1 ♢¹ '
      } else if (level <= 64) {
         roles = '2nd Lt. Grade 2 ♢²'
      } else if (level <= 66) {
         roles = '2nd Lt. Grade 3 ♢³'
      } else if (level <= 68) {
         roles = '2nd Lt. Grade 4 ♢⁴'
      } else if (level <= 70) {
         roles = '2nd Lt. Grade 5 ♢⁵'
      } else if (level <= 72) {
         roles = '1st Lt. Grade 1 ♢♢¹'
      } else if (level <= 74) {
         roles = '1st Lt. Grade 2 ♢♢²'
      } else if (level <= 76) {
         roles = '1st Lt. Grade 3 ♢♢³'
      } else if (level <= 78) {
         roles = '1st Lt. Grade 4 ♢♢⁴'
      } else if (level <= 80) {
         roles = '1st Lt. Grade 5 ♢♢⁵'
      } else if (level <= 82) {
         roles = 'Major Grade 1 ✷¹'
      } else if (level <= 84) {
         roles = 'Major Grade 2 ✷²'
      } else if (level <= 86) {
         roles = 'Major Grade 3 ✷³'
      } else if (level <= 88) {
         roles = 'Major Grade 4 ✷⁴'
      } else if (level <= 90) {
         roles = 'Major Grade 5 ✷⁵'
      } else if (level <= 92) {
         roles = 'Colonel Grade 1 ✷✷¹'
      } else if (level <= 94) {
         roles = 'Colonel Grade 2 ✷✷²'
      } else if (level <= 96) {
         roles = 'Colonel Grade 3 ✷✷³'
      } else if (level <= 98) {
         roles = 'Colonel Grade 4 ✷✷⁴'
      } else if (level <= 100) {
         roles = 'Colonel Grade 5 ✷✷⁵'
      } else if (level <= 102) {
         roles = 'Brigadier Early ✰'
      } else if (level <= 104) {
         roles = 'Brigadier Silver ✩'
      } else if (level <= 106) {
         roles = 'Brigadier gold ✯'
      } else if (level <= 108) {
         roles = 'Brigadier Platinum ✬'
      } else if (level <= 110) {
         roles = 'Brigadier Diamond ✪'
      } else if (level <= 112) {
         roles = 'Major General Early ✰'
      } else if (level <= 114) {
         roles = 'Major General Silver ✩'
      } else if (level <= 116) {
         roles = 'Major General gold ✯'
      } else if (level <= 118) {
         roles = 'Major General Platinum ✬'
      } else if (level <= 120) {
         roles = 'Major General Diamond ✪'
      } else if (level <= 122) {
         roles = 'Lt. General Early ✰'
      } else if (level <= 124) {
         roles = 'Lt. General Silver ✩'
      } else if (level <= 126) {
         roles = 'Lt. General gold ✯'
      } else if (level <= 128) {
         roles = 'Lt. General Platinum ✬'
      } else if (level <= 130) {
         roles = 'Lt. General Diamond ✪'
      } else if (level <= 132) {
         roles = 'General Early ✰'
      } else if (level <= 134) {
         roles = 'General Silver ✩'
      } else if (level <= 136) {
         roles = 'General gold ✯'
      } else if (level <= 138) {
         roles = 'General Platinum ✬'
      } else if (level <= 140) {
         roles = 'General Diamond ✪'
      } else if (level <= 142) {
         roles = 'Commander Early ★'
      } else if (level <= 144) {
         roles = 'Commander Intermediate ⍣'
      } else if (level <= 146) {
         roles = 'Commander Elite ≛'
      } else if (level <= 148) {
         roles = 'The Commander Hero ⍟'
      } else if (level <= 152) {
         roles = 'Legends 忍'
      } else if (level <= 154) {
         roles = 'Legends 忍'
      } else if (level <= 156) {
         roles = 'Legends 忍'
      } else if (level <= 158) {
         roles = 'Legends 忍'
      } else if (level <= 160) {
         roles = 'Legends 忍'
      } else if (level <= 162) {
         roles = 'Legends 忍'
      } else if (level <= 164) {
         roles = 'Legends 忍'
      } else if (level <= 166) {
         roles = 'Legends 忍'
      } else if (level <= 168) {
         roles = 'Legends 忍'
      } else if (level <= 170) {
         roles = 'Legends 忍'
      } else if (level <= 172) {
         roles = 'Legends 忍'
      } else if (level <= 174) {
         roles = 'Legends 忍'
      } else if (level <= 176) {
         roles = 'Legends 忍'
      } else if (level <= 178) {
         roles = 'Legends 忍'
      } else if (level <= 180) {
         roles = 'Legends 忍'
      } else if (level <= 182) {
         roles = 'Legends 忍'
      } else if (level <= 184) {
         roles = 'Legends 忍'
      } else if (level <= 186) {
         roles = 'Legends 忍'
      } else if (level <= 188) {
         roles = 'Legends 忍'
      } else if (level <= 190) {
         roles = 'Legends 忍'
      } else if (level <= 192) {
         roles = 'Legends 忍'
      } else if (level <= 194) {
         roles = 'Legends 忍'
      } else if (level <= 196) {
         roles = 'Legends 忍'
      } else if (level <= 198) {
         roles = 'Legends 忍'
      } else if (level <= 200) {
         roles = 'Legends 忍'
      } else if (level <= 210) {
         roles = 'Legends 忍'
      } else if (level <= 220) {
         roles = 'Legends 忍'
      } else if (level <= 230) {
         roles = 'Legends 忍'
      } else if (level <= 240) {
         roles = 'Legends 忍'
      } else if (level <= 250) {
         roles = 'Legends 忍'
      } else if (level <= 260) {
         roles = 'Legends 忍'
      } else if (level <= 270) {
         roles = 'Legends 忍'
      } else if (level <= 280) {
         roles = 'Legends 忍'
      } else if (level <= 290) {
         roles = 'Legends 忍'
      } else if (level <= 300) {
         roles = 'Legends 忍'
      } else if (level <= 310) {
         roles = 'Legends 忍'
      } else if (level <= 320) {
         roles = 'Legends 忍'
      } else if (level <= 330) {
         roles = 'Legends 忍'
      } else if (level <= 340) {
         roles = 'Legends 忍'
      } else if (level <= 350) {
         roles = 'Legends 忍'
      } else if (level <= 360) {
         roles = 'Legends 忍'
      } else if (level <= 370) {
         roles = 'Legends 忍'
      } else if (level <= 380) {
         roles = 'Legends 忍'
      } else if (level <= 390) {
         roles = 'Legends 忍'
      } else if (level <= 400) {
         roles = 'Legends 忍'
      } else if (level <= 410) {
         roles = 'Legends 忍'
      } else if (level <= 420) {
         roles = 'Legends 忍'
      } else if (level <= 430) {
         roles = 'Legends 忍'
      } else if (level <= 440) {
         roles = 'Legends 忍'
      } else if (level <= 450) {
         roles = 'Legends 忍'
      } else if (level <= 460) {
         roles = 'Legends 忍'
      } else if (level <= 470) {
         roles = 'Legends 忍'
      } else if (level <= 480) {
         roles = 'Legends 忍'
      } else if (level <= 490) {
         roles = 'Legends 忍'
      } else if (level <= 500) {
         roles = 'Legends 忍'
      } else if (level <= 600) {
         roles = 'Legends 忍'
      } else if (level <= 700) {
         roles = 'Legends 忍'
      } else if (level <= 800) {
         roles = 'Legends 忍'
      } else if (level <= 900) {
         roles = 'Legends 忍'
      } else if (level <= 1000) {
         roles = 'Legends 忍'
      } else if (level <= 2000) {
         roles = 'Legends 忍'
      } else if (level <= 3000) {
         roles = 'Legends 忍'
      } else if (level <= 4000) {
         roles = 'Legends 忍'
      } else if (level <= 5000) {
         roles = 'Legends 忍'
      } else if (level <= 6000) {
         roles = 'Legends 忍'
      } else if (level <= 7000) {
         roles = 'Legends 忍'
      } else if (level <= 8000) {
         roles = 'Legends 忍'
      } else if (level <= 9000) {
         roles = 'Legends 忍'
      } else if (level <= 10000) {
         roles = 'Legends 忍'
      }
      return roles
   }

   filter = (text: string): string => {
      if (text.length > 10) {
         return text.substr(text.length - 5)
      } else if (text.length > 7) {
         return text.substr(text.length - 4)
      } else if (text.length > 5) {
         return text.substr(text.length - 3)
      } else if (text.length > 2) {
         return text.substr(text.length - 2)
      } else if (text.length > 1) {
         return text.substr(text.length - 1)
      }
      return text
   }

   randomString = (len: number, charSet?: string): string => {
      charSet = charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/+=*-%$();?!#@'
      var randomString = ''
      for (var i = 0; i < len; i++) {
         var randomPoz = Math.floor(Math.random() * charSet.length)
         randomString += charSet.substring(randomPoz, randomPoz + 1)
      }
      return randomString
   }

   removeEmojis = (string: string): string => {
      var regex = /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/g
      return string.replace(regex, '')
   }

   detectStyledAlphabet = (str: string): string[] => {
      const styledAlphabetRegex = /[\u1D00-\u1D7F\uA730-\uA7FF]/g
      const matches = str.match(styledAlphabetRegex)
      if (matches) {
         return matches
      }
      return []
   }

   Styles = (text: string, style: number = 1): string => {
      var xStr = 'abcdefghijklmnopqrstuvwxyz1234567890'.split('')
      var yStr = Object.freeze({
         1: 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘqʀꜱᴛᴜᴠᴡxʏᴢ1234567890'
      })
      var replacer: { original: string, convert: string }[] = []
      xStr.map((v, i) => replacer.push({
         original: v,
         convert: yStr[style].split('')[i]
      }))
      var str = text.toLowerCase().split('')
      var output: string[] = []
      str.map(v => {
         const find = replacer.find(x => x.original == v)
         find ? output.push(find.convert) : output.push(v)
      })
      return output.join('')
   }

   logFile = (log: string, filename: string = 'bot'): void => {
      const log_file = fs.createWriteStream(path.join(process.cwd(), `${filename}.log`), {
         flags: 'a'
      })
      const time = moment(Date.now() * 1).format('DD/MM/YY HH:mm:ss')
      log_file.write(`[${time}] - ${log}\n`)
   }

   getEmoji = (str: string): string[] | null => {
      const regex = /[#*0-9]\uFE0F?\u20E3|[\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23ED-\u23EF\u23F1\u23F2\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB\u25FC\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692\u2694-\u2697\u2699\u269B\u269C\u26A0\u26A7\u26AA\u26B0\u26B1\u26BD\u26BE\u26C4\u26C8\u26CF\u26D1\u26E9\u26F0-\u26F5\u26F7\u26F8\u26FA\u2702\u2708\u2709\u270F\u2712\u2714\u2716\u271D\u2721\u2733\u2734\u2744\u2747\u2757\u2763\u27A1\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B55\u3030\u303D\u3297\u3299]\uFE0F?|[\u261D\u270C\u270D](?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?|[\u270A\u270B](?:\uD83C[\uDFFB-\uDFFF])?|[\u23E9-\u23EC\u23F0\u23F3\u25FD\u2693\u26A1\u26AB\u26C5\u26CE\u26D4\u26EA\u26FD\u2705\u2728\u274C\u274E\u2753-\u2755\u2795-\u2797\u27B0\u27BF\u2B50]|\u26D3\uFE0F?(?:\u200D\uD83D\uDCA5)?|\u26F9(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|\u2764\uFE0F?(?:\u200D(?:\uD83D\uDD25|\uD83E\uDE79))?|\uD83C(?:[\uDC04\uDD70\uDD71\uDD7E\uDD7F\uDE02\uDE37\uDF21\uDF24-\uDF2C\uDF36\uDF7D\uDF96\uDF97\uDF99-\uDF9B\uDF9E\uDF9F\uDFCD\uDFCE\uDFD4-\uDFDF\uDFF5\uDFF7]\uFE0F?|[\uDF85\uDFC2\uDFC7](?:\uD83C[\uDFFB-\uDFFF])?|[\uDFC4\uDFCA](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDFCB\uDFCC](?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDCCF\uDD8E\uDD91-\uDD9A\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF43\uDF45-\uDF4A\uDF4C-\uDF7C\uDF7E-\uDF84\uDF86-\uDF93\uDFA0-\uDFC1\uDFC5\uDFC6\uDFC8\uDFC9\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF8-\uDFFF]|\uDDE6\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF]|\uDDE7\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF]|\uDDE8\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF]|\uDDE9\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF]|\uDDEA\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA]|\uDDEB\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7]|\uDDEC\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE]|\uDDED\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA]|\uDDEE\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9]|\uDDEF\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5]|\uDDF0\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF]|\uDDF1\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE]|\uDDF2\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF]|\uDDF3\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF]|\uDDF4\uD83C\uDDF2|\uDDF5\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE]|\uDDF6\uD83C\uDDE6|\uDDF7\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC]|\uDDF8\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF]|\uDDF9\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF]|\uDDFA\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF]|\uDDFB\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA]|\uDDFC\uD83C[\uDDEB\uDDF8]|\uDDFD\uD83C\uDDF0|\uDDFE\uD83C[\uDDEA\uDDF9]|\uDDFF\uD83C[\uDDE6\uDDF2\uDDFC]|\uDF44(?:\u200D\uD83D\uDFEB)?|\uDF4B(?:\u200D\uD83D\uDFE9)?|\uDFC3(?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D(?:[\u2640\u2642]\uFE0F?(?:\u200D\u27A1\uFE0F?)?|\u27A1\uFE0F?))?|\uDFF3\uFE0F?(?:\u200D(?:\u26A7\uFE0F?|\uD83C\uDF08))?|\uDFF4(?:\u200D\u2620\uFE0F?|\uDB40\uDC67\uDB40\uDC62\uDB40(?:\uDC65\uDB40\uDC6E\uDB40\uDC67|\uDC73\uDB40\uDC63\uDB40\uDC74|\uDC77\uDB40\uDC6C\uDB40\uDC73)\uDB40\uDC7F)?)|\uD83D(?:[\uDC3F\uDCFD\uDD49\uDD4A\uDD6F\uDD70\uDD73\uDD76-\uDD79\uDD87\uDD8A-\uDD8D\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA\uDECB\uDECD-\uDECF\uDEE0-\uDEE5\uDEE9\uDEF0\uDEF3]\uFE0F?|[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDC8F\uDC91\uDCAA\uDD7A\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC](?:\uD83C[\uDFFB-\uDFFF])?|[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4\uDEB5](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDD74\uDD90](?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?|[\uDC00-\uDC07\uDC09-\uDC14\uDC16-\uDC25\uDC27-\uDC3A\uDC3C-\uDC3E\uDC40\uDC44\uDC45\uDC51-\uDC65\uDC6A\uDC79-\uDC7B\uDC7D-\uDC80\uDC84\uDC88-\uDC8E\uDC90\uDC92-\uDCA9\uDCAB-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDDA4\uDDFB-\uDE2D\uDE2F-\uDE34\uDE37-\uDE41\uDE43\uDE44\uDE48-\uDE4A\uDE80-\uDEA2\uDEA4-\uDEB3\uDEB7-\uDEBF\uDEC1-\uDEC5\uDED0-\uDED2\uDED5-\uDED7\uDEDC-\uDEDF\uDEEB\uDEEC\uDEF4-\uDEFC\uDFE0-\uDFEB\uDFF0]|\uDC08(?:\u200D\u2B1B)?|\uDC15(?:\u200D\uD83E\uDDBA)?|\uDC26(?:\u200D(?:\u2B1B|\uD83D\uDD25))?|\uDC3B(?:\u200D\u2744\uFE0F?)?|\uDC41\uFE0F?(?:\u200D\uD83D\uDDE8\uFE0F?)?|\uDC68(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDC68\uDC69]\u200D\uD83D(?:\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?)|[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?)|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]))|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFC-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB\uDFFD-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB-\uDFFD\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB-\uDFFE])))?))?|\uDC69(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?[\uDC68\uDC69]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?|\uDC69\u200D\uD83D(?:\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?))|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]))|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFC-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB\uDFFD-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB-\uDFFD\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB-\uDFFE])))?))?|\uDC6F(?:\u200D[\u2640\u2642]\uFE0F?)?|\uDD75(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|\uDE2E(?:\u200D\uD83D\uDCA8)?|\uDE35(?:\u200D\uD83D\uDCAB)?|\uDE36(?:\u200D\uD83C\uDF2B\uFE0F?)?|\uDE42(?:\u200D[\u2194\u2195]\uFE0F?)?|\uDEB6(?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D(?:[\u2640\u2642]\uFE0F?(?:\u200D\u27A1\uFE0F?)?|\u27A1\uFE0F?))?)|\uD83E(?:[\uDD0C\uDD0F\uDD18-\uDD1F\uDD30-\uDD34\uDD36\uDD77\uDDB5\uDDB6\uDDBB\uDDD2\uDDD3\uDDD5\uDEC3-\uDEC5\uDEF0\uDEF2-\uDEF8](?:\uD83C[\uDFFB-\uDFFF])?|[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD\uDDCF\uDDD4\uDDD6-\uDDDD](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDDDE\uDDDF](?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDD0D\uDD0E\uDD10-\uDD17\uDD20-\uDD25\uDD27-\uDD2F\uDD3A\uDD3F-\uDD45\uDD47-\uDD76\uDD78-\uDDB4\uDDB7\uDDBA\uDDBC-\uDDCC\uDDD0\uDDE0-\uDDFF\uDE70-\uDE7C\uDE80-\uDE88\uDE90-\uDEBD\uDEBF-\uDEC2\uDECE-\uDEDB\uDEE0-\uDEE8]|\uDD3C(?:\u200D[\u2640\u2642]\uFE0F?|\uD83C[\uDFFB-\uDFFF])?|\uDDCE(?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D(?:[\u2640\u2642]\uFE0F?(?:\u200D\u27A1\uFE0F?)?|\u27A1\uFE0F?))?|\uDDD1(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1|\uDDD1\u200D\uD83E\uDDD2(?:\u200D\uD83E\uDDD2)?|\uDDD2(?:\u200D\uD83E\uDDD2)?))|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFC-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB\uDFFD-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB-\uDFFD\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB-\uDFFE]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?))?|\uDEF1(?:\uD83C(?:\uDFFB(?:\u200D\uD83E\uDEF2\uD83C[\uDFFC-\uDFFF])?|\uDFFC(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB\uDFFD-\uDFFF])?|\uDFFD(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])?|\uDFFE(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB-\uDFFD\uDFFF])?|\uDFFF(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB-\uDFFE])?))?)/g
      return str.match(regex)
   }

   isEmojiPrefix = (str: string): boolean => {
      const regex = /^(?:[#*0-9]\uFE0F?\u20E3|[\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23ED-\u23EF\u23F1\u23F2\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB\u25FC\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692\u2694-\u2697\u2699\u269B\u269C\u26A0\u26A7\u26AA\u26B0\u26B1\u26BD\u26BE\u26C4\u26C8\u26CF\u26D1\u26E9\u26F0-\u26F5\u26F7\u26F8\u26FA\u2702\u2708\u2709\u270F\u2712\u2714\u2716\u271D\u2721\u2733\u2734\u2744\u2747\u2757\u2763\u27A1\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B55\u3030\u303D\u3297\u3299]\uFE0F?|[\u261D\u270C\u270D](?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?|[\u270A\u270B](?:\uD83C[\uDFFB-\uDFFF])?|[\u23E9-\u23EC\u23F0\u23F3\u25FD\u2693\u26A1\u26AB\u26C5\u26CE\u26D4\u26EA\u26FD\u2705\u2728\u274C\u274E\u2753-\u2755\u2795-\u2797\u27B0\u27BF\u2B50]|\u26D3\uFE0F?(?:\u200D\uD83D\uDCA5)?|\u26F9(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|\u2764\uFE0F?(?:\u200D(?:\uD83D\uDD25|\uD83E\uDE79))?|\uD83C(?:[\uDC04\uDD70\uDD71\uDD7E\uDD7F\uDE02\uDE37\uDF21\uDF24-\uDF2C\uDF36\uDF7D\uDF96\uDF97\uDF99-\uDF9B\uDF9E\uDF9F\uDFCD\uDFCE\uDFD4-\uDFDF\uDFF5\uDFF7]\uFE0F?|[\uDF85\uDFC2\uDFC7](?:\uD83C[\uDFFB-\uDFFF])?|[\uDFC4\uDFCA](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDFCB\uDFCC](?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDCCF\uDD8E\uDD91-\uDD9A\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF43\uDF45-\uDF4A\uDF4C-\uDF7C\uDF7E-\uDF84\uDF86-\uDF93\uDFA0-\uDFC1\uDFC5\uDFC6\uDFC8\uDFC9\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF8-\uDFFF]|\uDDE6\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF]|\uDDE7\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF]|\uDDE8\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF]|\uDDE9\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF]|\uDDEA\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA]|\uDDEB\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7]|\uDDEC\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE]|\uDDED\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA]|\uDDEE\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9]|\uDDEF\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5]|\uDDF0\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF]|\uDDF1\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE]|\uDDF2\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF]|\uDDF3\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF]|\uDDF4\uD83C\uDDF2|\uDDF5\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE]|\uDDF6\uD83C\uDDE6|\uDDF7\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC]|\uDDF8\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF]|\uDDF9\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF]|\uDDFA\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF]|\uDDFB\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA]|\uDDFC\uD83C[\uDDEB\uDDF8]|\uDDFD\uD83C\uDDF0|\uDDFE\uD83C[\uDDEA\uDDF9]|\uDDFF\uD83C[\uDDE6\uDDF2\uDDFC]|\uDF44(?:\u200D\uD83D\uDFEB)?|\uDF4B(?:\u200D\uD83D\uDFE9)?|\uDFC3(?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D(?:[\u2640\u2642]\uFE0F?(?:\u200D\u27A1\uFE0F?)?|\u27A1\uFE0F?))?|\uDFF3\uFE0F?(?:\u200D(?:\u26A7\uFE0F?|\uD83C\uDF08))?|\uDFF4(?:\u200D\u2620\uFE0F?|\uDB40\uDC67\uDB40\uDC62\uDB40(?:\uDC65\uDB40\uDC6E\uDB40\uDC67|\uDC73\uDB40\uDC63\uDB40\uDC74|\uDC77\uDB40\uDC6C\uDB40\uDC73)\uDB40\uDC7F)?)|\uD83D(?:[\uDC3F\uDCFD\uDD49\uDD4A\uDD6F\uDD70\uDD73\uDD76-\uDD79\uDD87\uDD8A-\uDD8D\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA\uDECB\uDECD-\uDECF\uDEE0-\uDEE5\uDEE9\uDEF0\uDEF3]\uFE0F?|[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDC8F\uDC91\uDCAA\uDD7A\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC](?:\uD83C[\uDFFB-\uDFFF])?|[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4\uDEB5](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDD74\uDD90](?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?|[\uDC00-\uDC07\uDC09-\uDC14\uDC16-\uDC25\uDC27-\uDC3A\uDC3C-\uDC3E\uDC40\uDC44\uDC45\uDC51-\uDC65\uDC6A\uDC79-\uDC7B\uDC7D-\uDC80\uDC84\uDC88-\uDC8E\uDC90\uDC92-\uDCA9\uDCAB-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDDA4\uDDFB-\uDE2D\uDE2F-\uDE34\uDE37-\uDE41\uDE43\uDE44\uDE48-\uDE4A\uDE80-\uDEA2\uDEA4-\uDEB3\uDEB7-\uDEBF\uDEC1-\uDEC5\uDED0-\uDED2\uDED5-\uDED7\uDEDC-\uDEDF\uDEEB\uDEEC\uDEF4-\uDEFC\uDFE0-\uDFEB\uDFF0]|\uDC08(?:\u200D\u2B1B)?|\uDC15(?:\u200D\uD83E\uDDBA)?|\uDC26(?:\u200D(?:\u2B1B|\uD83D\uDD25))?|\uDC3B(?:\u200D\u2744\uFE0F?)?|\uDC41\uFE0F?(?:\u200D\uD83D\uDDE8\uFE0F?)?|\uDC68(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDC68\uDC69]\u200D\uD83D(?:\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?)|[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?)|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]))|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFC-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB\uDFFD-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB-\uDFFD\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB-\uDFFE])))?))?|\uDC69(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?[\uDC68\uDC69]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?|\uDC69\u200D\uD83D(?:\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?))|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]))|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFC-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB\uDFFD-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB-\uDFFD\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB-\uDFFE])))?))?|\uDC6F(?:\u200D[\u2640\u2642]\uFE0F?)?|\uDD75(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|\uDE2E(?:\u200D\uD83D\uDCA8)?|\uDE35(?:\u200D\uD83D\uDCAB)?|\uDE36(?:\u200D\uD83C\uDF2B\uFE0F?)?|\uDE42(?:\u200D[\u2194\u2195]\uFE0F?)?|\uDEB6(?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D(?:[\u2640\u2642]\uFE0F?(?:\u200D\u27A1\uFE0F?)?|\u27A1\uFE0F?))?)|\uD83E(?:[\uDD0C\uDD0F\uDD18-\uDD1F\uDD30-\uDD34\uDD36\uDD77\uDDB5\uDDB6\uDDBB\uDDD2\uDDD3\uDDD5\uDEC3-\uDEC5\uDEF0\uDEF2-\uDEF8](?:\uD83C[\uDFFB-\uDFFF])?|[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD\uDDCF\uDDD4\uDDD6-\uDDDD](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDDDE\uDDDF](?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDD0D\uDD0E\uDD10-\uDD17\uDD20-\uDD25\uDD27-\uDD2F\uDD3A\uDD3F-\uDD45\uDD47-\uDD76\uDD78-\uDDB4\uDDB7\uDDBA\uDDBC-\uDDCC\uDDD0\uDDE0-\uDDFF\uDE70-\uDE7C\uDE80-\uDE88\uDE90-\uDEBD\uDEBF-\uDEC2\uDECE-\uDEDB\uDEE0-\uDEE8]|\uDD3C(?:\u200D[\u2640\u2642]\uFE0F?|\uD83C[\uDFFB-\uDFFF])?|\uDDCE(?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D(?:[\u2640\u2642]\uFE0F?(?:\u200D\u27A1\uFE0F?)?|\u27A1\uFE0F?))?|\uDDD1(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1|\uDDD1\u200D\uD83E\uDDD2(?:\u200D\uD83E\uDDD2)?|\uDDD2(?:\u200D\uD83E\uDDD2)?))|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFC-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB\uDFFD-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB-\uDFFD\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB-\uDFFE]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?))?|\uDEF1(?:\uD83C(?:\uDFFB(?:\u200D\uD83E\uDEF2\uD83C[\uDFFC-\uDFFF])?|\uDFFC(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB\uDFFD-\uDFFF])?|\uDFFD(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])?|\uDFFE(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB-\uDFFD\uDFFF])?|\uDFFF(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB-\uDFFE])?))?))\w+/;
      return regex.test(str)
   }

   getDevice = (id: string): string => id.length > 21 ? 'Android' : id.substring(0, 2) === '3A' ? 'IOS' : 'WhatsApp Web'
}

export default new Function