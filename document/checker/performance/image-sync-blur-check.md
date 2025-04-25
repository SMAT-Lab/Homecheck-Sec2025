## 规则名

@performance/image-sync-blur-check，静态图片，使用 AdaptiveColor.DEFAULT 方式取色。

## 规则来源

参考文档：[最佳实践](https://developer.huawei.com/consumer/cn/doc/best-practices/bpta-stability-coding-standard-api#section85943212152)

## 反例代码

```
build() {
  Column() {
    Text('Thin Material').fontSize(30).fontColor(0xCCCCCC)
    Image($r('app.media.app_icon'))
      .width(300)
      .height(350)
      .foregroundBlurStyle(BlurStyle.Thin,
        { colorMode: ThemeColorMode.LIGHT, adaptiveColor: AdaptiveColor.AVERAGE, scale: 1.0 })
  }
  .height('100%')
  .width('100%')
}  
```

## 正例代码

```
build() {
  Column() {
    Text('Thin Material').fontSize(30).fontColor(0xCCCCCC)
    Image($r('app.media.app_icon'))
      .width(300)
      .height(350)
      .foregroundBlurStyle(BlurStyle.Thin,
        { colorMode: ThemeColorMode.LIGHT, adaptiveColor: AdaptiveColor.DEFAULT, scale: 1.0 })
  }
  .height('100%')
  .width('100%')
}  
```