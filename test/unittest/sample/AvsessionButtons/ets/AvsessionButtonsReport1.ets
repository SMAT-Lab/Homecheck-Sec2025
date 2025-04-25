import { BusinessError } from '@kit.BasicServicesKit';
import { avSession } from '@kit.AVSessionKit';
import { metadata, playbackState } from './utils/AvSessionMetadata';

let tag = "createNewSession";
let context: Context = getContext(this);
let currentAVSession: avSession.AVSession;

// 告警
avSession.createAVSession(context, tag, "audio").then((data: avSession.AVSession) => {
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
  data.on("play", () => {

  });
  data.on("pause", () => {

  });
  data.on("stop", () => {

  });
  data.on("playPrevious", () => {

  });
  console.info(`CreateAVSession : SUCCESS : sessionId = ${data.sessionId}`);
}).catch((err: BusinessError) => {
  console.info(`CreateAVSession BusinessError: code: ${err.code}, message: ${err.message}`);
})

// 告警
avSession.createAVSession(context, tag, "audio").then((data: avSession.AVSession) => {
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
  currentAVSession = data;
  console.info(`CreateAVSession : SUCCESS : sessionId = ${data.sessionId}`);
}).catch((err: BusinessError) => {
  console.info(`CreateAVSession BusinessError: code: ${err.code}, message: ${err.message}`);
})

export function avSessionButton() {
  currentAVSession.on("play", () => {

  });
  currentAVSession.on("pause", () => {

  });
  currentAVSession.on("stop", () => {

  });
  currentAVSession.on("playPrevious", () => {

  });
}

// 告警
avSession.createAVSession(context, tag, "audio").then((data: avSession.AVSession) => {
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
  registerSessionListener(data);
  console.info(`CreateAVSession : SUCCESS : sessionId = ${data.sessionId}`);
}).catch((err: BusinessError) => {
  console.info(`CreateAVSession BusinessError: code: ${err.code}, message: ${err.message}`);
})

function registerSessionListener(data: avSession.AVSession) {
  data.on("play", () => {

  });
  data.on("pause", () => {

  });
  data.on("stop", () => {

  });
  data.on("playPrevious", () => {

  });
}