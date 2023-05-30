/* eslint-disable no-console */
/* eslint-disable no-tabs */
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from 'langchain/prompts'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { OpenAI } from 'langchain/llms/openai'
import type { MapReduceDocumentsChain, QAChainParams, RefineDocumentsChain, StuffDocumentsChain } from 'langchain/chains'
import { loadQAChain } from 'langchain/chains'
import * as dotenv from 'dotenv'
import { MemoryVectorStore } from 'langchain/vectorstores/memory'
import { VectorStoreRetrieverMemory } from 'langchain/memory'
import { Document } from 'langchain/document'
import type { BaseLLM } from 'langchain/llms'
import type { SaveableVectorStore } from 'langchain/vectorstores'
import type { LLMResult } from 'langchain/dist/schema'
import QuickLRU from 'quick-lru'
import { v4 as uuidv4 } from 'uuid'
import { VectorFaissService } from '../services/vector-faiss-service'

dotenv.config()

// const MAX_CHUNK_SIZE = 800
// const MAX_CHUN_OVER_LAP = 80
// console.log(process.env)
// const rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout,
// })

export class TaogeMemory {
  private embeddings: OpenAIEmbeddings
  // private memory: VectorStoreRetrieverMemory
  // private memoryStore: MemoryVectorStore
  private memories: QuickLRU<string, MemoryVectorStore>

  constructor(embeddings?: OpenAIEmbeddings) {
    this.embeddings = embeddings || new OpenAIEmbeddings()
    // this.memoryStore = new MemoryVectorStore(this.embeddings)
    // this.memory = new VectorStoreRetrieverMemory({
    //   vectorStoreRetriever: this.memoryStore.asRetriever(3),
    //   memoryKey: 'history',
    // })
    this.memories = new QuickLRU<string, MemoryVectorStore>({ maxSize: 100 })
  }

  async _loadMemory(memoryStore: MemoryVectorStore): Promise<VectorStoreRetrieverMemory> {
    return new VectorStoreRetrieverMemory({
      vectorStoreRetriever: memoryStore.asRetriever(3),
      memoryKey: 'history',
    })
  }

  /**
   * Save history to memory
   * @param conversationId
   * @param content
   * @returns
   */
  async saveHistoryMemory(conversationId: string, content: { input: string; output: string }) {
    const memoryStore = this.memories.get(conversationId) || new MemoryVectorStore(this.embeddings)
    const memory = await this._loadMemory(memoryStore)
    const { input, output } = content
    await memory.saveContext({ input }, { output })
    this.memories.set(conversationId, memoryStore)
  }

  /**
   * Load history from memory
   * @param conversationId
   * @param question
   */
  async loadHistoryMemory(conversationId: string, question: string): Promise<string | null> {
    const memoryStore = this.memories.get(conversationId)
    if (memoryStore) {
      const memory = await this._loadMemory(memoryStore)
      const history_entity = await memory.loadMemoryVariables({ prompt: question })
      console.log(`history_entity=${JSON.stringify(history_entity)}`)
      return history_entity.history
    }
    return null
  }
}

export type LoadHistory = (question: string) => Promise<string | null>
export type SaveHistory = (answer: string) => Promise<void>

export class TaogeQA {
  private llm: BaseLLM
  private chain: StuffDocumentsChain | MapReduceDocumentsChain | RefineDocumentsChain
  private verbose = false
  private memory: TaogeMemory
  private vectorStore: SaveableVectorStore

  constructor(llm: BaseLLM, memory: TaogeMemory, vectorStore: SaveableVectorStore, params: QAChainParams = {}) {
    const { type = 'stuff', verbose = false } = params
    this.verbose = verbose
    this.llm = llm
    this.memory = memory
    this.vectorStore = vectorStore
    this.chain = loadQAChain(this.llm, { prompt: this.createPrompt(), type, verbose: this.verbose })
  }

  private createPrompt(): ChatPromptTemplate {
    const systemTemplate = `
		Use the following context data to answer the user's question.
		If you don't know, just say "Sorry, I don't know.", don't try to make up any answer.
		\"""
		{context}
		\"""

		You need to answer the question in the same language as the language in which the question is being asked. For example, if the question is in Chinese, you need to answer in Chinese.
		`
    const chatPrompt = ChatPromptTemplate.fromPromptMessages([
      SystemMessagePromptTemplate.fromTemplate(systemTemplate),
      HumanMessagePromptTemplate.fromTemplate('{question}'),
    ])
    return chatPrompt
  }

  private async generateContext(question: string, conversationId: string): Promise<Document[]> {
    const historySummarize = await this.memory.loadHistoryMemory(conversationId, question)
    console.log(`historySummarize=${historySummarize}`)
    const inputDocuments = await this.vectorStore.similaritySearch(question, 2)
    if (historySummarize && inputDocuments) {
      const newDocuments = new Document({ pageContent: historySummarize, metadata: { source: 'Chat History' } })
      inputDocuments.push(newDocuments)
    }
    return inputDocuments
  }

  // 如果传进来的字符串是有下列开头的就去掉：'\noutput:\n'、'\noutput: \n'、'\noutput:'、'output:'、'\n'
  private filterString(inputString: string): string {
    if (inputString.startsWith('\noutput:\n'))
      inputString = inputString.replace('\noutput:\n', '')
    if (inputString.startsWith('\noutput: \n'))
      inputString = inputString.replace('\noutput: \n', '')
    if (inputString.startsWith('\noutput:'))
      inputString = inputString.replace('\noutput:', '')
    if (inputString.startsWith('output:'))
      inputString = inputString.replace('output:', '')
    const regex = /^\n+/
    const result = inputString.replace(regex, '')
    return result
  }

  public async call(question: string, conversationId: string, options?, maxTokens?: 256): Promise<string> {
    const inputDocuments = await this.generateContext(question, conversationId)
    const { onMessage, onEnd, onError } = options
    let res
    let n = 0
    let answer = ''
    const callback = {} as { handleLLMNewToken?; handleLLMEnd?; handleLLMError? }
    if (onMessage) {
      // append handleLLMNewToken() to callback
      callback.handleLLMNewToken = (token: string, runId: string, parentRunId: string) => {
        // console.log({ token })
        onMessage?.(token, runId, parentRunId)
      }
    }
    if (onEnd) {
      callback.handleLLMEnd = (output, runId, parentRunId) => {
        onEnd?.(output, runId, parentRunId)
      }
    }
    if (onError) {
      callback.handleLLMError = (error, runId, parentRunId) => {
        onError?.(error, runId, parentRunId)
      }
    }
    while ((!res || !res.text) && n < 3) {
      res = await this.chain.call({
        input_documents: inputDocuments,
        question,
        max_tokens: maxTokens,
      }, [
        callback,
      ])
      if (res &&	res.text) {
        console.log(`langchain res=${JSON.stringify(res)}`)
        answer = this.filterString(res.text)
        this.memory.saveHistoryMemory(conversationId, { input: question, output: answer })
      }
      else {
        n++
        console.log(`chain call result is null, try again 1 second later, n=${n}`)
        // sleep 1 second
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    return answer
  }
}

// async function askQuestion(question: string): Promise<string> {
//   return new Promise((resolve) => {
//     rl.question(question, (answer) => {
//       resolve(answer)
//     })
//   })
// }

// async function setApiKey() {
//   try {
//     const openaiKey = await askQuestion('OPEN AI KEY:')
//     process.env.OPENAI_API_KEY = openaiKey
//     console.log(`OPENAI_API_KEY=${process.env.OPENAI_API_KEY}`)
//   }
//   catch (e) {
//     console.error(`Error occurred: ${e}`)
//   }
// }

// export default async function run() {
export default async function run(question: string,
  options?: { onMessage?: (data: string, runId: string, parentRunId: string) => void; onEnd?: (output: LLMResult, runId: string, parentRunId: string) => void }): Promise<string> {
  console.log(`Running..., openai api key:${process.env.OPENAI_API_KEY}`)
  const DATA_STORE_DIR = '/workspaces/chatgpt-web/data_store_PyPDFLoader2'
  const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY })

  // Initialize the LLM to use to answer the question.
  const model = new OpenAI({ modelName: 'gpt-3.5-turbo', openAIApiKey: process.env.OPENAI_API_KEY, maxTokens: 256, streaming: true })

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

  // return

  const memory = new TaogeMemory(embeddings)

  const taogeQA = new TaogeQA(model, memory, vectorStore, { verbose: true })

  // const qas = [
  //   '物流行业的无人驾驶公司有哪些？',
  //   '推荐几款可以清扫辅路落叶的无人驾驶产品',
  //   // '介绍一下于万智驾这家公司',
  //   // '于万智驾有哪些产品？',
  //   // 'Clear 1是哪家公司的产品?',
  // ]
  // let n = 0
  // while (n < qas.length) {
  //   // const question = await askQuestion('问题：')
  //   const question = qas[n]
  //   console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>')
  //   console.log(`question: ${question}`)

  //   const answer = await taogeQA.call(question)

  //   console.log(`Answer: ${answer || 'nothing'}`)
  //   n++
  // }
  const conversationId = uuidv4() // generate
  return await taogeQA.call(question, conversationId, options)
}

// run()
