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
import Logger, { LOG_MODULE_TYPE } from "arkanalyzer/lib/utils/logger";
import { processAfterCheck } from "./utils/common/AfterCheck";
import { CheckEntry, checkEntryBuilder, getSelectFileList } from "./utils/common/CheckEntry";
import { ConfigUtils } from "./utils/common/ConfigUtils";
import { defaultMessage } from "./model/Message";
import { Utils } from "./utils/common/Utils";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'Main');

export async function start(checkEntry: CheckEntry): Promise<boolean> {
    // 外部没有建立消息通道，使用默认通道
    if (!checkEntry.message) {
        checkEntry.message = new defaultMessage();
    }
    
    // 前处理
    if (!await checkEntryBuilder(checkEntry)) {
        return false;
    }

    // 开始检查
    await checkEntry.runAll();

    // 后处理
    await processAfterCheck(checkEntry);
    logger.info('Checking completed.');
    return true;
}

export async function run(): Promise<boolean> {
    const startTime = new Date().getTime();
    const checkEntry = new CheckEntry();
    // 构建ruleConfig和projectConfig，保存至checkEntry中
    if (!ConfigUtils.parseConfig(Utils.parseCliOptions(process.argv), checkEntry)) {
        return false;
    }

    // 设置指定文件检查，不设置默认检查所有文件
    checkEntry.setCheckFileList(getSelectFileList(checkEntry.projectConfig.checkPath));

    // 启动homecheck检查
    await start(checkEntry);

    const endTime = new Date().getTime();
    logger.info(`HomeCheck took: ${(endTime - startTime) / 1000} s.`);
    return true;
};