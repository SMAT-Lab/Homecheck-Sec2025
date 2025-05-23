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

const number_arg = 123;
const number_msg1 = `arg = ${number_arg}`;
const number_msg2 = `arg = ${number_arg || 'zero'}`;

const boolean_arg = true;
const boolean_msg1 = `arg = ${boolean_arg}`;
const boolean_msg2 = `arg = ${boolean_arg || 'not truthy'}`;

const any_user = JSON.parse('{ "name": "foo" }');
const any_msg1 = `arg = ${any_user.name}`;
const any_msg2 = `arg = ${any_user.name || 'the user with no name'}`;

const null_arg = condition ? 'ok' : null;
const null_msg1 = `arg = ${null_arg}`;

const regexp_arg = new RegExp('foo');
const regexp_msg1 = `arg = ${regexp_arg}`;
const regexp_arg2 = /foo/;
const regexp_msg2 = `arg = ${regexp_arg2}`;

