import { defineStore } from 'pinia'
import { getToken, removeToken, setToken } from './helper'
import { store } from '@/store'
import { fetchSession, login } from '@/api'

interface SessionResponse {
  auth: boolean
  model: 'ChatGPTAPI' | 'ChatGPTUnofficialProxyAPI'
}

export interface AuthState {
  username: string | undefined
  token: string | undefined
  session: SessionResponse | null
}

export const useAuthStore = defineStore('auth-store', {
  state: (): AuthState => ({
    username: undefined,
    token: getToken(),
    session: null,
  }),

  getters: {
    // isChatGPTAPI(state): boolean {
    //   return state.session?.model === 'ChatGPTAPI'
    // },
    isChatGPTAPI(): boolean {
      return true
    },

    currentUsername(state): string {
      return state.username as string
    },

    isSuper(state): boolean {
      return state.username === 'wilson'
    },
  },

  actions: {
    async getSession() {
      try {
        const { data } = await fetchSession<SessionResponse>()
        this.session = { ...data }
        return Promise.resolve(data)
      }
      catch (error) {
        return Promise.reject(error)
      }
    },

    // 登录
    Login(username: string, password: string) {
      return new Promise<any>((resolve, reject) => {
        login(username, password)
          .then((res) => {
            this.setToken(res.data as string)
            this.username = username
            resolve(res.status as string)
          })
          .catch((error) => {
            reject(error)
          })
      })
    },

    setToken(token: string) {
      this.token = token
      setToken(token)
    },

    removeToken() {
      this.token = undefined
      removeToken()
    },
  },
})

export function useAuthStoreWithout() {
  return useAuthStore(store)
}
