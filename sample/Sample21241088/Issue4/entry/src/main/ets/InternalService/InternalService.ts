import ServiceExtensionAbility from '@ohos.app.ability.ServiceExtensionAbility';
import Want from '@ohos.app.ability.Want';

export default class InternalService extends ServiceExtensionAbility {
    onStart(want: Want) {
        console.log('InternalService onStart');
        // 安全：此Service在module.json5中未导出
    }
}