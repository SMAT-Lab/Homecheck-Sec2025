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

function funTest<T = number>() {}
funTest<number>();

function gStringTest<T = number, U = string>() {}
gStringTest<string, string>();

class ClassNewTest<T = number> {}
new ClassNewTest<number>();

class DexTest extends ClassNewTest<number> {}

interface InterfaceTest<T = number> {}
class ImplTest implements InterfaceTest<number> {}