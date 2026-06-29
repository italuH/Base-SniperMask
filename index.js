//IMPORTS MODULOS
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } from "baileys"
import express from "express"
import pino from "pino"
import fs from "fs"
import path from "path"
import chalk from "chalk"
import qrcode from "qrcode-terminal"
import qrWeb from "qrcode"
import * as Boom from '@hapi/boom'
import moment from "moment-timezone"
import chokidar from 'chokidar'
import { pathToFileURL } from 'url'

import { mask as bot } from "./bot.js"
let handler

//CARREGAR HANDLER
async function loadHandler() {
    const fileUrl = pathToFileURL('./bot.js').href
    const module = await import(`${fileUrl}?update=${Date.now()}`)
    handler = module.mask
    console.log('✅ Handler carregado')
}

//INICIAR SERVIDOR EXPRESS
const app = express()
app.use(express.json())

let mask
let isConnected = false
let currentQR = null
let isReconnecting = false

//VERIFICAR SE O QR CODE FOI SALVO
function isQrSaved() {
    const authPath = path.resolve("./auth_info")
    const credsPath = path.join(authPath, "creds.json")
    return fs.existsSync(authPath) && fs.existsSync(credsPath)
}

//INICIAR BOT
export async function startBot() {
    if (isReconnecting) return
    isReconnecting = true

    console.log("🚀 Iniciando bot WhatsApp...")

    //CARREGAR ESTADO DE AUTENTICAÇÃO
    const { state, saveCreds } = await useMultiFileAuthState("./auth_info")
    const { version } = await fetchLatestBaileysVersion()

    //CARREGAR HANDLER
    await loadHandler()

    //CRIAR SOCKET
    mask = makeWASocket({
        auth: state,
        browser: ["Sniper", "Mask", "0.0.1"],
        version,
        logger: pino({ level: "silent" }),
        keepAliveIntervalMs: 45_000
    })

    //SALVAR CREDENCIAIS
    mask.ev.on("creds.update", saveCreds)

    //EVENTO DE MAPEAMENTO DE LID
    mask.ev.on('lid-mapping.update', ({ mappings }) => {
        for (const m of mappings) {
            mask.authState.lidMapping.storeLIDPNMapping(m.lid, m.pn)
        }
    })

    //EVENTOS DE CONEXÃO
    mask.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr, isOnline } = update
        if (isOnline) return
        //GERAR QR CODE
        if (qr && !isQrSaved()) {
            currentQR = qr
            console.log("📱 Novo QR gerado (acesse /qr para visualizar via web)")
            qrcode.generate(qr, { small: true })
        }
        if (connection === "open") {
            isConnected = true
            currentQR = null
            isReconnecting = false
            console.log("✅ Conectado ao WhatsApp!")
        }
        else if (connection === "close") {
            isConnected = false
            const reason = lastDisconnect?.error ? Boom.boomify(lastDisconnect.error).output.statusCode : 'desconhecida'
            console.log(chalk.redBright(`Desconexão: ${reason}|${connection}`))
            if (reason === 401) {
                console.log(chalk.redBright("❌ Código 401: sessão expirada. Finalizando processo."))
                process.exit(1)
            }
            else if (!isReconnecting) {
                console.log(chalk.yellowBright("🔄 Tentando reconectar em 5 segundos..."))
                setTimeout(async () => {
                    isReconnecting = false
                    try {
                        await startBot()
                        console.log(chalk.greenBright("🔌 Reconexão iniciada!"))
                    } catch (err) {
                        console.error('❌ Erro ao reconectar:', err.message || err)
                    }
                }, 5000)
            }
        }
        console.log(chalk.magenta('Conectando...'))
    })

    //PROCESSAR MENSAGENS
    mask.ev.on('messages.upsert', async (mop) => {
        if (!handler) return

        try {
            await handler(mask, mop)
        } catch (err) {
            if (err?.message?.includes('Bad MAC')) {
                console.warn('⚠️ Sessão corrompida detectada. Limpando cache da chave...')

                const { state } = await useMultiFileAuthState('./auth_info')
                mask.authState = makeCacheableSignalKeyStore(
                    state.keys,
                    pino({ level: 'silent' })
                )

                return
            }

            console.error('❌ Erro ao processar mensagem:', err)
        }
    })
    isReconnecting = false
}

//VISUALIZAR QR CODE VIA WEB
app.get("/qr", async (req, res) => {
    if (isConnected) return res.send("<h2>✅ Já conectado ao WhatsApp!</h2>")
    if (!currentQR) return res.send("<h2>⏳ Nenhum QR disponível no momento...</h2>")
    const qrImage = await qrWeb.toDataURL(currentQR)
    res.send(`
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
      <h2>📱 Escaneie o QR Code para conectar o bot</h2>
      <img src="${qrImage}" alt="QR Code do WhatsApp" style="width:300px;height:300px;"/>
      <p>Atualize esta página se o QR expirar.</p>
    </div>
  `)
})

//ATUALIZAR AO SALVAR O ARQUIVO bot.js
chokidar.watch('./bot.js').on('change', async () => {
    console.log('🔄 Atualizando bot.js...')

    try {
        await loadHandler()
    } catch (err) {
        console.log('❌ Erro ao recarregar:', err)
    }
})