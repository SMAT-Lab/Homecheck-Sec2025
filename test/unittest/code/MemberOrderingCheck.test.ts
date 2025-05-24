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
import { MemberOrderingCheck } from '../../../src/checker/ArkTS-eslint/MemberOrderingCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/MemberOrdering', rule, CHECK_MODE.FILE2CHECK, MemberOrderingCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('MemberOrderingCheckTest', () => {

    /**
     * @tc.number: MemberOrderingCheckTest_001
     * @tc.name: 要求类、接口和类型字面量中成员的排序方式保持一致的风格
     * @tc.desc:要求类、接口和类型字面量中成员的排序方式保持一致的风格
     */
    test('MemberOrderingCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'MemberOrdering.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
        expect(detectedFileReport?.issues.length).toBe(0);

    });

    /**
     * @tc.number: MemberOrderingCheckTest_002
     * @tc.name: 要求类、接口和类型字面量中成员的排序方式保持一致的风格
     * @tc.desc: 要求类、接口和类型字面量中成员的排序方式保持一致的风格
     */
    test('MemberOrderingCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoMemberOrdering.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        expect(detectedFileReport?.issues.length).toBe(4);
    });
})