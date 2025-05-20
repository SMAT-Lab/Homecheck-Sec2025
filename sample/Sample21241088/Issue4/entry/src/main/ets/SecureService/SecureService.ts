import ServiceExtensionAbility from '@ohos.app.ability.ServiceExtensionAbility';
import Want from '@ohos.app.ability.Want';
import rpc from '@ohos.rpc';

export default class VulnerableService extends ServiceExtensionAbility {
    onStart(want: Want) {
        console.log('VulnerableService onStart');
        // 问题：此Service在module.json5中导出，但依赖一个 user_grant 权限
    }
    // ...
}