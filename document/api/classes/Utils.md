[**homecheck**](../README.md)

***

[homecheck](../globals.md) / Utils

# Class: Utils

Defined in: utils/common/Utils.ts:20

## Constructors

### Constructor

> **new Utils**(): `Utils`

#### Returns

`Utils`

## Methods

### getCliOptions()

> `static` **getCliOptions**(`program`, `args`): `OptionValues`

Defined in: utils/common/Utils.ts:39

获取命令行选项

#### Parameters

##### program

`Command`

Command 对象

##### args

`string`[]

命令行参数数组

#### Returns

`OptionValues`

选项值对象

***

### getEnumValues()

> `static` **getEnumValues**(`value`, `enumType`): `any`

Defined in: utils/common/Utils.ts:61

获取枚举类型的值

#### Parameters

##### value

枚举值，可以是字符串或数字

`string` | `number`

##### enumType

`any`

枚举类型

#### Returns

`any`

枚举值对应的枚举类型值

***

### parseCliOptions()

> `static` **parseCliOptions**(`args`): `OptionValues`

Defined in: utils/common/Utils.ts:26

解析命令行选项

#### Parameters

##### args

`string`[]

命令行参数数组

#### Returns

`OptionValues`

解析后的选项值

***

### setLogPath()

> `static` **setLogPath**(`logPath`): `void`

Defined in: utils/common/Utils.ts:51

设置日志路径

#### Parameters

##### logPath

`string`

日志路径

#### Returns

`void`

***

### sortByLineAndColumn()

> `static` **sortByLineAndColumn**(`keyA`, `keyB`): `number`

Defined in: utils/common/Utils.ts:72

按行号和列号对键值对进行排序

#### Parameters

##### keyA

`string`

格式为 "行号%列号%规则ID" 的字符串

##### keyB

`string`

格式为 "行号%列号%规则ID" 的字符串

#### Returns

`number`

排序比较结果
