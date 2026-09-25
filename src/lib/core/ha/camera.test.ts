import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Connection } from 'home-assistant-js-websocket';
import { playCamera } from './camera';

afterEach(() => vi.unstubAllGlobals());

function videoElement() {
	return {
		src: '',
		srcObject: null,
		canPlayType: vi.fn(() => 'probably'),
		play: vi.fn(async () => {}),
		pause: vi.fn(),
		load: vi.fn(),
		removeAttribute: vi.fn()
	} as unknown as HTMLVideoElement;
}

function capabilities(types: string[], respond: (message: { type: string }) => Promise<unknown>) {
	return vi.fn(async (message: { type: string }) =>
		message.type === 'camera/capabilities' ? { frontend_stream_types: types } : respond(message)
	);
}

describe('camera session ownership', () => {
	it('disposes native HLS playback once when its owner aborts', async () => {
		const sendMessagePromise = capabilities(['hls'], async () => ({
			url: '/api/hls/stream.m3u8'
		}));
		const connection = { sendMessagePromise } as unknown as Connection;
		const controller = new AbortController();
		const video = videoElement();
		const onError = vi.fn();
		await playCamera(connection, video, 'camera.door', controller.signal, onError);
		expect(video.src).toBe('/api/hls/stream.m3u8');
		controller.abort();
		controller.abort();
		expect(video.pause).toHaveBeenCalledTimes(1);
		expect(video.removeAttribute).toHaveBeenCalledWith('src');
		expect(onError).not.toHaveBeenCalled();
	});

	it('cannot attach a stream returned after cancellation', async () => {
		let resolve!: (value: { url: string }) => void;
		const connection = {
			sendMessagePromise: capabilities(['hls'], () => new Promise((r) => (resolve = r)))
		} as unknown as Connection;
		const controller = new AbortController();
		const video = videoElement();
		const loading = playCamera(connection, video, 'camera.door', controller.signal, vi.fn());
		await vi.waitFor(() => expect(resolve).toBeDefined());
		controller.abort();
		resolve({ url: '/late.m3u8' });
		await loading;
		expect(video.src).toBe('');
		expect(video.play).not.toHaveBeenCalled();
	});

	it('reports a failed stream request and releases the media element', async () => {
		const connection = {
			sendMessagePromise: capabilities(['hls'], async () => {
				throw new Error('offline');
			})
		} as unknown as Connection;
		const video = videoElement();
		const onError = vi.fn();
		await playCamera(connection, video, 'camera.door', new AbortController().signal, onError);
		expect(onError).toHaveBeenCalledTimes(1);
		expect(video.pause).toHaveBeenCalledTimes(1);
	});

	it('closes WebRTC media and an asynchronously established signaling subscription', async () => {
		const close = vi.fn(),
			stopTrack = vi.fn(),
			unsubscribe = vi.fn(async () => {});
		vi.stubGlobal(
			'RTCPeerConnection',
			class {
				addTransceiver = vi.fn();
				createOffer = vi.fn(async () => ({ sdp: 'offer' }));
				setLocalDescription = vi.fn(async () => {});
				close = close;
			}
		);
		vi.stubGlobal(
			'MediaStream',
			class {
				getTracks() {
					return [{ stop: stopTrack }];
				}
			}
		);
		let resolve!: (stop: () => Promise<void>) => void;
		const subscribeMessage = vi.fn(() => new Promise((r) => (resolve = r)));
		const connection = {
			sendMessagePromise: capabilities(['web_rtc', 'hls'], async () => ({})),
			subscribeMessage
		} as unknown as Connection;
		const video = videoElement(),
			controller = new AbortController();
		const loading = playCamera(connection, video, 'camera.door', controller.signal, vi.fn());
		await vi.waitFor(() => expect(subscribeMessage).toHaveBeenCalledOnce());
		controller.abort();
		resolve(unsubscribe);
		await loading;
		expect(close).toHaveBeenCalledOnce();
		expect(stopTrack).toHaveBeenCalledOnce();
		expect(unsubscribe).toHaveBeenCalledOnce();
		expect(video.srcObject).toBeNull();
	});
	it('does not request an HLS stream from a WebRTC-only camera', async () => {
		vi.stubGlobal(
			'RTCPeerConnection',
			class {
				addTransceiver = vi.fn();
				createOffer = vi.fn(async () => ({ sdp: 'offer' }));
				setLocalDescription = vi.fn(async () => {});
				close = vi.fn();
			}
		);
		vi.stubGlobal('MediaStream', class {});
		const sendMessagePromise = capabilities(['web_rtc'], async () => ({}));
		const subscribeMessage = vi.fn(async () => async () => {});
		const connection = { sendMessagePromise, subscribeMessage } as unknown as Connection;
		const onError = vi.fn();
		await playCamera(
			connection,
			videoElement(),
			'camera.door',
			new AbortController().signal,
			onError
		);
		const types = sendMessagePromise.mock.calls.map(([message]) => message.type);
		expect(types).not.toContain('camera/stream');
		expect(subscribeMessage).toHaveBeenCalledOnce();
		expect(onError).not.toHaveBeenCalled();
	});

	it('leaves a camera without stream types on its snapshot without requesting a stream', async () => {
		const sendMessagePromise = capabilities([], async () => ({ url: '/stream.m3u8' }));
		const connection = { sendMessagePromise } as unknown as Connection;
		const onError = vi.fn();
		await playCamera(
			connection,
			videoElement(),
			'camera.door',
			new AbortController().signal,
			onError
		);
		expect(sendMessagePromise).toHaveBeenCalledOnce();
		expect(onError).not.toHaveBeenCalled();
	});
});
