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

import { assert, beforeAll, describe, expect, test } from 'vitest';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { SparseArrayCheck } from '../../../src/checker/performance/SparseArrayCheck';
import { Rule } from '../../../src/Index';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const testPath = './test/unittest/sample/SparseArray';
    const rule: Rule = new Rule('@performance/sparse-array-check', ALERT_LEVEL.SUGGESTION);
    checkEntry = await testCaseCheck(testPath, rule, CHECK_MODE.FILE2CHECK, SparseArrayCheck, true);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('SparseArrayCheckTest', () => {
    // ts
    test('ts稀疏数组，需要上报', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report.ts');
        const expectReportList = [
            '19%34%38', '22%34%38', '24%20%23', '29%34%38', '32%34%38', '36%34%38', '39%34%38', '43%35%37',
            '45%35%37', '49%35%35', '53%35%35', '58%34%38', '63%35%39', '66%35%39', '70%35%39', '74%35%39',
            '76%25%41', '80%25%27', '85%35%41', '89%48%54', '89%68%74', '89%88%94', '90%48%54', '90%88%94',
            '95%10%13', '98%10%12', '102%10%13', '107%10%13', '111%10%13', '115%10%13', '117%10%26', '122%10%13',
            '125%10%17', '128%14%17', '130%14%17', '130%29%32', '130%44%47', '131%14%17', '131%42%45', '134%14%21',
            '134%47%50', '137%14%21', '137%33%40', '137%52%62'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    })

    test('ts稀疏数组，不需要上报', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_noreport.ts');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    // ets
    test('ets稀疏数组，需要上报', () => {
        const detectFile: string = path.join(realPath, 'ets', 'SparseArrayReport.ets');
        const expectReportList = [
            '32%36%40', '35%36%40', '37%22%25', '42%36%40', '45%36%40', '49%36%40', '52%36%40', '56%37%39',
            '58%37%39', '62%37%37', '66%37%37', '71%36%40', '76%37%41', '79%37%41', '83%37%41', '87%37%41',
            '89%37%53', '93%37%39', '98%37%43', '102%50%56', '102%70%76', '102%90%96', '103%50%56', '103%90%96',
            '118%20%23', '121%20%22', '125%20%23', '130%20%23', '134%20%23', '138%20%23', '140%20%36', '145%20%23',
            '148%20%27', '151%24%27', '153%24%27', '153%39%42', '153%54%57', '154%24%27', '154%52%55', '157%24%31',
            '157%57%60', '160%24%31', '160%43%50', '160%62%72'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    })

    test('ets稀疏数组，不需要上报', () => {
        const detectFile: string = path.join(realPath, 'ets', 'SparseArrayNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })


    /**
     * @tc.number: SparseArrayTest_001
     * @tc.name: 数组创建，检测常量入参
     * @tc.desc: 数组创建，检测常量入参
     */
    test('SparseArrayTest_001', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_new_array.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('7%34%38')));
        expect(detectFileReports?.length).toBe(1);
    })

    /**
     * @tc.number: SparseArrayTest_002
     * @tc.name: 数组创建，检测变量入参，参数为常量
     * @tc.desc: 数组创建，检测变量入参，参数为常量
     */
    test('SparseArrayTest_002', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_new_array.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('10%34%38')));
        expect(detectFileReports?.length).toBe(1);
    })

    /**
     * @tc.number: SparseArrayTest_003
     * @tc.name: 数组创建，检测变量入参，参数为二元运算符(加减乘除)运算结果
     * @tc.desc: 数组创建，检测变量入参，参数为二元运算符(加减乘除)运算结果
     */
    test('SparseArrayTest_003', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_new_array.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('20%36%41') || issue.defect.fixKey.includes('21%36%41')
                || issue.defect.fixKey.includes('22%36%41') || issue.defect.fixKey.includes('23%36%41')));
        expect(detectFileReports?.length).toBe(4);
    })

    /**
     * @tc.number: SparseArrayTest_004
     * @tc.name: 数组创建，检测变量入参，参数为一元运算自增、自减结果
     * @tc.desc: 数组创建，检测变量入参，参数为一元运算自增、自减结果
     */
    test('SparseArrayTest_004', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_new_array.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('33%36%37') || issue.defect.fixKey.includes('34%36%37')
                || issue.defect.fixKey.includes('35%36%37') || issue.defect.fixKey.includes('36%36%36')));
        expect(detectFileReports?.length).toBe(4);
    })

    /**
     * @tc.number: SparseArrayTest_005
     * @tc.name: 数组创建，检测变量入参，参数为位运算(与、或、异或、非)结果
     * @tc.desc: 数组创建，检测变量入参，参数为位运算(与、或、异或、非)结果
     */
    test('SparseArrayTest_005', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_new_array.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('45%36%41') || issue.defect.fixKey.includes('46%36%41')
                || issue.defect.fixKey.includes('47%36%41') || issue.defect.fixKey.includes('48%36%41')));
        expect(detectFileReports?.length).toBe(4);
    })

    /**
     * @tc.number: SparseArrayTest_006
     * @tc.name: 数组创建，检测变量入参，参数为(<<、>>、>>>)结果
     * @tc.desc: 数组创建，检测变量入参，参数为(<<、>>、>>>)结果
     */
    test('SparseArrayTest_006', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_new_array.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('54%36%41') || issue.defect.fixKey.includes('55%36%41')
                || issue.defect.fixKey.includes('56%36%41')));
        expect(detectFileReports?.length).toBe(3);
    })

    /**
     * @tc.number: SparseArrayTest_007
     * @tc.name: 数组创建，检测变量入参，参数为全局变量结果
     * @tc.desc: 数组创建，检测变量入参，参数为全局变量结果
     */
    test('SparseArrayTest_007', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_new_array.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('58%24%41')));
        expect(detectFileReports?.length).toBe(1);
    })

    /**
     * @tc.number: SparseArrayTest_008
     * @tc.name: 数组创建，检测变量入参，参数为赋值运算(加法减法)结果
     * @tc.desc: 数组创建，检测变量入参，参数为赋值运算(加法减法)结果
     */
    test('SparseArrayTest_008', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_new_array.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('64%26%27') || issue.defect.fixKey.includes('65%26%27')));
        expect(detectFileReports?.length).toBe(2);
    })

    /**
     * @tc.number: SparseArrayTest_009
     * @tc.name: 数组创建，检测变量入参，参数为复杂表达式结果
     * @tc.desc: 数组创建，检测变量入参，参数为复杂表达式结果
     */
    test('SparseArrayTest_009', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_new_array.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('70%34%39')));
        expect(detectFileReports?.length).toBe(1);
    })

    /**
     * @tc.number: SparseArrayTest_010
     * @tc.name: 数组创建，检测表达式入参
     * @tc.desc: 数组创建，检测表达式入参
     */
    test('SparseArrayTest_010', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_new_array.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('74%35%49')));
        expect(detectFileReports?.length).toBe(1);
    })

    /**
     * @tc.number: SparseArrayTest_011
     * @tc.name: 数组创建，检测类静态变量入参
     * @tc.desc: 数组创建，检测类静态变量入参
     */
    test('SparseArrayTest_011', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_new_array.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('76%35%54')));
        expect(detectFileReports?.length).toBe(1);
    })

    /**
     * @tc.number: SparseArrayTest_012
     * @tc.name: 数组创建，检测import入参
     * @tc.desc: 数组创建，检测import入参
     */
    test('SparseArrayTest_012', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_new_array.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('78%35%45')));
        expect(detectFileReports?.length).toBe(1);
    })

    /**
     * @tc.number: SparseArrayTest_013
     * @tc.name: 数组创建，检测一行多个上报，且Array重名场景
     * @tc.desc: 数组创建，检测一行多个上报，且Array重名场景
     */
    test('SparseArrayTest_013', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_new_array.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('81%48%53') || issue.defect.fixKey.includes('81%67%72')
                || issue.defect.fixKey.includes('81%86%91')));
        expect(detectFileReports?.length).toBe(3);
    })

    /**
     * @tc.number: SparseArrayTest_014
     * @tc.name: 数组创建，for循环内
     * @tc.desc: 数组创建，for循环内
     */
    test('SparseArrayTest_014', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_new_array.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('99%25%30')));
        expect(detectFileReports?.length).toBe(0);
    })

    /**
     * @tc.number: SparseArrayTest_015
     * @tc.name: 数组创建，入参方法返回值
     * @tc.desc: 数组创建，入参方法返回值
     */
    test('SparseArrayTest_015', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_new_array.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('102%25%34')));
        expect(detectFileReports?.length).toBe(0);
    })

    /**
     * @tc.number: SparseArrayTest_016
     * @tc.name: 数组引用，检测常量索引
     * @tc.desc: 数组引用，检测常量索引
     */
    test('SparseArrayTest_016', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_array_use.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.startsWith('8%10%13')));
        expect(detectFileReports?.length).toBe(1);
    })

    /**
     * @tc.number: SparseArrayTest_017
     * @tc.name: 数组引用，检测变量索引,索引为常量
     * @tc.desc: 数组引用，检测变量索引,索引为常量
     */
    test('SparseArrayTest_017', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_array_use.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('11%10%12')));
        expect(detectFileReports?.length).toBe(1);
    })

    /**
     * @tc.number: SparseArrayTest_018
     * @tc.name: 数组引用，检测变量索引,索引为二元运算符(加减乘除)结果
     * @tc.desc: 数组引用，检测变量索引,索引为二元运算符(加减乘除)结果
     */
    test('SparseArrayTest_018', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_array_use.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('20%10%13') || issue.defect.fixKey.includes('21%10%13')
                || issue.defect.fixKey.includes('22%10%13') || issue.defect.fixKey.includes('23%10%13')));
        expect(detectFileReports?.length).toBe(4);
    })

    /**
     * @tc.number: SparseArrayTest_019
     * @tc.name: 数组引用，检测变量索引,索引为一元运算自增、自减结果
     * @tc.desc: 数组引用，检测变量索引,索引为一元运算自增、自减结果
     */
    test('SparseArrayTest_019', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_array_use.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('28%10%14') || issue.defect.fixKey.includes('29%10%14')));
        expect(detectFileReports?.length).toBe(2);
    })

    /**
    * @tc.number: SparseArrayTest_020
    * @tc.name: 数组引用，检测变量索引,索引为位运算(与、或、异或、非)结果
    * @tc.desc: 数组引用，检测变量索引,索引为位运算(与、或、异或、非)结果
    */
    test('SparseArrayTest_020', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_array_use.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('38%10%13') || issue.defect.fixKey.includes('39%10%13')
                || issue.defect.fixKey.includes('40%10%13') || issue.defect.fixKey.includes('41%10%13')));
        expect(detectFileReports?.length).toBe(4);
    })

    /**
    * @tc.number: SparseArrayTest_021
    * @tc.name: 数组引用，检测变量索引,索引为(<<、>>、>>>)结果
    * @tc.desc: 数组引用，检测变量索引,索引为(<<、>>、>>>非)结果
    */
    test('SparseArrayTest_021', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_array_use.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('47%10%13') || issue.defect.fixKey.includes('48%10%13')
                || issue.defect.fixKey.includes('49%10%13')));
        expect(detectFileReports?.length).toBe(3);
    })

    /**
    * @tc.number: SparseArrayTest_022
    * @tc.name: 数组引用，检测变量索引,索引为赋值运算(加法减法)结果
    * @tc.desc: 数组引用，检测变量索引,索引为赋值运算(加法减法)结果
    */
    test('SparseArrayTest_022', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_array_use.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('55%10%15') || issue.defect.fixKey.includes('56%10%15')));
        expect(detectFileReports?.length).toBe(2);
    })

    /**
    * @tc.number: SparseArrayTest_023
    * @tc.name: 数组引用，检测变量索引,索引为全局变量结果
    * @tc.desc: 数组引用，检测变量索引,索引为全局变量结果
    */
    test('SparseArrayTest_023', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_array_use.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('58%10%27')));
        expect(detectFileReports?.length).toBe(1);
    })

    /**
    * @tc.number: SparseArrayTest_024
    * @tc.name: 数组引用，检测变量索引,索引为复杂表达式结果
    * @tc.desc: 数组引用，检测变量索引,索引为复杂表达式结果
    */
    test('SparseArrayTest_024', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_array_use.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('63%10%16')));
        expect(detectFileReports?.length).toBe(1);
    })

    /**
    * @tc.number: SparseArrayTest_025
    * @tc.name: 数组引用，检测表达式索引
    * @tc.desc: 数组引用，检测表达式索引
    */
    test('SparseArrayTest_025', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_array_use.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('66%10%21')));
        expect(detectFileReports?.length).toBe(1);
    })

    /**
    * @tc.number: SparseArrayTest_026
    * @tc.name: 数组引用，检测引用索引，索引为数组引用的结果
    * @tc.desc: 数组引用，检测引用索引，索引为数组引用的结果
    */
    test('SparseArrayTest_026', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_array_use.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('79%10%15')));
        expect(detectFileReports?.length).toBe(0);
    })

    /**
    * @tc.number: SparseArrayTest_027
    * @tc.name: 数组引用，检测静态引用索引，索引为类引用
    * @tc.desc: 数组引用，检测静态引用索引，索引为类引用
    */
    test('SparseArrayTest_027', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_array_use.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('72%10%29')));
        expect(detectFileReports?.length).toBe(1);
    })

    /**
    * @tc.number: SparseArrayTest_028
    * @tc.name: 数组引用，检测import索引，索引为import
    * @tc.desc: 数组引用，检测import索引，索引为import
    */
    test('SparseArrayTest_028', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_array_use.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('74%10%20')));
        expect(detectFileReports?.length).toBe(1);
    })

    /**
    * @tc.number: SparseArrayTest_029
    * @tc.name: 数组引用，检测同一行多个上报场景
    * @tc.desc: 数组引用，检测同一行多个上报场景
    */
    test('SparseArrayTest_029', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_array_use.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('76%14%17') || issue.defect.fixKey.includes('76%29%32')
                || issue.defect.fixKey.includes('76%44%47')));
        expect(detectFileReports?.length).toBe(3);
    })

    /**
    * @tc.number: SparseArrayTest_030
    * @tc.name: 数组引用，for循环内
    * @tc.desc: 数组引用，for循环内
    */
    test('SparseArrayTest_030', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_array_use.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('96%10%15')));
        expect(detectFileReports?.length).toBe(0);
    })

    /**
     * @tc.number: SparseArrayCheckTest_031
     * @tc.name: 数组引用，入参方法返回值
     * @tc.desc: 数组引用，入参方法返回值
     */
    test('SparseArrayCheckTest_031', () => {
        const detectFile: string = path.join(realPath, 'ts', 'test_report_array_use.ts');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('98%10%19')));
        expect(detectFileReports?.length).toBe(0);
    })

})