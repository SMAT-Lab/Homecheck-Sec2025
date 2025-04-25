[**homecheck**](../README.md)

***

[homecheck](../globals.md) / CheckEntry

# Class: CheckEntry

Defined in: utils/common/CheckEntry.ts:37

## Constructors

### Constructor

> **new CheckEntry**(): `CheckEntry`

Defined in: utils/common/CheckEntry.ts:46

#### Returns

`CheckEntry`

## Properties

### fileChecks

> **fileChecks**: `File2Check`[] = `[]`

Defined in: utils/common/CheckEntry.ts:41

***

### message

> **message**: [`Message`](../interfaces/Message.md)

Defined in: utils/common/CheckEntry.ts:43

***

### projectCheck

> **projectCheck**: `Project2Check`

Defined in: utils/common/CheckEntry.ts:40

***

### projectConfig

> **projectConfig**: [`ProjectConfig`](ProjectConfig.md)

Defined in: utils/common/CheckEntry.ts:39

***

### ruleConfig

> **ruleConfig**: [`RuleConfig`](RuleConfig.md)

Defined in: utils/common/CheckEntry.ts:38

***

### scene

> **scene**: `Scene`

Defined in: utils/common/CheckEntry.ts:42

***

### selectFileList

> **selectFileList**: `SelectedFileInfo`[] = `[]`

Defined in: utils/common/CheckEntry.ts:44

## Methods

### addFileCheck()

> **addFileCheck**(`fileCheck`): `void`

Defined in: utils/common/CheckEntry.ts:49

#### Parameters

##### fileCheck

`File2Check`

#### Returns

`void`

***

### addProjectCheck()

> **addProjectCheck**(`projectCheck`): `void`

Defined in: utils/common/CheckEntry.ts:53

#### Parameters

##### projectCheck

`Project2Check`

#### Returns

`void`

***

### buildScope()

> **buildScope**(): `void`

Defined in: utils/common/CheckEntry.ts:151

#### Returns

`void`

***

### codeFix()

> **codeFix**(`fileIssues`): [`FileReports`](../interfaces/FileReports.md)[]

Defined in: utils/common/CheckEntry.ts:161

修复代码问题

#### Parameters

##### fileIssues

`FileIssues`[]

以文件为维度的issues信息

#### Returns

[`FileReports`](../interfaces/FileReports.md)[]

修复后的文件报告数组，去掉已修复issues，且需更新未修复issues行列号等信息

***

### runAll()

> **runAll**(): `Promise`\<`void`\>

Defined in: utils/common/CheckEntry.ts:74

#### Returns

`Promise`\<`void`\>

***

### setCheckFileList()

> **setCheckFileList**(`selectFileList`): `void`

Defined in: utils/common/CheckEntry.ts:66

#### Parameters

##### selectFileList

`SelectedFileInfo`[]

#### Returns

`void`

***

### setDisableText()

> **setDisableText**(`fileDisableText`, `nextLineDisableText`): `void`

Defined in: utils/common/CheckEntry.ts:57

#### Parameters

##### fileDisableText

`string`

##### nextLineDisableText

`string`

#### Returns

`void`

***

### setEngineName()

> **setEngineName**(`engineName`): `void`

Defined in: utils/common/CheckEntry.ts:62

#### Parameters

##### engineName

`string`

#### Returns

`void`

***

### setMessage()

> **setMessage**(`messge`): `void`

Defined in: utils/common/CheckEntry.ts:70

#### Parameters

##### messge

[`Message`](../interfaces/Message.md)

#### Returns

`void`

***

### sortIssues()

> **sortIssues**(): `FileIssues`[]

Defined in: utils/common/CheckEntry.ts:104

按规则维度统计并输出告警信息，按文件维度汇总并返回告警信息。

#### Returns

`FileIssues`[]

FileReport[] 文件报告数组，每个元素包含文件名、缺陷列表和输出信息
