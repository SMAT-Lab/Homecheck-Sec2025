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

foo(function() { bar(thing, function(data) { baz(function() {}); }); });

foo(function() { bar(thing, (data) => { baz(function() {}); }); });

foo(() => { bar(thing, (data) => { baz( () => {}); }); });

foo(function() { if (isTrue) { bar(function(data) { baz(function() {}); }); } });

foo(function() { bar(thing, function(data) { baz(function() {}); }); });

foo1( function() {
  foo2(function() {
    foo3(function() {
      foo4(function() {
        // Do something
      });
    });
  });
});

function example() {
  setTimeout(() => {
    setTimeout(() => {
      setTimeout(() => {
        setTimeout(() => {
          console.log('Too many nested callbacks!');
        }, 1000);
      }, 1000);
    }, 1000);
  }, 1000);
}

// 循环嵌套深度14
foo(function() {foo(function() {foo(function() {foo(function() {foo(function() {foo(function() {foo(function() {foo(function() {foo(function() {foo(function() {foo(function() {foo(function() {foo(function() {foo(function() {});});});});});});});});});});});});});});

@Entry
@Component
struct Index {
  @State message: string = 'Hello World';

  @State count: number = 0;

  build() {
    RelativeContainer() {
      Text(this.message)
        .id('HelloWorld')
        .fontSize(50)
        .fontWeight(FontWeight.Bold)
        .alignRules({
          center: { anchor: '__container__', align: VerticalAlign.Center },
          middle: { anchor: '__container__', align: HorizontalAlign.Center }
        })
    }
    .height('100%')
    .width('100%')
  }

  mymMethod() {
    foo(function() { bar(thing, function(data) {}); });
  }

}