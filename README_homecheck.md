<<<<<<< HEAD
# homecheck

## 项目简介

该项目（homecheck）专为提升代码质量而设计，能高效识别代码缺陷并提出方案；其核心功能是对应用工程项目执行静态代码分析，评估代码在安全性、性能等方面上的表现，精准定位问题及其在代码中的位置。

## 目录

```
homecheck
├─config/                 # 项目配置
├─document/               # 项目文档
├─resources/              # 依赖库
├─src/
│　├─checker/             # 项目检测规则功能代码
│　├─codeFix/             # 修复
│　├─matcher/             # 匹配类型
│　├─model/               # 模块
│　├─utils/               # 公共接口
│　└─run.ts               # 项目入口
└─test/                   # 测试目录
```

## 项目主体流程

1.读取配置文件projectConfig.json和ruleConfig.json

2.使用**ArkAnalyzer**项目构建**sence**

3.根据配置文件参数，获取需要检测的文件

4.前处理

5.进行检测

6.后处理

## QuickStart

### 1.下载本项目

### 2.进入项目根目录，打开终端

```
cmd
```

### 3.安装依赖库

```
npm install
```

### 4.修改配置

详细配置请参考：[homecheck配置文件使用指南](document/user/homecheck配置文件使用指南.md)

**config\projectConfig.json**中修改项目配置
示例：

```
{
  "projectName": "TestProject", // 待检测工程的名字
  "projectPath": "D:\\arkProject",  // 待检测工程的路径
  "logPath": "./HomeCheck.log", // 日志输出路径
  "ohosSdkPath": "D:\\DevEco Studio\\sdk\\default\\openharmony\\ets", // ohossdk路径
  "hmsSdkPath": "D:\\DevEco Studio\\sdk\\default\\hms\\ets",  // hmssdk路径
  "sdkVersion": 14  // sdk版本
}
```

### 5.启动项目

注意修改projectConfig.json和ruleConfig.json文件路径

#### 5.1 命令行启动，示例：

根目录下执行
```
node -r ts-node/register ./src/run.ts  --projectConfigPath=./config/projectConfig.json --configPath=./config/ruleConfig.json
```

#### 5.2 vscode启动：

根目录新建.vscode目录，并新建launch.json文件，内容参考.vscode_sample\launch.json

点击左侧运行和调试按钮，点击启动程序，开始运行，运行结束查看HomeCheck.log
#### 5.3 webstorm启动：

## 新增规则

### 自定义规则
参考：[自定义规则开发指南](document/developer/ExtRule自定义规则开发指南.md)

### 检测规则
参考：[新增检测规则开发指南](document/developer/规则开发指南.md)

## api
参考：[api说明](document/api/globals.md)

## 打包

根目录下执行命令：

```
npm pack
```
产物，根目录下：

homecheck-1.0.0.tgz

## 安装与使用

参考：[homecheck安装与使用指南](document/user/homecheck安装与使用指南.md)

## HomeCheck附带工具使用指南

参考：[HomeCheck附带工具使用指南](document/user/HomeCheck附带工具使用指南.md)

### 日志

运行结果请查看根目录下的HomeCheck.log

## 代码上库
遵守openharmony-sig代码上库规范, 请参考：[代码风格编程规范](document/developer/代码风格编程规范.md)

操作方法请参考：[创建pr指南](document/developer/PR指南.md)

## Issues
提交Issues请参考：[Issues指南](document/developer/Issues指南.md)

## 添加自验证测试用例
自验证用例请参考：[单元测试用例开发指南](document/developer/单元测试用例开发指南.md)

## 相关仓

[ArkAnalyzer](https://gitcode.com/openharmony-sig/arkanalyzer)

## 欢迎加入homecheck社区开发讨论

![homecheck社区开发讨论](document/img/homecheck社区开发讨论.JPG)
=======
# Homecheck-Sec2025
>>>>>>> 8dedfe29006321cfa3f7c21040a4185cd00a5adb
