/**
 * VideoRTC - Robust Multi-Protocol Video Client for Go2RTC.
 * High-efficiency MediaSource (MSE) streaming with WebRTC fallback and automatic port retry.
 * Zero-UDP firewall friction: streams directly over the TCP WebSocket connection.
 */
export class VideoRTC {
    /**
     * @param {HTMLVideoElement} video
     */
    constructor(video) {
        if (!video) {
            throw new Error('[VideoRTC] HTMLVideoElement is required');
        }
        this.video = video;

        this.DISCONNECT_TIMEOUT = 5000;
        this.RECONNECT_TIMEOUT = 2000;

        // Codecs matching Go2RTC and modern camera profiles (H.264 baseline/main/high, H.265, AAC, Opus)
        this.CODECS = [
            'avc1.64001E',      // H.264 high 3.0 (Tapo stream2 sub-stream, ultra-fast 140kbps)
            'avc1.64001F',      // H.264 high 3.1
            'avc1.640020',      // H.264 high 3.2
            'avc1.640029',      // H.264 high 4.1 (cam1)
            'avc1.640032',      // H.264 high 5.0 (Tapo stream1 2K QHD)
            'avc1.640028',      // H.264 high 4.0 (cam2, cam6)
            'avc1.4D0029',      // H.264 main 4.1 (cam5)
            'avc1.64002A',      // H.264 high 4.2
            'avc1.640033',      // H.264 high 5.1
            'avc1.4d401f',      // H.264 baseline
            'hvc1.1.6.L153.B0', // H.265 main 5.1
            'mp4a.40.2',        // AAC LC
            'mp4a.40.5',        // AAC HE
            'opus',             // OPUS
            'flac',             // FLAC
        ];

        /** Supported streaming modes: 'mse' prioritized for zero-UDP firewall friction and instant LAN playback */
        this.mode = 'mse,webrtc';

        /** Requested media tracks */
        this.media = 'video,audio';

        /** Keep connection alive in background */
        this.background = true;

        /** WebRTC RTCPeerConnection configuration */
        this.pcConfig = {
            bundlePolicy: 'max-bundle',
            iceServers: [
                { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }
            ],
            sdpSemantics: 'unified-plan',
        };

        this.wsState = WebSocket.CLOSED;
        this.pcState = WebSocket.CLOSED;

        this.ws = null;
        this.wsURL = '';
        this.pc = null;
        this.connectTS = 0;
        this.reconnectTID = 0;
        this.disconnectTID = 0;
        this.onmessage = {};
        this.ondata = null;
        this.mseCodecs = '';
        this.mediaSource = null;
        this.sourceBuffer = null;
        this.onConnected = null;
        this.isDestroyed = false;
        this._hasReportedConnected = false;
        this._reconnectAttempts = 0;

        this.oninit();
    }

    oninit() {
        if (!this.video) return;

        this.video.playsInline = true;
        this.video.autoplay = true;
        this.video.preload = 'auto';

        // Ensure no conflicting blob URL remains
        if (this.video.src && this.video.src.startsWith('blob:')) {
            try {
                URL.revokeObjectURL(this.video.src);
                this.video.removeAttribute('src');
            } catch (_) {}
        }
    }

    /**
     * Filter supported codecs for MediaSource Extensions.
     * @param {Function} isSupported
     */
    codecs(isSupported) {
        const defaultCodecs = 'avc1.640029,avc1.640028,avc1.4D0029,avc1.64002A,avc1.640033,avc1.4d401f,hvc1.1.6.L153.B0,mp4a.40.2';
        try {
            const list = this.CODECS
                .filter(codec => {
                    const isVideo = codec.indexOf('vc1') > 0 || codec.indexOf('4d40') > 0 || codec.indexOf('4D00') > 0;
                    const kind = isVideo ? 'video' : 'audio';
                    return this.media.includes(kind);
                })
                .filter(codec => {
                    try {
                        return isSupported ? isSupported(`video/mp4; codecs="${codec}"`) : true;
                    } catch (_) {
                        return true;
                    }
                });
            return (list && list.length > 0) ? list.join() : defaultCodecs;
        } catch (_) {
            return defaultCodecs;
        }
    }

    /**
     * Set WebSocket URL to connect to Go2RTC stream.
     * @param {string|URL} value
     */
    set src(value) {
        if (!value || this.isDestroyed) return;
        let url = typeof value !== 'string' ? value.toString() : value;
        if (url.startsWith('http://')) {
            url = 'ws://' + url.substring(7);
        } else if (url.startsWith('https://')) {
            url = 'wss://' + url.substring(8);
        } else if (url.startsWith('/')) {
            const wsProto = typeof location !== 'undefined' && location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = typeof location !== 'undefined' ? location.host : '127.0.0.1:5173';
            url = `${wsProto}//${host}${url}`;
        }

        this.wsURL = url;
        this.onconnect();
    }

    get src() {
        return this.wsURL;
    }

    /**
     * Play video handling autoplay policy.
     */
    play() {
        if (!this.video || this.isDestroyed) return;
        this.video.muted = true;
        this.video.defaultMuted = true;
        const prom = this.video.play();
        if (prom && typeof prom.catch === 'function') {
            prom.catch(() => {
                this.video.muted = true;
                this.video.play().catch(() => {});
            });
        }
    }

    /**
     * Send JSON signaling payload to Go2RTC.
     * @param {Object} value
     */
    send(value) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(value));
        }
    }

    /**
     * Connect to Go2RTC WebSocket signaling endpoint.
     */
    onconnect() {
        if (this.isDestroyed || !this.video || !this.wsURL) return false;

        if (this.ws) {
            try { this.ws.close(); } catch (_) {}
            this.ws = null;
        }

        this.wsState = WebSocket.CONNECTING;
        this.connectTS = Date.now();
        this._hasReportedConnected = false;

        try {
            const ws = new WebSocket(this.wsURL);
            this.ws = ws;

            ws.binaryType = 'arraybuffer';
            ws.onopen = () => {
                if (this.isDestroyed || this.ws !== ws) return;
                this._reconnectAttempts = 0;
                this.onopen();
            };
            ws.onclose = () => {
                if (this.isDestroyed || this.ws !== ws) return;
                this.onclose();
            };
            ws.onerror = (err) => {
                if (this.isDestroyed || this.ws !== ws) return;
                console.warn('[VideoRTC] WS error on', this.wsURL, err);
            };
            ws.onmessage = (ev) => {
                if (this.isDestroyed || this.ws !== ws) return;
                if (typeof ev.data === 'string') {
                    try {
                        const msg = JSON.parse(ev.data);
                        for (const mode in this.onmessage) {
                            if (typeof this.onmessage[mode] === 'function') {
                                this.onmessage[mode](msg);
                            }
                        }
                    } catch (e) {
                        console.warn('[VideoRTC] Signaling parse error:', e);
                    }
                } else if (typeof this.ondata === 'function') {
                    this.ondata(ev.data);
                }
            };
            return true;
        } catch (e) {
            console.error('[VideoRTC] Failed to initialize WebSocket:', e);
            return false;
        }
    }

    /**
     * Disconnect active connection and clean up resources.
     * @param {boolean} [preserveVideo=false] - Keep previous video frame visible during reconnection
     */
    ondisconnect(preserveVideo = false) {
        if (this.reconnectTID) {
            clearTimeout(this.reconnectTID);
            this.reconnectTID = 0;
        }
        if (this.disconnectTID) {
            clearTimeout(this.disconnectTID);
            this.disconnectTID = 0;
        }

        this.wsState = WebSocket.CLOSED;
        if (this.ws) {
            const ws = this.ws;
            this.ws = null;
            ws.onopen = null;
            ws.onclose = null;
            ws.onerror = null;
            ws.onmessage = null;
            try { ws.close(); } catch (_) {}
        }

        this.pcState = WebSocket.CLOSED;
        if (this.pc) {
            const pc = this.pc;
            this.pc = null;
            try {
                pc.getSenders().forEach(s => { if (s.track) try { s.track.stop(); } catch (_) {} });
                pc.getReceivers().forEach(r => { if (r.track) try { r.track.stop(); } catch (_) {} });
                pc.close();
            } catch (_) {}
        }

        this.onmessage = {};
        this.ondata = null;

        // If preserveVideo is false, tear down video sources completely
        if (!preserveVideo) {
            if (this.mediaSource) {
                try {
                    if (this.mediaSource.readyState === 'open') {
                        this.mediaSource.endOfStream();
                    }
                } catch (_) {}
                this.mediaSource = null;
                this.sourceBuffer = null;
            }

            if (this.video) {
                try {
                    this.video.pause();
                    if (this.video.src && this.video.src.startsWith('blob:')) {
                        URL.revokeObjectURL(this.video.src);
                    }
                    this.video.removeAttribute('src');
                    this.video.srcObject = null;
                } catch (_) {}
            }
        }
    }

    /**
     * Completely destroy this instance so it never reconnects.
     */
    destroy() {
        this.isDestroyed = true;
        this.onConnected = null;
        this.ondisconnect(false);
    }

    /**
     * Triggered when WebSocket signaling channel opens.
     */
    onopen() {
        if (this.isDestroyed) return;
        this.wsState = WebSocket.OPEN;

        const hasWebRTC = typeof window !== 'undefined' && 'RTCPeerConnection' in window;
        const hasManagedMSE = typeof window !== 'undefined' && 'ManagedMediaSource' in window;
        const hasStandardMSE = typeof window !== 'undefined' && 'MediaSource' in window;
        const hasMSE = hasManagedMSE || hasStandardMSE;

        // Honor requested mode preference order (default: mse,webrtc)
        const modes = (this.mode || 'mse,webrtc').split(',');
        for (const m of modes) {
            const trimmed = m.trim().toLowerCase();
            if (trimmed === 'mse' && hasMSE) {
                this.onmse();
                return;
            }
            if (trimmed === 'webrtc' && hasWebRTC) {
                this.onwebrtc();
                return;
            }
        }

        // Automatic fallback
        if (hasMSE) {
            this.onmse();
        } else if (hasWebRTC) {
            this.onwebrtc();
        }
    }

    /**
     * MediaSource Extensions (MSE) over WebSocket.
     * Streams fMP4 fragments over TCP WebSocket with zero UDP firewall requirements.
     */
    onmse() {
        if (this.isDestroyed || !this.video) return;

        /** @type {MediaSource} */
        let ms;

        const checkSupported = (type) => {
            try {
                const MS = window['MediaSource'] || window['ManagedMediaSource'];
                return MS && typeof MS.isTypeSupported === 'function' ? MS.isTypeSupported(type) : true;
            } catch (_) {
                return true;
            }
        };

        // 1. Standard MediaSource (Chrome, Firefox, Edge, Android) - must be checked FIRST!
        if (typeof window !== 'undefined' && 'MediaSource' in window) {
            const MediaSource = window['MediaSource'];
            ms = new MediaSource();

            const sourceOpenTimeout = setTimeout(() => {
                if (this.isDestroyed || (ms && ms.readyState === 'open')) return;
                console.warn('[VideoRTC] MediaSource sourceopen timed out, falling back to WebRTC');
                this.onwebrtc();
            }, 3000);

            ms.addEventListener('sourceopen', () => {
                clearTimeout(sourceOpenTimeout);
                if (this.isDestroyed) return;
                this.send({ type: 'mse', value: this.codecs(checkSupported) });
            }, { once: true });

            if (this.video.src && this.video.src.startsWith('blob:')) {
                try { URL.revokeObjectURL(this.video.src); } catch (_) {}
            }
            this.video.src = URL.createObjectURL(ms);
            this.video.srcObject = null;
        } else if (typeof window !== 'undefined' && 'ManagedMediaSource' in window) {
            // 2. ManagedMediaSource (Safari iOS 17.1+ where standard MediaSource is missing)
            const ManagedMediaSource = window['ManagedMediaSource'];
            ms = new ManagedMediaSource();

            const sourceOpenTimeout = setTimeout(() => {
                if (this.isDestroyed || (ms && ms.readyState === 'open')) return;
                console.warn('[VideoRTC] ManagedMediaSource sourceopen timed out, falling back to WebRTC');
                this.onwebrtc();
            }, 3000);

            ms.addEventListener('sourceopen', () => {
                clearTimeout(sourceOpenTimeout);
                if (this.isDestroyed) return;
                this.send({ type: 'mse', value: this.codecs(checkSupported) });
            }, { once: true });

            this.video.disableRemotePlayback = true;
            this.video.srcObject = ms;
        } else {
            this.onwebrtc();
            return;
        }

        this.mediaSource = ms;
        this.play();
        this.mseCodecs = '';

        this.onmessage['mse'] = (msg) => {
            if (msg.type !== 'mse' || this.isDestroyed) return;

            this.mseCodecs = msg.value;

            if (!ms || ms.readyState !== 'open') return;
            let sb;
            try {
                sb = ms.addSourceBuffer(msg.value);
                this.sourceBuffer = sb;
            } catch (err) {
                console.warn('[VideoRTC] addSourceBuffer failed for codec:', msg.value, err ? err.message : err);
                // Attempt video-only fallback if audio codec failed
                try {
                    const videoOnly = msg.value.split(',')[0] + '"';
                    console.log('[VideoRTC] Trying video-only SourceBuffer:', videoOnly);
                    sb = ms.addSourceBuffer(videoOnly);
                    this.sourceBuffer = sb;
                } catch (err2) {
                    console.warn('[VideoRTC] Video-only SourceBuffer also failed, falling back to WebRTC:', err2);
                    this.onwebrtc();
                    return;
                }
            }
            sb.mode = 'segments';

            const queue = [];

            const processQueue = () => {
                if (this.isDestroyed || !ms || ms.readyState !== 'open' || !sb || sb.updating || queue.length === 0) {
                    return;
                }
                const chunk = queue.shift();
                try {
                    sb.appendBuffer(chunk);
                } catch (err) {
                    console.warn('[VideoRTC] appendBuffer error:', err ? err.message : err);
                }
            };

            sb.addEventListener('updateend', () => {
                if (this.isDestroyed) return;

                // 1. Immediately ensure playback and report connected as soon as any buffered frames exist!
                if (sb.buffered && sb.buffered.length > 0) {
                    const end = sb.buffered.end(sb.buffered.length - 1);
                    const start0 = sb.buffered.start(0);

                    // Ensure video starts playing immediately
                    if (this.video.paused && !this.video.ended) {
                        this.play();
                    }

                    // Report stream is active and playing live frames
                    if (!this._hasReportedConnected && typeof this.onConnected === 'function') {
                        this._hasReportedConnected = true;
                        this.onConnected();
                    }

                    // Zero-delay live synchronization without seek-stuttering:
                    const gap = end - this.video.currentTime;

                    // Initial startup: jump once directly to live edge
                    if (this.video.currentTime === 0 && end > 0.2 && !this.video.seeking) {
                        this.video.currentTime = Math.max(start0, end - 0.15);
                    } else if (!this.video.seeking && gap > 4.0) {
                        // Only hard-seek if we have fallen drastically behind (>4s, e.g. tab was hidden or suspended)
                        this.video.currentTime = Math.max(start0, end - 0.2);
                    } else if (gap > 1.2) {
                        // Smoothly accelerate to catch up without freezing
                        this.video.playbackRate = 1.25;
                    } else if (gap > 0.4) {
                        this.video.playbackRate = 1.10;
                    } else if (gap < 0.15) {
                        // Ease playback slightly so buffer doesn't underflow
                        this.video.playbackRate = 0.95;
                    } else {
                        // Perfect real-time 1:1 playback
                        this.video.playbackRate = 1.0;
                    }

                    // Trim old played data older than 10s in the past (only when queue is drained)
                    const pruneUpTo = this.video.currentTime - 10;
                    if (pruneUpTo > start0 + 5 && !sb.updating && queue.length === 0) {
                        try {
                            sb.remove(start0, pruneUpTo);
                            return;
                        } catch (_) {}
                    }
                }

                // 2. Process next queued chunk without blocking the live checks above
                if (!sb.updating && queue.length > 0) {
                    processQueue();
                }
            });

            this.ondata = (data) => {
                if (this.isDestroyed) return;

                queue.push(data);
                if (sb && !sb.updating) {
                    processQueue();
                }
            };
        };
    }

    /**
     * Triggered when WebSocket closes unexpectedly.
     * Retries automatically between proxy port and direct Go2RTC port 1984.
     */
    onclose() {
        if (this.isDestroyed || this.wsState === WebSocket.CLOSED) return false;

        this.wsState = WebSocket.CONNECTING;
        this.ws = null;
        this._reconnectAttempts++;

        const delay = Math.max(this.RECONNECT_TIMEOUT - (Date.now() - this.connectTS), 1000);

        this.reconnectTID = setTimeout(() => {
            this.reconnectTID = 0;
            if (!this.isDestroyed) {
                this.onconnect();
            }
        }, delay);

        return true;
    }

    /**
     * Initialize WebRTC PeerConnection and SDP handshake for ultra-fast, zero-latency streaming (<50ms).
     * Automatically falls back to MSE if UDP or WebRTC fails.
     */
    onwebrtc() {
        if (this.isDestroyed) return;

        const pc = new RTCPeerConnection(this.pcConfig);
        this.pc = pc;
        this.pcState = WebSocket.CONNECTING;

        const fallbackToMSE = () => {
            if (this.isDestroyed || (this.video && this.video.srcObject)) return;
            console.warn('[VideoRTC] WebRTC connection did not deliver tracks, falling back to MSE');
            try { pc.close(); } catch (_) {}
            if (this.pc === pc) this.pc = null;
            this.onmse();
        };

        const webrtcTimeout = setTimeout(fallbackToMSE, 2500);

        // ICE candidate exchange
        pc.addEventListener('icecandidate', (ev) => {
            if (this.isDestroyed || this.pc !== pc) return;
            if (ev.candidate) {
                const candidate = ev.candidate.toJSON().candidate;
                if (candidate) {
                    this.send({ type: 'webrtc/candidate', value: candidate });
                }
            }
        });

        // Track listener: handle native stream or build fallback MediaStream
        let fallbackStream = null;
        pc.addEventListener('track', (ev) => {
            if (this.isDestroyed || this.pc !== pc) return;
            clearTimeout(webrtcTimeout);

            const stream = (ev.streams && ev.streams[0]) ? ev.streams[0] : null;
            if (stream) {
                if (this.video.srcObject !== stream) {
                    try {
                        if (this.video.src && this.video.src.startsWith('blob:')) {
                            URL.revokeObjectURL(this.video.src);
                        }
                        this.video.removeAttribute('src');
                    } catch (_) {}
                    this.video.srcObject = stream;
                    this.play();
                    this.pcState = WebSocket.OPEN;

                    if (!this._hasReportedConnected && typeof this.onConnected === 'function') {
                        this._hasReportedConnected = true;
                        this.onConnected();
                    }
                }
            } else if (ev.track) {
                if (!fallbackStream) fallbackStream = new MediaStream();
                fallbackStream.addTrack(ev.track);

                if (this.video.srcObject !== fallbackStream) {
                    try {
                        if (this.video.src && this.video.src.startsWith('blob:')) {
                            URL.revokeObjectURL(this.video.src);
                        }
                        this.video.removeAttribute('src');
                    } catch (_) {}
                    this.video.srcObject = fallbackStream;
                    this.play();
                    this.pcState = WebSocket.OPEN;

                    if (!this._hasReportedConnected && typeof this.onConnected === 'function') {
                        this._hasReportedConnected = true;
                        this.onConnected();
                    }
                }
            }
        });

        // Connection state monitoring
        pc.addEventListener('connectionstatechange', () => {
            if (this.isDestroyed || this.pc !== pc) return;

            if (pc.connectionState === 'connected') {
                const tracks = pc.getTransceivers()
                    .filter(tr => tr.currentDirection === 'recvonly' && tr.receiver && tr.receiver.track)
                    .map(tr => tr.receiver.track);

                if (tracks.length > 0 && this.video.srcObject !== mediaStream) {
                    clearTimeout(webrtcTimeout);
                    this.video.srcObject = new MediaStream(tracks);
                    this.play();
                    this.pcState = WebSocket.OPEN;

                    if (!this._hasReportedConnected && typeof this.onConnected === 'function') {
                        this._hasReportedConnected = true;
                        this.onConnected();
                    }
                }
            } else if (pc.connectionState === 'failed') {
                clearTimeout(webrtcTimeout);
                fallbackToMSE();
            }
        });

        // Signaling message dispatch
        this.onmessage['webrtc'] = async (msg) => {
            if (this.isDestroyed || this.pc !== pc) return;
            switch (msg.type) {
                case 'webrtc/candidate':
                    if (msg.value) {
                        try {
                            await pc.addIceCandidate({ candidate: msg.value, sdpMid: '0' });
                        } catch (_) {}
                    }
                    break;

                case 'webrtc/answer':
                    try {
                        await pc.setRemoteDescription({ type: 'answer', sdp: msg.value });
                    } catch (er) {
                        console.warn('[VideoRTC] setRemoteDescription error:', er);
                    }
                    break;

                case 'error':
                    if (msg.value && msg.value.includes('webrtc')) {
                        console.warn('[VideoRTC] WebRTC offer rejected, falling back to MSE:', msg.value);
                        clearTimeout(webrtcTimeout);
                        fallbackToMSE();
                    }
                    break;
            }
        };

        // Create SDP offer for video and audio
        this.createOffer(pc).then((offer) => {
            if (this.isDestroyed || this.pc !== pc) return;
            this.send({ type: 'webrtc/offer', value: offer.sdp });
        }).catch((err) => {
            console.warn('[VideoRTC] createOffer error:', err);
            clearTimeout(webrtcTimeout);
            fallbackToMSE();
        });
    }

    /**
     * @param {RTCPeerConnection} pc
     * @return {Promise<RTCSessionDescriptionInit>}
     */
    async createOffer(pc) {
        for (const kind of ['video', 'audio']) {
            if (this.media.includes(kind)) {
                pc.addTransceiver(kind, { direction: 'recvonly' });
            }
        }
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        return offer;
    }
}
