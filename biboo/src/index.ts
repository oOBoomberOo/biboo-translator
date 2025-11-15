import fs from "fs/promises";
import path from "path";

import { convertToLocalSource, getDestination, getExtensionSource, parseComicInfo } from "./suwayomi";
import { createApi } from "./api";
import { createEventLoop } from "./tracker";
import { configDotenv } from "dotenv";
import PQueue from "p-queue";

configDotenv();

const auto_translate_tag = Bun.env.AUTO_TRANSLATE_TAG ?? "Auto Translate";
const lookup_dir = Bun.env.LOOKUP_DIR ?? "data/downloads/mangas";

const translator = createApi();
const tracker = createEventLoop(60);

const translation_queue = new PQueue({ concurrency: 1 });
const translation_cache = new Set<string>();

tracker.on("tick", async () => {
  try {
    await lookForMangas();
  } catch (error) {
    tracker.emit("error", error as Error);
  }
});

tracker.on("error", (error) => {
  console.error("Tracker error:", error);
});

tracker.on("discovered", async (source) => {
  try {
    if (!source.comic_info.category.includes(auto_translate_tag)) {
      return;
    }

    if (translation_cache.has(source.path)) {
      return;
    }

    const comic_info = await parseComicInfo(Bun.file(`${source.path}/ComicInfo.xml`));
    const local_path = path.join(getDestination(comic_info), 'completed');

    if (await fs.exists(local_path)) {
      console.log(`skipping already translated manga: ${comic_info.series}/${comic_info.title}`);
      translation_cache.add(source.path);
      return;
    }


    translation_cache.add(source.path);
    const result = await translation_queue.add(() => convertToLocalSource(translator, source));
    tracker.emit("translated", result);
  } catch (error) {
    translation_cache.delete(source.path);
    tracker.emit("error", error as Error);
  }
});

tracker.on("translated", (source) => {
  console.log(`Translated manga: ${source.comic_info.title}`);
});


async function lookForMangas() {
  for (const extension of await fs.readdir(lookup_dir)) {
    const extension_path = `${lookup_dir}/${extension}`;
    for (const manga of await fs.readdir(extension_path)) {
      for (const chapter of await fs.readdir(`${extension_path}/${manga}`)) {
        try {
          const source = await getExtensionSource(`${extension_path}/${manga}/${chapter}`);
          tracker.emit("discovered", source);
        } catch (error) {
          tracker.emit("error", error as Error);
        }
      }
    }
  }
}

console.log(`Starting Biboo tracker...`);
tracker.emit("tick");

// Keep the process running
process.stdin.resume();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down Biboo tracker...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down Biboo tracker...');
  process.exit(0);
});
