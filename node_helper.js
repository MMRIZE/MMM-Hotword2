"use strict"
const path = require('path')
const exec = require('child_process').exec
const fs = require('fs')
require('dotenv').config({ path: path.resolve(__dirname, '.env') })
const { WaveFile } = require('wavefile')
const { Porcupine, BuiltinKeyword } = require('@picovoice/porcupine-node')
const { PvRecorder } = require('@picovoice/pvrecorder-node')
const {
  Cobra,
  CobraActivationLimitReachedError,
} = require("@picovoice/cobra-node")

const BUILTIN_KEYWORDS = [
  'ALEXA', 'AMERICANO', 'BLUEBERRY', 'BUMBLEBEE', 'COMPUTER',
  'GRAPEFRUIT', 'GRASSHOPPER', 'HEY_GOOGLE', 'HEY_SIRI', 'JARVIS',
  'OK_GOOGLE', 'PICOVOICE', 'PORCUPINE', 'TERMINATOR',
]

const NodeHelper = require("node_helper")

const CUSTOM_HOTWORDS_PATH = './resources'
const CUSTOM_MODEL_PATH = './resources'

const ACCESS_KEY = process.env.PICOVOICE_ACCESS_KEY

let log = () => { }

module.exports = NodeHelper.create({
  start: function () {
    this.live = false
    try {
      this.availableDevices = PvRecorder.getAvailableDevices()
      console.log('[HOT2] Available devices:', this.availableDevices.map((r, i) => `${i}: ${r}`))
    } catch (e) {
      console.log('[HOT2] Cannot find any audio device.')
      console.log('[HOT2] Error:', e)
      this.sendSocketNotification('ERROR', e)
    }
  },

  status: function (payload) {
    this.sendSocketNotification('STATUS', payload)
  },

  initialize: function (config) {
    this.config = config
    if (config.verbose) log = (...args) => console.log('[HOT2]', ...args)
    //this.index = this.buildHotwords(config.hotwords)
    this.sendSocketNotification('INITIALIZED')
    this.status({ status: '' })
  },

  buildHotwords: function (hotwords) {
    const ret = []
    if (!hotwords) return ret

    for (const { hotword, sensitivity = this.config.sensitivity, file = 'PRE_DEFINED', continuousRecording = this.config.continuousRecording } of hotwords) {
      if (!hotword) {
        log('No hotword to detect.')
        continue
      }
      let fp = path.resolve(__dirname, CUSTOM_HOTWORDS_PATH, file)
      const value = (fs.existsSync(fp)) ? fp : (BUILTIN_KEYWORDS.includes(hotword) ? BuiltinKeyword[ hotword ] : null)
      if (value) {
        ret.push({ hotword, sensitivity, file: value, continuousRecording })
        log('Hotword added:', hotword, file)
      } else {
        log('Hotword file not found:', hotword, file)
      }
    }
    return ret
  },

  replyNotificationReceived: function (payload = null) {
    if (!payload?.notificationId) {
      log('No notification ID to reply.', payload)
      return
    }
    this.sendSocketNotification('RESULT', payload)
  },

  socketNotificationReceived: function (notification, payload) {
    const job = {
      'INIT': 'initialize',
      'ACTIVATE': 'activate',
      'DEACTIVATE': 'deactivate',
      'SHELL_EXEC': 'shellExec',
    }

    if (job[ notification ] && typeof this[ job[ notification ] ] === 'function') {
      this[ job[ notification ] ](payload)
      return
    }
  },

  shellExec: function ({shellId, script}) {
    exec(script, (error, stdout, stderr) => {
      const result = (error) ? error.message : stdout
      log("SHELL RESULT:", { shellId, script, result })
      this.sendSocketNotification('SHELL_RESULT', { shellId, result })
    })
  },

  deactivate: function (payload) {
    console.log('Deactivating...')
    this.live = false
    this.sendSocketNotification('DEACTIVATED', payload)
    this.status({ status: '' })
  },

  activate: async function (payload) {
    const { notificationId, ...original } = payload
    let reply = {
      notificationId,
      error: null,
      result: null,
      payload: original,
    }
    reply = { ...reply, ...(await this.process(payload)) }
    this.replyNotificationReceived(reply)
  },

  initializePorcupine: function (config, hotwordIndex) {
    if (!this.live) {
      log('Detector is not live')
      throw new Error('Detector is not live')
    }
    let porcupine = null
    try {
      const modelPath = (config.languageModel) ? path.resolve(__dirname, CUSTOM_MODEL_PATH, config.languageModel) : null
      porcupine = new Porcupine(...([
        ACCESS_KEY,
        [ ...hotwordIndex.map(r => r.file) ],
        [ ...hotwordIndex.map(r => r.sensitivity) ],
        modelPath,
      ]).filter(r => r))
    } catch (e) {
      log('Cannot create detector.')
      log('Error:', e.toString())
      throw e
    }
    return porcupine
  },

  initializeVAD: function (config) {
    if (!this.live) {
      log('Detector is not live')
      throw new Error('Detector is not live')
    }
    let cobra = null
    try {
      cobra = new Cobra(ACCESS_KEY)
    } catch (e) {
      log('Cannot create VAD.')
      log('Error:', e)
      throw e
    }
    return cobra
  },

  initializeRecorder: function (config) {
    if (!this.live) {
      log('Detector is not live')
      throw new Error('Detector is not live')
    }
    let recorder = null
    const { recorderFrameLength, recorderBufferedFramesCount } = config
    const device = (config.device === -1)
      ? -1
      : ((Number.isInteger(config.device))
        ? config.device
        : this.availableDevices.findIndex((d) => d === config.device))
    try {
      recorder = new PvRecorder(
        recorderFrameLength,
        device,
        recorderBufferedFramesCount,
      )
      const using = recorder.getSelectedDevice()
      log('MIC device:', using)
    } catch (e) {
      log('Cannot create recorder.')
      log('Error:', e)
      throw e
    }
    return recorder
  },

  deleteAllFiles: function () {
    const dir = path.resolve(__dirname, 'storage')
    fs.readdirSync(dir).forEach(file => {
      //if filename is not `placeholder.txt', delete it.
      if (file !== 'placeholder.txt') fs.unlinkSync(path.join(dir, file))
    })
    log('All previously recorded files are deleted.')
  },

  process: async function (payload) {
    let porcupine, cobra, recorder

    if (this.live) {
      log('Detector already running')
      return { error: 'Detector already running' }
    }
    this.live = true
    this.deleteAllFiles()
    config = { ...this.config, ...(payload?.config ?? {}) }

    const hotwordIndex = this.buildHotwords(config.hotwords)
    if (hotwordIndex.length < 1) {
      log('No hotword to detect.')
      this.live = false
      this.status({ status: 'error', content: 'No hotword to detect'})
      return { error: 'No hotword to detect' }
    }
    try {
      // Initialize porcupine
      porcupine = this.initializePorcupine(config, hotwordIndex)

      // Initialize VAD
      cobra = this.initializeVAD(config)

      // Initialize Recorder
      recorder = this.initializeRecorder(config)

    } catch (e) {
      log('Detector initialization failed.')
      this.status({ status: 'error', content: e.toString() })
      this.live = false
      if (typeof porcupine?.release === 'function') porcupine.release()
      porcupine = null
      if (typeof cobra?.release === 'function') cobra.release()
      cobra = null
      if (typeof recorder?.release === 'function') recorder.release()
      recorder = null
      return { error: e.toString() }
    }

    let detected = {}
    try {
      if (!this.live) {
        log('Detector is not live')
        throw new Error('Detector is not live')
      }
      this.status({ status: 'detecting', content: 'listening...' })
      log('Detector started')
      recorder.start()
      const { recordOnly = null } = payload
      // hotword detection
      if (recordOnly) {
        detected = hotwordIndex.find(r => r.hotword === recordOnly)
      } else {
        while (this.live) {
          let frames = await recorder.read()
          const index = porcupine.process(frames)
          if (index !== -1) {
            detected = hotwordIndex[ index ]
            log('Detected:', detected.hotword)
            this.status({ status: 'detected', content: detected.hotword })
            porcupine.release()
            porcupine = null
            break
          }
        }
      }
      if (!detected.hotword) {
        log('Detector stopped, but nothing detected.')
        throw new Error('Nothing detected')
      }

      // continuous recording
      if (detected.continuousRecording) {
        const { recorderFrameLength, tooShortRecording, tooLongRecording, soundThreshold, silentFrames } = config
        if (!this.live) {
          log('Detector is not live')
          throw new Error('Detector is not live')
        }
        this.status({ status: 'recording', content: detected.hotword })
        const wav = new WaveFile()
        const frames = []
        let startTime = Date.now()
        let endTime = null
        let sf = 0

        while (sf < silentFrames && this.live) {
          endTime = Date.now() - startTime
          if (endTime > tooLongRecording) {
            log('Recording too long.')
            endTime = null
            break
          }
          let frame = await recorder.read(recorderFrameLength)
          frames.push(frame)
          const sounds = cobra.process(frame)
          sf = (sounds < soundThreshold) ? sf + 1 : 0
        }

        const sampleRate = recorder.sampleRate
        recorder.stop()
        cobra.release()
        this.status({ status: 'detected', content: detected.hotword })
        let filename = null
        if (endTime > tooShortRecording) {
          const audioData = new Int16Array(recorderFrameLength * frames.length)
          for (let i = 0; i < frames.length; i++) {
            audioData.set(frames[ i ], i * recorderFrameLength)
          }
          wav.fromScratch(1, sampleRate, '16', audioData)
          filename = new Date().getTime() + '_' + Math.random().toString(36).substring(7) + '.wav'
          const filePath = path.resolve(__dirname, 'storage', filename)
          fs.writeFileSync(filePath, wav.toBuffer())
          detected.filePath = filePath
          detected.fileUrl = path.join('modules', 'MMM-Hotword2', 'storage', filename)
        } else {
          log('Recording too short. It will be ignored.')
        }
        log('Recorder stopped')
        //continuous recording ends.
      }
      this.live = false
      if (typeof porcupine?.release === 'function') porcupine.release()
      porcupine = null
      if (typeof cobra?.release === 'function') cobra.release()
      cobra = null
      if (typeof recorder?.release === 'function') recorder.release()
      recorder = null
      log('Detector process finished.')

      return {
        result: {
          hotword: detected.hotword,
          filePath: detected?.filePath ?? null,
          fileUrl: detected?.fileUrl ?? null,
        },
      }
    } catch (e) {
      this.status({ status: 'error', content: e.toString() })
      log('Detector process failed.')
      log(e)
      this.live = false
      if (typeof porcupine?.release === 'function') porcupine.release()
      porcupine = null
      if (typeof cobra?.release === 'function') cobra.release()
      cobra = null
      if (typeof recorder?.release === 'function') recorder.release()
      recorder = null
      return { error: e.toString() }
    }
  },

})