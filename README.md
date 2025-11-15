# About

Pre-packaged manga translation tool with suwayomi as the frontend and manga-image-translator as the backend.

# Installation

1. clone the repo with submodules,
```
git clone --recurse-submodules https://github.com/oOBoomberOo/biboo-translator.git
```
2. cd into the cloned directory.
```
cd biboo-translator
```
3. start docker process in detached mode. **expect** this step to take a long time as it wil have to download pytorch and other AI stuff.
```
docker compose up --detach
```

## Usage
Once the docker container is up and running, you can access suwayomi at `http://localhost:4567`.

The translator is configured so that any downloaded chapters from manga with the category "Auto Translate" will be automatically translated in the background. The first translation may take a while as the models need to be downloaded first but subsequent translations should be much faster after the model is saved to disk.