# homecheck安装与使用指南

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

config目录下新建**projectConfig.json**和**ruleConfig.json**，内容参考：[homecheck配置文件使用指南](homecheck配置文件使用指南.md)  
复制配置文件后修改
```
cp -r ./node_modules/homecheck/config .
```
projectConfig.json示例：

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

ruleConfig.json示例：
```
{
  "files": [
    "**/*.ets",
    "**/*.ts"
  ],
  "ignore": [
    "**/ohosTest/**/*",
    "**/node_modules/**/*",
    "**/build/**/*",
    "**/hvigorfile/**/*",
    "**/oh_modules/**/*",
    "**/.preview/**/*"
  ],
  "rules": {
  },
  "ruleSet": [
    "plugin:@ArkTS-eslint/all",
    "plugin:@performance/all",
    "plugin:@correctness/all"
  ],
  "overrides": [],
  "extRuleSet": []
}
```

## 运行

### 方式一：在代码里调用run接口

新建src目录并新建run.js文件，内容示例：

```
import { run } from 'homecheck';

run();
```

命令行启动，示例：

根目录下执行
```
node ./src/run.js --projectConfigPath=./config/projectConfig.json --configPath=./config/ruleConfig.json
```

### 方式二：调用homecheck的run文件

路径为：./node_modules/homecheck/src/run.js

命令行启动，示例：

根目录下执行
```
node ./node_modules/homecheck/src/run.js --projectConfigPath=./config/projectConfig.json --configPath=./config/ruleConfig.json
```