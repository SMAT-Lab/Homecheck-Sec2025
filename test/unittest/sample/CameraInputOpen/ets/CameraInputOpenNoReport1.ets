import { BusinessError } from '@kit.BasicServicesKit';
import { camera } from '@kit.CameraKit';

function beginConfig(session: camera.Session, cameraInput: camera.CameraInput): void {
  try {
    cameraInput.open().then(() => {
      console.info('Promise returned with camera opened.');
    }).catch((error: BusinessError) => {
      console.error(`Failed to open the camera, error code: ${error.code}.`);
    });
    session.beginConfig();
    session.addInput(cameraInput);
  } catch (error) {
    // 失败返回错误码error.code并处理。
    let err = error as BusinessError;
    console.error(`The beginConfig call failed. error code: ${err.code}`);
  }
}

