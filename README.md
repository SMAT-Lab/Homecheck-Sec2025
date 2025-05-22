# Homecheck-Sec2025

## 总体介绍

Homecheck是基于ArkAnalyzer实现的鸿蒙应用代码规范扫描工具，内部实现了多种检测规则，每一条规则对应一个checker。我们需要做的就是总结出几条代码安全规则，基于Homecheck的框架、编写安全规则检测的checker，同时给出含有相应安全问题的代码示例以供测试。

## 目录结构说明

```
Homecheck-Sec2025
|---.vscode_sample
|---|---launch.json //vscode调试配置文件 
|---sample //存放含有安全漏洞的被检测代码示例
|---|---TemplateSample //示例模板
|---|---|---Issue1
|---|---|---|---projectConfig.json //homecheck项目配置文件
|---|---|---|---ruleConfig.json //homecheck规则配置文件
|---|---|---|---sample1.ts //含有安全问题1的代码示例
|---|---|---Issue2
|---|---|---|---projectConfig.json //homecheck项目配置文件
|---|---|---|---ruleConfig.json //homecheck规则配置文件
|---|---|---|---sample2.ts //含有安全问题2的代码示例
|---|---Sample19241042 //建一个自己的文件夹
|---|---|---Issue1 //每一个安全问题一个Issue
|---|---|---|---projectConfig.json
|---|---|---|---ruleConfig.json
|---|---|---|---sample1.ts //问题代码示例
|---src
|---|---checker //存放基于ArkAnalyzer实现的针对sample中的样例的安全漏洞检测器
|---|---|---SoftwareSecurity25
|---|---|---|---TemplateChecker.ts  //Checker模板
|---|---|---|---Checker19241042  //每人建一个自己的目录
|---|---|---|---|---CommandExecutionCheck.ts  //规则示例，每个规则建一个单独的checker文件
|---|---utils
|---|---|---common
|---|---|---|---CheckerIndex.ts //规则列表 注册新规则用
|---test
|---|---SoftwareSecurity25 //测试文件 批量运行一个人的全部规则 最后我通过这个评测
|---|---|---TemplateTest.ts //模板文件
|---|---|---Test19241042.ts //自己创一个 参考样例 改成自己的路径
|---ruleSet.json //规则集 注册新规则用
|---README.md
```

未做说明的文件可以理解为本次作业暂不涉及，有兴趣可以参考[Homecheck相关文档](https://gitcode.com/openharmony-sig/homecheck)

## 样例运行

### 前置：SDK配置

由于部分规则可能涉及SDK中API的相关信息，故需要在projectConfig.json文件中为Homecheck配置鸿蒙SDK的路径，供ArkAnalyzer分析。（也就是小作业中涉及的那些.d.ts文件）

正常来讲需要大家安装DevEco Studio(鸿蒙应用开发用的IDE)，并从中拿到SDK文件，但是为了方便我直接把SDK文件给大家，但是SDK的文件太大了我不放仓库里了，我给大家传云盘了，有需要的同学可以从这里拿：

https://bhpan.buaa.edu.cn/link/AAE5BECB39B8534C65A587AD9211A965F2

对于已经安装了DevEco Studio的同学，可以直接在DevEco Studio安装目录下获取，例如若你的DevEco Studio安装在D:/DevEco Studio，则projectConfig.json中按如下配置：

``` Json
  "ohosSdkPath": "D:/DevEco Studio/sdk/default/openharmony/ets",
  "hmsSdkPath": "D:/DevEco Studio/sdk/default/hms/ets",
```

无论通过以上哪种方式获取的SDK，推荐大家将自己的SDK文件放在./resources/sdk下(resources目录已被我ignore)，所有的projectConfig.json文件中统一按如下所示相对路径配置，这样便于我们最后测试大家的代码。

``` Json
  "ohosSdkPath": "./resources/sdk/openharmony/ets",
  "hmsSdkPath": "./resources/sdk/hms/ets",
```

### 运行示例
```
npm install
ts-node ./test/SoftwareSecurity25/Test19241042.ts
```

控制台输出

```
Running test for: Issue1
Test finished for: Issue1
All tests completed.
```

日志HomeCheck.log输出

```
[INFO] [30588] [HomeCheck] - [ConfigUtils] Checking started.
[INFO] [30588] [HomeCheck] - [CheckEntry] File count: 1
[INFO] [30588] [HomeCheck] - [CheckEntry] Build sceneConfig completed.
[INFO] [30588] [HomeCheck] - [CheckEntry] Build scene completed.
[INFO] [30588] [HomeCheck] - [CheckEntry] Infer types completed.
[INFO] [30588] [HomeCheck] - [CheckEntry] Build scope completed.
[INFO] [30588] [HomeCheck] - [ConfigUtils] The npmPath:npm
[INFO] [30588] [HomeCheck] - [ConfigUtils] The npmInstallDir:./
[INFO] [30588] [HomeCheck] - [Message] ===== progress: 100% ======
[INFO] [30588] [HomeCheck] - [CheckEntry] 1 issues from checker - @software-sec/checker19241042/command-execution-check
[INFO] [30588] [HomeCheck] - [Main] Checking completed.
[INFO] [30588] [HomeCheck] - [Main] HomeCheck took: 2.276 s.
```

检测报告report/issuesReport.json输出

``` Json
[
  {
    "projectName": "TestProject",
    "projectPath": "./sample/Sample19241042/Issue1",
    "issues": [
      {
        "filePath": "D:\\File\\2025Spring\\软件安全基础2025\\BigHomework\\Homecheck-Sec2025\\sample\\Sample19241042\\Issue1\\sample1.ts",
        "messages": [
          {
            "line": 5,
            "column": 4,
            "severity": "WARN",
            "message": "Detects unsafe command execution via exec() calls.",
            "rule": "@software-sec/checker19241042/command-execution-check"
          }
        ]
      }
    ]
  }
]
```

### VSCode调试

把./.vscode_sample目录复制一份并重命名为.vscode，按需修改要执行的文件，通过VSCode左边Run and Debug运行，可正常添加断点并生成调试信息。

## 需要做的

### 添加含有安全漏洞的代码样例及配置文件

在./sample下建一个自己的文件夹，存放含有安全漏洞的被检测代码示例，文件夹命名：Sample学号，例：Sample19241042，该文件夹下每一种安全漏洞作为一个单独的项目，创建一个独立的文件夹，写好projectConfig.json和ruleConfig.json（参考模板，注意路径，ruleConfig.json中需要配置该Issue对应的检测规则），对于文件级规则在sampleX.ts中写含有第X种安全漏洞的被检测代码示例，对于项目级规则，整个IssueX为包含安全漏洞的项目示例。

### 注册规则
1. 在./ruleSet.json最后添加一条自己的规则，命名`@software-sec/checker学号/规则名-check`。

``` Json
  "plugin:@software-sec/all": {
    "@software-sec/checker19241042/command-execution-check": 1
  }
```

冒号后面的值代表规则的级别，按照如下在src/model/Rule.ts中给出的标准自己定义即可。

``` Typescript
export enum ALERT_LEVEL {
    OFF = 0,
    WARN = 1,
    ERROR = 2,
    SUGGESTION = 3,
}
```

注：这个文件要一百号人一起修改，请注意代码规范和git使用规范，我相信一个规则加一行这种事情是不会有问题的。

2. 在./src/utils/common/CheckerIndex.ts中的fileRules(文件级规则)或projectRules(项目级规则)最后添加一条自己的规则，命名同上。

``` Typescript
export const fileRules = {
    //software-security2025 start
    "@software-sec/checker19241042/command-execution-check":CommandExecutionCheck
    //software-security2025 end
}
```

冒号后面是checker文件导出的规则检查类。

注：这个文件也要一百号人一起修改，请注意代码规范和git使用规范，我相信一个规则加一行这种事情是不会有问题的。

### 实现Checker并报告问题
1. 在./src/checker/SoftwareSecurity25下建一个自己的Checker目录，文件夹命名：Checker学号，例：Checker19241042。

2. 每一条规则新建一个checker文件，命名：规则名Check.ts，例：CommandExecutionCheck.ts（参考模板TemplateChecker.ts）。

3. 实现Checker，针对sample下的每种含有安全漏洞的问题代码实现检测逻辑，并报告问题。

### 添加测试文件
在./test/SoftwareSecurity25目录下建一个自己的测试文件，文件命名Test学号.ts，例：Test19241042.ts(参考模板，注意修改路径)。

这个文件用于一次测试一个人的所有checker，最后我们会通过运行大家的这个文件来评测，请大家确保这个文件能正确执行。

## 参考源码

[homecheck：鸿蒙应用高性能编码检测工具](https://gitcode.com/openharmony-sig/homecheck)

[方舟分析器：面向ArkTS语言的静态程序分析框架](https://gitcode.com/openharmony-sig/arkanalyzer)

## 评分标准

正确完成两个checker可得大作业60%分数，正确完成五个checker可得大作业90%分数，其余综合最后整体完成情况。
（如何判断“正确”： 安全规则合理，按要求添加checker并能够检测出样例代码中的安全漏洞，在日志和检测报告中有相应输出并能表述清问题所在）

## 截止时间

第十六周日 2025.06.15 23:59:59

## P.S.

1. 再次嘱咐，由于本次作业需要近百人在统一仓库甚至同一文件提交代码，请大家千万遵守git使用规范同时注意对自己的代码做好备份。
2. 如你们所见，整个仓库都是助教们基于Homecheck改编而来，有疏漏之处或改进意见欢迎大家积极与我们沟通，本文档也会持续更新，尽量帮大家少踩坑，有更新会在群里通知请大家关注，感恩。