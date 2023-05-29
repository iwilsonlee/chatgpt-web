import * as fs from 'fs'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { FaissStore } from 'langchain/vectorstores/faiss'
import type { Document } from 'langchain/document'
import * as dotenv from 'dotenv'

dotenv.config()

export class VectorFaissService {
  public vectorStore: FaissStore | null = null
  private embeddings: OpenAIEmbeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY })
  private vector_store_path: string
  public constructor(vector_store_path: string, embeddings: OpenAIEmbeddings) {
    this.vector_store_path = vector_store_path
    this.embeddings = embeddings
  }

  public async loadDefaultVectorStore(): Promise<FaissStore> {
    if (fs.existsSync(this.vector_store_path))
      await this.loadVectorStore(this.vector_store_path)

    return this.vectorStore
  }

  public async loadDefaultVectorStoreFromPython(): Promise<FaissStore> {
    if (fs.existsSync(this.vector_store_path))
      await this.loadVectorStoreFromPython(this.vector_store_path)

    return this.vectorStore
  }

  private async initVector(documents: Document[]) {
    try {
      // console.log(`this.embeddings=${this.embeddings}`)
      this.vectorStore = await FaissStore.fromDocuments(documents, this.embeddings)
    }
    catch (error) {
      // console.error(`initVector found error: ${error}`)
    }
    // console.log(`initVector this.vectorStore=${this.vectorStore}`)
    this.vectorStore.save(this.vector_store_path)
  }

  public async addDocument(documents: Document[]): Promise<FaissStore> {
    if (!documents)
      throw new Error('The value of the documents parameter is null, you need to assign it first.')

    if (!this.vectorStore || !fs.existsSync(`${this.vector_store_path}/faiss.index`) || !fs.existsSync(`${this.vector_store_path}/docstore.json`)) {
      // console.log('new data to vector store.....')
      await this.initVector(documents)
    }
    else {
      // console.log('add data to vector store...')
      await this.vectorStore.addDocuments(documents)
    }
    return this.vectorStore!
  }

  public async loadVectorStore(path?: string): Promise<FaissStore> {
    if (!path) {
      // console.log(`Loading vector store at vector_store_path=${this.vector_store_path}`)
      path = this.vector_store_path
    }
    if (!fs.existsSync(`${path}/faiss.index`) || !fs.existsSync(`${path}/docstore.json`)) {
      return null
    }
    else {
      // console.log(`Loading vector store at path=${path}`)
      try {
        this.vectorStore = await FaissStore.load(this.vector_store_path, this.embeddings)
        // console.log(`Loading vector store at vectorStore=${this.vectorStore}`)
        return this.vectorStore
      }
      catch (error) {
        // console.error(`loadVectorStore found error: ${error}`)
        return null
      }
    }
  }

  public async loadVectorStoreFromPython(path?: string): Promise<FaissStore> {
    if (!path) {
      // console.log(`Loading vector store at vector_store_path=${this.vector_store_path}`)
      path = this.vector_store_path
    }
    if (!fs.existsSync(`${path}/index.faiss`) || !fs.existsSync(`${path}/index.pkl`)) {
      return null
    }
    else {
      // console.log(`Loading vector store at path=${path}`)
      try {
        this.vectorStore = await FaissStore.loadFromPython(this.vector_store_path, this.embeddings)
        // console.log(`Loading vector store at vectorStore=${this.vectorStore}`)
        return this.vectorStore
      }
      catch (error) {
        // console.error(`loadVectorStore found error: ${error}`)
        return null
      }
    }
  }

  public similaritySearch(question: string, k = 3): any {
    if (!this.vectorStore)
      throw new Error('vectorStore has not been initialized, you need to initialize first.')

    return this.vectorStore.similaritySearch(question, k)
  }
}
