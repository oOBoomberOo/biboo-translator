import type { ExtensionSource, LocalSource } from "./suwayomi";
import type TypedEventEmitter from "typed-emitter";
import EventEmitter from "events";

type TrackerEvents = {
	error: (error: Error) => void;
	tick: () => void;
	discovered: (source: ExtensionSource) => void;
	translated: (source: LocalSource) => void;
}

type Tracker = TypedEventEmitter<TrackerEvents>;

export function createEventLoop(seconds: number): Tracker {
	const tracker = new EventEmitter() as Tracker;

	setInterval(() => {
		tracker.emit("tick");
	}, seconds * 1000);

	return tracker;
}
