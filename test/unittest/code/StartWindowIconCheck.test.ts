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
import { StartWindowIconCheck } from '../../../src/checker/performance/StartWindowIconCheck';
import { Rule } from '../../../src/Index';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const testPath = './test/unittest/sample/StartWindowIcon';
    const rule: Rule = new Rule('@performance/start-window-icon-check', ALERT_LEVEL.SUGGESTION);
    checkEntry = await testCaseCheck(testPath, rule, CHECK_MODE.PROJECT2CHECK, StartWindowIconCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('StartWindowIconCheckTest', () => {

    /**
     * @tc.number: StartWindowIconCheckTest_001
     * @tc.name: startWindowIcon图标尺寸大于256*256
     * @tc.desc: startWindowIcon图标尺寸大于256*256
     */
    test('StartWindowIconCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'src', 'report', 'module.json5');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('22%27%42')));
        expect(detectFileReports.length).toBe(1);
    });

    /**
     * @tc.number: StartWindowIconCheckTest_002
     * @tc.name: startWindowIcon图标尺寸小于256*256
     * @tc.desc: startWindowIcon图标尺寸小于256*256
     */
    test('StartWindowIconCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'src', 'noreport', 'module.json5');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    })
})