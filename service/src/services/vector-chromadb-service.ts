import * as fs from 'fs'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { Chroma } from 'langchain/vectorstores/chroma'
import type { Document } from 'langchain/document'

export class VectorChromaService {
	  private static collectionName = 'langchain'
  private vectorStore: Chroma | null = null
  private embeddings: OpenAIEmbeddings = new OpenAIEmbeddings()
  private vector_store_path: string
  public constructor(vector_store_path: string) {
    this.vector_store_path = vector_store_path
    if (fs.existsSync(this.vector_store_path))
      this.loadVectorStore(this.vector_store_path)
  }

  private async initVector(documents: Document[]) {
    this.vectorStore = await Chroma.fromDocuments(documents, this.embeddings, {
      collectionName: VectorChromaService.collectionName,
      url: this.vector_store_path,
    })
  }

  public addDocument(documents: Document[]): Chroma {
    if (!documents)
      throw new Error('The value of the documents parameter is null, you need to assign it first.')

    if (!this.vectorStore || !fs.existsSync(`${this.vector_store_path}/index.faiss`) || !fs.existsSync(`${this.vector_store_path}/index.pkl`)) {
      console.log('new data to vector store.....')
      this.initVector(documents)
    }
    else {
      console.log('add data to vector store...')
      this.vectorStore.addDocuments(documents)
      // this.vectorStore.save("");
    }
    return this.vectorStore!
  }

  public async loadVectorStore(path?: string): Promise<Chroma> {
    if (!path) {
      this.vectorStore = await Chroma.fromExistingCollection(new OpenAIEmbeddings(),
        { collectionName: VectorChromaService.collectionName, url: this.vector_store_path })
    }
    else {
      this.vectorStore = await Chroma.fromExistingCollection(new OpenAIEmbeddings(),
        { collectionName: VectorChromaService.collectionName, url: path })
    }
    return this.vectorStore!
  }

  public search(question: string, k = 3): any {
    if (!this.vectorStore)
      throw new Error('vectorStore has not been initialized, you need to initialize first.')

    return this.vectorStore.similaritySearch(question, k)
  }
}
