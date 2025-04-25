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
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { FileReports } from './Defects';
import { GeneratingJsonFile } from '../utils/common/GeneratingJsonFile';
import path from 'path';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'Message');

export interface Message {
    sendResult(fileReports: FileReports[], reportDir?: string): void;
    messageNotify(messageLevel: MessageType, msg: string): void;
    progressNotify(progress: number, msg: string): void;
}

export class defaultMessage implements Message {
    /**
     * 发送消息
     *
     * @param msg 要发送的消息内容
     */
    async sendResult(fileReports: FileReports[], reportDir?: string | undefined): Promise<void> {
        if (reportDir && reportDir.length !== 0) {
            GeneratingJsonFile.generatingJsonFile(path.resolve(reportDir, 'issuesReport.json'), fileReports);
        } else {
            process.stdout.write(JSON.stringify(fileReports));
        }
    }

    
    /**
     * 消息通知函数
     *
     * @param messageLevel 消息类型，类型为MessageType枚举
     * @param msg 消息内容，类型为字符串
     */
    messageNotify(messageLevel: MessageType, msg: string): void {
        logger.error(JSON.stringify(msg));
        return;
    }


    /**
     * 通知进度更新
     *
     * @param progress 进度值，取值范围为 0 到 1 之间
     * @param msg 与进度相关的消息
     */
    progressNotify(progress: number, msg: string): void {
        const checkPercent = Math.floor(progress * 100);
        if (checkPercent % 20 === 0) {
            logger.info(`===== progress: ${checkPercent}% ======`);
        }
    }
}

/**
 * 告警消息类型
 */
export enum MessageType {
    BASE_ERROR = 0,
    CHECK_ERROR = -1,
    CHECK_WARN = -2,
    CHECK_INFO = -3
}