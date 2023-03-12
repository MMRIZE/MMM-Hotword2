# MMM-Hotword2
MagicMirror module with Picovoice's Porcupine for Hotword detector

## Screenshot


## Features
- Built-in and custom hotwords detection
- On detected, `helper` can do many things - send notification, module control, shell execution, and...


## Installation
```sh
cd ~/MagicMirror # Your MM root directory
cd modules
git clone https://github.com/MMRIZE/MMM-Hotword2
cd MMM-Hotword2
npm install
```

## Picovoice Access Key
1. Go to https://console.picovoice.ai/login , then sign-up/sign-in.





## Idle talk...
My previous `MMM-Hotword` was lost during on my absence. I delegated the ownership of the module to someone but he might have destroyed the repository itself. Anyway, the `snowboy`, the backbone engine of that module was also expired in one day.
And recently, I have been interested with AI implementation, but I couldn't find any sufficient interfaces for MagicMirror. 
For these reasons, I decided to reinvent the hotword detector and STT modules.
With a short research, Picovoice's `Porcupine` looks so promising. I found one module which is using Porcupine already, but it doesn't support custom hotwords. So I made this.


 