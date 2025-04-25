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

import { ts } from "arkanalyzer";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'Json5parser');

export class Json5parser {
    /**
     * 获取JSON5文件的根对象字面量表达式
     * @param file - JSON5文件的源文件对象
     * @returns 如果找到根对象字面量表达式，则返回该表达式；否则返回undefined
     */
    public static getRootObjectLiteral(file: ts.JsonSourceFile): ts.ObjectLiteralExpression | undefined {
        // 检查文件语句是否为空
        if (!file.statements || !file.statements.length) {
            logger.error('The JSON5 file format is incorrect, the root node statements is empty.');
            return undefined;
        }
        const expressionStatement = file.statements[0];
        if (expressionStatement.kind !== ts.SyntaxKind.ExpressionStatement) {
            logger.error(`The JSON5 file format is incorrect, the first child node is not ExpressionStatement. kind: ${expressionStatement.kind}`);
            return undefined;
        }
        // JSON5顶层对象仅识别一个
        const rootObjectLiteralExpression = (expressionStatement as ts.ExpressionStatement).expression;
        if (!rootObjectLiteralExpression) {
            logger.error('The JSON5 file format is incorrect, the first child node expression is empty.');
            return undefined;
        }
        // 检查表达式是否为对象字面量表达式
        if (rootObjectLiteralExpression.kind === ts.SyntaxKind.ObjectLiteralExpression) {
            return rootObjectLiteralExpression as ts.ObjectLiteralExpression;
        }
        // 检查表达式是否为数组字面量表达式
        if (rootObjectLiteralExpression.kind === ts.SyntaxKind.ArrayLiteralExpression) {
            const elements = (rootObjectLiteralExpression as ts.ArrayLiteralExpression).elements;
            // 检查数组是否为空或第一个元素是否为对象字面量表达式
            if (elements && elements.length && elements[0].kind === ts.SyntaxKind.ObjectLiteralExpression) {
                return elements[0] as ts.ObjectLiteralExpression;
            }
            logger.error('The JSON5 file format is incorrect, the node ArrayLiteralExpression first element is not ObjectLiteralExpression.');
        }
        logger.error('The JSON5 file format is incorrect.');
        return undefined;
    }

    /**
     * 解析对象字面量表达式
     * @param objectLiteralExpression - 对象字面量表达式
     * @param file - JSON源文件
     * @returns 解析后的对象字面量表达式
     */
    private static parseObjectLiteralExpression(objectLiteralExpression: ts.ObjectLiteralExpression, file: ts.JsonSourceFile): { [k: string]: unknown } {
        const res: { [k: string]: unknown } = {};
        objectLiteralExpression.properties.forEach(node => {
            const propNode = node as ts.PropertyAssignment;
            const key = (propNode.name as ts.Identifier).text;
            const value = this.parsePropertyInitializer(propNode.initializer, file);
            res[key] = value;
        });
        return res;
    }

    /**
     * 解析语法树中的表达式节点
     * @param node - 表达式节点
     * @param file - JSON源文件
     * @returns 解析后的值
     */
    private static parsePropertyInitializer(node: ts.Expression, file: ts.JsonSourceFile): unknown {
        if (node.kind === ts.SyntaxKind.StringLiteral) {
            return (node as ts.StringLiteral).text;
        } else if (node.kind === ts.SyntaxKind.NumericLiteral) {
            return parseInt((node as ts.NumericLiteral).text);
        } else if (node.kind === ts.SyntaxKind.PrefixUnaryExpression) {
            return Number((node as ts.PrefixUnaryExpression).getText(file));
        } else if (node.kind === ts.SyntaxKind.ArrayLiteralExpression) {
            return this.parseArrayLiteral(node, file);
        } else if (node.kind === ts.SyntaxKind.ObjectLiteralExpression) {
            return this.parseObjectLiteralExpression(node as ts.ObjectLiteralExpression, file);
        } else if (node.kind === ts.SyntaxKind.TrueKeyword) {
            return true;
        } else if (node.kind === ts.SyntaxKind.FalseKeyword) {
            return false;
        }
        return undefined;
    }

    /**
     * 解析数组字面量表达式
     * @param node - 要解析的表达式节点
     * @param file - 所属的 JSON 源文件
     * @returns 解析后的数组
     */
    private static parseArrayLiteral(node: ts.Expression, file: ts.JsonSourceFile) {
        const res: unknown[] = [];
        (node as ts.ArrayLiteralExpression).elements.forEach(n => {
            res.push(this.parsePropertyInitializer(n, file));
        });
        return res;
    }

    /**
     * 解析JSON文本
     * @param text - 要解析的JSON文本
     * @returns 解析后的对象
     */
    public static parseJsonText(text: string): { [k: string]: unknown } {
        const file = ts.parseJsonText('', text);
        const rootObjectLiteralExpression = this.getRootObjectLiteral(file);
        if (!rootObjectLiteralExpression) {
            return {};
        }
        return this.parseObjectLiteralExpression(rootObjectLiteralExpression, file);
    }
}