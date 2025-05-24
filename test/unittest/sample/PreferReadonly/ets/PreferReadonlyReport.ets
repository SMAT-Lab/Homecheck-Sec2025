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
/**
 class TestIncorrectlyModifiableStatic {
 static readonly #incorrectlyModifiableStatic = 7;
 }
}*/
class TestIncorrectlyModifiableStatic1 {
  // eslint-disable-next-line @typescript-eslint/prefer-readonly
  static #incorrectlyModifiableStatic1 = 7;
}
/**class TestIncorrectlyModifiableStatic {
  private static readonly incorrectlyModifiableStatic = 7;
}*/
class TestIncorrectlyModifiableStatic2 {
  static #incorrectlyModifiableStatic2 = 7;
}
class TestIncorrectlyModifiableStaticArrow3 {
  private static incorrectlyModifiableStaticArrow3 = () => 7;
}
class TestIncorrectlyModifiableStaticArrow4 {
  static #incorrectlyModifiableStaticArrow4 = () => 7;
}
class TestIncorrectlyModifiableInline5 {
  private incorrectlyModifiableInline5 = 7;
  public createConfusingChildClass() {
    return class {
      private incorrectlyModifiableInline6 = 7;
    };
  }
}
class TestIncorrectlyModifiableInline7 {
  #incorrectlyModifiableInline7 = 7;
  public createConfusingChildClass() {
    return class {
      #incorrectlyModifiableInline8 = 7;
    };
  }
}
class TestIncorrectlyModifiableDelayed8 {
  private incorrectlyModifiableDelayed8 = 7;
  public constructor() {
    this.incorrectlyModifiableDelayed8 = 7;
  }
}
class TestChildClassExpressionModifiable12 {
  private childClassExpressionModifiable12 = 7;

  public createConfusingChildClass() {
    return class {
      private childClassExpressionModifiable13 = 7; //这个不报
      mutate() {
        this.childClassExpressionModifiable13 += 1;
      }
    };
  }
}

class TestChildClassExpressionModifiable14 {
  #childClassExpressionModifiable14 = 7;
  public createConfusingChildClass() {
    return class {
      #childClassExpressionModifiable15 = 7;
      mutate() {
        this.#childClassExpressionModifiable15 += 1;
      }
    };
  }
}
class TestIncorrectlyModifiablePostMinus16 {
  private incorrectlyModifiablePostMinus16 = 7;
  public mutate() {
    this.incorrectlyModifiablePostMinus16 - 1;
  }
}
class TestIncorrectlyModifiablePostMinus17 {
  #incorrectlyModifiablePostMinus17 = 7;
  public mutate() {
    this.#incorrectlyModifiablePostMinus17 - 1;
  }
}
class TestIncorrectlyModifiablePostPlus18 {
  private incorrectlyModifiablePostPlus18 = 7;
  public mutate() {
    this.incorrectlyModifiablePostPlus18 + 1;
  }
}
class TestIncorrectlyModifiablePostPlus19 {
  #incorrectlyModifiablePostPlus19 = 7;
  public mutate() {
    this.#incorrectlyModifiablePostPlus19 + 1;
  }
}
class TestIncorrectlyModifiablePreMinus20 {
  private incorrectlyModifiablePreMinus20 = 7;
  public mutate() {
    -this.incorrectlyModifiablePreMinus20;
  }
}
class TestIncorrectlyModifiablePreMinus21 {
  #incorrectlyModifiablePreMinus21 = 7;
  public mutate() {
    -this.#incorrectlyModifiablePreMinus21;
  }
}
class TestIncorrectlyModifiablePrePlus22 {
  private incorrectlyModifiablePrePlus22 = 7;
  public mutate() {
    +this.incorrectlyModifiablePrePlus22;
  }
}
class TestIncorrectlyModifiablePrePlus23 {
  #incorrectlyModifiablePrePlus23 = 7;
  public mutate() {
    +this.#incorrectlyModifiablePrePlus23;
  }
}
class TestOverlappingClassVariable24 {
  private overlappingClassVariable24 = 7;
  public workWithSimilarClass(other: SimilarClass) {
    other.overlappingClassVariable24 = 7;
  }
}
class SimilarClass {
  public overlappingClassVariable24 = 7; //不报
}
class TestIncorrectlyModifiableParameter25 {
  public constructor(private incorrectlyModifiableParameter25 = 7) {}
}
class TestIncorrectlyModifiableParameter26 {
  public constructor(
    public ignore: boolean,
    private incorrectlyModifiableParameter26 = 7,
  ) {}
}
class TestCorrectlyNonInlineLambdas27 {
  private incorrectlyInlineLambda27 = () => 7;
}
function ClassWithName28<TBase extends new (...args: any[]) => {}>(Base: TBase) {
  return class extends Base {
    private _name28: string;
  };
}
class Test28 {
  private testObj28 = { // private readonly testObj28 = {
    prop: '',
  };
  public test28(): void {
    this.testObj28.prop = '';
  }
}
class Test29 {
  #testObj29 = {//  readonly #testObj29 = {
    prop: '',
  };
  public test29(): void {
    this.#testObj29.prop = '';
  }
}
class TestObject30 {
  public prop30: number;
}
class Test30 {
  private testObj = new TestObject30();// private readonly testObj = new TestObject();
  public test(): void {
    this.testObj.prop30 = 10;
  }
}
class TestObject34 {
  public prop34: number;
}
class Test34 {
  #testObj34 = new TestObject34();// readonly #testObj = new TestObject();
  public test(): void {
    this.#testObj34.prop34 = 10;
  }
}
class Test35 {
  private testObj35 = {//private readonly testObj = {
    prop35: '',
  };
  public test(): void {
    this.testObj35.prop35;
  }
}
class Test36 {
  #testObj36 = {//readonly #testObj = {
    prop36: '',
  };
  public test36(): void {
    this.#testObj36.prop36;
  }
}
class Test37 {
  private testObj37 = {};// private readonly testObj = {};
  public test(): void {
    this.testObj37?.prop;
  }
}
class Test38 {
  #testObj38 = {};// readonly #testObj = {};
  public test(): void {
    this.#testObj38?.prop;
  }
}
class Test39 {
  private testObj39 = {}; //private readonly testObj = {};
  public test(): void {
    this.testObj39!.prop;
  }
}
class Test40 {
  #testObj40 = {};// readonly #testObj = {};
  public test(): void {
    this.#testObj40!.prop;
  }
}
class Test41 {
  private testObj41 = {};// private readonly testObj = {};
  public test(): void {
    this.testObj41.prop.prop = '';
  }
}
class Test42 {
  #testObj42 = {};//readonly #testObj = {};
  public test(): void {
    this.#testObj42.prop.prop = '';
  }
}
class Test43 {
  private testObj43 = {};// private readonly testObj = {};
  public test(): void {
    this.testObj43.prop.doesSomething();
  }
}
class Test44 {
  #testObj44 = {};// readonly #testObj = {};
  public test(): void {
    this.#testObj44.prop.doesSomething();
  }
}
class Test45 {
  private testObj45 = {};// private readonly testObj = {};
  public test(): void {
    this.testObj45?.prop.prop;
  }
}
class Test46 {
  #testObj46 = {};//readonly #testObj = {};
  public test(): void {
    this.#testObj46?.prop.prop;
  }
}
class Test47 {
  private testObj = {};//private readonly testObj = {};
  public test(): void {
    this.testObj47?.prop?.prop;
  }
}
class Test48 {
  #testObj = {};//readonly #testObj = {};
  public test(): void {
    this.#testObj48?.prop?.prop;
  }
}
class Test49 {
  private testObj449 = {};// private readonly testObj = {};
  public test(): void {
    this.testObj49.prop?.prop;
  }
}
class Test50 {
  #testObj50 = {};//readonly #testObj = {};
  public test(): void {
    this.#testObj50.prop?.prop;
  }
}
class Test51 {
  private testObj51 = {};//private readonly testObj = {};
  public test(): void {
    this.testObj51!.prop?.prop;
  }
}
class Test52 {
  #testObj52 = {}; // readonly #testObj = {};
  public test(): void {
    this.#testObj52!.prop?.prop;
  }
}
class Test53 {
  private prop53: number = 3; // private readonly prop: number = 3;
  test() {
    const that = {} as this & { _foo: 'bar' };
    that._foo = 1;
  }
}
class Test54 {
  private prop54: number = 3;// private readonly prop: number = 3;
  test() {
    const that = {} as this | (this & { _foo: 'bar' });
    that.prop54;
  }
}
class Test55 {
  private prop55: number; // private readonly prop: number;
  constructor() {
    const that = {} as this & { _foo: 'bar' };
    that.prop55 = 1;
  }
}

export class Container {
  // These member variables could be marked as readonly
  private neverModifiedMember = true;

  private onlyModifiedInConstructor: number;
  // Private parameter properties can also be marked as readonly
  private neverModifiedParameter: string;
  public constructor(
    onlyModifiedInConstructor: number,
    // Private parameter properties can also be marked as readonly
    neverModifiedParameter: string,
  ) {
    this.neverModifiedParameter = neverModifiedParameter;
    this.onlyModifiedInConstructor = onlyModifiedInConstructor;
  }
}
/**typescript-eslint*/
class Container {
  // These member variables could be marked as readonly
  private neverModifiedMember = true;
  private onlyModifiedInConstructor: number;
  #neverModifiedPrivateField = 3;
  public constructor(
    onlyModifiedInConstructor: number,
    // Private parameter properties can also be marked as readonly
    private neverModifiedParameter: string,
  ) {
    this.onlyModifiedInConstructor = onlyModifiedInConstructor;
  }
}
@Entry
@Component
struct PreferReadonlyNoReport {
  build() {
    Column() {
      Row() {
        Button().onClick(()=>{
        })
      }
    }
  }
}