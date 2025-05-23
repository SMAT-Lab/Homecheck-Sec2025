import { camera } from '@kit.CameraKit';

async function releaseCaptureSession(session: camera.Session) {
  session.release();
}
