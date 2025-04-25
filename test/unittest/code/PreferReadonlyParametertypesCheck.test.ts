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
import { PreferReadonlyParametertypesCheck } from "../../../src/checker/ArkTS-eslint/PreferReadonlyParametertypesCheck";
import { CHECK_MODE, testCaseCheck } from "./common/testCommon";
import path from "path";
import { Rule } from "../../../src/model/Rule";
import { CheckEntry } from "../../../src/utils/common/CheckEntry";

let realPath: string = "";
let checkEntry: CheckEntry;

beforeAll(async () => {
  const rule: Rule = new Rule("");
  checkEntry = await testCaseCheck(
    "./test/unittest/sample/PreferReadonlyParametertypes",
    rule,
    CHECK_MODE.FILE2CHECK,
    PreferReadonlyParametertypesCheck
  );
  realPath = checkEntry.scene.getRealProjectDir();
});

describe("PreferReadonlyParametertypesTest", () => {
  /**
   * @tc.number:PreferReadonlyParametertypesTest
   * @tc.name: 方法参数强制设定为只读默认不设置参数，上报
   * @tc.desc: 方法参数强制设定为只读默认不设置参数，上报
   */
  test("PreferReadonlyParametertypesTest_001", () => {
    const detectFile: string = path.join(realPath, "ets", "defaultError.ets");
    const expectReportList = ["16%17%","17%17%","18%17%","19%17%","22%18%","23%19%","24%18%","30%18%","36%18%"
      ,"38%17%","48%15%","49%14%","42%4%","45%8%","51%8%","47%18%"
    ];
        const detectFileReport = checkEntry.fileChecks.find(
          (fileCheck) => fileCheck.arkFile.getFilePath() === detectFile
        );
        assert.isDefined(detectFileReport, "The file path is error.");
        assert.equal(
          detectFileReport?.issues.length,
          expectReportList.length,
          "The number of reported line is different from the expected number of line."
        );
        detectFileReport?.issues.forEach((issue, index) => {
          assert.include(issue.defect.fixKey, expectReportList[index]);
        });
  });

  /**
   * @tc.number:PreferReadonlyParametertypesTest
   * @tc.name: 方法参数强制设定为只读默认不设置参数，不上报
   * @tc.desc: 方法参数强制设定为只读默认不设置参数，不上报
   */
  test("PreferReadonlyParametertypesTest_002", () => {
    const detectFile: string = path.join(realPath, "ets", "defaultPass.ets");

    const detectedFileReport = checkEntry.fileChecks.find(
      (fileCheck) => fileCheck.arkFile.getFilePath() === detectFile
    );
    assert.equal(
      detectedFileReport?.issues.length,
      0,
      "Parameter should be a read only type."
    );
    detectedFileReport?.issues.forEach((issue, index) => {
      assert.include(issue.defect.fixKey, issue.defect.fixKey);
    });
  });
  /**
   * @tc.number:PreferReadonlyParametertypesTest
   * @tc.name: 方法参数强制设定为只读设置allow参数，上报
   * @tc.desc: 方法参数强制设定为只读设置allow参数，上报
   */
  test("PreferReadonlyParametertypesTest_003", () => {
    const detectFile: string = path.join(realPath, "ets", "allowError.ets");
    const expectReportList = ["29%14%","32%14%","35%14%"];
        const detectFileReport = checkEntry.fileChecks.find(
          (fileCheck) => fileCheck.arkFile.getFilePath() === detectFile
        );
        assert.isDefined(detectFileReport, "The file path is error.");
        assert.equal(
          detectFileReport?.issues.length,
          expectReportList.length,
          "The number of reported line is different from the expected number of line."
        );
        detectFileReport?.issues.forEach((issue, index) => {
          assert.include(issue.defect.fixKey, expectReportList[index]);
        });
  });
  /**
   * @tc.number:PreferReadonlyParametertypesTest
   * @tc.name: 方法参数强制设定为只读设置allow参数，不上报
   * @tc.desc: 方法参数强制设定为只读设置allow参数，不上报
   */
  test("PreferReadonlyParametertypesTest_004", () => {
    const detectFile: string = path.join(realPath, "ets", "allowPass.ets");
    const expectReportList = ["25%14%","28%14%","32%15%"];
        const detectFileReport = checkEntry.fileChecks.find(
          (fileCheck) => fileCheck.arkFile.getFilePath() === detectFile
        );
        assert.isDefined(detectFileReport, "The file path is error.");
        assert.equal(
          detectFileReport?.issues.length,
          expectReportList.length,
          "The number of reported line is different from the expected number of line."
        );
        detectFileReport?.issues.forEach((issue, index) => {
          assert.include(issue.defect.fixKey, expectReportList[index]);
        });
  });
  /**
   * @tc.number:PreferReadonlyParametertypesTest
   * @tc.name: 方法参数强制设定为只读设置ignoreInferredTypes参数，上报
   * @tc.desc: 方法参数强制设定为只读设置ignoreInferredTypes参数，上报
   */
  test("PreferReadonlyParametertypesTest_005", () => {
    const detectFile: string = path.join(
      realPath,
      "ets",
      "ignoreInferredTypesErro.ets"
    );
    const expectReportList = [];
        const detectFileReport = checkEntry.fileChecks.find(
          (fileCheck) => fileCheck.arkFile.getFilePath() === detectFile
        );
        assert.isDefined(detectFileReport, "The file path is error.");
        assert.equal(
          detectFileReport?.issues.length,
          expectReportList.length,
          "The number of reported line is different from the expected number of line."
        );
        detectFileReport?.issues.forEach((issue, index) => {
          assert.include(issue.defect.fixKey, expectReportList[index]);
        });
  });
  /**
   * @tc.number:PreferReadonlyParametertypesTest
   * @tc.name: 方法参数强制设定为只读设置treatMethodsAsReadonly参数，不上报
   * @tc.desc: 方法参数强制设定为只读设置treatMethodsAsReadonly参数，不上报
   */
  test("PreferReadonlyParametertypesTest_006", () => {
    const detectFile: string = path.join(
      realPath,
      "ets",
      "treatMethodsAsReadonlypass.ets"
    );
    const expectReportList = ["19%14%"];
    const detectFileReport = checkEntry.fileChecks.find(
      (fileCheck) => fileCheck.arkFile.getFilePath() === detectFile
    );
    assert.isDefined(detectFileReport, "The file path is error.");
    assert.equal(
      detectFileReport?.issues.length,
      expectReportList.length,
      "The number of reported line is different from the expected number of line."
    );
    detectFileReport?.issues.forEach((issue, index) => {
      assert.include(issue.defect.fixKey, expectReportList[index]);
    });
  });
});
