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
import Logger, {LOG_LEVEL, LOG_MODULE_TYPE} from 'arkanalyzer/lib/utils/logger';
import {Command, OptionValues} from 'commander';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'Utils');

export class Utils {
    /**
     * 解析命令行选项
     * @param args 命令行参数数组
     * @returns 解析后的选项值
     */
    static parseCliOptions(args: string[]): OptionValues {
        logger.info('Parse cli options.');
        const program = new Command();
        return this.getCliOptions(program, args);
    }

    /**
     * 获取命令行选项
     * @param program Command 对象
     * @param args 命令行参数数组
     * @returns 选项值对象
     */
    static getCliOptions(program: Command, args: string[]): OptionValues {
        program
            .option('--configPath <configPath>', 'rule config path')
            .option('--projectConfigPath <projectConfigPath>', 'project config path')
            .option('--depGraphOutputDir <depGraphOutputDir>', 'output directory of dependency graph')
            .parse(args);
        return program.opts();
    }

    /**
     * 设置日志路径
     * @param logPath 日志路径
     */
    static setLogPath(logPath: string, arkLogLevel: LOG_LEVEL = LOG_LEVEL.ERROR,
        hcLogLevel: LOG_LEVEL = LOG_LEVEL.INFO): void {
        Logger.configure(logPath, arkLogLevel, hcLogLevel);
    }

    /**
     * 获取枚举类型的值
     * @param value - 枚举值，可以是字符串或数字
     * @param enumType - 枚举类型
     * @returns 枚举值对应的枚举类型值
     */
    static getEnumValues(value: string | number, enumType: any): any {
        const key = Object.keys(enumType).find(k => k.toLowerCase() === value || enumType[k as string] === value);
        return enumType[key as string]
    }

    /**
     * 按行号和列号对键值对进行排序
     * @param keyA 格式为 "行号%列号%规则ID" 的字符串
     * @param keyB 格式为 "行号%列号%规则ID" 的字符串
     * @returns 排序比较结果
     */
    public static sortByLineAndColumn(keyA: string, keyB: string): number {
        const [lineA, colA] = keyA.split('%', 2).map(Number);
        const [lineB, colB] = keyB.split('%', 2).map(Number);
        if (lineA !== lineB) {
            return lineA - lineB;
        }
        return colA - colB;
    }
}