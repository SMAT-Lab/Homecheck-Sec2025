# homecheck工具使用

## 安装

工程根目录下执行命令：

```
npm install homecheck
```

安装成功示例：

```
$ npm install homecheck

added 3 packages in 9s

39 packages are looking for funding
  run `npm fund` for details
```
node_modules目录下新增文件夹homecheck

## 配置文件

新建config目录并新建**projectConfig.json**，内容参考:[homecheck配置文件使用指南](homecheck配置文件使用指南.md)

示例：

```
{
  "projectName": "TestProject",
  "projectPath": "/path/to/project",
  "logPath": "./HomeCheck.log",
  "ohosSdkPath": "/path/to/ohosSdk",
  "hmsSdkPath": "/path/to/hmsSdk",
  "arkCheckPath": "/path/to/homecheck"
}
```

## 工具支持

当前homecheck支持以下工具：

### 1. 依赖图生成（beta）
生成模块依赖关系图和文件依赖关系图，包含json格式和dot格式。

## 运行

参考[启动项目](../../README.md#5启动项目)

1. 命令行启动，示例：

根目录下执行
```
node --max-old-space-size=16384 ./node_modules/homecheck/lib/tools/toolRun.js --projectConfigPath=./config/projectConfig.json --depGraphOutputDir=./
```
其中，参数**projectConfigPath**为上文中**projectConfig.json**所在路径，参数**depGraphOutputDir**为生成结果存储目录（需使用已有目录，默认为当前目录），如果目标分析工程代码量较大，建议内存限制不低于16G，即**max-old-space-size**的值不低于16384。

## 注意事项

所有路径相关配置或命令行参数尽量避免使用中文，以避免运行失败或运行成功无结果生成。