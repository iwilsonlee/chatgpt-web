import * as fs from 'fs'
import * as readline from 'readline'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { OpenAI } from 'langchain/llms/openai'
import { loadQAStuffChain } from 'langchain/chains'
import * as dotenv from 'dotenv'
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from 'langchain/prompts'
import { VectorStoreRetrieverMemory } from 'langchain/memory'
import { MemoryVectorStore } from 'langchain/vectorstores/memory'
import { Document } from 'langchain/document'
import { VectorFaissService } from '../services/vector-faiss-service'
import { PDFLoader } from "langchain/document_loaders/fs/pdf"

dotenv.config()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

// const DATA_STORE_DIR = '/Users/wilson/develop/workspace_revolutionauto/projects-ai/langchain-gpt/data_store_all'
const DATA_STORE_DIR = '/Users/wilson/develop/workspace_revolutionauto/projects-ai/langchain-gpt/data_store_PyPDFLoader'


const memoryVectorStore = new MemoryVectorStore(new OpenAIEmbeddings())
const memory = new VectorStoreRetrieverMemory({
  vectorStoreRetriever: memoryVectorStore.asRetriever(3),
  memoryKey: 'history',
})

async function saveHistory(input: string, output: string) {
  await memory.saveContext({ input }, { output })
}

async function loadHistoryMemory(question: string) {
  const history_entity = await memory.loadMemoryVariables({ prompt: question })
  return history_entity.history
}

async function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer)
    })
  })
}

// export default async function run() {
async function run() {
	console.log('Running...')
  // Initialize the LLM to use to answer the question.
  const model = new OpenAI({})

  const vfs = new VectorFaissService(DATA_STORE_DIR)
  let vectorStore = await vfs.loadDefaultVectorStore()
  if (!vectorStore) {
    console.error(`Missing files. Upload index.faiss and index.pkl files to ${DATA_STORE_DIR} directory first`)
    // 加载pdf文件并转成document
    // const text = fs.readFileSync('state_of_the_union.txt', 'utf8')
		const loader = new PDFLoader("/Users/wilson/develop/workspace_revolutionauto/projects-ai/langchain-gpt/files/智能驾驶相关项目储备202303.pdf");
		const docsOrg = await loader.load();
		const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 })
    const docs = await textSplitter.splitDocuments(docsOrg);
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

	You need to answer the question in the same language as the language in which the question is being asked. For example, if the question is in Chinese, you have to answer in Chinese.
	`
  const chatPrompt = ChatPromptTemplate.fromPromptMessages([
    SystemMessagePromptTemplate.fromTemplate(systemTemplate),
    HumanMessagePromptTemplate.fromTemplate('{question}'),
  ])

  // const responseB = await chatPrompt.formatPromptValue({
  //   context: "English",
  //   question: "I love programming.",
  // });

  // const responseBString = responseB.toString();

  // Create a chain that uses the OpenAI LLM and HNSWLib vector store.
  const chainA = loadQAStuffChain(model, { prompt: chatPrompt, verbose: true })

  /*
  {
    res: {
      text: 'The president said that Justice Breyer was an Army veteran, Constitutional scholar,
      and retiring Justice of the United States Supreme Court and thanked him for his service.'
    }
  }
  */
  while (true)	{
      // const question = await askQuestion('问题：')
      const question = '物流行业的无人驾驶公司有哪些？'
			console.log(`question: ${question}`)
      const historySummarize = await loadHistoryMemory(question)
      const inputDocuments = vectorStore ? await vectorStore.similaritySearch(question, 3) : null
      if (historySummarize && inputDocuments) {
        const newDocuments = new Document({ pageContent: historySummarize, metadata: { source: 'Chat History' } })
        inputDocuments.push(newDocuments)
      }

      const resA = await chainA.call({
        input_documents: inputDocuments,
        question,
      })
      console.log({ resA })
      await saveHistory(question, resA.text)
      rl.close()
  }
}

run()
