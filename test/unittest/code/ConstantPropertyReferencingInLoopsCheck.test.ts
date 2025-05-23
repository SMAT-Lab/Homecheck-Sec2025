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
import { ConstantPropertyReferencingInLoopsCheck } from '../../../src/checker/performance/ConstantPropertyReferencingInLoopsCheck';
import { Rule } from '../../../src/Index';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const testPath = './test/unittest/sample/ConstantPropertyReferencingInLoops';
    const rule: Rule = new Rule('@performance/constant-property-referencing-check-in-loops', ALERT_LEVEL.SUGGESTION);
    checkEntry = await testCaseCheck(testPath, rule, CHECK_MODE.FILE2CHECK, ConstantPropertyReferencingInLoopsCheck, true);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('ConstantPropertyReferencingInLoopsCheckTest', () => {

    /**
     * @tc.number: ConstantPropertyReferencingInLoopsCheckTest_001
     * @tc.name: 循环语句中使用了常量，需要上报
     * @tc.desc: 循环语句中使用了常量，需要上报
     */
    test('ConstantPropertyReferencingInLoopsCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'ConstantPropertyReferencingInLoopsReport.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('25%16%42')));
        expect(detectFileReports?.length).toBe(1);
    });

    /**
     * @tc.number: ConstantPropertyReferencingInLoopsCheckTest_002
     * @tc.name: 循环语句中未使用了常量，不需要上报
     * @tc.desc: 循环语句中未使用了常量，不需要上报
     */
    test('ConstantPropertyReferencingInLoopsCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'ConstantPropertyReferencingInLoopsNoReport.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        expect(file2Check?.issues.length).toBe(0);
    })
})