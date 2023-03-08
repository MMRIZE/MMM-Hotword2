//
// Module : MMM-Porcupine
//

"use strict"
require('dotenv').config()
const path = require("path")
const exec = require("child_process").exec
const Record = require("./components/lpcm16.js")
const fs = require("fs")

const {Porcupine,BuiltinKeyword} = require("@picovoice/porcupine-node")
const { PvRecorder } = require("@picovoice/pvrecorder-node")

console.log('[PRCPN] Available devices : ', PvRecorder.getAudioDevices())


const NodeHelper = require("node_helper")

const BIKS = [
  'ALEXA', 'AMERICANO', 'BLUEBERRY', 'BUMBLEBEE', 'COMPUTER',
  'GRAPEFRUIT', 'GRASSHOPPER', 'HEY_GOOGLE', 'HEY_SIRI', 'JARVIS',
  'OK_GOOGLE', 'PICOVOICE', 'PORCUPINE', 'TERMINATOR',
]

const CUSTOM_KEYWORD_PATH = './custom_keywords'

module.exports = NodeHelper.create({
  start: function () {
    this.keywords = []
    this.sensitivities = []
    this.index = []
  },

  initialize(config) {
    this.config = config

    for (const {keyword, sensitivity = config.sensitivity, file='_'} of config.keywords) {
      if (!keyword) continue
      let fp = path.resolve(__dirname, CUSTOM_KEYWORD_PATH, file)
      let value = (fs.existsSync(fp)) ? fp : ((BIKS.includes(keyword)) ? BuiltinKeyword[keyword] : null )
      if (value) this.index.push({keyword, sensitivity, value})
    }

    console.log('INDEX', this.index)

    let {manualModelPath, manualLibraryPath} = config
    this.porcupine = new Porcupine(...([
      process.env.PORCUPINE_KEY,
      [...this.index.map(r => r.value)],
      [...this.index.map(r => r.sensitivity)],
      manualModelPath,
      manualLibraryPath,
    ]).filter(r=>r))
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === 'INIT') {
      this.initialize(payload)
    }

    if (notification === 'PROCESS') {
      this.process().catch((e) => {
        console.log('[PRCPN] Error : ', e)
      })
    }

    if (notification === 'STOP') {
      this.release()
    }
  },

  release: function () {
    if (!this.recorder) return
    this.recorder.stop()
    this.recorder.release()
    this.recorder = null
    console.log('[PRCPN] Listening stops.')
    this.sendSocketNotification('RELEASED')
  },

  process: async function () {
    if (this.recorder) {
      console.log ('[PRCPN] Recorder is still activating.')
      return
    }
    this.recorder = new PvRecorder(-1, this.porcupine.frameLength)
    this.sendSocketNotification('STARTED')
    console.log('[PRCPN] Listening starts')
    this.recorder.start()
    while (1) {
      const frames = await this.recorder.read()
      const index = this.porcupine.process(frames)
      if (index !== -1) {
        console.log('[PRCPN] DETECTED : ', this.index[index].keyword)
        this.sendSocketNotification('DETECTED', this.index[index].keyword)
        this.release()
        break
      }
    }
  }


})
