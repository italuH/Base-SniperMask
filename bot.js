
//IMPORTS E MODULOS
import { downloadContentFromMessage, downloadMediaMessage, generateWAMessageFromContent, proto, prepareWAMessageMedia } from "baileys"
import moment from "moment-timezone"
import chalk from "chalk"
import { exec } from "child_process"

//LIB
import { getGroupAdmins  } from './lib/functions.js'
import { emojis } from "./src/var.js";

export async function mask(mask, mop) {
    try {
        const msg = mop.messages[0];
        if (!msg?.message) return;

        let message = msg.message.ephemeralMessage?.message || msg.message;
        if (!message) return;

        const type = Object.keys(message).find(k => !["senderKeyDistributionMessage", "messageContextInfo"].includes(k));

        const bodyMap = {
            conversation: () => message.conversation,
            extendedTextMessage: () => message.extendedTextMessage?.text,
            imageMessage: () => message.imageMessage?.caption || "",
            videoMessage: () => message.videoMessage?.caption || ""
        };

        let body = (bodyMap[type]?.() || "").replace(/[\u200b-\u200f\uFEFF]/g, "").trim();
        const formatWaId = id => id.replace(/:\d*?(?=@)/g, '');

        const prefix = "?";
        const semPrefixo = body.startsWith(prefix) ? body.slice(prefix.length).trim() : "";
        var args = semPrefixo.split(/ +/).slice(1);
        const txt = message.conversation || message.extendedTextMessage?.text || message.imageMessage?.caption || message.videoMessage?.caption || message.documentMessage?.caption || message[type]?.contextInfo?.quotedMessage?.[type]?.caption || "";
        const comando = semPrefixo.split(/ +/)[0].toLowerCase();
        const from = msg.key.remoteJid;
        const grupo = from.endsWith("@g.us");
        const botNumber = formatWaId(mask.user.id.split(":")[0] + "@s.whatsapp.net")
        let sender = grupo ? (msg.key?.participantAlt || msg.key?.participant) : (msg.key?.remoteJidAlt || msg.key?.participant)
        const time = moment.tz('America/Sao_Paulo').format('HH:mm:ss');
        const pushname = msg.key.fromMe ? mask.user.name : msg.pushName || "Nome não detectado";
        let dono = [botNumber, "557499510904@s.whatsapp.net", "185585536860263@lid", "164377391055035@lid"].includes(sender);
        if (msg.key.fromMe === true) {
            dono = true
        }

        let groupMetadata = {}, groupName = "", participants = [], groupAdmins = [], botAdmin = false, admin = dono;

        if (grupo) {
            groupMetadata = await mask.groupMetadata(from).catch(() => ({}));
            participants = groupMetadata.participants || [];
            groupName = groupMetadata.subject || "";
            groupAdmins = getGroupAdmins(participants);
            botAdmin = groupAdmins.includes(botNumber);
            admin = dono || groupAdmins.includes(sender);
        }

        const isMedia = ['imageMessage', 'videoMessage', 'audioMessage'].includes(type);
        const content = JSON.stringify(message);
        const isBaileys = msg.key.id.startsWith("BAE5") && msg.key.id.length === 16;

        //RESPONDER MENSAGEM
        const reply = (texto, membro) => {
            mask.sendMessage(from, { text: texto, mentions: membro || [] }, { quoted: msg });
        };

        //EDITAR MENSAGEM
        async function edit(mask, mensagem, newText) {
            try {
                await mask.sendMessage(from, { text: newText, edit: mensagem.key, }, { quoted: msg });
            } catch (err) {
                console.error('edit error:', err);
            }
        }

        //ENVIAR REAÇÃO
        const rct = (emoji) => {
            mask.sendMessage(from, { react: { text: emoji, key: msg.key } });
        };

        //REAÇÕES ALEATÓRIAS
        if (!comando && txt && Math.random() * 100 <= 5) {
            rct(emojis[Math.floor(Math.random() * emojis.length)]);
        }

        const isReaction = type === 'reactionMessage';
        const isQuotedImage = type === 'extendedTextMessage' && content.includes('imageMessage')
        const isQuotedVideo = type === 'extendedTextMessage' && content.includes('videoMessage')
        const isQuotedMedia = isQuotedVideo || isQuotedImage;

        if (isReaction) return //IGNORA REAÇÕES
        mask.readMessages([msg.key]) //MARCA A MENSAGEM COMO LIDA
        mask.sendPresenceUpdate('available', from) //ATUALIZA O "DIGITANDO..."
        if (isBaileys && comando && sender != botNumber) return; //IGNORA MENSAGENS DE OUTROS BOTS
        //if (msg.key.remoteJid == 'status@broadcast') return; //IGNORA STATUS

        //LOGGER COMANDOS
        const logInfo = [chalk.blueBright('COMANDO RECEBIDO'), chalk.yellow('HORA:'), chalk.yellow(time), chalk.green('DE:'), chalk.green(pushname)];
        if (grupo) logInfo.push(chalk.green('EM:'), chalk.green(groupName));
        if (comando) console.log(...logInfo);

        // RESPOSTAS AUTOMATICAS/RANDOM
        if (!comando && (txt.toLowerCase().includes("miau"))) {
            mask.sendMessage(from, { text: 'Miau!' }, { quoted: msg })
        }

        //COMANDOS ABAIXO
        switch (comando) {

            case "ppt":
                if (args.length < 1) return reply(`Você deve digitar ${prefix}ppt pedra, ${prefix}ppt papel ou ${prefix}ppt tesoura`)
                ppt = ["pedra", "papel", "tesoura"]
                pptb = ppt[Math.floor(Math.random() * ppt.length)]
                if ((pptb == "pedra" && args == "papel") ||
                    (pptb == "papel" && args == "tesoura") ||
                    (pptb == "tesoura" && args == "pedra")) {
                    var vit = "vitoria"
                } else if ((pptb == "pedra" && args == "tesoura") ||
                    (pptb == "papel" && args == "pedra") ||
                    (pptb == "tesoura" && args == "papel")) {
                    var vit = "derrota"
                } else if ((pptb == "pedra" && args == "pedra") ||
                    (pptb == "papel" && args == "papel") ||
                    (pptb == "tesoura" && args == "tesoura")) {
                    var vit = "empate"
                } else if (vit = "undefined") {
                    return reply(`Você deve digitar ${prefix}ppt pedra, ${prefix}ppt papel ou ${prefix}ppt tesoura`)
                }
                if (vit == "vitoria") {
                    var tes = "Vitória do jogador🎉"
                }
                if (vit == "derrota") {
                    var tes = "A vitória é do BOT😎"
                }
                if (vit == "empate") {
                    var tes = "O jogo terminou em empate🛡"
                }
                reply(`BOT jogou: ${pptb}\nO jogador jogou: ${args}\n\n${tes}`)
                break

            //DEBUG - TESTES

            case 'ping': {
                const start = performance.now()
                const sent = await mask.sendMessage(from, { text: 'Calculando ping...' })
                const end = performance.now()
                const ping = (end - start).toFixed(2)
                await edit(mask, sent, `🏓 Pong!\nVelocidade: ${ping}ms`)
                break
            }

            case 'exe':
                if (!dono) return reply("Apenas meu dono pode usar este comando!")
                const cmde = text.slice(4)
                exec(cmde, (err, stdout) => {
                    if (err) return mask.sendMessage(from, { text: `EXEC ${err}` }, { quoted: msg })
                    if (stdout) {
                        mask.sendMessage(from, { text: stdout }, { quoted: msg })
                    }
                })
                break

            case 'run': case 'return': {
                if (!dono) return reply("Apenas meu dono pode usar este comando!")
                try {
                    eval(txt || msg.message.extendedTextMessage.contextInfo.quotedMessage.conversation)
                } catch (err) {
                    const s = String(err)
                    reply(s)
                }
            }
                break

            case 'msg':
                if (!dono) return reply("Apenas meu dono pode usar este comando!")
                mask.sendMessage(from, { text: JSON.stringify(mop, null, 2) }, { quoted: msg }); console.log(JSON.stringify(mop, null, 2))
                break

            default:

                if (comando) reply(`Comando *${comando}* não encontrado!`)
                break
        }

    } catch (err) {
        console.log(err)
    }

}