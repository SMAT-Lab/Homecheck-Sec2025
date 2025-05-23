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
import { NoUnusedExpressionsCheck } from "../../../src/checker/ArkTS-eslint/NoUnusedExpressionsCheck";
import { CHECK_MODE, testCaseCheck } from "./common/testCommon";
import path from "path";
import { Rule } from "../../../src/model/Rule";
import { CheckEntry } from "../../../src/utils/common/CheckEntry";

let realPath: string = "";
let checkEntry: CheckEntry;

beforeAll(async () => {
  const rule: Rule = new Rule("");
  checkEntry = await testCaseCheck(
    "./test/unittest/sample/NoUnusedExpressions",
    rule,
    CHECK_MODE.FILE2CHECK,
    NoUnusedExpressionsCheck
  );
  realPath = checkEntry.scene.getRealProjectDir();
});

describe("NoUnusedExpressionsTest", () => {
  /**
   * @tc.number: PreferEnumInitializwersTest_001
   * @tc.name: 构造方法不能为空，上报
   * @tc.desc: 构造方法不能为空，上报
   */
  test("NoUnusedExpressionsTest_001", () => {
    const detectFile: string = path.join(realPath, "ets", "defaultError.ets");
    const expectReportList = ['15%1%', '17%7%', '19%2%', '21%1%', '23%1%', '25%1%', '28%1%', '32%1%',
      '34%1%', '36%1%', '38%1%', '40%1%', '42%1%', '44%1%', '46%1%'
    ];
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
   * @tc.number: PreferEnumInitializwersTest_002
   * @tc.name: 构造方法不能为空，不上报
   * @tc.desc: 构造方法不能为空，不上报
   */
  test("NoUnusedExpressionsTest_002", () => {
    const detectFile: string = path.join(realPath, "ets", "defaultPass.ets");
    const detectedFileReport = checkEntry.fileChecks.find(
      (fileCheck) => fileCheck.arkFile.getFilePath() === detectFile
    );
    assert.equal(
      detectedFileReport?.issues.length,
      0,
      "Suggestion: NoUselessConstructor."
    );
  });
});
