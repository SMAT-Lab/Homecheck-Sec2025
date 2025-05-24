import { BusinessError } from '@kit.BasicServicesKit';
import { camera } from '@kit.CameraKit';

function beginConfig(session: camera.Session, cameraInput: camera.CameraInput): void {
  try {
    openCameraInput(cameraInput);
    session.beginConfig();
    session.addInput(cameraInput);
  } catch (error) {
    // 失败返回错误码error.code并处理。
    let err = error as BusinessError;
    console.error(`The beginConfig call failed. error code: ${err.code}`);
  }
}

function openCameraInput(cameraInput: camera.CameraInput): void {

}