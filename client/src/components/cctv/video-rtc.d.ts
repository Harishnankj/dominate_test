export class VideoRTC {
  constructor(video: HTMLVideoElement);
  video: HTMLVideoElement;
  mode: string;
  media: string;
  background: boolean;
  pcConfig: RTCConfiguration;
  wsState: number;
  pcState: number;
  ws: WebSocket | null;
  wsURL: string | URL;
  pc: RTCPeerConnection | null;
  connectTS: number;
  mseCodecs: string;
  src: string | URL;
  onConnected: (() => void) | null;
  play(): void;
  send(value: any): void;
  onconnect(): boolean;
  ondisconnect(preserveVideo?: boolean): void;
  destroy(preserveVideo?: boolean): void;
  oninit(): void;
  onopen(): string[];
  onclose(): boolean;
}
