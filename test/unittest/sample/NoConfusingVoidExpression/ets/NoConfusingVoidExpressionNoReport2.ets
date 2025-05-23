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
// options: [{ ignoreVoidOperator: true }],
!void console.log('foo');

+void (foo && console.log(foo));

-void (foo || console.log(foo));

() => void ((foo && void console.log(true)) || console.log(false));

const x = void (foo ? console.log(true) : console.log(false));

!(foo && void console.log(foo));

!!(foo || void console.log(foo));

const x = (foo && void console.log(true)) || void console.log(false);

() => (foo ? void console.log(true) : void console.log(false));

return void console.log('foo');