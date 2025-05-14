# homecheck配置文件使用指南

## config\projectConfig.json配置文件

### 示例
```
{
  "projectName": "TestProject",
  "projectPath": "D:\\arkProject",
  "logPath": "./HomeCheck.log",
  "ohosSdkPath": "D:\\DevEco Studio\\sdk\\default\\openharmony\\ets",
  "hmsSdkPath": "D:\\DevEco Studio\\sdk\\default\\hms\\ets",
  "checkPath": "",
  "sdkVersion": 14,
  "fix": "false",
  "npmPath": "",
  "npmInstallDir": "./",
  "reportDir": "./report",
  "arkCheckPath": "./",
  "product": "default",
  "homecheck_log_level": "info",
  "arkanalyzer_log_level": "error",
  "sdksThirdParty": []
}
```

### 字段说明
projectName：待检测工程的名字

projectPath：待检测工程的路径

logPath：日志输出路径

ohosSdkPath：ohossdk路径，比如DevEco Studio安装目录下的sdk\default\openharmony\ets，请使用绝对路径

hmsSdkPath：hmssdk路径，比如DevEco Studio安装目录下的sdk\default\hms\ets，请使用绝对路径

checkPath：解析指定的文件

sdkVersion：sdk版本

fix：是否修复

npmPath：自定义规则npm路径

npmInstallDir：自定义规则安装路径

reportDir：homecheck附带工具的报告目录

arkCheckPath：homecheck工程的目录

product：当前激活的产品名称

homecheck_log_level：homecheck日志级别，支持debug、info、warn、error、trace，默认为info

arkanalyzer_log_level：arkanalyzer日志级别,支持debug、info、warn、error、trace，默认为error

sdksThirdParty：sdk三方库，name：库名称，path:库路径，moduleName：模块名称，示例如下：
```
"sdksThirdParty": [
    {
      "name": "thirdParty",
      "path": "./resources/thirdPartyModules",
      "moduleName": ""
    }
  ]
```

## config\ruleConfig.json配置文件

### 示例

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
    "@performance/foreach-args-check": 3
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

### 字段说明

参考：[配置代码检查规则](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V14/ide-code-linter-V14#section1782903483817)

files：待检测文件类型

ignore：过滤文件

rules：可以基于ruleSet配置的规则集，新增额外规则项

ruleSet：规则集

overrides：定制化检查的规则

extRuleSet：自定义规则,参考[自定义规则开发指南](../developer/ExtRule自定义规则开发指南.md)