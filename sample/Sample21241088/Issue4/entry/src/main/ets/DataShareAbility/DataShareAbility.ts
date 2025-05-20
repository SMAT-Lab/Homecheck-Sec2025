import DataAbility from '@ohos.app.ability.DataAbility';
import rdb from '@ohos.data.rdb';
import { ValuesBucket } from '@ohos.data.ValuesBucket';
import { PacMap } from '@ohos.ability.wantConstant';

export default class DataShareAbility extends DataAbility {
    onCreate() {
        console.log('DataShareAbility onCreate');
        // 问题：此DataAbility在module.json5中导出但未声明权限
    }
    // 实现 insert, query, update, delete 等方法
    async query(uri: string, columns: Array<string>, predicates: PacMap) {
        console.log('DataShareAbility query called');
        return null;
    }
}