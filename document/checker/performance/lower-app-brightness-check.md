## 规则名

@performance/lower-app-brightness-check，在省电模式或深色模式下，应用程序应主动降低亮度。

## 规则来源

参考文档：[省电模式最佳实践](https://developer.huawei.com/consumer/cn/doc/best-practices/bpta-low-power-design-in-dark-mode#section1335695914514) 和
[深色模式最佳实践](https://developer.huawei.com/consumer/cn/doc/best-practices/bpta-low-power-design-in-dark-mode#section221914535123)

## 反例代码

```
onWindowStageCreate(windowStage: window.WindowStage) {
  // 判断当前是否为深色模式
  if (this.context?.config?.colorMode === ConfigurationConstant.ColorMode.COLOR_MODE_DARK) {
    let windowClass = windowStage.getMainWindowSync();
    try {
      // 未设置当前应用窗口亮度
      console.info('The application brightness has not been set.');
    } catch (exception) {
      console.error('Failed to set the brightness. Cause: ' + JSON.stringify(exception));
    }
  }
}
```

## 正例代码

```
onWindowStageCreate(windowStage: window.WindowStage) {
  // 判断当前是否为深色模式
  if (this.context?.config?.colorMode === ConfigurationConstant.ColorMode.COLOR_MODE_DARK) {
    let windowClass = windowStage.getMainWindowSync();
    try {
      // 设置当前应用窗口亮度
      windowClass.setWindowBrightness(0.2, (err) => {
        if (err.code) {
          console.error('Failed to set the brightness. Cause: ' + JSON.stringify(err));
          return;
        }
        console.info('Succeeded in setting the brightness.');
      });
    } catch (exception) {
      console.error('Failed to set the brightness. Cause: ' + JSON.stringify(exception));
    }
  }
}
```