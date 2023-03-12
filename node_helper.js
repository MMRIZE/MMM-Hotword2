//
// Module : MMM-Porcupine
//

"use strict"
require('dotenv').config()
const path = require("path")
const exec = require("child_process").exec
const fs = require("fs")

const {Porcupine,BuiltinKeyword} = require("@picovoice/porcupine-node")
const { PvRecorder } = require("@picovoice/pvrecorder-node")
const NodeHelper = require("node_helper")

const BIKS = [
  'ALEXA', 'AMERICANO', 'BLUEBERRY', 'BUMBLEBEE', 'COMPUTER',
  'GRAPEFRUIT', 'GRASSHOPPER', 'HEY_GOOGLE', 'HEY_SIRI', 'JARVIS',
  'OK_GOOGLE', 'PICOVOICE', 'PORCUPINE', 'TERMINATOR',
]

const CUSTOM_HOTWORDS_PATH = './custom_hotwords'
const PICOVOICE_ACCESS_KEY = process.env.PICOVOICE_ACCESS_KEY

if (!PICOVOICE_ACCESS_KEY) console.error('[]HTWD2] PICOVOICE_ACCESS_KEY is not described in .env file.')

module.exports = NodeHelper.create({
  defaultRecorderOptions: {
    channels: 1,
    threshold: 0.5,
    thresholdStart: null,
    thresholdEnd: null,
    silence: 1.0,
    verbose: false,
    recordProgram: 'sox',
    device: null, // 'plughw:1'
  },

  start: function () {
    this.index = []
    this.availableDevices = PvRecorder.getAudioDevices()
    console.log('[HTWD2] Available devices : ', this.availableDevices)
    this.status = true
  },

  initialize(config) {
    this.config = config
    for (const {hotword, sensitivity = config.sensitivity, file='_'} of config.hotwords) {
      if (!hotword) continue
      let fp = path.resolve(__dirname, CUSTOM_HOTWORDS_PATH, file)
      let value = (fs.existsSync(fp)) ? fp : ((BIKS.includes(hotword)) ? BuiltinKeyword[hotword] : null )
      if (value) this.index.push({hotword, sensitivity, value})
    }
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === 'INIT') {
      this.initialize(payload)
    }

    if (notification === 'PROCESS') {
      this.status = true
      this.process().catch((e) => {
        this.status = false
        console.log('[HTWD2] Error : ', e)
      })
    }

    if (notification === 'STOP') {
      this.status = false
    }

    if (notification == "SHELL_EXEC") {
      console.log("[HTWD2] shellExec trying:", payload)
      exec(payload, (error, stdout, stderr)=>{
        if (error) {
          console.log("[HTWD2] shellExec error:\n ------ \n", error, "\n ----- \n")
        }
        if (stderr) console.log("[HTWD2] shellExec stdErr:\n ------ \n", stderr, "\n ----- \n")
        console.log("[HTWD2] shellExec stdOut:\n ------ \n", stdout, "\n ----- \n")
      })
    }
  },

  process: async function () {
    if (this.porcupine) {
      console.log ('[HTWD2] Still working, try later.')
      return
    }

    this.porcupine = new Porcupine(...([
      PICOVOICE_ACCESS_KEY,
      [...this.index.map(r => r.value)],
      [...this.index.map(r => r.sensitivity)],
    ]).filter(r=>r))

    //console.log(`[HTWD2] Preparing Porcupine. frameLength: ${this.porcupine.frameLength}, sampleRate: ${this.porcupine.sampleRate}`)
    
    let detected = null
    let device = (Number.isInteger(this.config.device)) ? this.config.device : this.availableDevices.findIndex(this.config.device)
    this.recorder = new PvRecorder(device, this.porcupine.frameLength)
    this.recorder.start()
    this.sendSocketNotification('STARTED')
    console.log('[HTWD2] Listening starts')

    // detecting hotword
    while (this.status) {
      try {
        let frames = await this.recorder.read(this.porcupine.frameLength)
        const index = this.porcupine.process(frames)
        if (index !== -1) {
          detected = this.index[index]
          console.log('[HTWD2] DETECTED : ', detected.hotword)
          break
        }
      } catch (err) {
        console.error('[HTWD2] Error :', err)
        this.status = false
        break
      }
    }

    this.porcupine.release()
    console.log('[HTWD2] Interrupt listening')
    this.recorder.release()
    console.log('[HTWD2] Recorder is released.')
    this.porcupine = null
    
    this.sendSocketNotification('RELEASED')
    if (detected) this.sendSocketNotification('DETECTED', detected.hotword)
  }
})
