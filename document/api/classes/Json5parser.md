[**homecheck**](../README.md)

***

[homecheck](../globals.md) / Json5parser

# Class: Json5parser

Defined in: utils/common/Json5parser.ts:21

## Constructors

### Constructor

> **new Json5parser**(): `Json5parser`

#### Returns

`Json5parser`

## Methods

### getRootObjectLiteral()

> `static` **getRootObjectLiteral**(`file`): `undefined` \| `ObjectLiteralExpression`

Defined in: utils/common/Json5parser.ts:27

获取JSON5文件的根对象字面量表达式

#### Parameters

##### file

`JsonSourceFile`

JSON5文件的源文件对象

#### Returns

`undefined` \| `ObjectLiteralExpression`

如果找到根对象字面量表达式，则返回该表达式；否则返回undefined

***

### parseJsonText()

> `static` **parseJsonText**(`text`): `object`

Defined in: utils/common/Json5parser.ts:122

解析JSON文本

#### Parameters

##### text

`string`

要解析的JSON文本

#### Returns

`object`

解析后的对象
