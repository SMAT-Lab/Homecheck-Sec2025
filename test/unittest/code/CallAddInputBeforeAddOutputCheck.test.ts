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
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { CallAddInputBeforeAddOutputCheck } from '../../../src/checker/stability/CallAddInputBeforeAddOutputCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/CallAddInputBeforeAddOutput', rule, CHECK_MODE.FILE2CHECK, CallAddInputBeforeAddOutputCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('CallAddInputBeforeAddOutputTest', () => {

    /**
     * @tc.number: CallAddInputBeforeAddOutputTest_001
     * @tc.name: addOutput在前，addInput在后，需要上报
     * @tc.desc: addOutput在前，addInput在后，需要上报
     */
    test('CallAddInputBeforeAddOutputTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'CallAddInputBeforeAddOutputReport.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('23%13%21')));
        expect(detectFileReports?.length).toBe(1);
    });

    /**
     * @tc.number: CallAddInputBeforeAddOutputTest_001
     * @tc.name: addOutput在前，addInput在后，需要上报
     * @tc.desc: addOutput在前，addInput在后，需要上报
     */
    test('CallAddInputBeforeAddOutputTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'CallAddInputBeforeAddOutputReport2.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('23%13%21')));
        expect(detectFileReports?.length).toBe(1);
    });

    /**
     * @tc.number: CallAddInputBeforeAddOutputTest_003
     * @tc.name: addInput在前，addOutput在后，不需要上报
     * @tc.desc: addInput在前，addOutput在后，不需要上报
     */
    test('CallAddInputBeforeAddOutputTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'CallAddInputBeforeAddOutputNoReport.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        expect(file2Check?.issues.length).toBe(0);
    });
})