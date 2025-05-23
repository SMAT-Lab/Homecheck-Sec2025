[**homecheck**](../README.md)

***

[homecheck](../globals.md) / Message

# Interface: Message

Defined in: model/Message.ts:22

## Methods

### messageNotify()

> **messageNotify**(`messageLevel`, `msg`): `void`

Defined in: model/Message.ts:24

#### Parameters

##### messageLevel

[`MessageType`](../enumerations/MessageType.md)

##### msg

`string`

#### Returns

`void`

***

### progressNotify()

> **progressNotify**(`progress`, `msg`): `void`

Defined in: model/Message.ts:25

#### Parameters

##### progress

`number`

##### msg

`string`

#### Returns

`void`

***

### sendResult()

> **sendResult**(`fileReports`, `reportDir`?): `void`

Defined in: model/Message.ts:23

#### Parameters

##### fileReports

[`FileReports`](FileReports.md)[]

##### reportDir?

`string`

#### Returns

`void`
