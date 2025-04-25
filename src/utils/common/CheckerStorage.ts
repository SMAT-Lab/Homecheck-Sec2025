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

import { Scope } from "../../model/Scope";

export class CheckerStorage {
    private static instance: CheckerStorage;
    private scopeMap: Map<string, Scope> = new Map();
    private apiVersion: number = 16;
    private product: string = '';

    /**
     * 获取 CheckerStorage 的单例实例
     * @returns {CheckerStorage} CheckerStorage 的单例实例
     */
    public static getInstance(): CheckerStorage {
        if (!CheckerStorage.instance) {
            CheckerStorage.instance = new CheckerStorage();
        }
        return CheckerStorage.instance;
    }

    /**
     * 根据文件路径获取Scope
     * @param filePath - 文件路径
     * @returns Scope | undefined - 返回Scope对象或undefined
     */
    public getScope(filePath: string): Scope | undefined {
        return this.scopeMap.get(filePath);
    }

    /**
     * 设置Scope映射
     * @param scopeMap - Scope映射，类型为 Map<string, Scope>
     */
    public setScopeMap(scopeMap: Map<string, Scope>) {
        this.scopeMap = scopeMap;
    }

    /**
     * 设置API版本
     * @param api API版本号
     */
    public setApiVersion(api: number): void {
        this.apiVersion = api;
    }

    /**
     * 获取API版本号
     * @returns {number} 返回API版本号
     */
    public getApiVersion(): number {
        return this.apiVersion;
    }

    /**
     * 设置product
     * @param product 
     */
    public setProduct(pro: string): void {
        this.product = pro;
    }

    /**
     * 获取product
     * @returns {string} 返回product
     */
    public getProduct(): string {
        return this.product;
    }
}