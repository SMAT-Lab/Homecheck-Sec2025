[**homecheck**](../README.md)

***

[homecheck](../globals.md) / FileUtils

# Class: FileUtils

Defined in: utils/common/FileUtils.ts:26

## Constructors

### Constructor

> **new FileUtils**(): `FileUtils`

#### Returns

`FileUtils`

## Methods

### genSdks()

> `static` **genSdks**(`projectConfig`): `Sdk`[]

Defined in: utils/common/FileUtils.ts:204

生成SDK数组

#### Parameters

##### projectConfig

[`ProjectConfig`](ProjectConfig.md)

项目配置

#### Returns

`Sdk`[]

Sdk[] - SDK数组

***

### getAllFiles()

> `static` **getAllFiles**(`dirPath`, `exts`, `filenameArr`, `visited`): `string`[]

Defined in: utils/common/FileUtils.ts:159

获取指定目录下所有符合条件的文件

#### Parameters

##### dirPath

`string`

目录路径

##### exts

`string`[]

文件扩展名数组，如果为空则获取所有文件，['.ts', '.ets', '.json5']

##### filenameArr

`string`[] = `[]`

存储符合条件的文件路径的数组，默认为空数组

##### visited

`Set`\<`string`\> = `...`

已访问的目录集合，默认为空集合

#### Returns

`string`[]

符合条件的文件路径数组

***

### getFiltedFiles()

> `static` **getFiltedFiles**(`fileList`, `ruleConfig`): `Promise`\<`string`[]\>

Defined in: utils/common/FileUtils.ts:42

根据给定的文件列表和规则配置，过滤出符合规则的文件列表。

#### Parameters

##### fileList

`string`[]

文件列表。

##### ruleConfig

[`RuleConfig`](RuleConfig.md)

规则配置，包含匹配和忽略文件的规则，以及可能的重写规则。

#### Returns

`Promise`\<`string`[]\>

返回符合规则的文件列表，异常情况下返回空数组。

***

### getSeletctedFileInfos()

> `static` **getSeletctedFileInfos**(`jsonPath`, `exts`): `SelectedFileInfo`[]

Defined in: utils/common/FileUtils.ts:136

从指定路径的JSON文件中获取符合条件的文件信息列表

#### Parameters

##### jsonPath

`string`

JSON文件路径

##### exts

`string`[]

文件扩展名数组

#### Returns

`SelectedFileInfo`[]

符合条件的文件信息数组

***

### isExistsSync()

> `static` **isExistsSync**(`filePath`): `boolean`

Defined in: utils/common/FileUtils.ts:126

检查文件是否存在

#### Parameters

##### filePath

`string`

文件路径

#### Returns

`boolean`

如果文件存在则返回true，否则返回false

***

### matchFiles()

> `static` **matchFiles**(`fileList`, `fileGlob`, `ignoreGlob`): `Promise`\<`string`[]\>

Defined in: utils/common/FileUtils.ts:66

匹配文件列表中的文件，返回符合条件的文件路径列表

#### Parameters

##### fileList

`string`[]

文件路径列表

##### fileGlob

`GlobMatch`

##### ignoreGlob

`GlobMatch`

#### Returns

`Promise`\<`string`[]\>

符合条件的文件路径列表

***

### readFile()

> `static` **readFile**(`fileName`): `string`

Defined in: utils/common/FileUtils.ts:32

读取指定文件并返回其内容

#### Parameters

##### fileName

`string`

要读取的文件名

#### Returns

`string`

- 文件内容

***

### readLinesFromFile()

> `static` **readLinesFromFile**(`filePath`, `lineNo`?): `Promise`\<`string`[]\>

Defined in: utils/common/FileUtils.ts:89

从文件中读取指定行或全部行

#### Parameters

##### filePath

`string`

文件路径

##### lineNo?

`number`

要读取的行号，不传或者0值则读取全部行

#### Returns

`Promise`\<`string`[]\>

读取到的行组成的字符串数组

#### Throws

如果读取文件时发生错误，将抛出异常

***

### writeToFile()

> `static` **writeToFile**(`filePath`, `content`, `mode`): `void`

Defined in: utils/common/FileUtils.ts:248

写入文件，同步接口

#### Parameters

##### filePath

`string`

文件路径

##### content

`string`

写入的内容

##### mode

[`WriteFileMode`](../enumerations/WriteFileMode.md) = `WriteFileMode.APPEND`

写入模式，不传默认为追加模式

#### Returns

`void`
