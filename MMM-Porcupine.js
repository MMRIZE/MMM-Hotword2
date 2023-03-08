Module.register('MMM-Porcupine', {
  defaults: {
    sensitivity: 0.5,
    manualModelPath: null,
    manualLibraryPath: null,
    // ALEXA, AMERICANO, BLUEBERRY, BUMBLEBEE, COMPUTER, GRAPEFRUIT
    // GRASSHOPPER, HEY_GOOGLE, HEY_SIRI, JARVIS, OK_GOOGLE, PICOVOICE
    // PORCUPINE, TERMINATOR

    keywords: [
      {
        keyword: 'MagicMirror',
        file: 'MagicMirror.ppn',
        sensitivity: 0.5,
      },
      {
        keyword: 'COMPUTER',
      },
      {
        keyword: 'JARVIS'
      }
    ]
  },

  start: function () {
    this.sendSocketNotification('INIT', this.config)
  },

  notificationReceived: function (notification, payload, sender) {
    if (notification === 'DOM_OBJECTS_CREATED') {
      this.sendSocketNotification('PROCESS')
    }
  },

  socketNotificationReceived: function(notification, payload) {
    console.log(notification, payload)
  }
})