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

import { assert, beforeAll, expect, describe, test } from 'vitest';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { ExplicitFunctionReturnTypeCheck } from '../../../src/checker/ArkTS-eslint/ExplicitFunctionReturnTypeCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/ExplicitFunctionReturnType', rule, CHECK_MODE.FILE2CHECK, ExplicitFunctionReturnTypeCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('ExplicitFunctionReturnTypeCheckTest', () => {

    /**
     * @tc.number: ExplicitFunctionReturnTypeCheckTest_001
     * @tc.name: 函数和类方法需要显式的定义返回类型
     * @tc.desc: 函数和类方法需要显式的定义返回类型
     */
    test('ExplicitFunctionReturnTypeCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ts', 'ExplicitFunctionReturnType.ts');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
        expect(detectedFileReport?.issues.length).toBe(0);

    });

    /**
     * @tc.number: ExplicitFunctionReturnTypeCheckTest_002
     * @tc.name: 函数和类方法没有显式的定义返回类型
     * @tc.desc: 函数和类方法需要没有的定义返回类型
     */
    test('ExplicitFunctionReturnTypeCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoExplicitFunctionReturnType.ts');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        expect(detectedFileReport?.issues.length).toBe(4);
    });
})