/* eslint-disable no-console */
import * as dotenv from 'dotenv'
import 'isomorphic-fetch'
import { SocksProxyAgent } from 'socks-proxy-agent'
import httpsProxyAgent from 'https-proxy-agent'
import fetch from 'node-fetch'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { OpenAI } from 'langchain/llms/openai'
import { TaogeMemory, TaogeQA } from '../taoge/taoge-qa'
import type { ChatGPTAPIOptions, ChatMessage, SendMessageOptions, SendMessageOptionsByLangchain } from '../taoge'
import { ChatGPTAPI } from '../taoge'
import { sendResponse } from '../utils'
import { isNotEmptyString } from '../utils/is'
import type { ApiModel, ChatContext, ModelConfig } from '../types'
import { VectorFaissService } from '../services/vector-faiss-service'
import type { RequestOptions, SetProxyOptions, UsageResponse } from './types'

const { HttpsProxyAgent } = httpsProxyAgent

dotenv.config()

const ErrorCodeMessage: Record<string, string> = {
  401: '[OpenAI] 提供错误的API密钥 | Incorrect API key provided',
  403: '[OpenAI] 服务器拒绝访问，请稍后再试 | Server refused to access, please try again later',
  502: '[OpenAI] 错误的网关 |  Bad Gateway',
  503: '[OpenAI] 服务器繁忙，请稍后再试 | Server is busy, please try again later',
  504: '[OpenAI] 网关超时 | Gateway Time-out',
  500: '[OpenAI] 服务器繁忙，请稍后再试 | Internal Server Error',
}

const timeoutMs: number = !isNaN(+process.env.TIMEOUT_MS) ? +process.env.TIMEOUT_MS : 100 * 1000
const disableDebug: boolean = process.env.OPENAI_API_DISABLE_DEBUG === 'true'

let apiModel: ApiModel
const model = isNotEmptyString(process.env.OPENAI_API_MODEL) ? process.env.OPENAI_API_MODEL : 'gpt-3.5-turbo'

if (!isNotEmptyString(process.env.OPENAI_API_KEY) && !isNotEmptyString(process.env.OPENAI_ACCESS_TOKEN))
  throw new Error('Missing OPENAI_API_KEY or OPENAI_ACCESS_TOKEN environment variable')

// let api: ChatGPTAPI | ChatGPTUnofficialProxyAPI
let api: ChatGPTAPI
let chain: TaogeQA

(async () => {
  // More Info: https://github.com/transitive-bullshit/chatgpt-api

  if (isNotEmptyString(process.env.OPENAI_API_KEY)) {
    const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL

    const options: ChatGPTAPIOptions = {
      apiKey: process.env.OPENAI_API_KEY,
      completionParams: { model },
      debug: !disableDebug,
    }

    // increase max token limit if use gpt-4
    if (model.toLowerCase().includes('gpt-4')) {
      // if use 32k model
      if (model.toLowerCase().includes('32k')) {
        options.maxModelTokens = 32768
        options.maxResponseTokens = 8192
      }
      else {
        options.maxModelTokens = 8192
        options.maxResponseTokens = 2048
      }
    }

    if (isNotEmptyString(OPENAI_API_BASE_URL))
      options.apiBaseUrl = `${OPENAI_API_BASE_URL}/v1`

    // setupProxy(options)

    const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY })
    const memory = new TaogeMemory(embeddings)

    api = new ChatGPTAPI({ ...options })
    apiModel = 'ChatGPTAPI'

    // Initialize the LLM to use to answer the question.
    const DATA_STORE_DIR = '/workspaces/chatgpt-web/data_store_PyPDFLoader2'

    // Initialize the LLM to use to answer the question.
    const llm = new OpenAI({ modelName: 'gpt-3.5-turbo', openAIApiKey: process.env.OPENAI_API_KEY, temperature: 0.2, maxTokens: 256, streaming: true })

    const vfs = new VectorFaissService(DATA_STORE_DIR, embeddings)
    const vectorStore = await vfs.loadDefaultVectorStoreFromPython()
    if (!vectorStore)
      console.error(`Missing files. Upload index.faiss and index.pkl files to ${DATA_STORE_DIR} directory first`)
      // 加载pdf文件并转成document
      // const loader = new PDFLoader('/workspaces/chatgpt-web/service/files/智能驾驶相关项目储备202303.pdf')
      // const docsOrg = await loader.load()
      // const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: MAX_CHUNK_SIZE, chunkOverlap: MAX_CHUN_OVER_LAP })
      // const docs = await textSplitter.splitDocuments(docsOrg)
      // vectorStore = await vfs.addDocument(docs)

    else
      console.log(`Loading vector store from ${DATA_STORE_DIR}`)
    chain = new TaogeQA(llm, memory, vectorStore, { verbose: true })
  }
})()

async function chatReplyProcessByLangchain(options: RequestOptions) {
  const { message, lastContext, process, systemMessage, temperature, top_p } = options
  try {
    let options: SendMessageOptionsByLangchain = { timeoutMs }

    if (apiModel === 'ChatGPTAPI') {
      if (isNotEmptyString(systemMessage))
        options.systemMessage = systemMessage
      options.completionParams = { model, temperature, top_p }
    }

    if (lastContext != null) {
      if (apiModel === 'ChatGPTAPI') {
        options.parentMessageId = lastContext.parentMessageId
				options.conversationId = lastContext.conversationId
			} else
        options = { ...lastContext }
    }

    const response = await api.sendMessageByLangchain(message, chain, {
      ...options,
      onProgress: (partialResponse) => {
        process?.(partialResponse)
      },
    })

    return sendResponse({ type: 'Success', data: response })
  }
  catch (error: any) {
    const code = error.statusCode
    global.console.log(error)
    if (Reflect.has(ErrorCodeMessage, code))
      return sendResponse({ type: 'Fail', message: ErrorCodeMessage[code] })
    return sendResponse({ type: 'Fail', message: error.message ?? 'Please check the back-end console' })
  }
}

async function chatReplyProcess(options: RequestOptions) {
  const { message, lastContext, process, systemMessage, temperature, top_p } = options
  try {
    let options: SendMessageOptions = { timeoutMs }

    if (apiModel === 'ChatGPTAPI') {
      if (isNotEmptyString(systemMessage))
        options.systemMessage = systemMessage
      options.completionParams = { model, temperature, top_p }
    }

    if (lastContext != null) {
      if (apiModel === 'ChatGPTAPI')
        options.parentMessageId = lastContext.parentMessageId
      else
        options = { ...lastContext }
    }

    const response = await api.sendMessage(message, {
      ...options,
      onProgress: (partialResponse) => {
        process?.(partialResponse)
      },
    })

    return sendResponse({ type: 'Success', data: response })
  }
  catch (error: any) {
    const code = error.statusCode
    global.console.log(error)
    if (Reflect.has(ErrorCodeMessage, code))
      return sendResponse({ type: 'Fail', message: ErrorCodeMessage[code] })
    return sendResponse({ type: 'Fail', message: error.message ?? 'Please check the back-end console' })
  }
}

async function fetchUsage() {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL

  if (!isNotEmptyString(OPENAI_API_KEY))
    return Promise.resolve('-')

  const API_BASE_URL = isNotEmptyString(OPENAI_API_BASE_URL)
    ? OPENAI_API_BASE_URL
    : 'https://api.openai.com'

  const [startDate, endDate] = formatDate()

  // 每月使用量
  const urlUsage = `${API_BASE_URL}/v1/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`

  const headers = {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  }

  const options = {} as SetProxyOptions

  setupProxy(options)

  try {
    // 获取已使用量
    const useResponse = await options.fetch(urlUsage, { headers })
    if (!useResponse.ok)
      throw new Error('获取使用量失败')
    const usageData = await useResponse.json() as UsageResponse
    const usage = Math.round(usageData.total_usage) / 100
    return Promise.resolve(usage ? `$${usage}` : '-')
  }
  catch (error) {
    global.console.log(error)
    return Promise.resolve('-')
  }
}

function formatDate(): string[] {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const lastDay = new Date(year, month, 0)
  const formattedFirstDay = `${year}-${month.toString().padStart(2, '0')}-01`
  const formattedLastDay = `${year}-${month.toString().padStart(2, '0')}-${lastDay.getDate().toString().padStart(2, '0')}`
  return [formattedFirstDay, formattedLastDay]
}

async function chatConfig() {
  const usage = await fetchUsage()
  const reverseProxy = process.env.API_REVERSE_PROXY ?? '-'
  const httpsProxy = (process.env.HTTPS_PROXY || process.env.ALL_PROXY) ?? '-'
  const socksProxy = (process.env.SOCKS_PROXY_HOST && process.env.SOCKS_PROXY_PORT)
    ? (`${process.env.SOCKS_PROXY_HOST}:${process.env.SOCKS_PROXY_PORT}`)
    : '-'
  return sendResponse<ModelConfig>({
    type: 'Success',
    data: { apiModel, reverseProxy, timeoutMs, socksProxy, httpsProxy, usage },
  })
}

function setupProxy(options: SetProxyOptions) {
  if (isNotEmptyString(process.env.SOCKS_PROXY_HOST) && isNotEmptyString(process.env.SOCKS_PROXY_PORT)) {
    const agent = new SocksProxyAgent({
      hostname: process.env.SOCKS_PROXY_HOST,
      port: process.env.SOCKS_PROXY_PORT,
      userId: isNotEmptyString(process.env.SOCKS_PROXY_USERNAME) ? process.env.SOCKS_PROXY_USERNAME : undefined,
      password: isNotEmptyString(process.env.SOCKS_PROXY_PASSWORD) ? process.env.SOCKS_PROXY_PASSWORD : undefined,
    })
    options.fetch = (url, options) => {
      return fetch(url, { agent, ...options })
    }
  }
  else if (isNotEmptyString(process.env.HTTPS_PROXY) || isNotEmptyString(process.env.ALL_PROXY)) {
    const httpsProxy = process.env.HTTPS_PROXY || process.env.ALL_PROXY
    if (httpsProxy) {
      const agent = new HttpsProxyAgent(httpsProxy)
      options.fetch = (url, options) => {
        return fetch(url, { agent, ...options })
      }
    }
  }
  else {
    options.fetch = (url, options) => {
      return fetch(url, { ...options })
    }
  }
}

function currentModel(): ApiModel {
  return apiModel
}

export type { ChatContext, ChatMessage }

export { chatReplyProcess, chatReplyProcessByLangchain, chatConfig, currentModel }
