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
import { JsCodeCacheByPrecompileCheck } from '../../../src/checker/performance/JsCodeCacheByPrecompileCheck';
import { Rule } from '../../../src/Index';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const testPath = './test/unittest/sample/JsCodeCacheByPrecompile';
    const rule: Rule = new Rule('@performance/js-code-cache-by-precompile-check', ALERT_LEVEL.SUGGESTION);
    checkEntry = await testCaseCheck(testPath, rule, CHECK_MODE.FILE2CHECK, JsCodeCacheByPrecompileCheck, true);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('JsCodeCacheByPrecompileCheckTest', () => {

    /**
     * @tc.number: JsCodeCacheByPrecompileCheckTest_001
     * @tc.name: 未在onControllerAttached中开启了预编译功能
     * @tc.desc: 未在onControllerAttached中开启了预编译功能
     */
    test('JsCodeCacheByPrecompileCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'JsCodeCacheByPrecompileCheckReport.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('31%7%9')));
        expect(detectFileReports?.length).toBe(1);
    })

    /**
     * @tc.number: JsCodeCacheByPrecompileCheckTest_002
     * @tc.name: 在onControllerAttached中开启了预编译功能
     * @tc.desc: 在onControllerAttached中开启了预编译功能
     */
    test('JsCodeCacheByPrecompileCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'JsCodeCacheByPrecompileCheckNoReport.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        expect(file2Check?.issues.length).toBe(0);
    })

    /**
     * @tc.number: JsCodeCacheByPrecompileCheckTest_003
     * @tc.name: 在aboutToAppear中开启了预编译功能
     * @tc.desc: 在aboutToAppear中开启了预编译功能
     */
    test('JsCodeCacheByPrecompileCheckTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'JsCodeCacheByPrecompileCheckNoReport2.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        expect(file2Check?.issues.length).toBe(0);
    })

})