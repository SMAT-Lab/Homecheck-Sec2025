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
import { BanCallbackOperationsCheck } from '../../../src/checker/stability/BanCallbackOperationsCheck';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/BanCallbackOperations', rule, CHECK_MODE.FILE2CHECK, BanCallbackOperationsCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('BanCallbackOperationsTest', () => {

    /**
     * @tc.number: BanCallbackOperationsTest_001
     * @tc.name: cameraManager调用on方法，callback里面调用了off方法，需要上报
     * @tc.desc: cameraManager调用on方法，callback里面调用了off方法，需要上报
     */
    test('BanCallbackOperationsTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'BanCallbackOperationsReport.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('22%15%16')));
        expect(detectFileReports?.length).toBe(1);
    });

    /**
     * @tc.number: BanCallbackOperationsTest_002
     * @tc.name: cameraManager调用on方法，callback为箭头函数调用了on方法，需要上报
     * @tc.desc: cameraManager调用on方法，callback为箭头函数调用了on方法，需要上报
     */
    test('BanCallbackOperationsTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'BanCallbackOperationsReport2.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('21%15%16') || issue.defect.fixKey.includes('24%17%18')));
        expect(detectFileReports?.length).toBe(2);
    });

    /**
     * @tc.number: BanCallbackOperationsTest_003
     * @tc.name: cameraManager调用on方法，callback里面调用了on方法，互相调用，需要上报
     * @tc.desc: cameraManager调用on方法，callback里面调用了on方法，互相调用，需要上报
     */
    test('BanCallbackOperationsTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'BanCallbackOperationsReport3.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('23%17%18') || issue.defect.fixKey.includes('28%17%18')));
        expect(detectFileReports?.length).toBe(2);
    });

    /**
     * @tc.number: BanCallbackOperationsTest_004
     * @tc.name: cameraManager调用on方法，callback里面未调用on或off方法，不需要上报
     * @tc.desc: cameraManager调用on方法，callback里面未调用on或off方法，不需要上报
     */
    test('BanCallbackOperationsTest_004', () => {
        const detectFile: string = path.join(realPath, 'ets', 'BanCallbackOperationsNoReport.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        expect(file2Check?.issues.length).toBe(0);
    });

    /**
     * @tc.number: BanCallbackOperationsTest_005
     * @tc.name: cameraManager调用on方法，callback为箭头函数未调用on或off方法，不需要上报
     * @tc.desc: cameraManager调用on方法，callback为箭头函数未调用on或off方法，不需要上报
     */
    test('BanCallbackOperationsTest_005', () => {
        const detectFile: string = path.join(realPath, 'ets', 'BanCallbackOperationsNoReport2.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        expect(file2Check?.issues.length).toBe(0);
    });
})