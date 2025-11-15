import { fetch, type BunFile, type FileBlob } from "bun";

export interface TranslatorApi {
	translate(image: FileBlob): Promise<Blob>;
}

export function createApi(): TranslatorApi {
	const endpoint = Bun.env.TRANSLATOR_API_ENDPOINT ?? "http://localhost:5003";
	const config = Bun.env.TRANSLATOR_API_CONFIG ?? "config.json";
	return new TranslatorApiImpl(endpoint, config);
}

class TranslatorApiImpl implements TranslatorApi {
	private config: BunFile;

	constructor(private readonly endpoint: string, private config_path: string) {
		this.config = Bun.file(this.config_path);
	}

	async getConfig() {
		return await this.config.json();
	}

	async translate(image: FileBlob): Promise<Blob> {
		const config = await this.getConfig();
		const bytes = await image.bytes();
		const base64 = `data:${image.type};base64,` + bytes.toBase64();

		const abort_controller = new AbortController();

		const response = await fetch(`${this.endpoint}/translate/image`, {
			method: `POST`,
			body: JSON.stringify({
				image: base64,
				config: config,
			}),
			signal: abort_controller.signal,
		})

		if (response.status !== 200) {
			throw new Error(`Translation API error: ${response.status} - ${response.statusText}`);
		}

		const translated = await response.blob();
		return translated;
	}
}