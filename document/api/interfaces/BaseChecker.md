[**homecheck**](../README.md)

***

[homecheck](../globals.md) / BaseChecker

# Interface: BaseChecker

Defined in: checker/BaseChecker.ts:28

## Properties

### issues

> **issues**: [`IssueReport`](../classes/IssueReport.md)[]

Defined in: checker/BaseChecker.ts:36

***

### metaData

> **metaData**: `object`

Defined in: checker/BaseChecker.ts:29

***

### rule

> **rule**: [`Rule`](../classes/Rule.md)

Defined in: checker/BaseChecker.ts:31

## Methods

### check()

> **check**(`target`): `void`

Defined in: checker/BaseChecker.ts:33

#### Parameters

##### target

`any`

#### Returns

`void`

***

### codeFix()?

> `optional` **codeFix**(`arkFile`, `fixKey`): `boolean`

Defined in: checker/BaseChecker.ts:34

#### Parameters

##### arkFile

`ArkFile`

##### fixKey

`string`

#### Returns

`boolean`

***

### registerMatchers()

> **registerMatchers**(): [`MatcherCallback`](MatcherCallback.md)[]

Defined in: checker/BaseChecker.ts:32

#### Returns

[`MatcherCallback`](MatcherCallback.md)[]
