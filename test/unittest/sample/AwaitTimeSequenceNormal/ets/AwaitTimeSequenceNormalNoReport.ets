import { camera } from '@kit.CameraKit';

async function releaseCaptureSession(session: camera.Session) {
  await session.release();
}
