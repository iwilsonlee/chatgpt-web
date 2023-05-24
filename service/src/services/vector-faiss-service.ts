import * as fs from 'fs'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { FaissStore } from 'langchain/vectorstores/faiss'
import type { Document } from 'langchain/document'

export class VectorFaissService {
  public vectorStore: FaissStore | null = null
  private embeddings: OpenAIEmbeddings = new OpenAIEmbeddings()
  private vector_store_path: string
  public constructor(vector_store_path: string) {
    this.vector_store_path = vector_store_path
  }

	public async loadDefaultVectorStore(): Promise<FaissStore> {
		if (fs.existsSync(this.vector_store_path)) {
      await this.loadVectorStore(this.vector_store_path)
		}
		return this.vectorStore
	}

  private async initVector(documents: Document[]) {
    this.vectorStore = await FaissStore.fromDocuments(documents, this.embeddings)
    this.vectorStore.save(this.vector_store_path)
  }

  public async addDocument(documents: Document[]): Promise<FaissStore> {
    if (!documents)
      throw new Error('The value of the documents parameter is null, you need to assign it first.')

    if (!this.vectorStore || !fs.existsSync(`${this.vector_store_path}/index.faiss`) || !fs.existsSync(`${this.vector_store_path}/index.pkl`)) {
      console.log('new data to vector store.....')
      await this.initVector(documents)
    }
    else {
      console.log('add data to vector store...')
      await this.vectorStore.addDocuments(documents)
      // this.vectorStore.save("");
    }
    return this.vectorStore!
  }

  public async loadVectorStore(path?: string): Promise<FaissStore> {
    if (!path) {
			console.log(`Loading vector store at vector_store_path=${this.vector_store_path}`)
      this.vectorStore = await FaissStore.loadFromPython(this.vector_store_path, this.embeddings)
		} else {
			console.log(`Loading vector store at path=${path}`)
      this.vectorStore = await FaissStore.loadFromPython(path, this.embeddings)
			console.log(`Loading vector store at vectorStore=${this.vectorStore}`)
		}
    return this.vectorStore!
  }

  public similaritySearch(question: string, k = 3): any {
    if (!this.vectorStore)
      throw new Error('vectorStore has not been initialized, you need to initialize first.')

    return this.vectorStore.similaritySearch(question, k)
  }
}
