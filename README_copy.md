# Homecheck-Sec2025
## 文件结构

```
Homecheck-Sec2025
|---sample //存放含有安全漏洞的被检测代码示例
|---|---TemplateSample //示例模板
|---|---|---Issue1
|---|---|---|---config.json //ArkAnalyzer配置文件
|---|---|---|---sample1.ts //含有安全问题1的代码示例
|---|---|---Issue2
|---|---|---|---config.json //ArkAnalyzer配置文件
|---|---|---|---sample2.ts //含有安全问题2的代码示例
|---|---Sample19241042 //建一个自己的文件夹
|---|---|---Issue1 //每一个安全问题一个Issue
|---|---|---|---config.json
|---|---|---|---sample1.ts //问题代码示例
|---src
|---|---checker //存放基于ArkAnalyzer实现的针对sample中的样例的安全漏洞检测器
|---|---|---TemplateChecker.ts  //Checker模板
|---|---|---Checker19241042.ts  //检测逻辑示例，每人建一个自己的文件
|---|---bundle.js  //ArkAnalyzer包
|---README.md
|---tsconfig.json
```

## 样例运行

```
npm install
ts-node .\src\checker\TemplateChecker.ts
ts-node .\src\checker\Checker19241042.ts
```

TemplateChecker.ts输出

```
Issue1
Issue2
```

Checker19241042.ts输出

```
variable: $temp1, def: $temp1 = 'rm -rf /bin', use: staticinvoke <@_UnkownProjectName/_UnkownFileName: .exec()>($temp1)
```

## Checker说明

TemplateChecker.ts

``` Typescript
import { Scene, SceneConfig } from "../bundle";

//文件和类命名为 Checker学号 例 Checker19241042
export class TemplateChecker {

    //在此描述安全漏洞类型1
    public static checkRule1(scene: Scene) {
        //TODO: 实现检测逻辑，合理输出
        console.log("Issue1");
        return ;
    }

    //在此描述安全漏洞类型2
    public static checkRule2(scene: Scene) {
        //TODO: 实现检测逻辑，合理输出
        console.log("Issue2");
        return ;
    }

    //初始化被检测项目Scene数据结构，不用改
    public static initScene(config_path: string) {
        let config: SceneConfig = new SceneConfig();
        config.buildFromJson(config_path);
        let scene: Scene = new Scene(config);
        scene.inferTypes();
        return scene;
    }

    public static check(){
        //检查每一项安全漏洞
        let scene1: Scene = this.initScene("sample/TemplateSample/Issue1/config.json");
        this.checkRule1(scene1);
        let scene2: Scene = this.initScene("sample/TemplateSample/Issue2/config.json");
        this.checkRule2(scene2);
    }

}

function main() {
    TemplateChecker.check();
}

main()
```

## 需要做的

1. 在./sample下建一个自己的文件夹，存放含有安全漏洞的被检测代码示例，文件夹命名：Sample学号，例：Sample19241042，该文件夹下每一种安全漏洞作为一个单独的项目，创建一个独立的文件夹，写好config.json（参考模板，注意路径），在sampleX.ts中写含有第X种安全漏洞的被检测代码示例。
2. 在./src/checker下建一个自己的Checker，文件夹命名：Checker学号.ts，例：Checker19241042.ts（参考模板）。
3. 实现Checker，针对sample下的每种含有安全漏洞的问题代码实现检测逻辑，输出不做具体要求，能表述清楚问题所在即可。

## 参考源码

[homecheck：鸿蒙应用高性能编码检测工具](https://gitcode.com/openharmony-sig/homecheck)

[方舟分析器：面向ArkTS语言的静态程序分析框架](https://gitcode.com/openharmony-sig/arkanalyzer)

## 截止时间

第十六周日 2025.06.15 23:59:59