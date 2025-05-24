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
class TestEmpty {}
class TestReadonlyStatic1 {
  private static readonly correctlyReadonlyStatic1 = 7;
}
class TestReadonlyStatic2 {
  static readonly #correctlyReadonlyStatic2 = 7;
}
class TestModifiableStatic3 {
  private static correctlyModifiableStatic3 = 7;

  public constructor() {
    TestModifiableStatic3.correctlyModifiableStatic3 += 1;
  }
}
class TestModifiableStatic4 {
  static #correctlyModifiableStatic4 = 7;

  public constructor() {
    TestModifiableStatic4.#correctlyModifiableStatic4 += 1;
  }
}
class TestModifiableByParameterProperty5 {
  private static readonly correctlyModifiableByParameterProperty5 = 7;

  public constructor(
    public correctlyModifiablePublicParameter: number = (() => {
      return (TestModifiableStatic.correctlyModifiableByParameterProperty += 1);
    })(),
  ) {}
}
class TestModifiableByParameterProperty6 {
  static readonly #correctlyModifiableByParameterProperty6 = 7;
  public constructor(
    public correctlyModifiablePublicParameter: number = (() => {
      return (TestModifiableStatic.#correctlyModifiableByParameterProperty += 1);
    })(),
  ) {}
}
class TestReadonlyInline7 {
  private readonly correctlyReadonlyInline7 = 7;
}

class TestReadonlyInline8 {
  readonly #correctlyReadonlyInline8 = 7;
}
class TestReadonlyDelayed9 {
  private readonly correctlyReadonlyDelayed9 = 7;
  public constructor() {
    this.correctlyReadonlyDelayed9 += 1;
  }
}
class TestReadonlyDelayed10 {
  readonly #correctlyReadonlyDelayed10 = 7;
  public constructor() {
    this.#correctlyReadonlyDelayed10 += 1;
  }
}
class TestModifiableInline12 {
  private correctlyModifiableInline12 = 7;
  public mutate() {
    this.correctlyModifiableInline12 += 1;
    return class {
      private correctlyModifiableInline13 = 7;
      mutate() {
        this.correctlyModifiableInline13 += 1;
      }
    };
  }
}
class TestModifiableInline14 {
  #correctlyModifiableInline14 = 7;
  public mutate() {
    this.#correctlyModifiableInline14 += 1;
    return class {
      #correctlyModifiableInline15 = 7;
      mutate() {
        this.#correctlyModifiableInline15 += 1;
      }
    };
  }
}
class TestModifiableDelayed16 {
  private correctlyModifiableDelayed16 = 7;
  public mutate() {
    this.correctlyModifiableDelayed16 += 1;
  }
}
class TestModifiableDelayed17 {
  #correctlyModifiableDelayed17 = 7;
  public mutate() {
    this.#correctlyModifiableDelayed17 += 1;
  }
}
class TestModifiableDeleted18 {
  private correctlyModifiableDeleted18 = 7;
  public mutate() {
    delete this.correctlyModifiableDeleted18;
  }
}
class TestModifiableWithinConstructor19 {
  private correctlyModifiableWithinConstructor19 = 7;
  public constructor() {
    (() => {
      this.correctlyModifiableWithinConstructor19 += 1;
    })();
  }
}
class TestModifiableWithinConstructor20 {
  #correctlyModifiableWithinConstructor20 = 7;
  public constructor() {
    (() => {
      this.#correctlyModifiableWithinConstructor20 += 1;
    })();
  }
}
class TestModifiableWithinConstructorArrowFunction21 {
  private correctlyModifiableWithinConstructorArrowFunction21 = 7;
  public constructor() {
    (() => {
      this.correctlyModifiableWithinConstructorArrowFunction21 += 1;
    })();
  }
}
class TestModifiableWithinConstructorArrowFunction22 {
  #correctlyModifiableWithinConstructorArrowFunction22 = 7;
  public constructor() {
    (() => {
      this.#correctlyModifiableWithinConstructorArrowFunction22 += 1;
    })();
  }
}
class TestModifiableWithinConstructorInFunctionExpression23 {
  private correctlyModifiableWithinConstructorInFunctionExpression23 = 7;
  public constructor() {
    const self = this;

    (() => {
      self.correctlyModifiableWithinConstructorInFunctionExpression23 += 1;
    })();
  }
}
class TestModifiableWithinConstructorInFunctionExpression24 {
  #correctlyModifiableWithinConstructorInFunctionExpression24 = 7;
  public constructor() {
    const self = this;
    (() => {
      self.#correctlyModifiableWithinConstructorInFunctionExpression24 += 1;
    })();
  }
}
class TestModifiableWithinConstructorInGetAccessor25 {
  private correctlyModifiableWithinConstructorInGetAccessor25 = 7;
  public constructor() {
    const self = this;
    const confusingObject = {
      get accessor() {
        return (self.correctlyModifiableWithinConstructorInGetAccessor25 += 1);
      },
    };
  }
}
class TestModifiableWithinConstructorInGetAccessor26 {
  #correctlyModifiableWithinConstructorInGetAccessor26 = 7;
  public constructor() {
    const self = this;
    const confusingObject = {
      get accessor() {
        return (self.#correctlyModifiableWithinConstructorInGetAccessor26 += 1);
      },
    };
  }
}
class TestModifiableWithinConstructorInMethodDeclaration30 {
  private correctlyModifiableWithinConstructorInMethodDeclaration30 = 7;
  public constructor() {
    const self = this;
    const confusingObject = {
      methodDeclaration() {
        self.correctlyModifiableWithinConstructorInMethodDeclaration30 = 7;
      },
    };
  }
}
class TestModifiableWithinConstructorInMethodDeclaration31 {
  #correctlyModifiableWithinConstructorInMethodDeclaration31 = 7;
  public constructor() {
    const self = this;
    const confusingObject = {
      methodDeclaration() {
        self.#correctlyModifiableWithinConstructorInMethodDeclaration31 = 7;
      },
    };
  }
}
class TestModifiableWithinConstructorInSetAccessor32 {
  private correctlyModifiableWithinConstructorInSetAccessor32 = 7;
  public constructor() {
    const self = this;
    const confusingObject = {
      set accessor(value: number) {
        self.correctlyModifiableWithinConstructorInSetAccessor32 += value;
      },
    };
  }
}
class TestModifiableWithinConstructorInSetAccessor33 {
  #correctlyModifiableWithinConstructorInSetAccessor33 = 7;
  public constructor() {
    const self = this;
    const confusingObject = {
      set accessor(value: number) {
        self.#correctlyModifiableWithinConstructorInSetAccessor33 += value;
      },
    };
  }
}
class TestModifiablePostDecremented34 {
  private correctlyModifiablePostDecremented34 = 7;
  public mutate() {
    this.correctlyModifiablePostDecremented34 -= 1;
  }
}
class TestModifiablePostDecremented35 {
  #correctlyModifiablePostDecremented35 = 7;
  public mutate() {
    this.#correctlyModifiablePostDecremented35 -= 1;
  }
}
class TestyModifiablePostIncremented36 {
  private correctlyModifiablePostIncremented36 = 7;
  public mutate() {
    this.correctlyModifiablePostIncremented36 += 1;
  }
}
class TestyModifiablePostIncremented37 {
  #correctlyModifiablePostIncremented37 = 7;
  public mutate() {
    this.#correctlyModifiablePostIncremented37 += 1;
  }
}
class TestModifiablePreDecremented38 {
  private correctlyModifiablePreDecremented38 = 7;
  public mutate() {
    --this.correctlyModifiablePreDecremented38;
  }
}
class TestModifiablePreDecremented40 {
  #correctlyModifiablePreDecremented40 = 7;
  public mutate() {
    --this.#correctlyModifiablePreDecremented40;
  }
}
class TestModifiablePreIncremented41 {
  private correctlyModifiablePreIncremented41 = 7;
  public mutate() {
    ++this.correctlyModifiablePreIncremented41;
  }
}
class TestModifiablePreIncremented42 {
  #correctlyModifiablePreIncremented42 = 7;
  public mutate() {
    ++this.#correctlyModifiablePreIncremented42;
  }
}
class TestProtectedModifiable43 {
  protected protectedModifiable43 = 7;
}

class TestPublicModifiable44 {
  public publicModifiable44 = 7;
}
class TestReadonlyParameter45 {
  public constructor(private readonly correctlyReadonlyParameter45 = 7) {}
}
/** onlyInlineLambdas: true,*/
class TestCorrectlyModifiableParameter46 {
  public constructor(private correctlyModifiableParameter46 = 7) {}
  public mutate() {
    this.correctlyModifiableParameter46 += 1;
  }
}

//下面没有option配置
class TestComputedParameter48 {
  public mutate() {
    this['computed'] = 1;
  }
}
class Foo49 {
  private value49: number = 0;
  bar(newValue: { value: number }) {
    ({ value: this.value49 } = newValue);
    return this.value49;
  }
}
class Foo50 {
  #value50: number = 0;
  bar(newValue: { value: number }) {
    ({ value: this.#value50 } = newValue);
    return this.#value50;
  }
}
function ClassWithName51<TBase extends new (...args: any[]) => {}>(Base: TBase) {
  return class extends Base {
    private _name51: string;
    public test(value: string) {
      this._name51 = value;
    }
  };
}
function ClassWithName52<TBase extends new (...args: any[]) => {}>(Base: TBase) {
  return class extends Base {
    #name52: string;
    public test(value: string) {
      this.#name52 = value;
    }
  };
}
class Foo53 {
  private value53: Record<string, number> = {};
  bar(newValue: Record<string, number>) {
    ({ ...this.value53 } = newValue);
    return this.value53;
  }
}
class Foo54 {
  #value54: Record<string, number> = {};
  bar(newValue: Record<string, number>) {
    ({ ...this.#value54 } = newValue);
    return this.#value54;
  }
}
class Foo55 {
  private value55: number[] = [];
  bar(newValue: number[]) {
    [...this.value55] = newValue;
    return this.value55;
  }
}
class Foo56 {
  #value56: number[] = [];
  bar(newValue: number[]) {
    [...this.#value56] = newValue;
    return this.#value56;
  }
}
class Foo57 {
  private value57: number = 0;
  bar(newValue: number[]) {
    [this.value57] = newValue;
    return this.value57;
  }
}
class Foo58 {
  #value58: number = 0;
  bar(newValue: number[]) {
    [this.#value58] = newValue;
    return this.#value58;
  }
}
class Test59 {
  private testObj59 = {
    prop: '',
  };
  public test(): void {
    this.testObj59 = '';
  }
}
class Test60 {
  #testObj60 = {
    prop: '',
  };
  public test(): void {
    this.#testObj60 = '';
  }
}

class TestObject61 {
  public prop61: number;
}
class Test61 {
  private testObj = new TestObject61();
  public test(): void {
    this.testObj = new TestObject61();
  }
}
class TestObject62 {
  public prop: number;
}
class Test62 {
  #testObj62 = new TestObject62();
  public test(): void {
    this.#testObj62 = new TestObject62();
  }
}
class TestIntersection63 {
  private prop63: number = 3;
  test() {
    const that = {} as this & { _foo: 'bar' };
    that.prop63 = 1;
  }
}
class TestUnion64 {
  private prop64: number = 3;
  test64() {
    const that = {} as this | (this & { _foo: 'bar' });
    that.prop64 = 1;
  }
}
class TestStaticIntersection65 {
  private static prop65: number;
  test65() {
    const that = {} as typeof TestStaticIntersection & { _foo: 'bar' };
    that.prop65 = 1;
  }
}
class TestStaticUnion66 {
  private static prop66: number = 1;
  test66() {
    const that = {} as
      | typeof TestStaticUnion
      | (typeof TestStaticUnion & { _foo: 'bar' });
    that.prop66 = 1;
  }
}
class TestBothIntersection67 {
  private prop167: number = 1;
  private static prop267: number;
  test() {
    const that = {} as typeof TestBothIntersection67 & this;
    that.prop167 = 1;
    that.prop267 = 1;
  }
}
class TestBothIntersection68 {
  private prop168: number = 1;
  private static prop268: number;
  test() {
    const that = {} as this & typeof TestBothIntersection68;
    that.prop168 = 1;
    that.prop268 = 1;
  }
}
class TestStaticPrivateAccessor69 {
  private static accessor staticAcc69 = 1;
}
class TestStaticPrivateFieldAccessor70 {
  static accessor #staticAcc70 = 1;
}
class TestPrivateAccessor71 {
  private accessor acc71 = 3;
}
class TestPrivateFieldAccessor72 {
  accessor #acc72 = 3;
}

export class Container {
  // Public members might be modified externally
  public publicMember: boolean = true;
  // Protected members might be modified by child classes
  protected protectedMember: number = Number.MAX_VALUE;
  // This is modified later on by the class
  private modifiedLater = 'unchanged';
  public mutate() {
    this.modifiedLater = 'mutated';
  }
}
//typescript-eslint
class Container {
  // Public members might be modified externally
  public publicMember: boolean;
  // Protected members might be modified by child classes
  protected protectedMember: number;
  // This is modified later on by the class
  private modifiedLater = 'unchanged';
  public mutate() {
    this.modifiedLater = 'mutated';
  }
  // This is modified later on by the class
  #modifiedLaterPrivateField = 'unchanged';
  public mutatePrivateField() {
    this.#modifiedLaterPrivateField = 'mutated';
  }
}
@Entry
@Component
struct PreferReadonlyReport {
  build() {
    Column() {
      Row() {
        Button().onClick(()=>{
        })
      }
    }
  }
}