import type { Router } from 'vue-router'
import { getToken } from '@/store/modules/auth/helper'
import { ss } from '@/utils/storage'
// import { useAuthStoreWithout } from '@/store/modules/auth'

const allowList = ['Login', 'authRedirect'] // no redirect allowList
const loginRoutePath = '/login'
// const defaultRoutePath = '/'
const FROM_URL = 'from_url'

export function setupPageGuard(router: Router) {
  router.beforeEach(async (to, from, next) => {
    // const authStore = useAuthStoreWithout()

    const token = getToken()
    if (!token) {
      try {
        if (to.name && allowList.includes(to.name as string)) {
          next()
        }
        else {
          const fromUrl = ss.get(FROM_URL)
          if (fromUrl)
            window.location.replace(fromUrl)
          else
            next({ path: loginRoutePath, query: { redirect: to.fullPath } })
        }
      }
      catch (error) {
        if (to.path !== '/500')
          next({ name: '500' })
        else
          next()
      }

      // try {
      //   // const data = await authStore.getSession()
      //   // if (String(data.auth) === 'false' && authStore.token)
      //   //   authStore.removeToken()
      //   if (to.path === '/500')
      //     next({ name: 'Root' })
      //   else
      //     next()
      // }
      // catch (error) {
      //   if (to.path !== '/500')
      //     next({ name: '500' })
      //   else
      //     next()
      // }
    }
    else {
      next()
    }
  })
}
