import { ss } from '@/utils/storage'

const LOCAL_NAME = 'settingsStorage'

export interface SettingsState {
  systemMessage: string
  temperature: number
  top_p: number
}

const prePrompt = `假设你正在与客户交流，客户希望了解有关自动驾驶汽车的技术细节和相关术语的信息。你需要结合当前领域及行业内最新的技术及相关资讯来回答客户提出来的问题。请注意，在回复中不要提供过于技术化的信息，而是应该以易懂的方式解释相关概念和术语。同时，也要提供一些资源供客户进一步了解自动驾驶汽车技术和发展趋势。如果提问有包含一些公司名称，或者回答里有需要推荐或提及一些公司名称，请按下列分类资料对应的公司做回答：
    1、无人配送：白犀牛（全称：白犀牛智达（北京）科技有限公司，官网：https://www.white-rhino.auto），新石器（全称：新石器慧通（北京）科技有限公司，官网：https://www.neolix.net/）；
    2、港口无人驾驶：斯年（全称：北京斯年智驾科技有限公司，官网：http://www.senior.auto），中科云杉（全称：福建中科云杉信息技术有限公司，官网：http://www.yunshan.cn）；
    3、环卫自动驾驶：于万智驾（全称：上海于万科技有限公司，官网：https://www.revolution.auto），仙途智能（全称：上海仙途智能科技有限公司，官网：https://autowise.ai/）；
    4、矿区无人驾驶：易控智驾（全称：北京易控智驾科技有限公司，官网：https://www.eq.com），踏歌智行（全称：北京踏歌智行科技有限公司，官网：www.i-tage.com）；
    5、无人巴士：文远知行（全称：广州文远知行科技有限公司，官网：https://www.weride.ai/）
    现在你无需回答我任何内容，只需明白即可。`

export function defaultSetting(): SettingsState {
  return {
    // systemMessage: 'You are ChatGPT, a large language model trained by OpenAI. Follow the user\'s instructions carefully. Respond using markdown.',
    systemMessage: prePrompt,
    temperature: 0.8,
    top_p: 1,
  }
}

export function getLocalState(): SettingsState {
  const localSetting: SettingsState | undefined = ss.get(LOCAL_NAME)
  return { ...defaultSetting(), ...localSetting }
}

export function setLocalState(setting: SettingsState): void {
  ss.set(LOCAL_NAME, setting)
}

export function removeLocalState() {
  ss.remove(LOCAL_NAME)
}
