import { avSession } from "@kit.AVSessionKit";

export let metadata: avSession.AVMetadata = {
  assetId: "121278",
  // Title
  title: "lose yourself",
  artist: "Eminem",
  // Lyrics generator
  author: "ST",
  album: "Slim shady",
  writer: "",
  composer: "ST",
  // Subtitle
  subtitle: "8 Mile",
  // Duration
  duration: 2222,
  mediaImage: "https://www.example.com/example.jpg",
  description: "Rap",
  lyric: "Lyrics in LRC format",
  previousAssetId: "121277",
  nextAssetId: "121279"
};

export let playbackState: avSession.AVPlaybackState = {
  // Playing State
  state: avSession.PlaybackState.PLAYBACK_STATE_PLAY,
  speed: 1.0,
  // Playback position
  position: { elapsedTime: 10, updateTime: (new Date()).getTime() },
  bufferedTime: 1000,
  loopMode: avSession.LoopMode.LOOP_MODE_SINGLE,
  isFavorite: true
};