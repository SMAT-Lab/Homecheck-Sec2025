## 规则名

@performance/camera-input-open-check，CameraSession中，addInput接口的入参必须是一个已经调用了open的CameraInput。

## 规则来源

参考文档：[文档链接](https://developer.huawei.com/consumer/cn/doc/best-practices/bpta-stability-coding-standard-api#section178871719112717)

## 反例代码

```
cameraInput = cameraManager.createCameraInput(camera);
session.beginConfig();
session.addInput(cameraInput); // 接口抛出异常
```

## 正例代码

```
cameraInput = cameraManager.createCameraInput(camera);
await cameraInput.open(); // 确保 cameraInput 已经调用了 open 方法
session.beginConfig();
session.addInput(cameraInput);
```