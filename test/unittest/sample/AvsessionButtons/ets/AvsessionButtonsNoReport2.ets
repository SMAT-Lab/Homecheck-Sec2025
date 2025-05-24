import { BusinessError } from '@kit.BasicServicesKit';
import { avSession } from '@kit.AVSessionKit';
import { metadata, playbackState } from './utils/AvSessionMetadata';

let tag = "createNewSession";
let context: Context = getContext(this);
let currentAVSession: avSession.AVSession;

// 告警
avSession.createAVSession(context, tag, "audio", (err: BusinessError, data: avSession.AVSession) => {
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
  if (err) {
    console.error(`CreateAVSession BusinessError: code: ${err.code}, message: ${err.message}`);
  } else {
    data.on("play", () => {

    });
    data.on("pause", () => {

    });
    data.on("stop", () => {

    });
    data.on("playPrevious", () => {

    });
    data.on("playNext", () => {

    });
    console.info(`CreateAVSession : SUCCESS : sessionId = ${data.sessionId}`);
  }
})

// 告警
avSession.createAVSession(context, tag, "audio", (err: BusinessError, data: avSession.AVSession) => {
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
  if (err) {
    console.error(`CreateAVSession BusinessError: code: ${err.code}, message: ${err.message}`);
  } else {
    currentAVSession = data;
    console.info(`CreateAVSession : SUCCESS : sessionId = ${data.sessionId}`);
  }
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
  currentAVSession.on("playNext", () => {

  });
}

// 告警
avSession.createAVSession(context, tag, "audio", (err: BusinessError, data: avSession.AVSession) => {
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
  if (err) {
    console.error(`CreateAVSession BusinessError: code: ${err.code}, message: ${err.message}`);
  } else {
    registerSessionListener(data);
    console.info(`CreateAVSession : SUCCESS : sessionId = ${data.sessionId}`);
  }
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
  data.on("playNext", () => {

  });
}