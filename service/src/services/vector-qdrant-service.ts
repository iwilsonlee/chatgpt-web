import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { QdrantVectorStore } from 'langchain/vectorstores/qdrant'
import type { Document } from 'langchain/document'
import * as dotenv from 'dotenv'

dotenv.config()

export class VectorQdrantService {
  private default_qdrant_url = 'http://localhost:6333'
  private default_collection_name = 'default'
  private qdrantUrl: string
  private collectionName: string
  public vectorStore: QdrantVectorStore | null = null
  private embeddings: OpenAIEmbeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY })
  public constructor(qdrantUrl: string, collectionName: string, embeddings: OpenAIEmbeddings) {
    this.qdrantUrl = qdrantUrl
    this.collectionName = collectionName
    this.embeddings = embeddings
    if (!this.qdrantUrl)
      this.qdrantUrl = this.default_qdrant_url

    if (!this.collectionName)
      this.collectionName = this.default_collection_name
    this.initVector()
  }

  private async initVector() {
    try {
      // console.log(`this.embeddings=${this.embeddings}`)
      this.vectorStore = await this.loadVectorStore()
    }
    catch (error) {
      // console.error(`initVector found error: ${error}`)
    }
  }

  public async addDocument(documents: Document[]): Promise<QdrantVectorStore> {
    if (!documents)
      throw new Error('The value of the documents parameter is null, you need to assign it first.')

    if (!this.vectorStore) {
      // console.log('new data to vector store.....')
      await this.initVector()
    }
    if (!this.vectorStore) {
      this.vectorStore = await QdrantVectorStore.fromDocuments(
        documents,
        new OpenAIEmbeddings(),
        {
          url: this.qdrantUrl,
          collectionName: this.collectionName,
        },
      )
    }
    if (this.vectorStore) {
      // console.log('add data to vector store...')
      await this.vectorStore.addDocuments(documents)
    }
    return this.vectorStore!
  }

  public async loadVectorStore(qdrantUrl?: string, collectionName?: string): Promise<QdrantVectorStore> {
    if (!qdrantUrl) {
      // console.log(`Loading vector store at vector_store_path=${this.vector_store_path}`)
      qdrantUrl = this.default_qdrant_url
    }
    if (!collectionName)
      collectionName = this.default_collection_name
    const vectorStore = await QdrantVectorStore.fromExistingCollection(this.embeddings, {
      url: qdrantUrl,
      collectionName,
    })
    return vectorStore
  }

  public async similaritySearch(question: string, k = 3): Promise<any> {
    if (!this.vectorStore)
      throw new Error('vectorStore has not been initialized, you need to initialize first.')

    return await this.vectorStore.similaritySearch(question, k)
  }
}
