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

switch(foo) { case 0: a(); /* falls through */ case 1: b(); }
switch(foo) { case 0: a(); /* falls through */ case 1: b(); }
switch(foo) { case 0: a(); /* falls through */ case 1: b(); }
switch(foo) { case 0: a(); /* fall through */ case 1: b(); }
switch(foo) { case 0: a(); /* fallthrough */ case 1: b(); }
switch(foo) { case 0: a(); /* FALLS THROUGH */ case 1: b(); }
switch(foo) { case 0: { a(); } /* falls through */ case 1: b(); }
function foo() { switch(foo) { case 0: a(); return; case 1: b(); } }
switch(foo) { case 0: a(); throw 'foo'; case 1: b(); }
while (a) { switch(foo) { case 0: a(); continue; case 1: b(); } }
switch(foo) { case 0: a(); break; case 1: b(); }
switch(foo) { case 0: case 1: a(); break; case 2: b(); }
switch(foo) { case 0: case 1: break; case 2: b(); }
switch(foo) { case 0: case 1: break; default: b(); }
switch(foo) { case 0: case 1: a(); }
switch(foo) { case 0: case 1: a(); break; }
switch(foo) { case 0: case 1: break; }
switch(foo) { case 0:
  case 1: break; }
switch(foo) { case 0: // comment\n case 1: break;
}
function foo1() { switch(foo) { case 0: case 1: return; } }
function foo2() { switch(foo) { case 0: {return;}

  case 1: {return;} } }
switch(foo) { case 0: case 1: {break;} }
switch(foo) { }
switch(foo) { case 0: switch(bar) { case 2: break; } /* falls through */ case 1: break; }
function foo3() { switch(foo) { case 1: return a; a++; }}
switch (foo) { case 0: a(); /* falls through */ default: b(); /* comment */ }
switch (foo) { case 0: a(); /* falls through */ default: /* comment */ b(); }
switch(foo) { case 0: do{break ;}while (a) { break} default: b() }
switch(foo) { case 0:  /* falls through */ case 1: b(); }

switch (foo) {
  case 0:
    a();
    break;
/* falls through */
  case 1:
    b();
}
switch (foo) {
  case 0:
    a();
    break;
/* falls through */
  case 1:
    b();
}
switch (foo) {
  case 0:
    a();
}
switch (bar) {
  case 1:
    b();
}