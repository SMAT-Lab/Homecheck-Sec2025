/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
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

import { assert, beforeAll, expect, describe, test } from 'vitest';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { AwaitThenableCheck } from '../../../src/checker/ArkTS-eslint/AwaitThenableCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/AwaitThenable', rule, CHECK_MODE.FILE2CHECK, AwaitThenableCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('AwaitThenableCheckTest', () => {

    /**
     * @tc.number: AwaitThenableCheckTest_001
     * @tc.name:不允许对不是“Thenable”对象的值使用await关键字（“Thenable”表示某个对象拥有“then”方法，比如Promise）
     * @tc.desc: 不允许对不是“Thenable”对象的值使用await关键字（“Thenable”表示某个对象拥有“then”方法，比如Promise）
     */
    test('AwaitThenableCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoAwaitThenable.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        expect(detectedFileReport?.issues.length).toBe(0);

    });

    /**
     * @tc.number: AwaitThenableCheckTest_002
     * @tc.name: 不允许对不是“Thenable”对象的值使用await关键字（“Thenable”表示某个对象拥有“then”方法，比如Promise）
     * @tc.desc: 不允许对不是“Thenable”对象的值使用await关键字（“Thenable”表示某个对象拥有“then”方法，比如Promise）
     */
    test('AwaitThenableCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AwaitThenable.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        expect(detectedFileReport?.issues.length).toBe(2);
    });
    /**
     * @tc.number: AwaitThenableCheckTest_002
     * @tc.name: 不允许对不是“Thenable”对象的值使用await关键字（“Thenable”表示某个对象拥有“then”方法，比如Promise）
     * @tc.desc: 不允许对不是“Thenable”对象的值使用await关键字（“Thenable”表示某个对象拥有“then”方法，比如Promise）
     */
    test('AwaitThenableCheckTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AwaitThenable.ts');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        expect(detectedFileReport?.issues.length).toBe(2);
    });
})