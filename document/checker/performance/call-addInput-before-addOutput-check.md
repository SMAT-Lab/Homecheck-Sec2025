## 规则名

@performance/call-addInput-before-addOutput-check，CameraSession中，addOutput前需要先addInput。

## 规则来源

参考文档：[最佳实践](https://developer.huawei.com/consumer/cn/doc/best-practices/bpta-stability-coding-standard-api#section178871719112717)

## 反例代码

```
previewOutput = cameraManager.createPreviewOutput(profile, surfaceId);
cameraInput = cameraManager.createCameraInput(camera);
await cameraInput.open();
session.beginConfig();
session.addOutput(previewOutput); // CameraSession中，addOutput前需要先addInput。
session.addInput(cameraInput);
```

## 正例代码

```
previewOutput = cameraManager.createPreviewOutput(profile, surfaceId);
cameraInput = cameraManager.createCameraInput(camera);
await cameraInput.open();
session.beginConfig();
session.addInput(cameraInput);
session.addOutput(previewOutput); // CameraSession中，addOutput前需要先addInput。
```