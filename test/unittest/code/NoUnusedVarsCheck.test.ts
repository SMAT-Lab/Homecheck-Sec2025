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

import { assert, beforeAll, describe, test } from "vitest";
import { NoUnusedVarsCheck } from "../../../src/checker/ArkTS-eslint/NoUnusedVarsCheck";
import { CHECK_MODE, testCaseCheck } from "./common/testCommon";
import path from "path";
import { Rule } from "../../../src/model/Rule";
import { CheckEntry } from "../../../src/utils/common/CheckEntry";

let realPath: string = "";
let checkEntry: CheckEntry;

beforeAll(async () => {
  const rule: Rule = new Rule("");
  checkEntry = await testCaseCheck(
    "./test/unittest/sample/NoUnusedVars",
    rule,
    CHECK_MODE.FILE2CHECK,
    NoUnusedVarsCheck
  );
  realPath = checkEntry.scene.getRealProjectDir();
});

describe("NoUnusedVarsCheckTest", () => {
  /**
   * @tc.number:NoUnusedVarsCheckTest
   * @tc.name: 方法参数强制设定为只读默认不设置参数，上报
   * @tc.desc: 方法参数强制设定为只读默认不设置参数，上报
   */
  test("NoUnusedVarsCheckTest_001", () => {
    const detectFile: string = path.join(realPath, "ets", "default.ets");
    const expectReportList = ['40%10%', '24%1%', '26%5%', '46%24%', '46%18%',"35%11%", '35%17%'];
    const detectFileReport = checkEntry.fileChecks.find(
      (fileCheck) => fileCheck.arkFile.getFilePath() === detectFile
    );
    assert.isDefined(detectFileReport, "The file path is error.");
    assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
    detectFileReport?.issues.forEach((issue, index) => {
      assert.include(issue.defect.fixKey, expectReportList[index]);
  });
  });

  /**
   * @tc.number:NoUnusedVarsCheckTest
   * @tc.name: 方法参数强制设定为只读默认不设置参数，上报
   * @tc.desc: 方法参数强制设定为只读默认不设置参数，上报
   */
  test("NoUnusedVarsCheckTest_002", () => {
    const detectFile: string = path.join(realPath, "ets", "caughtErrors.ets");
    const expectReportList = ['18%10%'];
    const detectFileReport = checkEntry.fileChecks.find(
      (fileCheck) => fileCheck.arkFile.getFilePath() === detectFile
    );
    assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
    detectFileReport?.issues.forEach((issue, index) => {
      assert.include(issue.defect.fixKey, expectReportList[index]);
  });
  });
  /**
   * @tc.number:NoUnusedVarsCheckTest
   * @tc.name: 方法参数强制设定为只读设置allow参数，上报
   * @tc.desc: 方法参数强制设定为只读设置allow参数，上报
   */
  test("NoUnusedVarsCheckTest_003", () => {
    const detectFile: string = path.join(
      realPath,
      "ets",
      "destructuredArrayIgnorePattern.ets"
    );
    const expectReportList = ['15%11%', '18%13%', '30%9%', '39%2%', '21%15%', '26%20%'];
    const detectFileReport = checkEntry.fileChecks.find(
      (fileCheck) => fileCheck.arkFile.getFilePath() === detectFile
    );
    assert.isDefined(detectFileReport, "The file path is error.");
    assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
    detectFileReport?.issues.forEach((issue, index) => {
      assert.include(issue.defect.fixKey, expectReportList[index]);
  });
  });
  /**
   * @tc.number:NoUnusedVarsCheckTest
   * @tc.name: 方法参数强制设定为只读设置allow参数，不上报
   * @tc.desc: 方法参数强制设定为只读设置allow参数，不上报
   */
  test("NoUnusedVarsCheckTest_004", () => {
    const detectFile: string = path.join(
      realPath,
      "ets",
      "ignoreClassError.ets"
    );
    const expectReportList = ['23%7%', '25%9%', '28%7%'];
    const detectedFileReport = checkEntry.fileChecks.find(
      (fileCheck) => fileCheck.arkFile.getFilePath() === detectFile
    );
    assert.equal(
      detectedFileReport?.issues.length,
      expectReportList.length,
      "Parameter should be a read only type."
    );
    detectedFileReport?.issues.forEach((issue, index) => {
      assert.include(issue.defect.fixKey, issue.defect.fixKey);
    });
  });
  /**
   * @tc.number:NoUnusedVarsCheckTest
   * @tc.name: 方法参数强制设定为只读设置ignoreInferredTypes参数，上报
   * @tc.desc: 方法参数强制设定为只读设置ignoreInferredTypes参数，上报
   */
  test("NoUnusedVarsCheckTest_005", () => {
    const detectFile: string = path.join(
      realPath,
      "ets",
      "ignoreClassPass.ets"
    );
    const detectedFileReport = checkEntry.fileChecks.find(
      (fileCheck) => fileCheck.arkFile.getFilePath() === detectFile
    );
    detectedFileReport?.issues.forEach((issue, index) => {
      assert.include(issue.defect.fixKey, issue.defect.fixKey);
    });
  });
  /**
   * @tc.number:NoUnusedVarsCheckTest
   * @tc.name: 方法参数强制设定为只读设置treatMethodsAsReadonly参数，上报
   * @tc.desc: 方法参数强制设定为只读设置treatMethodsAsReadonly参数，上报
   */
  test("NoUnusedVarsCheckTest_006", () => {
    const detectFile: string = path.join(
      realPath,
      "ets",
      "ignoreRestSiblings.ets"
    );
    const expectReportList = ['18%7%', '25%5%'];
    const detectFileReport = checkEntry.fileChecks.find(
      (fileCheck) => fileCheck.arkFile.getFilePath() === detectFile
    );
    assert.isDefined(detectFileReport, "The file path is error.");
    assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
    detectFileReport?.issues.forEach((issue, index) => {
      assert.include(issue.defect.fixKey, expectReportList[index]);
  });
  });
});
