# web预编译规则开发指南

## 原理介绍

参考文档：[文档链接](https://developer.huawei.com/consumer/cn/doc/best-practices-V14/bpta-web-develop-optimization-V14#section563844632917)

## 实现思路

1.使用web组件

2.web组件的onControllerAttached生命周期

3.在onControllerAttached周期内有使用预编译接口

## 示例代码

### 反例代码

```
import { webview } from '@kit.ArkWeb';
import { hiTraceMeter } from '@kit.PerformanceAnalysisKit';

@Entry
@Component
struct JsCodeCacheByPrecompileCheckReport {
  controller: webview.WebviewController = new webview.WebviewController();
  build() {
    Column() {
      Button('加载页面')
        .onClick(() => {
          hiTraceMeter.startTrace('unPrecompileJavaScript', 1);
          this.controller.loadUrl('https://www.example.com/b.html');
        })
      // warning line
      Web({ src: 'https://www.example.com/a.html', controller: this.controller })
        .fileAccess(true)
        .onPageBegin((event) => {
          console.log(`load page begin: ${event?.url}`);
        })
        .onPageEnd((event) => {
          hiTraceMeter.finishTrace('unPrecompileJavaScript', 1);
          console.log(`load page end: ${event?.url}`);
        })
    }
  }
}
```

### 正例代码

```
import { webview } from '@kit.ArkWeb';
interface Config {
  url: string,
  localPath: string,
  options: webview.CacheOptions
}

@Entry
@Component
struct JsCodeCacheByPrecompileCheckNoReport {
  controller: webview.WebviewController = new webview.WebviewController();
  configs: Array<Config> = [
    {
      url: 'https://www.example.com/example.js',
      localPath: 'example.js',
      options: {
        responseHeaders: [
          { headerKey: 'E-Tag', headerValue: 'xxx' },
          { headerKey: 'Last-Modified', headerValue: 'Web, 21 Mar 2024 10:38:41 GMT' }
        ]
      }
    }
  ]
  build() {
    Column() {
      Web({ src: 'https://www.example.com/a.html', controller: this.controller })
        .onControllerAttached(async () => {
          for (const config of this.configs) {
            let content = getContext().resourceManager.getRawFileContentSync(config.localPath);
            try {
              this.controller.precompileJavaScript(config.url, content, config.options)
                .then((errCode: number) => {
                  console.log('precompile successfully!' );
                }).catch((errCode: number) => {
                console.error('precompile failed.' + errCode);
              })
            } catch (err) {
              console.error('precompile failed!.' + err.code + err.message);
            }
          }
        })
    }
  }
}
```

## 代码实现

### 规则分类

根据背景介绍可知web预编译是性能类规则，所以应在src\checker\performance目录下

### 命名

规则名：JsCodeCacheByPrecompileCheck

### 新建类

新建JsCodeCacheByPrecompileCheck.ts文件，在文件中新建类，如下：
```
export class JsCodeCacheByPrecompileCheck implements BaseChecker {
```

### matcher

1、新建ClassMatcher，条件为含有viewtree的class，如下：
```
private buildMatcher: ClassMatcher = {
    matcherType: MatcherTypes.CLASS,
    hasViewTree: true
};
```
2、注册回调MatcherCallback
```
public registerMatchers(): MatcherCallback[] {
    const matchBuildCb: MatcherCallback = {
        matcher: this.buildMatcher,
        callback: this.check
    }
    return [matchBuildCb];
}
```

3、回调函数

获取arkclass中的viewtree并遍历此viewtree
```
public check = (arkClass: ArkClass) => {
    // 业务逻辑
}
```

4、遍历viewtree中是否使用web组件

```
private traverseViewTree(viewtreeRoot: ViewTreeNode, arkClass: ArkClass, scene: Scene): void {
    if (!viewtreeRoot) {
        return;
    }
    let name = viewtreeRoot.name;
    if (name === 'Web') {
        this.webOperation(viewtreeRoot, arkClass, scene);
    }
    if (viewtreeRoot.children.length > 0) {
        for (let child of viewtreeRoot.children) {
            let classSignature = child.signature;
            if (classSignature && child.isCustomComponent()) {
                continue;
            }
            this.traverseViewTree(child, arkClass, scene);
        }
    }
}
```

5、判断web是否包含onControllerAttached属性
```
private webOperation(viewtreeRoot: ViewTreeNode, arkClass: ArkClass, scene: Scene): void {
    let hasJsInValue = false;
    for (let [key, vals] of viewtreeRoot.attributes) {
        if (!webSet.has(key)) {
            continue;
        }
        if (this.isHasJSInValue(vals, scene)) {
            hasJsInValue = true;
            return;
        }
    }
    if (!hasJsInValue && !this.findSymbolInAboutToAppear(arkClass, scene)) {
        this.setReportIssue(arkClass, viewtreeRoot);
    }
}
```

6、判断onControllerAttached中是否含有预编译接口，需要遍历function中的stmts,判断签名一致，则认为有使用
```
private isHasJSInValue(values: [Stmt, (Constant | ArkInstanceFieldRef | MethodSignature)[]], scene: Scene): boolean {
    let value = values[0];
    let invokeExpr = CheckerUtils.getInvokeExprFromStmt(value);
    if (!invokeExpr) {
        return false;
    }
    let args = invokeExpr.getArgs();
    if (args.length === 0) {
        return false;
    }
    let arg = args[0];
    let type = arg.getType();
    if (!(type instanceof FunctionType)) {
        return false;
    }
    let invokeMethod = scene.getMethod(type.getMethodSignature());
    if (!invokeMethod) {
        return false;
    }
    let busyMethods = new Set<MethodSignature>();
    if (this.findSymbolInMethod(invokeMethod, scene, busyMethods)) {
        return true;
    }
    return false;
}
```

```
private findSymbolInMethod(arkMethod: ArkMethod, scene: Scene, busyMethods: Set<MethodSignature>): boolean {
    const stmts = arkMethod.getBody()?.getCfg()?.getStmts();
    if (!stmts) {
        return false;
    }
    const curMethodSignature = arkMethod.getSignature();
    busyMethods.add(curMethodSignature);
    for (let stmt of stmts) {
        const invokeExpr = CheckerUtils.getInvokeExprFromStmt(stmt);
        if (!invokeExpr) {
            continue;
        }
        const invokeSignature = invokeExpr.getMethodSignature();
        let invokeSignatureStr = invokeSignature.toString();
        if (busyMethods.has(invokeSignature) || invokeSignatureStr.includes(`@${UNKNOWN_PROJECT_NAME}/${UNKNOWN_FILE_NAME}`)) {
            continue;
        }
        if (invokeSignatureStr === precompileJavaScriptSignature) {
            return true;
        } else {
            this.findSymbolInInvokeStmt(stmt, scene, busyMethods);
            let invokeMethod = scene.getMethod(invokeSignature);
            if (invokeMethod === null) {
                continue;
            }
            if (this.findSymbolInMethod(invokeMethod, scene, busyMethods)) {
                return true;
            }
        }
    }
    busyMethods.delete(curMethodSignature);
    return false;
}
```

7、找到则告警

```
let defects = new Defects(lineNum, startColumn, this.metaData.description, severity, this.rule.ruleId,
                mergeKey, this.metaData.ruleDocPath, true, false, false, fixKey);
this.issues.push(new IssueReport(defects, undefined));
```