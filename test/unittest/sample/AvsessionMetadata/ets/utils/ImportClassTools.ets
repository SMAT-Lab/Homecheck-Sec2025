import { avSession } from "@kit.AVSessionKit";

export class AvSessionMetadata {
  static metadata: avSession.AVMetadata = {
    assetId: "121278",
    // Title
    title: "lose yourself",
    artist: "Eminem",
    author: "ST",
    album: "Slim shady",
    writer: "",
    composer: "ST",
    // Duration
    duration: 2222,
    mediaImage: "https://www.example.com/example.jpg",
    subtitle: "8 Mile",
    description: "Rap",
    lyric: "Lyrics in LRC format",
    previousAssetId: "121277",
    nextAssetId: "121279"
  };
  static playbackState: avSession.AVPlaybackState = {
    speed: 1.0,
    // Playback position
    position: { elapsedTime: 10, updateTime: (new Date()).getTime() },
    bufferedTime: 1000,
    loopMode: avSession.LoopMode.LOOP_MODE_SINGLE,
    isFavorite: true
  };
}