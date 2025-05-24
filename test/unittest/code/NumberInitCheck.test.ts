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
import { NumberInitCheck } from '../../../src/checker/performance/NumberInitCheck';
import { Rule } from '../../../src/Index';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';


let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const testPath = './test/unittest/sample/NumberInit';
    const rule: Rule = new Rule('@performance/number-init-check', ALERT_LEVEL.SUGGESTION);
    checkEntry = await testCaseCheck(testPath, rule, CHECK_MODE.PROJECT2CHECK, NumberInitCheck, true);
    realPath = checkEntry.scene.getRealProjectDir();
})


describe('NumberInitCheckTest', () => {

    /**
     * @tc.number: NumberInitCheckTest_001
     * @tc.name: 变量的定义语句和重新赋值类型不一样
     * @tc.desc: 变量的定义语句和重新赋值类型不一样
     */
    test('NumberInitCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NumberInitReport.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('19%5%5') || issue.defect.fixKey.includes('21%5%5') ||
                issue.defect.fixKey.includes('28%7%7') || issue.defect.fixKey.includes('24%5%11') ||
                issue.defect.fixKey.includes('33%7%9') || issue.defect.fixKey.includes('30%5%5') ||
                issue.defect.fixKey.includes('37%5%5') || issue.defect.fixKey.includes('40%5%5')));
        expect(detectFileReports.length).toBe(8);
    })

    test('NumberInitCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NumberInitReport.ts');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('19%5%5') || issue.defect.fixKey.includes('21%5%5') ||
                issue.defect.fixKey.includes('28%7%7') || issue.defect.fixKey.includes('24%5%11') ||
                issue.defect.fixKey.includes('33%7%9') || issue.defect.fixKey.includes('30%5%5') ||
                issue.defect.fixKey.includes('37%5%5') || issue.defect.fixKey.includes('40%5%5')));
        expect(detectFileReports.length).toBe(8);
    })

    /**
     * @tc.number: NumberInitCheckTest_002
     * @tc.name: 变量的定义语句和重新赋值类型一样或类型无法获取
     * @tc.desc: 变量的定义语句和重新赋值类型一样或类型无法获取
     */
    test('NumberInitCheckTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NumberInitNoReport.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    })

    test('NumberInitCheckTest_004', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NumberInitNoReport.ts');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    })

})