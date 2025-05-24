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

import { assert, beforeAll, describe, test } from 'vitest';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { SymbolUsageCheck } from '../../../src/checker/security/SymbolUsageCheck';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let projectPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
  projectPath = path.resolve('./test/unittest/sample/SymbolUsage');
  const targetFilePath = path.join(projectPath, 'ets', 'Target.ets');
  const rule: Rule = new Rule('');
  rule.option = [
    {
      "selector": "namespace",
      "filePath": targetFilePath,
      "namespace": ["MySpace"],  // 找namespace使用处
      "class": "",
      "function": "",
      "property": ""
    },
    {
      "selector": "namespace",
      "filePath": targetFilePath,
      "namespace": ["MySpace", "InnerSpace"],  // 找ns下namespace使用处
      "class": "",
      "function": "",
      "property": ""
    },
    {
      "selector": "class",
      "filePath": targetFilePath,
      "namespace": [],
      "class": "ClassTarget",  // 找类使用处
      "function": "",
      "property": ""
    },
    {
      "selector": "class",
      "filePath": targetFilePath,
      "namespace": ["MySpace", "InnerSpace"],
      "class": "ClassTarget",  // 找ns下类使用处
      "function": "",
      "property": ""
    },
    {
      "selector": "class",
      "filePath": targetFilePath,
      "namespace": [],
      "class": "InterfaceTarget",  // 找接口使用处
      "function": "",
      "property": ""
    },
    {
      "selector": "class",
      "filePath": targetFilePath,
      "namespace": ["MySpace", "InnerSpace"],
      "class": "InterfaceTarget",  // 找ns下接口使用处
      "function": "",
      "property": ""
    },
    {
      "selector": "class",
      "filePath": targetFilePath,
      "namespace": [],
      "class": "EnumTarget",  // 找枚举使用处
      "function": "",
      "property": ""
    },
    {
      "selector": "class",
      "filePath": targetFilePath,
      "namespace": ["MySpace", "InnerSpace"],
      "class": "EnumTarget",  // 找ns下枚举使用处
      "function": "",
      "property": ""
    },
    {
      "selector": "function",
      "filePath": targetFilePath,
      "namespace": [],
      "class": "ClassTarget",
      "function": "methodStatic",  // 找类静态成员方法使用处
      "property": ""
    },
    {
      "selector": "function",
      "filePath": targetFilePath,
      "namespace": ["MySpace", "InnerSpace"],
      "class": "ClassTarget",
      "function": "methodStatic",  // 找ns下类静态成员方法使用处
      "property": ""
    },
    {
      "selector": "function",
      "filePath": targetFilePath,
      "namespace": [],
      "class": "ClassTarget",
      "function": "methodTarget",  // 找类实例成员方法使用处
      "property": ""
    },
    {
      "selector": "function",
      "filePath": targetFilePath,
      "namespace": ["MySpace", "InnerSpace"],
      "class": "ClassTarget",
      "function": "methodTarget",  // 找类实例成员方法使用处
      "property": ""
    },
    {
      "selector": "function",
      "filePath": targetFilePath,
      "namespace": [],
      "class": "",
      "function": "funcTarget",  // 找全局方法使用处
      "property": ""
    },
    {
      "selector": "function",
      "filePath": targetFilePath,
      "namespace": ["MySpace", "InnerSpace"],
      "class": "",
      "function": "funcTarget",  // 找ns下全局方法使用处
      "property": ""
    },
    {
      "selector": "property",
      "filePath": targetFilePath,
      "namespace": [],
      "class": "ClassTarget",
      "function": "",
      "property": "fieldTarget",  // 找类实例属性使用处
    },
    {
      "selector": "property",
      "filePath": targetFilePath,
      "namespace": ["MySpace", "InnerSpace"],
      "class": "ClassTarget",
      "function": "",
      "property": "fieldTarget"  // 找ns下类实例属性使用处
    },
    {
      "selector": "property",
      "filePath": targetFilePath,
      "namespace": [],
      "class": "ClassTarget",
      "function": "",
      "property": "fieldStatic",  // 找类静态属性使用处
    },
    {
      "selector": "property",
      "filePath": targetFilePath,
      "namespace": ["MySpace", "InnerSpace"],
      "class": "ClassTarget",
      "function": "",
      "property": "fieldStatic",  // 找ns下类静态属性使用处
    },
    {
      "selector": "type",
      "filePath": targetFilePath,
      "namespace": [],
      "class": "",
      "function": "",
      "property": "",
      "type": "TypeTarget",  // 找type使用处
    },
    {
      "selector": "type",
      "filePath": targetFilePath,
      "namespace": ["MySpace", "InnerSpace"],
      "class": "",
      "function": "",
      "property": "",
      "type": "TypeTarget",  // 找ns下type使用处
    },
    {
      "selector": "class",
      "filePath": targetFilePath,
      "namespace": [],
      "class": "StructTarget",  // 找sturct使用处
      "function": "",
      "property": "",
      "type": ""
    },
    {
      "selector": "type",
      "filePath": targetFilePath,
      "namespace": ['NSTest'],
      "class": "",
      "function": "",
      "property": "",
      "type": "Constructor"  // 找泛型方法别名
    },
    {
      "selector": "function",
      "filePath": targetFilePath,
      "namespace": ['NSTest'],
      "class": "",
      "function": "testFunc",
      "property": "",
      "type": ""
    },
  ];
  checkEntry = await testCaseCheck(projectPath, rule, CHECK_MODE.PROJECT2CHECK, SymbolUsageCheck);
})

describe('SymbolUsageTest', () => {
  test('指定符号查找', () => {
    const detectFile1: string = path.join(projectPath, 'ets', 'FindClassTest.ets');
    const expectReportList1 = [
      '69%25%31%', '75%5%11%', '78%13%19%', '81%13%19%', '84%13%19%', '87%13%19%', '90%22%28%', '56%44%50%', '58%19%25%', '60%19%25%', '62%19%25%', '64%23%29%', // ns
      '69%25%42%', '75%5%22%', '78%13%30%', '81%13%30%', '84%13%30%', '87%13%30%', '90%22%39%', '56%44%61%', '58%19%36%', '60%19%36%', '62%19%36%', '64%23%40%', // ns下ns
      '31%25%35%', '37%5%15%', '40%13%23%', '43%13%23%', '46%13%23%', '49%13%23%', '52%22%32%', '18%32%42%', '20%19%29%', '22%19%29%', '24%19%29%', '26%23%33%', // class
      '69%44%54%', '75%24%34%', '78%32%42%', '81%32%42%', '84%32%42%', '87%32%42%', '90%41%51%', '56%63%73%', '58%38%48%', '60%38%48%', '62%38%48%', '64%42%52%', // ns下class
      '43%13%36%', '46%25%36%', '22%19%42%', '24%31%42%', // 类静态方法
      '81%32%55%', '84%44%55%', '60%38%61%', '62%50%61%', // ns下类静态方法
      '34%23%33%', // 类实例属性
      '72%23%33%', // ns下类实例属性
      '37%17%27%', '40%25%35%', '49%25%35%', '20%31%41%', // 类静态属性
      '75%36%46%', '78%44%54%', '87%44%54%', '58%50%60%', // ns下类静态属性
    ];
    const detectFileReports1 = checkEntry.projectCheck.issues.filter(issue => issue.defect.mergeKey.startsWith(detectFile1));
    assert.equal(detectFileReports1.length, expectReportList1.length, 'The number of reported line is different from the expected number of line.');
    detectFileReports1.forEach((issue, index) => {
      assert.include(issue.defect.fixKey, expectReportList1[index]);
    });

    const detectFile2: string = path.join(projectPath, 'ets', 'FindEnumTest.ets');
    const expectReportList2 = [
      '47%15%21%', '49%21%27%', '52%17%23%', '40%19%25%', '42%19%25%', // ns
      '47%15%32%', '49%21%38%', '52%17%34%', '40%19%36%', '42%19%36%', // ns下ns
      '27%15%24%', '29%21%30%', '32%17%26%', '20%19%28%', '22%19%28%', // enum
      '47%34%43%', '49%40%49%', '52%36%45%', '40%38%47%', '42%38%47%', // ns下enum
    ];
    const detectFileReports2 = checkEntry.projectCheck.issues.filter(issue => issue.defect.mergeKey.startsWith(detectFile2));
    assert.equal(detectFileReports2.length, expectReportList2.length, 'The number of reported line is different from the expected number of line.');
    detectFileReports2.forEach((issue, index) => {
      assert.include(issue.defect.fixKey, expectReportList2[index]);
    });

    const detectFile3: string = path.join(projectPath, 'ets', 'FindFunctionTest.ets');
    const expectReportList3 = [
      '56%13%19%', '58%13%19%', '60%13%19%', '62%17%23%', '66%5%11%', '68%5%11%', '48%19%25%', '50%19%25%', '52%19%25%', // ns
      '56%13%30%', '58%13%30%', '60%13%30%', '62%17%34%', '66%5%22%', '68%5%22%', '48%19%36%', '50%19%36%', '52%19%36%', // ns下ns
      '30%13%23%', '32%13%23%', '34%17%27%', '40%5%15%', '22%19%29%', '24%19%29%', // class
      '58%32%42%', '60%32%42%', '62%36%46%', '68%24%34%', '50%38%48%', '52%38%48%', // ns下class
      '30%13%36%', '32%25%36%', '40%5%28%', '22%19%42%', '24%31%42%', // 类静态方法
      '58%32%55%', '60%44%55%', '68%24%47%', '50%38%61%', '52%50%61%', // ns下类静态方法
      '35%13%26%', '42%5%18%', // 类实例方法
      '63%13%26%', '70%5%18%', // ns下类实例方法
      '28%13%22%', '38%5%14%', '20%19%28%', // 全局方法
      '56%21%41%', '66%13%33%', '48%27%47%', // ns下全局方法
      '35%13%26%', '42%5%18%', // 间接使用类实例属性
      '63%13%26%', '70%5%18%', // 间接使用ns下类实例属性
    ];
    const detectFileReports3 = checkEntry.projectCheck.issues.filter(issue => issue.defect.mergeKey.startsWith(detectFile3));
    assert.equal(detectFileReports3.length, expectReportList3.length, 'The number of reported line is different from the expected number of line.');
    detectFileReports3.forEach((issue, index) => {
      assert.include(issue.defect.fixKey, expectReportList3[index]);
    });

    const detectFile4: string = path.join(projectPath, 'ets', 'FindInterfaceTest.ets');
    const expectReportList4 = [
      '25%51%57%', // ns
      '25%51%68%', // ns下ns
      '32%17%31%', '19%39%53%', // interface
      '25%70%84%', // ns下interface
    ];
    const detectFileReports4 = checkEntry.projectCheck.issues.filter(issue => issue.defect.mergeKey.startsWith(detectFile4));
    assert.equal(detectFileReports4.length, expectReportList4.length, 'The number of reported line is different from the expected number of line.');
    detectFileReports4.forEach((issue, index) => {
      assert.include(issue.defect.fixKey, expectReportList4[index]);
    });

    const detectFile5: string = path.join(projectPath, 'ets', 'FindPropertyTest.ets');
    const expectReportList5 = [
      '50%15%21%', '52%21%27%', '54%29%35%', '44%19%25%', '46%19%25%', // ns
      '50%15%32%', '52%21%38%', '54%29%46%', '44%19%36%', '46%19%36%', // ns下ns
      '26%15%25%', '28%21%31%', '30%29%39%', '20%19%29%', '22%19%29%', // class
      '50%34%44%', '52%40%50%', '54%48%58%', '44%38%48%', '46%38%48%', // ns下class
      '31%39%49%', '33%43%53%', '36%33%43%', // 类实例属性
      '55%39%49%', '57%43%53%', '60%33%43%', // ns下类实例属性
      '26%27%37%', '28%33%43%', '20%31%41%', '22%31%41%', // 类静态属性
      '50%46%56%', '52%52%62%', '44%50%60%', '46%50%60%', // ns下类静态属性
    ];
    const detectFileReports5 = checkEntry.projectCheck.issues.filter(issue => issue.defect.mergeKey.startsWith(detectFile5));
    assert.equal(detectFileReports5.length, expectReportList5.length, 'The number of reported line is different from the expected number of line.');
    detectFileReports5.forEach((issue, index) => {
      assert.include(issue.defect.fixKey, expectReportList5[index]);
    });

    const detectFile6: string = path.join(projectPath, 'ets', 'IndirectEntry.ets');
    const expectReportList6 = [
      '25%3%17%', '25%3%17%', '25%3%17%', '25%3%17%', '25%3%17%', '25%3%17%', '25%3%17%', '28%3%20%', '28%3%20%', '28%3%20%', '28%3%20%', '31%3%20%', '31%3%20%', '31%3%20%', // 间接使用class
      '36%3%16%', '36%3%16%', '36%3%16%', // 间接使用enum
      '25%3%17%', '25%3%17%', '28%3%20%', '28%3%20%', '28%3%20%', // 间接使用类静态方法
      '28%3%20%', '28%3%20%', // 间接使用类实例方法
      '28%3%20%', '28%3%20%', // 间接使用全局方法
      '25%3%17%', '28%3%20%', '28%3%20%', '31%3%20%', '31%3%20%', '31%3%20%', // 间接使用类实例属性
      '25%3%17%', '25%3%17%', '25%3%17%', '31%3%20%', '31%3%20%', // 间接使用类静态属性
      '39%3%16%', '39%3%16%', '39%3%16%', // 间接使用type
      '45%5%14%', '45%5%14%', // 间接使用struct
    ];
    const detectFileReports6 = checkEntry.projectCheck.issues.filter(issue => issue.defect.mergeKey.startsWith(detectFile6));
    assert.equal(detectFileReports6.length, expectReportList6.length, 'The number of reported line is different from the expected number of line.');
    detectFileReports6.forEach((issue, index) => {
      assert.include(issue.defect.fixKey, expectReportList6[index]);
    });

    const detectFile7: string = path.join(projectPath, 'ets', 'Target.ets');
    const expectReportList7 = [
      '31%18%28%', '24%10%20%', // 目标类中的实例属性
      '67%22%32%', '60%14%24%', // ns下目标类中的实例属性
      '25%10%20%', // 目标类中的静态属性
      '61%14%24%', // ns下目标类中的静态属性
    ];
    const detectFileReports7 = checkEntry.projectCheck.issues.filter(issue => issue.defect.mergeKey.startsWith(detectFile7));
    assert.equal(detectFileReports7.length, expectReportList7.length, 'The number of reported line is different from the expected number of line.');
    detectFileReports7.forEach((issue, index) => {
      assert.include(issue.defect.fixKey, expectReportList7[index]);
    });

    const detectFile8: string = path.join(projectPath, 'ets', 'FindTypeTest.ets');
    const expectReportList8 = [
      '25%12%21%', '28%19%28%', '30%22%31%', '20%18%27%', // 使用目标type
      '43%31%40%', '46%38%47%', '48%41%50%', '38%37%46%', // 使用ns下的目标type
    ];
    const detectFileReports8 = checkEntry.projectCheck.issues.filter(issue => issue.defect.mergeKey.startsWith(detectFile8));
    assert.equal(detectFileReports8.length, expectReportList8.length, 'The number of reported line is different from the expected number of line.');
    detectFileReports8.forEach((issue, index) => {
      assert.include(issue.defect.fixKey, expectReportList8[index]);
    });

    const detectFile9: string = path.join(projectPath, 'ets', 'FindStructTest.ets');
    const expectReportList9 = [
      '21%5%16%', '25%5%16%', // 使用目标struct
    ];
    const detectFileReports9 = checkEntry.projectCheck.issues.filter(issue => issue.defect.mergeKey.startsWith(detectFile9));
    assert.equal(detectFileReports9.length, expectReportList9.length, 'The number of reported line is different from the expected number of line.');
    detectFileReports9.forEach((issue, index) => {
      assert.include(issue.defect.fixKey, expectReportList9[index]);
    });

    const detectFile10: string = path.join(projectPath, 'ets', 'GenicTypeFind.ets');
    const expectReportList10 = [
      '24%25%35%', '19%36%46%', '27%1%15%', // 直接或者间接使用目标泛型
    ];
    const detectFileReports10 = checkEntry.projectCheck.issues.filter(issue => issue.defect.mergeKey.startsWith(detectFile10));
    assert.equal(detectFileReports10.length, expectReportList10.length, 'The number of reported line is different from the expected number of line.');
    detectFileReports10.forEach((issue, index) => {
      assert.include(issue.defect.fixKey, expectReportList10[index]);
    });
  });
})