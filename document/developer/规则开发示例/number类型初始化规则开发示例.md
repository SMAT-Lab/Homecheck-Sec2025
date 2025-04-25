# number类型初始化规则开发指南

## 原理介绍

针对number类型，运行时在优化时会区分整型和浮点型数据。建议避免在初始化后改变数据类型。

参考文档：[文档链接](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V13/arkts-high-performance-programming-V13)

## 实现思路

1、查找number类型的变量

2、查找该变量的定义语句和重新赋值语句

3、出现初始化类型是int被重新赋值为float、初始化类型是float被重新赋值为int，则进行告警

## 示例代码

### 反例代码

```
let intNum = 1;
// intNum is declared as int. Avoid changing it to float.
intNum = 1.1; 
let floatNum = 1.3;
// floatNum is declared as float. Avoid changing it to int.
floatNum = 2; 
```

### 正例代码

```
let intNum = 1;
intNum = 2;
let floatNum = 1.3;
floatNum = 2.4;
```

## 代码实现

### 规则命名

规则名：NumberInitCheck

### 新建类

新建NumberInitCheck类并实现BaseChecker，如下：
```
export class NumberInitCheck implements BaseChecker {}
```

### 新建matcher

1、当前规则需要检测所有的文件，所以新建一个FileMatcher，如下：
```
private fileMatcher: FileMatcher = {
  matcherType: MatcherTypes.FILE
};
```
2、注册回调MatcherCallback
```
public registerMatchers(): MatcherCallback[] {
    const matchFileCb: MatcherCallback = {
        matcher: this.fileMatcher,
        callback: this.check
    }
    return [matchFileCb];
}
```
3、回调函数
```
public check = (arkFile: ArkFile) => {
    // 业务逻辑
}
```

### 关键逻辑

1、通过filePath获取scope
```
let filePath = arkFile.getFilePath();
let scope = CheckerStorage.getInstance().getScope(filePath);
```
2、通过递归scope来实现计算usage处类型
```
private traverseScope(scope: Scope): void {
    this.parameteCheck(scope);
    if (scope.childScopeList.length !== 0) {
        for (let childScope of scope.childScopeList) {
            this.traverseScope(childScope);
        }
    }
}
```
3、遍历所有变量定义的语句，获取变量的初始化类型(defStmt里变量的类型)
```
for (let defValueInfo of scope.defList) {
    let defType: ValueType = ValueType.UNKNOWN;
    let defStmt = defValueInfo.defStmt;
    let defStmtInfo = new VarInfo(defStmt, scope);
    if (defStmt instanceof ArkAssignStmt) {
        let rightOp = defStmt.getRightOp();
        defType = this.checkValueType(defStmtInfo, rightOp);
        if (defType === ValueType.UNKNOWN) {
            continue;
        }
    }
}
```
4、遍历reDefStmtInfos,获取变量重新赋值后的类型
```
let reDefStmtInfos = defValueInfo.redefInfo;
for (let reDefStmtInfo of reDefStmtInfos) {
    let reDefStmt = reDefStmtInfo.stmt;
    if (reDefStmt instanceof ArkAssignStmt) {
        let rightOp = reDefStmt.getRightOp();
        let reDefType = this.checkValueType(reDefStmtInfo, rightOp);
        if (reDefType === ValueType.UNKNOWN) {
            break;
        }
    }
}
```
5、判断变量初始化的类型和重新赋值后的类型是否一致，不一致，则告警
```
if (reDefType != defType) {
    this.setIssueReports(reDefStmt);
}
```