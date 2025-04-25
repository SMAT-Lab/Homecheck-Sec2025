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
import { ModuleTopLevelCodeCheck } from '../../../src/checker/performance/ModuleTopLevelCodeCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/ModuleTopLevelCodeCheck', rule, CHECK_MODE.FILE2CHECK, ModuleTopLevelCodeCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('ModuleTopLevelCodeCheckTest', () => {
    /**
     * @tc.number: ModuleTopLevelCodeCheck_001
     * @tc.name: 顶层节点类型是VariableStatement
     * @tc.desc: 顶层节点类型是VariableStatement
     */
    test('ModuleTopLevelCodeCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'noReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    /**
     * @tc.number: ModuleTopLevelCodeCheckTest_002
     * @tc.name: 顶层节点类型是ExpressionStatement
     * @tc.desc: 顶层节点类型是ExpressionStatement
     */
    test('ModuleTopLevelCodeCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'report0.ets');
        const expectReportList = ['16%1%1', '17%1%1', '19%1%1'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: ModuleTopLevelCodeCheckTest_003
     * @tc.name: 顶层节点类型是IfStatement
     * @tc.desc: 顶层节点类型是IfStatement
     */
    test('ModuleTopLevelCodeCheckTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'report1.ets');
        const expectReportList = ['16%1%1', '22%1%1'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: ModuleTopLevelCodeCheckTest_004
     * @tc.name: 顶层节点类型是isExpressionStatement
     * @tc.desc: 顶层节点类型是isExpressionStatement
     */
    test('ModuleTopLevelCodeCheckTest_004', () => {
        const detectFile: string = path.join(realPath, 'ets', 'report2.ets');
        const expectReportList = ['18%1%1'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: ModuleTopLevelCodeCheckTest_005
     * @tc.name: 顶层节点类型是DoStatement
     * @tc.desc: 顶层节点类型是DoStatement
     */
    test('ModuleTopLevelCodeCheckTest_005', () => {
        const detectFile: string = path.join(realPath, 'ets', 'report3.ets');
        const expectReportList = ['17%1%1'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: ModuleTopLevelCodeCheckTest_006
     * @tc.name: 顶层节点类型是WhileStatement
     * @tc.desc: 顶层节点类型是WhileStatement
     */
    test('ModuleTopLevelCodeCheckTest_006', () => {
        const detectFile: string = path.join(realPath, 'ets', 'report4.ets');
        const expectReportList = ['17%1%1'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: ModuleTopLevelCodeCheckTest_007
     * @tc.name: 顶层节点类型是ForStatement
     * @tc.desc: 顶层节点类型是ForStatement
     */
    test('ModuleTopLevelCodeCheckTest_007', () => {
        const detectFile: string = path.join(realPath, 'ets', 'report5.ets');
        const expectReportList = ['16%1%1'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: ModuleTopLevelCodeCheckTest_008
     * @tc.name: 顶层节点类型是SwitchStatement
     * @tc.desc: 顶层节点类型是SwitchStatement
     */
    test('ModuleTopLevelCodeCheckTest_008', () => {
        const detectFile: string = path.join(realPath, 'ets', 'report6.ets');
        const expectReportList = ['17%1%1'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: ModuleTopLevelCodeCheckTest_009
     * @tc.name: 顶层节点类型是TryStatement
     * @tc.desc: 顶层节点类型是TryStatement
     */
    test('ModuleTopLevelCodeCheckTest_009', () => {
        const detectFile: string = path.join(realPath, 'ets', 'report7.ets');
        const expectReportList = ['16%1%1'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: ModuleTopLevelCodeCheckTest_010
     * @tc.name: 顶层节点类型是block
     * @tc.desc: 顶层节点类型是block
     */
    test('ModuleTopLevelCodeCheckTest_010', () => {
        const detectFile: string = path.join(realPath, 'ets', 'report8.ets');
        const expectReportList = ['16%1%1'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: ModuleTopLevelCodeCheckTest_011
     * @tc.name: 顶层节点类型是ExpressionStatement
     * @tc.desc: 顶层节点类型是ExpressionStatement
     */
    test('ModuleTopLevelCodeCheckTest_011', () => {
        const detectFile: string = path.join(realPath, 'ets', 'report9.ets');
        const expectReportList = ['16%1%1'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: ModuleTopLevelCodeCheckTest_012
     * @tc.name: 顶层节点类型是VariableStatement
     * @tc.desc: 顶层节点类型是VariableStatement
     */
    test('ModuleTopLevelCodeCheckTest_012', () => {
        const detectFile: string = path.join(realPath, 'ets', 'report10.ets');
        const expectReportList = ['16%1%1'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });
})
