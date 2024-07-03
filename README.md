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
**TODO** (Help needed.)

### 2. Install `MMM-Hotword2`
```sh
cd <MagicMirror Directory>/modules
git clone https://github.com/MMRIZE/MMM-Hotword2
cd MMM-Hotword2
npm install
```

### 3. Get PICOVOICE AccessKey
1. Join [PICOVOICE](https://picovoice.ai/) and get an accessKey. (`Forever-Free` plan might have some limitations but would be enough for private use.)
2. Open `.env` file (or copy from `env.example`) then put the accessKey into it.
```env
## .env
PICOVOICE_ACCESS_KEY=#FILL_YOUR_ACCESS_KEY
```
For more details, [See the WIKI](https://github.com/MMRIZE/MMM-Hotword2/wiki)