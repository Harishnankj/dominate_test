/**
 * VideoRTC - Pure JavaScript WebRTC Client for Go2RTC.
 * Ultra-low-latency (<100ms) WebRTC streaming player with graceful teardown and instant reconnect.
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
        this.RECONNECT_TIMEOUT = 10000;

        /** Supported streaming modes: 'webrtc' prioritized for zero-latency */
        this.mode = 'webrtc';

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
        this.onConnected = null;
        this.isDestroyed = false;

        this.oninit();
    }

    oninit() {
        if (!this.video) return;

        this.video.playsInline = true;
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
            const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
            url = `${wsProto}//${location.host}${url}`;
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
        const prom = this.video.play();
        if (prom && typeof prom.catch === 'function') {
            prom.catch(() => {
                if (!this.video.muted) {
                    this.video.muted = true;
                    this.video.play().catch(() => {});
                }
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

        if (this.ws || this.pc) {
            this.ondisconnect(true);
        }

        this.wsState = WebSocket.CONNECTING;
        this.connectTS = Date.now();

        try {
            console.log('[VideoRTC] Connecting WebSocket to:', this.wsURL);
            const ws = new WebSocket(this.wsURL);
            this.ws = ws;

            ws.binaryType = 'arraybuffer';
            ws.onopen = () => {
                if (this.isDestroyed || this.ws !== ws) return;
                this.onopen();
            };
            ws.onclose = () => {
                if (this.isDestroyed || this.ws !== ws) return;
                this.onclose();
            };
            ws.onerror = (err) => {
                if (this.isDestroyed || this.ws !== ws) return;
                console.warn('[VideoRTC] WS connection error:', err);
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
     * @param {boolean} [preserveVideo=false] - Keep previous video frame visible until new stream connects
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

        if (this.video && !preserveVideo) {
            try {
                this.video.pause();
                this.video.removeAttribute('src');
                this.video.srcObject = null;
            } catch (_) {}
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
     * Launches WebRTC peer connection.
     */
    onopen() {
        if (this.isDestroyed) return;
        this.wsState = WebSocket.OPEN;
        console.log('[VideoRTC] WS opened for:', this.wsURL);

        if (this.mode.includes('webrtc') && 'RTCPeerConnection' in window) {
            this.onwebrtc();
        } else {
            console.warn('[VideoRTC] RTCPeerConnection not supported');
        }
    }

    /**
     * Triggered when WebSocket closes unexpectedly.
     */
    onclose() {
        if (this.isDestroyed || this.wsState === WebSocket.CLOSED) return false;

        this.wsState = WebSocket.CONNECTING;
        this.ws = null;

        // Auto-reconnect with minimum 1.5s delay to avoid hammering server
        const delay = Math.max(this.RECONNECT_TIMEOUT - (Date.now() - this.connectTS), 1500);

        this.reconnectTID = setTimeout(() => {
            this.reconnectTID = 0;
            if (!this.isDestroyed && this.pcState !== WebSocket.OPEN) {
                this.onconnect();
            }
        }, delay);

        return true;
    }

    /**
     * Initialize WebRTC PeerConnection and SDP handshake.
     */
    onwebrtc() {
        if (this.isDestroyed) return;

        const pc = new RTCPeerConnection(this.pcConfig);
        this.pc = pc;
        this.pcState = WebSocket.CONNECTING;

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

        // Track listener: build live MediaStream
        const mediaStream = new MediaStream();
        pc.addEventListener('track', (ev) => {
            if (this.isDestroyed || this.pc !== pc) return;
            if (ev.track) {
                mediaStream.addTrack(ev.track);

                // Ensure clean HTML5 video element binding
                if (this.video.srcObject !== mediaStream) {
                    try {
                        this.video.removeAttribute('src');
                    } catch (_) {}
                    this.video.srcObject = mediaStream;
                }

                this.play();
                this.pcState = WebSocket.OPEN;

                if (typeof this.onConnected === 'function') {
                    this.onConnected();
                }
            }
        });

        // Connection state monitoring
        pc.addEventListener('connectionstatechange', () => {
            if (this.isDestroyed || this.pc !== pc) return;
            console.log('[VideoRTC] WebRTC connectionState:', pc.connectionState);

            if (pc.connectionState === 'connected') {
                const tracks = pc.getTransceivers()
                    .filter(tr => tr.currentDirection === 'recvonly' && tr.receiver && tr.receiver.track)
                    .map(tr => tr.receiver.track);

                if (tracks.length > 0 && this.video.srcObject !== mediaStream) {
                    this.video.srcObject = new MediaStream(tracks);
                }
                this.play();
                this.pcState = WebSocket.OPEN;

                if (typeof this.onConnected === 'function') {
                    this.onConnected();
                }
            } else if (pc.connectionState === 'failed') {
                console.warn('[VideoRTC] WebRTC connection failed, reconnecting...');
                try { pc.close(); } catch (_) {}
                this.pcState = WebSocket.CLOSED;
                this.pc = null;
                if (!this.isDestroyed) {
                    this.onconnect();
                }
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
                    if (msg.value && msg.value.includes('webrtc/offer')) {
                        console.warn('[VideoRTC] Offer rejected:', msg.value);
                        try { pc.close(); } catch (_) {}
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
