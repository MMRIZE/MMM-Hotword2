class HotwordHelper {
  constructor (callbacks) {
    this._callbacks = callbacks
  }

  sendNotification(noti, payload) {
    this._callbacks.sendNotification(noti, payload)
  }

  shellExec(scr) {
    this._callbacks.shellExec(scr)
  }

  getModule(mName = null) {
    var modules = this.getModules()
    if (mName == null) mName = "MMM-OpenAI"
    for (var i = 0; i < modules.length; i++) {
      if (modules[i] && modules[i].name == mName) return modules[i]
    }
  }

  getModules() {
    return this._callbacks.getModules()
  }

  resume(delay = 0) {
    return this._callbacks.resume(delay)
  }

  stop() {
    return this._callbacks.stop()
  }
}

Module.register('MMM-Hotword2', {
  defaults: {
    stealth: false,
    startOnBoot: true,
    autoRestart: false, // true or ms for delaying to start

    device: -1, // default device: -1. Index or device name

    sensitivity: 0.5,

    hotwords: [
      /*
      {
        hotword: 'Magic Mirror',
        file: 'MagicMirror.ppn',
        sensitivity: 0.5,
      },
      */
      { hotword: 'COMPUTER' },
      { hotword: 'JARVIS' },
          // ALEXA, AMERICANO, BLUEBERRY, BUMBLEBEE, COMPUTER, GRAPEFRUIT
          // GRASSHOPPER, HEY_GOOGLE, HEY_SIRI, JARVIS, OK_GOOGLE, PICOVOICE
          // PORCUPINE, TERMINATOR
    ],

    onDetect: (helper, hotword) => {
      console.log('[HTWD2] Detected : ', hotword)
      helper.sendNotification('SHOW_ALERT', {message: `Hotword "${hotword}" is detected.`, timer: 3000, title: 'MMM-Hotword2'})
      helper.resume(3000)
    }
  },

  start: function () {
    this.restartTimer = null
    this.living = false
    this.detected = ''
    this.autoRestart = (!isNaN(this.config.autoRestart && this.config.autoRestart > 0)) ? this.config.autoRestart : 10
    this.sendSocketNotification('INIT', this.config)
    this.helper = new HotwordHelper({
      sendNotification: (noti, payload) => {
        this.sendNotification(noti, payload)
      },
      shellExec: (scr) => {
        if (!scr) return false
        this.sendSocketNotification("SHELL_EXEC", scr)
      },
      getModules: () => {
        return MM.getModules()
      },
      resume: (delay = 0) => {
        const asleep = (ms) => {
          return new Promise(resolve => setTimeout(resolve, ms))
        }
        const job = async () => {
          await asleep(delay)
          return this.resumeMic()
        }
        job()
      },
      stop: () => {
        return this.stopMic()
      }
    })
  },

  notificationReceived: function (notification, payload, sender) {
    if (notification === 'DOM_OBJECTS_CREATED' && this.config.startOnBoot) {
      this.resumeMic()
    }

    if (notification === 'HOTWORD_RESUME') {
      console.log('resume?')
      this.resumeMic()
    }

    if (notification === 'HOTWORD_STOP') {
      console.log('stop?')
      this.stopMic()
    }
  },

  socketNotificationReceived: function(notification, payload) {
    console.log(notification, payload)
    if (notification === 'DETECTED') {
      this.drawDetect(payload)
      if (typeof this.config.onDetect === 'function') {
        this.config.onDetect(this.helper, payload)
      }
    }

    if (notification === 'STARTED') {
      this.living = true
      this.updateDom()
    }

    if (notification === 'RELEASED') {
      this.living = false
      this.updateDom()
      if (this.autoRestart) {
        clearTimeout(this.restartTimer)
        this.restartTimer = null
        this.restartTimer = setTimeout(() => {
          this.resumeMic()
        }, this.autoRestart)
      }
    }
  },

  resumeMic: function() {
    this.detected = ''
    this.sendSocketNotification('PROCESS')
  },

  stopMic: function() {
    this.sendSocketNotification('STOP')
  },

  drawDetect: function(hotword) {
    this.detected = hotword
    this.updateDom()
    this.drawTimer = setTimeout(() => {
      this.detected = ''
      this.updateDom()
    }, this.autoRestart)
  },

  getDom: function() {
    let dom = document.createElement('div')
    dom.classList.add('HOTWORD2', 'bodice')
    console.log('UPDATE', this.config.stealth, "!", this.living, "@", this.detected)
    if (this.config.stealth) return dom
    dom.classList.add((this.living) ? 'listening' : (this.detected) ? 'detected' : 'stopped')

    let icon = document.createElement('div')
    icon.classList.add('icon')
    
    let hotword = document.createElement('div')
    hotword.classList.add('hotword')
    hotword.innerHTML = this.detected

    dom.appendChild(icon)
    dom.appendChild(hotword)

    return dom
  },

  getStyles: function() {
    return ["MMM-Hotword2.css"]
  }

})