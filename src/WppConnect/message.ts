export default class Message {
   createMessageFunction = (ev: any) => {
      ev.reply = async (jid: string, text: string, quoted: any, options: any = {}) => {
         await ev.startTyping(jid)
         return await ev.sendText(jid, text, {
            quotedMsg: quoted?.id || null,
            ...options
         })
      }
   }
}