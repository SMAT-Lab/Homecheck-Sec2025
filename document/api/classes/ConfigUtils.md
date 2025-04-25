[**homecheck**](../README.md)

***

[homecheck](../globals.md) / ConfigUtils

# Class: ConfigUtils

Defined in: utils/common/ConfigUtils.ts:33

## Constructors

### Constructor

> **new ConfigUtils**(): `ConfigUtils`

#### Returns

`ConfigUtils`

## Methods

### checkExtRuleSetConfig()

> `static` **checkExtRuleSetConfig**(`ruleSet`, `allRules`, `extRuleSetSet`, `message`): `boolean`

Defined in: utils/common/ConfigUtils.ts:259

检查自定义规则集配置的有效性

#### Parameters

##### ruleSet

`ExtRuleSet`

自定义规则集

##### allRules

`Map`\<`string`, `object`\>

所有规则集合

##### extRuleSetSet

`Set`\<`string`\>

自定义规则集集合

##### message

[`Message`](../interfaces/Message.md)

消息对象

#### Returns

`boolean`

- 是否通过检查

***

### getConfig()

> `static` **getConfig**(`configPath`, `rootDir`?): `any`

Defined in: utils/common/ConfigUtils.ts:40

获取配置文件

#### Parameters

##### configPath

`string`

配置文件路径

##### rootDir?

`string`

根目录，可选参数

#### Returns

`any`

返回解析后的配置对象，如果解析失败则返回null

***

### getRuleMap()

> `static` **getRuleMap**(`ruleConfig`, `projectConfig`, `message`): `Map`\<`string`, [`Rule`](Rule.md)\>

Defined in: utils/common/ConfigUtils.ts:89

从配置文件中获取规则

#### Parameters

##### ruleConfig

[`RuleConfig`](RuleConfig.md)

规则配置

##### projectConfig

[`ProjectConfig`](ProjectConfig.md)

项目配置

##### message

[`Message`](../interfaces/Message.md)

消息通知实例

#### Returns

`Map`\<`string`, [`Rule`](Rule.md)\>

Map, ruleId -- Rule

***

### getRuleSetMap()

> `static` **getRuleSetMap**(`rootDir`): `Map`\<`string`, `object`\>

Defined in: utils/common/ConfigUtils.ts:222

读取RuleSet.json中配置的规则集

#### Parameters

##### rootDir

`string`

#### Returns

`Map`\<`string`, `object`\>

***

### isOnlineRule()

> `static` **isOnlineRule**(`ruleId`, `allRules`): `boolean`

Defined in: utils/common/ConfigUtils.ts:242

检查指定的规则是否存在

#### Parameters

##### ruleId

`string`

要检查的规则ID

##### allRules

`Map`\<`string`, `object`\>

包含所有规则的Map对象

#### Returns

`boolean`

如果规则存在则返回true，否则返回false

***

### parseConfig()

> `static` **parseConfig**(`argvObj`, `checkEntry`): `boolean`

Defined in: utils/common/ConfigUtils.ts:60

解析配置文件并设置检查入口

#### Parameters

##### argvObj

`OptionValues`

命令行参数对象

##### checkEntry

[`CheckEntry`](CheckEntry.md)

检查入口对象

#### Returns

`boolean`

是否成功解析配置文件
