<script lang="ts">
import { computed, defineComponent, reactive, ref } from 'vue'
import type { FormInst } from 'naive-ui'
import { NButton, NForm, NFormItem, NInput, useMessage } from 'naive-ui'
import { useRouter } from 'vue-router'
import { useAuthStore, useUserStore } from '@/store'

export default defineComponent({
  components: {
    NForm,
    NFormItem,
    NInput,
    NButton,
  },
  setup() {
    const userStore = useUserStore()
    const userInfo = computed(() => userStore.userInfo)
    const name = ref(userInfo.value.name ?? '')
    const formRef = ref<FormInst | null>(null)
    const formValue = reactive({
      username: '',
      password: '',
    })
    const message = useMessage()
    const router = useRouter()

    return {
      formRef,
      title: name,
      formValue,
      rules: {
        username: { required: true, message: '请输入用户名', trigger: 'blur' },
        password: { required: true, message: '请输入密码', trigger: 'blur' },
      },
      handleValidateClick(e: MouseEvent) {
        e.preventDefault()
        formRef.value?.validate((errors) => {
          if (!errors) {
            // message.success('Valid')
            // const form = formRef.value?.model as { username: string; password: string }
            const { username, password } = formValue
            const authStore = useAuthStore()
            authStore.Login(username, password)
              .then((res) => {
                // const result = res.data as string
                // eslint-disable-next-line no-console
                console.log('login result=', res)
                // 登录成功后自动跳转到路由/
                message.success('登入成功')
                router.push('/')
              })
              .catch((err) => {
                // eslint-disable-next-line no-console
                console.log('found error in login:', err)
                message.error('登入失败')
              },
              )
              .finally(() => {

              })
          }
          else {
            // console.log(errors)
            // message.error('Invalid')
          }
        })
      },
    }
  },
})
</script>

<template>
  <div>
    <h1 style="text-align: center;">
      {{ title }}
    </h1>
    <div class="login">
      <NForm ref="formRef" :model="formValue" :rules="rules">
        <NFormItem label="用户名" path="username">
          <NInput v-model:value="formValue.username" placeholder="请输入用户名" />
        </NFormItem>
        <NFormItem label="密码" path="password">
          <NInput v-model:value="formValue.password" type="password" placeholder="请输入密码" />
        </NFormItem>
        <NFormItem>
          <NButton attr-type="button" type="primary" @click="handleValidateClick">
            登录
          </NButton>
        </NFormItem>
      </NForm>
    </div>
  </div>
</template>

  <style scoped>
    h1 {
  font-size: 32px;
  margin-bottom: 20px;
}
  .login {
    max-width: 400px;
    margin: 0 auto;
    padding: 20px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  </style>
