[**homecheck**](../README.md)

***

[homecheck](../globals.md) / Scope

# Class: Scope

Defined in: model/Scope.ts:37

## Constructors

### Constructor

> **new Scope**(`parent`, `defList`, `level`, `type`): `Scope`

Defined in: model/Scope.ts:45

#### Parameters

##### parent

`null` | `Scope`

##### defList

`Variable`[]

##### level

`number`

##### type

[`ScopeType`](../enumerations/ScopeType.md) = `ScopeType.UNKNOWN_TYPE`

#### Returns

`Scope`

## Properties

### blocks

> **blocks**: `Set`\<`BasicBlock`\>

Defined in: model/Scope.ts:41

***

### childScopeList

> **childScopeList**: `Scope`[]

Defined in: model/Scope.ts:39

***

### defList

> **defList**: `Variable`[]

Defined in: model/Scope.ts:40

***

### parentScope

> **parentScope**: `null` \| `Scope`

Defined in: model/Scope.ts:38

***

### scopeLevel

> **scopeLevel**: `number`

Defined in: model/Scope.ts:42

***

### scopeType

> **scopeType**: [`ScopeType`](../enumerations/ScopeType.md)

Defined in: model/Scope.ts:43

## Methods

### addVariable()

> **addVariable**(`variable`): `void`

Defined in: model/Scope.ts:58

#### Parameters

##### variable

`Variable`

#### Returns

`void`

***

### setChildScope()

> **setChildScope**(`child`): `void`

Defined in: model/Scope.ts:54

#### Parameters

##### child

`Scope`

#### Returns

`void`
