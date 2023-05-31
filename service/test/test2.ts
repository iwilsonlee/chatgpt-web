/* eslint-disable no-console */
import { OpenAI } from 'langchain'
import { ConversationChain } from 'langchain/chains'
import { BufferMemory } from 'langchain/memory'
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from 'langchain/prompts'

const context = '上下文数据'
const question = '问题内容'

const systemTemplate = `
Use the following context data to answer the user's question.
If you don't know, just say "Sorry, I don't know.", don't try to make up any answer.
\"""
${context}
\"""
You need to answer the question in the same language as the language in which the question is being asked. For example, if the question is in Chinese, you have to answer in Chinese.
`

const chatPrompt = ChatPromptTemplate.fromPromptMessages([
  SystemMessagePromptTemplate.fromTemplate(systemTemplate),
  HumanMessagePromptTemplate.fromTemplate('{question}'),
])

const chat = new OpenAI()

const chain = new ConversationChain({
  memory: new BufferMemory({ returnMessages: true, memoryKey: 'history' }),
  prompt: chatPrompt,
  llm: chat,
})

const response = await chain.call({
  input: question,
})

console.log(response)
