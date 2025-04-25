# fix规则修复开发指南

## 描述

当开发规则检测到告警时，支持将此告警修复。

## 告警检测

规则开发参考：[规则开发指南](规则开发指南.md)

具体示例参考：[array-type-check](../../src/checker/ArkTS-eslint/ArrayTypeCheck.ts)

## 告警修复

### 1、当检测到告警，获取告警信息

示例：

```
// 创建缺陷报告
const defect = new Defects(
    position.actualLine,
    position.actualColStart,
    position.actualColEnd,
    this.metaData.description,
    severity,
    this.rule.ruleId,
    this.filePath,
    this.metaData.ruleDocPath,
    true,
    false,
    true
);
```

### 2、获取fix

示例：

```
// 创建fix
private createFix(target: ArkFile, node: ts.Node, elementType: ts.Node | string, startAST: number, endAST: number): RuleFix | undefined {
    // 获取数组类型配置
    const isReadonly = this.hasReadonlyModifier(node);
    const option = isReadonly ? this.defaultOptions[0].readonly : this.defaultOptions[0].default;

    // 处理类型文本
    const typeText = this.processTypeText(elementType);
    const isSimpleType = this.checkIsSimpleType(elementType, node);

    // 生成替换文本
    const replaceText = this.generateReplaceText(option ?? 'array', isReadonly, typeText, isSimpleType, node);

    return { range: [startAST, endAST], text: replaceText };
}

// 获取fix并存储issue
const fix = this.createFix(target, node, elementType, position.startAST, position.endAST);
RuleListUtil.push(defect);
this.issues.push(new IssueReport(defect, fix));
```

## 运行checker

参考：[homecheck使用指南](../user/homecheck安装与使用指南.md)

projectConfig.json配置如下：

```
{
  "projectName": "TestProject",
  "projectPath": "/path/to/project",
  "logPath": "./HomeCheck.log",
  "ohosSdkPath": "/path/to/ohosSdk",
  "hmsSdkPath": "/path/to/hmsSdk",
  "arkCheckPath": "/path/to/homecheck",
  "fix": "true"
}
```

## 产物

运行成功后，告警文件的同目录会生成后缀为**homecheckFix**的修复文件