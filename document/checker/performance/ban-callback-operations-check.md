## 规则名

@performance/ban-callback-operations-check，回调on('xxx')接口中，禁止添加（调用on）或者移除（调用off）回调操作。

## 规则来源

参考文档：[最佳实践](https://developer.huawei.com/consumer/cn/doc/best-practices/bpta-stability-coding-standard-api#section178871719112717)

## 反例代码

```
function callback() {
  cameraManager.off('cameraStatus');
}
cameraManager.on('cameraStatus', callback);
```

## 正例代码

```
function callback() {
  console.info('Not added (by calling "on") or removed (by calling "off")');
}
cameraManager.on('cameraStatus', callback);
```