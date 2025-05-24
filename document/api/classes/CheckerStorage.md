[**homecheck**](../README.md)

***

[homecheck](../globals.md) / CheckerStorage

# Class: CheckerStorage

Defined in: utils/common/CheckerStorage.ts:18

## Constructors

### Constructor

> **new CheckerStorage**(): `CheckerStorage`

#### Returns

`CheckerStorage`

## Methods

### getApiVersion()

> **getApiVersion**(): `number`

Defined in: utils/common/CheckerStorage.ts:64

获取API版本号

#### Returns

`number`

返回API版本号

***

### getProduct()

> **getProduct**(): `string`

Defined in: utils/common/CheckerStorage.ts:80

获取product

#### Returns

`string`

返回product

***

### getScope()

> **getScope**(`filePath`): `undefined` \| [`Scope`](Scope.md)

Defined in: utils/common/CheckerStorage.ts:40

根据文件路径获取Scope

#### Parameters

##### filePath

`string`

文件路径

#### Returns

`undefined` \| [`Scope`](Scope.md)

Scope | undefined - 返回Scope对象或undefined

***

### setApiVersion()

> **setApiVersion**(`api`): `void`

Defined in: utils/common/CheckerStorage.ts:56

设置API版本

#### Parameters

##### api

`number`

API版本号

#### Returns

`void`

***

### setProduct()

> **setProduct**(`pro`): `void`

Defined in: utils/common/CheckerStorage.ts:72

设置product

#### Parameters

##### pro

`string`

#### Returns

`void`

***

### setScopeMap()

> **setScopeMap**(`scopeMap`): `void`

Defined in: utils/common/CheckerStorage.ts:48

设置Scope映射

#### Parameters

##### scopeMap

`Map`\<`string`, [`Scope`](Scope.md)\>

Scope映射，类型为 Map<string, Scope>

#### Returns

`void`

***

### getInstance()

> `static` **getInstance**(): `CheckerStorage`

Defined in: utils/common/CheckerStorage.ts:28

获取 CheckerStorage 的单例实例

#### Returns

`CheckerStorage`

CheckerStorage 的单例实例
