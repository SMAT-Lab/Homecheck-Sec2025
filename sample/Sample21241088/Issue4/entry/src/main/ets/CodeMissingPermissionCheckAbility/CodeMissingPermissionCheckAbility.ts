import UIAbility from '@ohos.app.ability.UIAbility';
import Want from '@ohos.app.ability.Want';
import abilityAccessCtrl, { Permissions } from '@ohos.abilityAccessCtrl'; // 导入

export default class CodeMissingPermissionCheckAbility extends UIAbility {
    onNewWant(want: Want) {
        console.log('CodeMissingPermissionCheckAbility onNewWant');
        // 问题：此Ability在module.json5中导出并声明了 ohos.permission.CAMERA
        // 但在这里没有使用 abilityAccessCtrl.createAtManager().checkAccessTokenSync() 进行检查
        this.performSensitiveOperation();
    }

    performSensitiveOperation() {
        console.log('Performing sensitive operation that should be permission protected.');
        // 模拟需要权限的操作
    }

    // 正确的做法应该像这样：
    // async onNewWantWithCheck(want: Want) {
    //     console.log('CodeMissingPermissionCheckAbility onNewWantWithCheck');
    //     const atManager = abilityAccessCtrl.createAtManager();
    //     const callerToken = this.context.caller?.tokenID; // 获取调用方tokenID，实际获取方式可能不同
    //     if (callerToken !== undefined) {
    //         try {
    //             // 检查权限
    //             atManager.checkAccessTokenSync(callerToken, "ohos.permission.CAMERA" as Permissions);
    //             console.log("CAMERA permission checked and passed.");
    //             this.performSensitiveOperation();
    //         } catch (err) {
    //             console.error("CAMERA permission denied or error:", err);
    //             // 处理权限不足的情况
    //         }
    //     } else {
    //         console.error("Could not get caller token ID.");
    //     }
    // }
}