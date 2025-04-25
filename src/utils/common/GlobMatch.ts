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

export class GlobMatch {
    private regexps: string[] = [];

    constructor(globPattern: string[]) {
        this.regexps = globPattern.map(pattern => this.globToRegexp(pattern));
    }

    matchGlob(path: string): boolean {
        path = path.replace(/\\/g, '/');
        return this.regexps.some(regexp => new RegExp(regexp).test(path));
    }

    private globToRegexp(glob: string): string {
        glob = glob.replace(/\\/g, '/').replace(/\/+/g, '/');
        const specialChars = new Set(['.', '+', '*', '?', '[', '^', ']', '(', ')', '{', '}', '|']);
        let regexp = '';
        let isStar = false;
        for (let i = 0; i < glob.length; i++) {
            const char = glob[i];
            if (char === '*') {
                if (!isStar) {
                    regexp += '.*';  // 匹配任意字符序列，包括空字符串。
                }
                isStar = true;
                continue;
            } else if (char === '?') {
                regexp += '.';  // 匹配任意单个字符。
            } else if (specialChars.has(char)) {
                regexp += `\\${char}`;  // 转义特殊字符。
            } else {
                regexp += char;
            }
            isStar = false;
        }
        // 防止配置的是'.c', 匹配到了'.cpp'
        if (regexp.match('.*\\.[a-zA-Z]+$')) {
            regexp = `${regexp}$`;
        }
        return regexp;
    }
}