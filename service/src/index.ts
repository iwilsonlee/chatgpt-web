import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import type { RequestProps } from './types'
import type { ChatMessage } from './chatgpt'
import { chatConfig, chatReplyProcess, currentModel } from './chatgpt'
import { authMiddleware } from './middleware/auth'
import { isNotEmptyString } from './utils/is'
import { limiter } from './middleware/limiter'
import { AuthService } from './services/auth-service'

dotenv.config()

const app = express()
const router = express.Router()

app.use(express.static('public'))
app.use(cors({
  origin: '*',
}))
app.use(express.json())

app.all('*', (_, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'authorization, Content-Type')
  res.header('Access-Control-Allow-Methods', '*')
  next()
})

router.post('/chat-process', [authMiddleware, limiter], async (req, res) => {
  res.setHeader('Content-type', 'application/octet-stream')

  try {
    const { prompt, options = {}, systemMessage, temperature, top_p } = req.body as RequestProps
    let firstChunk = true
    await chatReplyProcess({
      message: prompt,
      lastContext: options,
      process: (chat: ChatMessage) => {
        res.write(firstChunk ? JSON.stringify(chat) : `\n${JSON.stringify(chat)}`)
        firstChunk = false
      },
      systemMessage,
      temperature,
      top_p,
    })
  }
  catch (error) {
    res.write(JSON.stringify(error))
  }
  finally {
    res.end()
  }
})

router.post('/config', authMiddleware, async (req, res) => {
  try {
    const response = await chatConfig()
    res.send(response)
  }
  catch (error) {
    res.send(error)
  }
})

router.post('/session', async (req, res) => {
  try {
    const AUTH_SECRET_KEY = process.env.AUTH_SECRET_KEY
    const hasAuth = isNotEmptyString(AUTH_SECRET_KEY)
    res.send({ status: 'Success', message: '', data: { auth: hasAuth, model: currentModel() } })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body as { token: string }
    if (!token)
      throw new Error('Secret key is empty')

    if (process.env.AUTH_SECRET_KEY !== token)
      throw new Error('密钥无效 | Secret key is invalid')

    res.send({ status: 'Success', message: 'Verify successfully', data: null })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    const a = new AuthService()
    const result = await a.login(username, password)
    if (!result)
      res.status(400).send('用户名或密码错误')
    else
      res.send({ status: 'Success', message: 'login success', data: result })
  }
  catch (e) {
    console.error(e)
    res.status(400).send(e.message)
  }
})

app.use('', router)
// 将路由挂载到应用程序上，前缀为/api
app.use('/api', router)

// 设置代理信任级别为1
app.set('trust proxy', 1)

// app.listen(3002, () => globalThis.console.log('Server is running on port 3002'))
const PORT = process.env.PORT || 3002
app.listen(PORT, () => {
  globalThis.console.log('Server is running on port %d', PORT)
})
