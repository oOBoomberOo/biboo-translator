import type { FileBlob } from "bun";
import type { TranslatorApi } from "./api";
import { XMLParser } from "fast-xml-parser";
import path from "path";
import fs from "fs/promises";

export interface ExtensionSource {
	path: string;

	comic_info: {
		title: string;
		series: string;
		author: string;
		artist: string;
		description: string;
		genre: string[];
		category: string[];
	}
}

export type ComicInfo = ExtensionSource["comic_info"];

export async function parseComicInfo(comic_info: FileBlob): Promise<ComicInfo> {
	const parser = new XMLParser();
	const text = await comic_info.text();
	const { ComicInfo } = parser.parse(text);

	const genre: string = ComicInfo?.Genre ?? "";
	const category: string = ComicInfo?.["ty:Categories"] ?? "";

	return {
		title: ComicInfo?.Title ?? "N/A",
		series: ComicInfo?.Series ?? "N/A",
		author: ComicInfo?.Writer ?? "N/A",
		artist: ComicInfo?.Penciller ?? "N/A",
		description: ComicInfo?.Summary ?? "N/A",
		genre: genre.split(",").map(g => g.trim()),
		category: category.split(",").map(c => c.trim()),
	};
}

export async function getExtensionSource(path: string): Promise<ExtensionSource> {
	const comic_info = await parseComicInfo(Bun.file(`${path}/ComicInfo.xml`));
	return {
		path,
		comic_info,
	};
}

export interface LocalSource {
	output: string;

	comic_info: ComicInfo;
}

const LOCAL_DIR = Bun.env.LOCAL_DIR ?? "data/local";

export function getDestination(comic_info: ComicInfo): string {
	return path.join(LOCAL_DIR, comic_info.series, comic_info.title);
}

export async function convertToLocalSource(api: TranslatorApi, source: ExtensionSource): Promise<LocalSource> {
	const { title, series } = source.comic_info;
	const destination = getDestination(source.comic_info);
	const temp = path.join('./temp', destination);

	console.log(`[${series}/${title}] starting translation process...`);
	const images = await Array.fromAsync(getImages(source.path));

	images.sort((a, b) => chapterNumber(a) - chapterNumber(b));

	console.log(`[${series}/${title}] found ${images.length} images to process.`);

	const processedImages = [];

	for (const image of images) {
		try {
			const blob = Bun.file(path.join(source.path, image));
			console.log(`[${series}/${title}] translating ${image}...`);

			const result = await api.translate(blob);
			const file_name = path.join(temp, getImageName(image, result.type));
			await Bun.write(file_name, result);

			console.log(`[${series}/${title}] translated ${image}.`);
			processedImages.push(result);
		} catch (error) {
			console.error(`[${series}/${title}] error while translating ${image}:`, error);
			throw error;
		}
	}

	if (await fs.exists(destination)) {
		await fs.rmdir(destination, { recursive: true });
	}

	await fs.cp(temp, destination, { recursive: true });
	await fs.rmdir(temp, { recursive: true });

	const manga_dir = path.join(LOCAL_DIR, series);

	const details = Bun.file(path.join(manga_dir, "details.json"));
	console.log(`[${series}/${title}] writing details to ${details.name}...`);

	const local_info = source.comic_info;
	local_info.title = series;
	await details.write(JSON.stringify(local_info));

	const cover = Bun.file(path.join(manga_dir, "cover.jpg"));
	const hasCover = await cover.exists();
	const firstImage = findFirstImage(processedImages);

	if (!hasCover && firstImage !== null) {
		console.log(`[${series}/${title}] generating cover image to ${cover.name}...`);
		await cover.write(await firstImage.bytes());
	}

	await Bun.write(path.join(destination, 'completed'), '');

	console.log(`[${series}/${title}] successfully processed ${processedImages.length} images.`);

	return {
		output: destination,
		comic_info: source.comic_info,
	}
}

function getImageName(image: string, mime_type: string) {
	const [_, ext] = mime_type.split("/");
	return `${image}.${ext}`;
}

function findFirstImage<T>(task: (T | null)[]): T | null {
	for (const result of task) {
		if (result !== null) {
			return result;
		}
	}

	return null;
}

function getImages(base_dir: string) {
	const glob = new Bun.Glob("*.{jpg,jpeg,png,gif,webp}");
	return glob.scan(base_dir);
}

function chapterNumber(file_name: string): number {
	const match = file_name.match(/(\d+)/);

	if (!match) {
		return 0;
	}

	const digit = match[1];
	return parseInt(digit, 10);
}
