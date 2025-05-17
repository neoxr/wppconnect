const { exec } = require('child_process')
const syntax = require('syntax-error')

const jsonFormat = (obj) => {
   try {
      let print = (obj && (obj.constructor.name == 'Object' || obj.constructor.name == 'Array')) ? require('util').format(JSON.stringify(obj, null, 2)) : require('util').format(obj)
      return print
   } catch {
      return require('util').format(obj)
   }
}

const texted = (type, text) => {
   switch (type) {
      case 'bold':
         return '*' + text + '*'
         break
      case 'italic':
         return '_' + text + '_'
         break
      case 'monospace':
         return '```' + text + '```'
   }
}

module.exports = async (client, m) => {
   const body = m.body
   if (typeof body === 'object') return
   let command, text
   let x = body && body.trim().split`\n`,
      y = ''
   command = x[0] ? x[0].split` `[0] : ''
   y += x[0] ? x[0].split` `.slice`1`.join` ` : '', y += x ? x.slice`1`.join`\n` : ''
   text = y.trim()
   if (!text) return

   console.log({ command, text })
   if (command === '=>') {
      try {
         var evL = await eval(`(async () => { return ${text} })()`)
         client.sendText(m.from, jsonFormat(evL), {
            quotedMsg: m.id
         })
      } catch (e) {
         let err = await syntax(text)
         client.sendText(m.from, typeof err != 'undefined' ? texted('monospace', err) + '\n\n' : '' + require('util').format(e), {
            quotedMsg: m.id
         })
      }
   } else if (command === '>') {
      try {
         var evL = await eval(`(async () => { ${text} })()`)
         client.sendText(m.from, jsonFormat(evL), {
            quotedMsg: m.id
         })
      } catch (e) {
         let err = await syntax(text)
         client.sendText(m.from, typeof err != 'undefined' ? texted('monospace', err) + '\n\n' : '' + require('util').format(e), {
            quotedMsg: m.id
         })
      }
   } else if (command == '$') {
      exec(text.trim(), (err, stdout) => {
         if (err) return client.sendText(m.from, err.toString(), {
            quotedMsg: m.id
         })
         if (stdout) return client.sendText(m.from, stdout.toString(), {
            quotedMsg: m.id
         })
      })
   }
}