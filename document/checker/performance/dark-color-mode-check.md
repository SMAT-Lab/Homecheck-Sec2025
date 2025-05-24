## 规则名

@performance/dark-color-mode-check，在项目的resources文件下，创建深色模式的Dark资源文件夹。

## 规则来源

参考文档：[最佳实践](https://developer.huawei.com/consumer/cn/doc/best-practices/bpta-low-power-design-in-dark-mode#section221914535123)

## 反例代码

```
src
├── main  
│   ├── ets    
│   └── resources
│        └── base          
├── mock
│   └── mock-config.json5  
```

## 正例代码

```
src
├── main  
│   ├── ets    
│   └── resources
│        ├── dark    
│        └── base          
├── mock
│   └── mock-config.json5
```