class HotwordHelper {
  #_callbacks = null
  constructor(callbacks) {
    this.#_callbacks = callbacks
  }

  sendNotification(notification, payload) {
    this.#_callbacks.sendNotification(notification, payload)
  }

  async shellExec(scr) {
    return this.#_callbacks.shellExec(scr)
  }

  getModules() {
    return this.#_callbacks.getModules()
  }

  getModule(name) {
    const modules = this.getModules()
    return modules.find(m => m.name === name)
  }
}


Module.register("MMM-Hotword2", {
  defaults: {
    verbose: false,
    //stealth: false,
    startOnBoot: true,
    device: -1, // default device: -1. Index or mic name

    sensitivity: 0.5,
    continuousRecording: false,
    restart: false,
    restartDelay: 1000,
    onDetect: async ({ helper, result, error, payload }) => { // helper, result, error, payload
      if (error) return
      console.log('[HOT2] Detected:', result)
      helper.sendNotification('SHOW_ALERT', { title: 'Hotword Detected', message: `Hotword: ${result?.hotword}` })
    },

    languageModel: null, // For english, just leave as null, or 'porcupine_params_ko.pv' for Korean.
    hotwords: [
      { hotword: 'COMPUTER' },
      { hotword: 'JARVIS' },
    ],

    /* Advanced settings */

    recorderFrameLength: 512,
    recorderBufferedFramesCount: 50, // 50 * 512 / 16000 = 1.6 sec. Higher value is more smooth but memory consuming.

    tooShortRecording: 1000 * 1, // 1 sec
    tooLongRecording: 1000 * 60, // 60 sec
    soundThreshold: 0.1, // 0 ~ 1. Ideally, 0 is silent and your voice will increase the number. Lower value is more sensitive. In noisy environment, set higher value.
    silentFrames : 100, // accumulated soundThreshold for silent detection. (soundThreshold 0.1 to 100 accumulated frames would be around 1.5 sec)
    waitTimeout: 1000 * 30, // 30 sec
  },

  getStyles: function () {
    return ['MMM-Hotword2.css']
  },

  regularizeHotwords: function (hotwords) {
    return hotwords.map(h => {
      return {
        ...h,
        onDetect: (typeof h.onDetect === 'function') ? h.onDetect : this.config.onDetect,
        restart: h.restart ?? this.config.restart,
        restartDelay: h.restartDelay ?? this.config.restartDelay,
        continuousRecording: h.continuousRecording ?? this.config.continuousRecording,
        sensitivity: h.sensitivity ?? this.config.sensitivity,
      }
    })
  },

  start: function () {
    this.requested = new Map()
    this.shellJobs = new Map()

    this.config.hotwords = this.regularizeHotwords(this.config.hotwords)

    this.sendSocketNotification('INIT', this.config)
    this.helper = new HotwordHelper({
      sendNotification: (noti, payload) => {
        this.sendNotification(noti, payload)
      },
      shellExec: (script) => {
        const { resolve, promise } = Promise.withResolvers()
        const resolver = (shellId, result) => {
          resolve(result)
          this.shellJobs.delete(shellId)
        }
        const shellId = new Date().getTime() + Math.random().toString(36).substring(7)
        this.shellJobs.set(shellId, resolver)
        this.sendSocketNotification("SHELL_EXEC", { shellId, script })
        return promise
      },
      getModules: () => {
        return MM.getModules()
      },
    })
  },

  onDeactivated: async function (payload) {
    this.onStatus({ status: '' })
    //setTimeout(async () => {
    await this.flushRequestedMap()
    this.sendNotification('HOTWORD_DEACTIVATED')
    //}, 1000)
  },

  onResult: async function ({ notificationId, result, error, payload }) {
    const { sender, payload: original } = this.consumeRequestedMap(notificationId)

    if (!original) return
    let { callback = async () => { return }, ...rest } = original

    if (typeof callback !== 'function') return
    await callback({ error, result, payload: rest })
    const { hotwords = [] } = original?.config ?? this.config
    if (Array.isArray(hotwords) && hotwords.length > 0) {
      let found = hotwords.find(h => h.hotword === result?.hotword)
      let onDetect = (typeof found?.onDetect === 'function') ? found.onDetect : this.config.onDetect
      const ret = await onDetect({
        helper: this.helper,
        result,
        error,
        payload: rest
      })
      if (found?.restart) {
        setTimeout(() => {
          console.log('[HOT2] Restarting detector...')
          this.notificationReceived('HOTWORD_ACTIVATE', original, sender)
        }, found?.restartDelay ?? 1000)
      } else {
        setTimeout(() => {
          const status = document.getElementById('HOT2_' + this.identifier)
          if (status.dataset.status === 'detected') {
            console.log('[HOT2] Finished...')
            status.dataset.status = ''
            status.innerHTML = ''
          }
        }, 3000)
      }
    }
  },

  onInitialized: function () {
    this.sendNotification('HOTWORD_READY')
    if (this.config.startOnBoot) {
      Log.log('[HOT2] Starting on Boot...')
      this.notificationReceived('HOTWORD_ACTIVATE', this.config, { name: 'MMM-Hotword2' })
    }
  },

  onStatus: function ({ status = '', content = '' }) {
    const dom = document.getElementById('HOT2_' + this.identifier)
    if (!dom) return
    dom.dataset.status = status
    dom.innerHTML = content || ''
  },

  onShellResult: function ({ shellId, result }) {
    if (!this.shellJobs.has(shellId)) return
    const resolver = this.shellJobs.get(shellId)
    resolver(shellId, result)
  },

  socketNotificationReceived: function (notification, payload) {
    const job = {
      'INITIALIZED': 'onInitialized',
      //'RESULT': 'onResult',
      'DEACTIVATED': 'onDeactivated',
      'RESULT': 'onResult',
      'STATUS': 'onStatus',
      'SHELL_RESULT': 'onShellResult',
    }

    if (job[ notification ] && typeof this[ job[ notification ] ] === 'function') {
      this[ job[ notification ] ](payload)
      return
    }
  },

  notificationReceived: function (notification, payload, sender) {
    const job = {
      'DOM_OBJECTS_CREATED': 'onDomCreated',
      'HOTWORD_ACTIVATE': 'activate',
      'HOTWORD_DEACTIVATE': 'deactivate',
    }

    if (job[ notification ] && typeof this[ job[ notification ] ] === 'function') {
      this[ job[ notification ] ](payload, sender)
      return
    }
  },

  flushRequestedMap: async function () {
    for (const [ notificationId, { sender, payload: original } ] of this.requested) {
      const { callback, ...payload } = original
      if (typeof payload.callback === 'function') {
        payload.callback({ error: 'Flushed forcely', result: null, payload })
      }
    }
    this.requested.clear()
  },

  setRequestedMap: function (payload, sender) {
    const notificationId = new Date().getTime() + Math.random().toString(36).substring(7)
    this.requested.set(notificationId, { payload, sender })
    return notificationId
  },

  consumeRequestedMap: function (notificationId) {
    if (!this.requested.has(notificationId)) return null
    const payload = this.requested.get(notificationId)
    //this.requested.delete(notificationId)
    return payload
  },

  activate: function (delivered = {}, sender = { name: 'unknown' }) {
    const payload = { ...this.config, ...delivered }
    const notificationId = this.setRequestedMap(payload, sender)
    this.sendSocketNotification('ACTIVATE', { notificationId, ...payload })
  },

  onDomCreated: function () {
    //this.sendSocketNotification('INIT', this.config)
  },


  stop: function () {
    this.deactivate()
  },

  deactivate: function () {
    this.sendSocketNotification('DEACTIVATE')
  },

  getDom: function () {
    const wrapper = document.createElement("div")
    wrapper.className = "HOT2"
    wrapper.id = 'HOT2_' + this.identifier
    return wrapper
  },

})