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
const container: Record<string, number> = {
  /* ... */
};

// Can be replaced with the constant equivalents, such as container.aaa
delete container['tom'];
delete container['Infinity'];

// Dynamic, difficult-to-reason-about lookups
const mouse = 'jerry';
delete container[mouse];
delete container[mouse.toUpperCase()];

const container: { [i: string]: 0 } = {};
delete container.aaa;
const container: { [i: string]: 0 } = {};
delete container.aaa;
const container: { [i: string]: 0 } = {};
delete container['aa' + 'b'];
const container: { [i: string]: 0 } = {};
delete container['delete'];
const container: { [i: string]: 0 } = {};
delete container.delete;
const container: { [i: string]: 0 } = {};
delete container.Infinity;
const container: { [i: string]: 0 } = {};
delete container[+Infinity];
const container: { [i: string]: 0 } = {};
delete container[NaN];
const container: { [i: string]: 0 } = {};
delete container['NaN'];
const container: { [i: string]: 0 } = {};
delete container.NaN;
const container: { [i: string]: 0 } = {};
const name = 'name';
delete container[name];
const container: { [i: string]: 0 } = {};
const getName = () => 'aaa';
delete container[getName()];
const container: { [i: string]: 0 } = {};
const name = { foo: { bar: 'bar' } };
delete container[name.foo.bar];