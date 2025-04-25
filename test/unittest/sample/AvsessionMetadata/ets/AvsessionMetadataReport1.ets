import { avSession } from '@kit.AVSessionKit';
import { BusinessError } from '@kit.BasicServicesKit';

let tag = "createNewSession";
let context: Context = getContext(this);

let metadata: avSession.AVMetadata = {
  assetId: "121278",
  // Title
  title: "lose yourself",
  artist: "Eminem",
  album: "Slim shady",
  writer: "",
  composer: "ST",
  // Duration
  duration: 2222,
  mediaImage: "https://www.example.com/example.jpg",
  description: "Rap",
  lyric: "Lyrics in LRC format",
  previousAssetId: "121277",
  nextAssetId: "121279"
};

let playbackState: avSession.AVPlaybackState = {
  // Playing State
  state: avSession.PlaybackState.PLAYBACK_STATE_PLAY,
  speed: 1.0,
  // Playback position
  position: { elapsedTime: 10, updateTime: (new Date()).getTime() },
  bufferedTime: 1000,
  loopMode: avSession.LoopMode.LOOP_MODE_SINGLE,
  isFavorite: true
};

// warning
avSession.createAVSession(context, tag, "audio", (err: BusinessError, data: avSession.AVSession) => {
  if (err) {
    console.error(`CreateAVSession BusinessError: code: ${err.code}, message: ${err.message}`);
  } else {
    data.setAVMetadata(metadata, (err: BusinessError) => {
      if (err) {
        console.error(`SetAVMetadata BusinessError: code: ${err.code}, message: ${err.message}`);
      } else {
        console.info(`SetAVMetadata successfully`);
      }
    });
    data.setAVPlaybackState(playbackState).then(() => {
      console.info('SetAVPlaybackState successfully');
    }).catch((err: BusinessError) => {
      console.error(`SetAVPlaybackState BusinessError: code: ${err.code}, message: ${err.message}`);
    });
    // Process the play command
    data.on('play', () => {

    });
    // Process the pause command
    data.on('pause', () => {

    });
    // Process the stop command
    data.on('stop', () => {

    });
    // Process the play-next command
    data.on('playNext', () => {

    });
    // Process the play-previous command
    data.on('playPrevious', () => {

    });
  }
});