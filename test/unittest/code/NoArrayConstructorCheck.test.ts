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

import { assert, beforeAll, describe, test } from 'vitest';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { Rule } from '../../../src/Index';
import { NoArrayConstructorCheck } from '../../../src/checker/ArkTS-eslint/NoArrayConstructorCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('@ArkTS-eslint/no-array-constructor-check');
    checkEntry = await testCaseCheck('./test/unittest/sample/NoArrayConstructor', rule, CHECK_MODE.FILE2CHECK, NoArrayConstructorCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoArrayConstructorCheckTest', () => {
    /**
     * @tc.number: NoArrayConstructorCheckTest_001
     * @tc.name: NoArrayConstructor检查Array构造方法创建数组，上报
     * @tc.desc: NoArrayConstructor检查Array构造方法创建数组，上报
     */
    test('NoArrayConstructorCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoArrayConstructorReport.ets');
        const expectReportList = ['16%1','17%1','18%1','19%16','22%16','26%15','27%5','28%5','32%1','35%1','38%1','42%1','45%1',
            '48%1','51%1','54%1','57%1','60%1','62%1','65%1','68%1','71%1','73%6','75%7','77%3','79%8','81%14','83%11','85%4','88%30','90%25',
            '92%33','94%12','98%1','101%1','105%3','110%3','115%1','118%1','121%1','124%1','128%1','132%1','136%1','140%1','147%3'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: NoArrayConstructorCheckTest_002
     * @tc.name: NoArrayConstructor检查Array构造方法部分创建数组，不上报
     * @tc.desc: NoArrayConstructor检查Array构造方法部分创建数组，不上报
     */
    test('NoArrayConstructorCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoArrayConstructorNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})