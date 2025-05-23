import { avSession } from '@kit.AVSessionKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { metadata, playbackState } from './utils/AvSessionMetadata';

let tag = "createNewSession";
let context: Context = getContext(this);
let currentAVSession1: avSession.AVSession;

export async function CreateAVSession() {
  let data = await avSession.createAVSession(context, tag, "audio");
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
}

// 告警
export async function CreateAVSession1() {
  currentAVSession1 = await avSession.createAVSession(context, tag, "audio");
}

export function avSessionButton() {
  currentAVSession1.setAVMetadata(metadata, (err: BusinessError) => {
    if (err) {
      console.error(`SetAVMetadata BusinessError: code: ${err.code}, message: ${err.message}`);
    } else {
      console.info(`SetAVMetadata successfully`);
    }
  });
  currentAVSession1.setAVPlaybackState(playbackState).then(() => {
    console.info('SetAVPlaybackState successfully');
  }).catch((err: BusinessError) => {
    console.error(`SetAVPlaybackState BusinessError: code: ${err.code}, message: ${err.message}`);
  });
  currentAVSession1.on("play", () => {

  });
  currentAVSession1.on("pause", () => {

  });
  currentAVSession1.on("stop", () => {

  });
  currentAVSession1.on("playPrevious", () => {

  });
}

// 告警
export async function CreateAVSession2() {
  let data = await avSession.createAVSession(context, tag, "audio");
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
}

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