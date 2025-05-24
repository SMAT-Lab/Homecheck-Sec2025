import { avSession } from '@kit.AVSessionKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { metadata, playbackState } from './utils/AvSessionMetadata';

let tag = "createNewSession";
let context: Context = getContext(this);
let currentAVSession: avSession.AVSession;

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
  data.on("playNext", () => {

  });
}

// 告警
export async function CreateAVSession1() {
  currentAVSession = await avSession.createAVSession(context, tag, "audio");
}

export function avSessionButton() {
  currentAVSession.setAVMetadata(metadata, (err: BusinessError) => {
    if (err) {
      console.error(`SetAVMetadata BusinessError: code: ${err.code}, message: ${err.message}`);
    } else {
      console.info(`SetAVMetadata successfully`);
    }
  });
  currentAVSession.setAVPlaybackState(playbackState).then(() => {
    console.info('SetAVPlaybackState successfully');
  }).catch((err: BusinessError) => {
    console.error(`SetAVPlaybackState BusinessError: code: ${err.code}, message: ${err.message}`);
  });
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
  data.on("playNext", () => {

  });
}