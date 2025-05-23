[**homecheck**](../README.md)

***

[homecheck](../globals.md) / CheckerUtils

# Class: CheckerUtils

Defined in: utils/checker/CheckerUtils.ts:25

## Constructors

### Constructor

> **new CheckerUtils**(): `CheckerUtils`

#### Returns

`CheckerUtils`

## Methods

### getArgRight()

> `static` **getArgRight**(`arg`, `arkClass`): `null` \| `Value`

Defined in: utils/checker/CheckerUtils.ts:154

获取参数的右值

#### Parameters

##### arg

`Value`

参数

##### arkClass

`ArkClass`

ArkClass对象

#### Returns

`null` \| `Value`

Value | null - 返回参数的右值，如果不存在则返回null

***

### getArkFileByFilePath()

> `static` **getArkFileByFilePath**(`scene`, `absolutePath`): `null` \| `ArkFile`

Defined in: utils/checker/CheckerUtils.ts:142

根据文件路径获取ArkFile对象

#### Parameters

##### scene

`Scene`

Scene

##### absolutePath

`string`

文件路径

#### Returns

`null` \| `ArkFile`

返回对应的ArkFile对象，如果未找到则返回null

***

### getInvokeExprFromAwaitStmt()

> `static` **getInvokeExprFromAwaitStmt**(`stmt`): `null` \| `AbstractInvokeExpr`

Defined in: utils/checker/CheckerUtils.ts:48

从给定的语句中获取调用表达式（Await）

#### Parameters

##### stmt

`Stmt`

要处理的语句

#### Returns

`null` \| `AbstractInvokeExpr`

如果找到调用表达式，则返回 AbstractInvokeExpr，否则返回 null

***

### getInvokeExprFromStmt()

> `static` **getInvokeExprFromStmt**(`stmt`): `null` \| `AbstractInvokeExpr`

Defined in: utils/checker/CheckerUtils.ts:31

从给定的语句中获取调用表达式

#### Parameters

##### stmt

`Stmt`

要处理的语句

#### Returns

`null` \| `AbstractInvokeExpr`

如果找到调用表达式，则返回 AbstractInvokeExpr，否则返回 null

***

### getScopeType()

> `static` **getScopeType**(`stmt`): [`ScopeType`](../enumerations/ScopeType.md)

Defined in: utils/checker/CheckerUtils.ts:78

获取语句的Scope类型

#### Parameters

##### stmt

`Stmt`

语句对象

#### Returns

[`ScopeType`](../enumerations/ScopeType.md)

Scope类型

***

### isDeclaringStmt()

> `static` **isDeclaringStmt**(`defName`, `stmt`): `boolean`

Defined in: utils/checker/CheckerUtils.ts:99

判断给定的语句是否是声明语句

#### Parameters

##### defName

`string`

要检查的变量名

##### stmt

`Stmt`

要检查的语句

#### Returns

`boolean`

如果语句是声明语句，则返回true，否则返回false

***

### wherIsTemp()

> `static` **wherIsTemp**(`stmt`): [`TempLocation`](../enumerations/TempLocation.md)

Defined in: utils/checker/CheckerUtils.ts:118

获取语句中临时变量的位置

#### Parameters

##### stmt

`Stmt`

语句

#### Returns

[`TempLocation`](../enumerations/TempLocation.md)

临时变量的位置
