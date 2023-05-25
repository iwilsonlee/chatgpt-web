/* eslint-disable no-console */
/* eslint-disable no-tabs */
import * as readline from 'readline'
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from 'langchain/prompts'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { OpenAI } from 'langchain/llms/openai'
import { loadQAChain } from 'langchain/chains'
import * as dotenv from 'dotenv'
import { MemoryVectorStore } from 'langchain/vectorstores/memory'
import { VectorStoreRetrieverMemory } from 'langchain/memory'
import { Document } from 'langchain/document'
import { PDFLoader } from 'langchain/document_loaders/fs/pdf'
import { VectorFaissService } from '../services/vector-faiss-service'

dotenv.config()

const MAX_CHUNK_SIZE = 800
const MAX_CHUN_OVER_LAP = 80
// console.log(process.env)
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

async function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer)
    })
  })
}

async function setApiKey() {
  try {
    const openaiKey = await askQuestion('OPEN AI KEY:')
    process.env.OPENAI_API_KEY = openaiKey
    console.log(`OPENAI_API_KEY=${process.env.OPENAI_API_KEY}`)
  }
  catch (e) {
    console.error(`Error occurred: ${e}`)
  }
}

// export default async function run() {
async function run() {
  console.log(`Running..., openai api key:${process.env.OPENAI_API_KEY}`)
  const DATA_STORE_DIR = '/workspaces/chatgpt-web/data_store_PyPDFLoader'
  const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY })
  const memoryStore = new MemoryVectorStore(new OpenAIEmbeddings())
  const memory = new VectorStoreRetrieverMemory({
    vectorStoreRetriever: memoryStore.asRetriever(3),
    memoryKey: 'history',
  })

  async function saveHistory(input: string, output: string) {
    await memory.saveContext({ input }, { output })
  }

  async function loadHistoryMemory(question: string) {
    const history_entity = await memory.loadMemoryVariables({ prompt: question })
    console.log(`history_entity=${JSON.stringify(history_entity)}`)
    return history_entity.history
  }
  // Initialize the LLM to use to answer the question.
  const model = new OpenAI({ openAIApiKey: process.env.OPENAI_API_KEY })

  const vfs = new VectorFaissService(DATA_STORE_DIR, embeddings)
  let vectorStore = await vfs.loadDefaultVectorStore()
  if (!vectorStore) {
    console.error(`Missing files. Upload index.faiss and index.pkl files to ${DATA_STORE_DIR} directory first`)
    // 加载pdf文件并转成document
    const loader = new PDFLoader('/workspaces/chatgpt-web/service/files/智能驾驶相关项目储备202303.pdf')
    const docsOrg = await loader.load()
    const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: MAX_CHUNK_SIZE, chunkOverlap: MAX_CHUN_OVER_LAP })
    const docs = await textSplitter.splitDocuments(docsOrg)
    vectorStore = await vfs.addDocument(docs)
  }
  else {
    console.log(`Loading vector store from ${DATA_STORE_DIR}`)
  }
  // return
  // Create prompt
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

  // Create a chain that uses the OpenAI LLM and Faiss vector store.
  const chainA = loadQAChain(model, { prompt: chatPrompt, type: 'stuff', verbose: true })

  const qas = [
    '物流行业的无人驾驶公司有哪些？',
    '推荐几款可以清扫辅路落叶的无人驾驶产品',
    '介绍一下于万智驾这家公司',
    '于万智驾有哪些产品？',
    'Clear 1是哪家公司的产品?']
  let n = 0
  while (n < qas.length) {
    // const question = await askQuestion('问题：')
    const question = qas[n]
    console.log(`question: ${question}`)
    const historySummarize = await loadHistoryMemory(question)
    const inputDocuments = vectorStore ? await vectorStore.similaritySearch(question, 2) : null
    if (historySummarize && inputDocuments) {
      const newDocuments = new Document({ pageContent: historySummarize, metadata: { source: 'Chat History' } })
      inputDocuments.push(newDocuments)
    }

    const resA = await chainA.call({
      input_documents: inputDocuments,
      question,
      max_tokens: 256,
    })
    console.log(`Answer: ${resA ? resA.text : 'nothing'}`)
    await saveHistory(question, resA.text)
    n++
    // rl.close()
  }
}

// setApiKey().then((res) => {
//   run()
// }).catch((e) => {
//   console.error(`setApiKey found error=&{e}`)
// }).finally(() =>{
//   rl.close()
// })

run()
