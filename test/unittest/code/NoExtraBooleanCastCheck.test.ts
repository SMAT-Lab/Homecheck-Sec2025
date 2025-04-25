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
import { NoExtraBooleanCastCheck } from '../../../src/checker/ArkTS-eslint/NoExtraBooleanCastCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('@ArkTS-eslint/no-extra-boolean-cast-check');
    rule.option = [{ "enforceForLogicalOperands": false }];
    checkEntry = await testCaseCheck('./test/unittest/sample/NoExtraBooleanCast', rule, CHECK_MODE.FILE2CHECK, NoExtraBooleanCastCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoExtraBooleanCastCheckTest', () => {
    /**
     * @tc.number: NoExtraBooleanCastCheckTest_001
     * @tc.name: NoExtraBooleanCast检查，上报
     * @tc.desc: NoExtraBooleanCast检查，上报
     */
    test('NoExtraBooleanCastCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoExtraBooleanCastReport.ets');
        const expectReportList = ['16%5','18%14','20%8','22%1','24%8','26%2','28%9','30%1','32%5','34%14','36%8','38%1','40%8',
            '42%2','44%2','46%2','48%2','50%2','52%2','54%2','58%2','60%2','62%3','64%6','66%9','68%11',
            '70%5','72%8','74%9','76%9','78%24','80%24','82%24','84%25','86%25','88%28','90%3','92%6',
            '94%7','96%8','98%3','100%3','102%7','104%7','106%10','108%6','110%2','112%2','114%2','116%4',
            '118%2','120%6','122%2','124%2','126%2','128%2','130%4','132%2','134%6','136%6','138%2','140%2',
            '142%2','144%3','146%8','148%4','150%4','152%4','154%2','156%9','158%9','160%10','162%10',
            '164%9','166%10','168%9','170%10','172%9','174%9','176%9','178%9','180%9','182%9','184%10',
            '186%1','190%1','194%1','196%1','198%1','200%1','206%1','208%1',
            '210%1','214%1','216%5','218%5','220%5','222%5','224%5','226%5','228%5','230%5','232%5',
            '234%5','236%6','238%6','240%5','242%5','244%8','246%8','248%8','250%8','252%8','254%8','256%8',
            '258%8','260%8','262%8','264%9','266%9','268%8','270%8','272%14','274%14','276%14','278%14',
            '280%14','282%14','284%14','286%14','288%14','290%14','292%15','294%15','296%14','298%14','300%8',
            '302%8','304%8','306%8','308%8','310%8','312%8','314%8','316%8','318%8','320%9','322%9','324%8',
            '326%8','328%1','330%2','332%1','334%1','336%1','338%2','340%1','342%1','344%1','346%1','348%1',
            '350%1','352%1','354%1','356%1','358%1','360%1','362%1','364%2','366%1','368%1','370%1','372%2',
            '374%2','376%2','378%2','380%3','382%2','384%2','386%3','388%2','390%2','392%2','394%2',
            '396%2','398%2','400%10','402%2','404%2','406%2','408%23','410%23','412%2','412%3','414%2','414%4',
            '416%2','418%2','420%2','422%3','424%2','426%2','428%2','430%3','432%2','434%2','436%2','438%2',
            '440%2','442%2','444%2','446%2','448%6'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: NoExtraBooleanCastCheckTest_002
     * @tc.name: NoExtraBooleanCast检查正例,默认可选项，不上报
     * @tc.desc: NoExtraBooleanCast检查正例,默认可选项，不上报
     */
    test('NoExtraBooleanCastCheckTest_002', async () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoExtraBooleanCastNoReport1.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    /**
     * @tc.number: NoExtraBooleanCastCheckTest_003
     * @tc.name: NoExtraBooleanCast检查，配置可选项enforceForLogicalOperands = true，不上报
     * @tc.desc: NoExtraBooleanCast检查，不上报
     */
    test('NoExtraBooleanCastCheckTest_003', async () => {
        const rule: Rule = new Rule('@ArkTS-eslint/no-extra-boolean-cast-check');
        checkEntry = await testCaseCheck('./test/unittest/sample/NoExtraBooleanCast', rule, CHECK_MODE.FILE2CHECK, NoExtraBooleanCastCheck);
        const detectFile: string = path.join(realPath, 'ets', 'NoExtraBooleanCastNoReport1.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    /**
     * @tc.number: NoExtraBooleanCastCheckTest_004
     * @tc.name: NoExtraBooleanCast检查，配置可选项enforceForLogicalOperands = true,上报
     * @tc.desc: NoExtraBooleanCast检查，配置可选项enforceForLogicalOperands = true,上报
     */
    test('NoExtraBooleanCastCheckTest_004', async () => {
        const rule: Rule = new Rule('@ArkTS-eslint/no-extra-boolean-cast-check');
        rule.option = [{ "enforceForLogicalOperands": true }];
        checkEntry = await testCaseCheck('./test/unittest/sample/NoExtraBooleanCast', rule, CHECK_MODE.FILE2CHECK, NoExtraBooleanCastCheck);
        const detectFile: string = path.join(realPath, 'ets', 'NoExtraBooleanCastReport1.ets');
        const expectReportList = ['16%5','18%5','20%6','22%12','24%14','26%8','28%1','30%8','32%1','32%2','34%9','36%13','38%5','40%14','42%8','44%1',
            '46%8','48%2','50%2','52%2','54%2','56%2','58%2','60%2','62%2','64%2','66%2','68%2','70%3',
            '72%6','74%9','76%11','78%5','80%8','82%25','84%25','86%25','88%26','90%29','92%3','94%7','96%8',
            '98%9','100%3','102%11','104%7','106%1','106%2','108%1','108%2','110%3','112%4','114%2','116%7','118%2','120%2',
            '122%2','124%3','126%4','128%2','130%6','132%6','134%2','136%2','138%3','140%9','142%3','144%8',
            '146%4','148%4','150%4','152%2','154%10','156%24','158%5','158%17','160%5','160%24','162%5',
            '162%17','164%5','164%24'];
        const detectFileReport = await checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    })

})