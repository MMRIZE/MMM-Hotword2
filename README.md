# MMM-Hotword2
MagicMirror module with Picovoice's Porcupine for Hotword detector. My previous `MMM-Hotword` module is deprecated due to `snowboy` hot-word detecting engine closing its service. Fortunately, PICOVOICE's Porcupine and its siblings are good enough and cheap. So I rebuilt the hot-word detector again.


## Install


### 1. Install `SOX` for the backbone audio framework.
You need to install `sox` at the beginning.
#### For MacOS
```sh
brew install sox
```

#### For most linux distro's (including Raspbian)
```sh
sudo apt-get install sox libsox-fmt-all
```

#### For Windows
**TODO** Help needed.

### 2. Install `MMM-Hotword2`
```sh
cd <MagicMirror Directory>/modules
git clone https://github.com/MMRIZE/MMM-Hotword2
cd MMM-Hotword2
npm install
```

### 3. Get PICOVOICE AccessKey
1. Join [PICOVOICE](https://picovoice.ai/) and get an accessKey. (`Forever-Free` plan might have some limitations but be enough for private use.)
2. Open `.env` file (or copy from `env.example`) then put the accessKey into it.
```sh
## .env
PICOVOICE_ACCESS_KEY=#FILL_YOUR_ACCESS_KEY
```

## Configuration
```js
/* in config/config.js */
{
  module: "MMM-Hotword",
  position: "bottom_left",
  config: {
    verbose: true,
    hotwords: [
      { hotword: 'JARVIS' },
    ...
    // Everything is defined by default, but if you want some change, describe the properties here.
  },
},
```

|**property**|**default**|**description**|
|---|---|---|
|`verbose`|false|When you set as `true`, more detailed information will be logged.|
|`startOnBoot`|true|Auto-start on the bootup.|
|`device`|-1|Mic index or name to use. system default device would have `-1`. You can see the device list in the log.|
|`sensitivity`|0.5|Default sensitivity of the mic to detect a voice. This value will be applied to all hotword definitions unless you re-define individually in a hotword.|
|`continuousRecording`|false|Default behaviour when the hotword is detected. This value will be applied to all hotword definitions unless you re-define individullay in a hotword.|
|`autoRestart`|false| After all jobs are done, restart the detector again.
|`onDetect`| () => {} | CALLBACK Function. You can make your default job when any hotword is detected. (This would be overriden in each hotword definition.) |
|`languageModel`|null|For English, just leave as null. For non-English custom hotword, you may need this. <br/>e.g) 'porcupine_params_ko.pv' for Korean hotword.<br/>(Explained below)|
|`hotwords`|[...hotword objects]|Definitions of hotword. (Explained below)|
|`recorderFrameLenght`| 512 | **(For expert)** Generally you don't need to care about this. |
|`recorderBufferedFramesCount` | 50 | **(For expert)** Generally you don't need to care about this. |
|`tooShortRecording`| 1000 | (ms) When continuous-recording is shorter than this, it will be ignored. |
|`tooLongRecording`| 60000 | (ms) Max continuous-recording length. |
|`soundThreshold`|0.1| 0 ~ 1 available. <br/>Ideally, 0 is absolutely silent and the loudness of your voice will increase this value. <br/>This value may vary depends on your devices and environments. You may need many trials to find a proper value.|
|`silentFrames`|100| The count of continuous frames below `soundThreashold` to detect end-of-utterance silence. It may vary depends on your devices and environments. Usually this 100 value will be around 1.5 sec.|
|`waitTimeout`| 30000 | (ms) Waiting for `continuousRecording` without voice will be stopped on this timer.|

> * **`recorderFrameLength`** is the length of the audio frames to receive and **`recorderBufferedFramesCount`** is the internal buffer size. 512 * 50 / 16000 (sample Rate) would be 1.6 sec. If this value is too low, buffer overflows could occur and audio frames could be dropped. A higher value will increase memory usage.

### Individual Hotword definition
```js
hotwords: [
  {
    hotword: 'JARVIS' // Default config value would be applied to this hotword
  },
  {
    hotword: 'COMPUTER', // Or you can define each hotword separately.
    sensitivity: 0.5,
    continuousRecording: false,
    autoRestart: false,
    onDetect: ({ helper, error, result, payload }) => {
      console.log("Detected hotword: 'COMPUTER'")
      helper.sendNotification('SHOW_ALERT', { message: `${result.hotword} detected.`})
    },
  },
  {
    hotword: 'MagicMirror',
    file: "MagicMirror.ppn", // For custom hotword, you need custom file name(.ppn)
  }
],
```

### Custom Hotwords
- You can train your custom hotword on `picovoice` homepage. After download your custom `.ppn` file, put it into `resources` directory of this module.

#### Non-English Custom Hotwords
You need an additional `model(.pv)` file for your trained `hotword(.ppn)`.
Available language models are [here](https://github.com/Picovoice/porcupine/tree/master/lib/common).
You can download it from `github` page manually, or,
```sh
# For Korean hotword, you need porcupine_params_ko.pv
cd <MagicMirror Directory>/modules/MMM-Hotword2/resources
curl -L -O https://github.com/Picovoice/porcupine/raw/master/lib/common/porcupine_params_ko.pv
```
Then, you need additional configuration of the module.
```js
{
  module: "MMM-Hotword2",
  position: "bottom_right",
  config: {
    languageModel: "porcupine_params_ko.pv",
    hotwords: [
      {
        hotword: "거울아거울아"
        file: "korean_mirrormirror.ppn",
...
```

> 1. You cannot mix multi-language models for hotwords. All custom hotwords used have to belong to one languageModel.
> 2. The default built-in hotwords like `COMPUTER` will not work with Non-English model.

## HOW TO USE
### 1. Standalone Voice Commander
You can use `MMM-Hotword` as a standalone voice commander or for MagicMirror
```js
{
  module: "MMM-Hotword",
  position: "bottom_left",
  config: {
    startOnBoot: true,
    hotwords: [
      {
        hotword: 'DoSomething', // I assume you built this custom hotword.
        file: 'dosomething.ppn',
        continuousRecording: false, // You may not need continuous recording for this kind of short-word command.
        onDetect: async ({ helper }) => {
          console.log("'Do Something' hotword detected!")
          // helper.sendMessage("DO_SOMETHING")
          // helper.getModule("MMM-Something").doSomething()
          // helper.shellExec("dosomething.sh -option 1")
          // ... whaterver
        }
      },
    ...
```

### 2. Hotword detector & Voice interface for other modules
This module also be used as a Hotword detector & vocal interface of user-input for other modules, if they could. (At least, `MMM-GPT` will use.)
```js
{
  module: "MMM-Hotword",
  position: "bottom_left",
  config: {
    startOnBoot: false,
    // hotwords: [], // If 3rd party model could provide hotword definition, you may not need to define them here by yourself.
  },
}
```

```js
/* In MMM-Something module */
this.sendNotification('HOTWORD_ACTIVATE', {
  config: {
    hotwords: [
      {
        hotword: 'YES_I_CAN',
        file: 'yesican.ppn',
        onDetect: async ({ helper }) => {
          console.log("User said 'yes'")
        }
      }
    ]
  },
  callback: (response) => {
    if (response.error) console.log(response.error)
  }
})
```

### 3. User's voice recording.
And, this module could be used as a voice recorder for other module, if they could. (At least, `MMM-GPT` will use)
```js
this.sendNotification('HOTWORD_ACTIVATE', {
  asDetected: 'COMPUTER',
  config: {
    continuousRecording: true,
  },
  callback: (response) => {
    const filePath = response.filePath
    ...
  }
}
```