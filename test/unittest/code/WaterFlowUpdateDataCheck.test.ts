/*
 * Copyright (c) 2024 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { beforeAll, describe, expect, test } from 'vitest';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { WaterFlowUpdateDataCheck } from '../../../src/checker/performance/WaterFlowUpdateDataCheck';
import { Rule } from '../../../src/Index';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const testPath = './test/unittest/sample/WaterFlowUpdateData';
    const rule: Rule = new Rule('@performance/waterflow-data-preload-check', ALERT_LEVEL.SUGGESTION);
    checkEntry = await testCaseCheck(testPath, rule, CHECK_MODE.FILE2CHECK, WaterFlowUpdateDataCheck, true);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('WaterFlowUpdateDataCheckTest', () => {

    /**
     * @tc.number: WaterFlowUpdateDataCheckTest_001
     * @tc.name: Waterflow未预加载数据
     * @tc.desc: Waterflow未预加载数据
     */
    test('WaterFlowUpdateDataCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'WaterFlowUpdateDataReport.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('68%7%15')));
        expect(detectFileReports?.length).toBe(1);
    })

    /**
     * @tc.number: WaterFlowUpdateDataCheckTest_002
     * @tc.name: Waterflow预加载数据
     * @tc.desc: Waterflow预加载数据
     */
    test('WaterFlowUpdateDataCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'WaterFlowUpdateDataNoReport.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        expect(file2Check?.issues.length).toBe(0);
    })

})