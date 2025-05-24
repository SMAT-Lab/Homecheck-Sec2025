import { avSession } from '@kit.AVSessionKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { AvSessionMetadata } from './utils/ImportClassTools';

export function currentAVSession() {
  let tag = "createNewSession";
  let context: Context = getContext(AvSessionMetadata);
  // warning
  avSession.createAVSession(context, tag, "audio", (err: BusinessError, data: avSession.AVSession) => {
    if (err) {
      console.error(`CreateAVSession BusinessError: code: ${err.code}, message: ${err.message}`);
    } else {
      data.setAVMetadata(AvSessionMetadata.metadata, (err: BusinessError) => {
        if (err) {
          console.error(`SetAVMetadata BusinessError: code: ${err.code}, message: ${err.message}`);
        } else {
          console.info(`SetAVMetadata successfully`);
        }
      });
      data.setAVPlaybackState(AvSessionMetadata.playbackState).then(() => {
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
}





