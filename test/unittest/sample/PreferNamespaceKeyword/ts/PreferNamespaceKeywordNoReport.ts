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
declare module 'foo';
declare module 'foo' {}
namespace foo {}
declare namespace foo {}
declare global {}
export namespace Example2 {}

//反类
export      module Example1 {}
module foo {}
declare module foo1 {}
declare module foo2 {
      declare module bar2 {}
      declare    module bar3 {}
}