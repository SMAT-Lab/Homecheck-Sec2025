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

'use strict';

describe('foo', () => {
    it('does something', function (this: Mocha.Context) {
        this.timeout(100);
        // done
    });
});

interface SomeType {
    prop: string;
}
function f1(this: SomeType) {
    this.prop;
}

function f2(this: prop) {
    this.propMethod();
}

z(function (x, this: context) {
    console.log(x, this);
});

function f3() {
    /** @this Obj*/
    return function bar() {
        console.log(this);
        z(x => console.log(x, this));
    };
}

var Ctor = function () {
    console.log(this);
    z(x => console.log(x, this));
};

function F1() {
    console.log(this);
    z(x => console.log(x, this));
}

function F2() {
    console.log(this);
    z(x => console.log(x, this));
}

function F3() {
    console.log(this);
    z(x => console.log(x, this));
}

var F4 = function Foo() {
    console.log(this);
    z(x => console.log(x, this));
};

class A {
    constructor() {
        console.log(this);
        z(x => console.log(x, this));
    }
}

var obj = {
    foo: function () {
        console.log(this);
        z(x => console.log(x, this));
    },
};

var obj = {
    foo() {
        console.log(this);
        z(x => console.log(x, this));
    },
};

var obj1 = {
    foo:
    foo ||
        function () {
            console.log(this);
            z(x => console.log(x, this));
        },
};

var obj2 = {
    foo: hasNative
        ? foo
        : function () {
            console.log(this);
            z(x => console.log(x, this));
        },
};

var obj3 = {
    foo: (function () {
        return function () {
            console.log(this);
            z(x => console.log(x, this));
        };
    })(),
};

Object.defineProperty(obj, 'foo', {
    value: function () {
        console.log(this);
        z(x => console.log(x, this));
    },
});

Object.defineProperties(obj, {
    foo: {
        value: function () {
            console.log(this);
            z(x => console.log(x, this));
        },
    },
});

obj.foo = function () {
    console.log(this);
    z(x => console.log(x, this));
};

obj.foo =
    foo ||
        function () {
            console.log(this);
            z(x => console.log(x, this));
        };

obj.foo = foo
    ? bar
    : function () {
        console.log(this);
        z(x => console.log(x, this));
    };

obj.foo = (function () {
    return function () {
        console.log(this);
        z(x => console.log(x, this));
    };
})();

obj.foo = (() =>
function () {
    console.log(this);
    z(x => console.log(x, this));
})();

(function () {
    console.log(this);
    z(x => console.log(x, this));
}).call(obj);

var foo4 = function () {
    console.log(this);
    z(x => console.log(x, this));
}.bind(obj);

Reflect.apply(
    function () {
        console.log(this);
        z(x => console.log(x, this));
    },
    obj,
    [],
);

(function () {
    console.log(this);
    z(x => console.log(x, this));
}).apply(obj);

class A1 {
    foo() {
        console.log(this);
        z(x => console.log(x, this));
    }
}

class A2 {
    b = 0;
    c = this.b;
}

class A3 {
    b = new Array(this, 1, 2, 3);
}

class A4 {
    b = () => {
        console.log(this);
    };
}

Array.from(
    [],
    function () {
        console.log(this);
        z(x => console.log(x, this));
    },
    obj,
);

foo.every(function () {
    console.log(this);
    z(x => console.log(x, this));
}, obj);

foo.filter(function () {
    console.log(this);
    z(x => console.log(x, this));
}, obj);

foo.find(function () {
    console.log(this);
    z(x => console.log(x, this));
}, obj);

foo.findIndex(function () {
    console.log(this);
    z(x => console.log(x, this));
}, obj);

foo.forEach(function () {
    console.log(this);
    z(x => console.log(x, this));
}, obj);

foo.map(function () {
    console.log(this);
    z(x => console.log(x, this));
}, obj);

foo.some(function () {
    console.log(this);
    z(x => console.log(x, this));
}, obj);

/** @this Obj */ function foo() {
    console.log(this);
    z(x => console.log(x, this));
}

foo(
    /* @this Obj */ function () {
    console.log(this);
    z(x => console.log(x, this));
},
);

/**
 * @returns {void}
 * @this Obj
 */
function foo() {
    console.log(this);
    z(x => console.log(x, this));
}

Ctor = function () {
    console.log(this);
    z(x => console.log(x, this));
};

function foo(
    Ctor = function () {
        console.log(this);
        z(x => console.log(x, this));
    },
) {}

[
    obj.method = function () {
        console.log(this);
        z(x => console.log(x, this));
    },
] = a;

class A {
    static foo() {
        console.log(this);
        z(x => console.log(x, this));
    }
}

class A {
    a = 5;
    b = this.a;
    accessor c = this.a;
}

interface SomeType {
    prop: string;
}
function foo() {
    this.prop;
}

console.log(this);
z(x => console.log(x, this));

console.log(this);
z(x => console.log(x, this));

(function () {
    console.log(this);
    z(x => console.log(x, this));
})();

function foo() {
    console.log(this);
    z(x => console.log(x, this));
}

function foo() {
    console.log(this);
    z(x => console.log(x, this));
}

function Foo() {
    console.log(this);
    z(x => console.log(x, this));
}

function foo() {
    'use strict';
    console.log(this);
    z(x => console.log(x, this));
}

function Foo() {
    'use strict';
    console.log(this);
    z(x => console.log(x, this));
}

return function () {
    console.log(this);
    z(x => console.log(x, this));
};

var foo = function () {
    console.log(this);
    z(x => console.log(x, this));
}.bar(obj);

var obj = {
    foo: function () {
        function foo() {
            console.log(this);
            z(x => console.log(x, this));
        }
        foo();
    },
};

var obj = {
    foo() {
        function foo() {
            console.log(this);
            z(x => console.log(x, this));
        }
        foo();
    },
};

var obj = {
    foo: function () {
        return function () {
            console.log(this);
            z(x => console.log(x, this));
        };
    },
};

var obj = {
    foo: function () {
        'use strict';
        return function () {
            console.log(this);
            z(x => console.log(x, this));
        };
    },
};

obj.foo = function () {
    return function () {
        console.log(this);
        z(x => console.log(x, this));
    };
};

obj.foo = function () {
    'use strict';
    return function () {
        console.log(this);
        z(x => console.log(x, this));
    };
};

class A {
    foo() {
        return function () {
            console.log(this);
            z(x => console.log(x, this));
        };
    }
}

class A {
    b = new Array(1, 2, function () {
        console.log(this);
        z(x => console.log(x, this));
    });
}

class A {
    b = () => {
        function c() {
            console.log(this);
            z(x => console.log(x, this));
        }
    };
}

obj.foo = (function () {
    return () => {
        console.log(this);
        z(x => console.log(x, this));
    };
})();

obj.foo = (() => () => {
    console.log(this);
    z(x => console.log(x, this));
})();

var foo = function () {
    console.log(this);
    z(x => console.log(x, this));
}.bind(null);

(function () {
    console.log(this);
    z(x => console.log(x, this));
}).call(undefined);

(function () {
    console.log(this);
    z(x => console.log(x, this));
}).apply(void 0);

Array.from([], function () {
    console.log(this);
    z(x => console.log(x, this));
});

foo.every(function () {
    console.log(this);
    z(x => console.log(x, this));
});

foo.filter(function () {
    console.log(this);
    z(x => console.log(x, this));
});

foo.find(function () {
    console.log(this);
    z(x => console.log(x, this));
});

foo.findIndex(function () {
    console.log(this);
    z(x => console.log(x, this));
});

foo.forEach(function () {
    console.log(this);
    z(x => console.log(x, this));
});

foo.map(function () {
    console.log(this);
    z(x => console.log(x, this));
});

foo.some(function () {
    console.log(this);
    z(x => console.log(x, this));
});

foo.forEach(function () {
    console.log(this);
    z(x => console.log(x, this));
}, null);

/** @returns {void} */ function foo() {
    console.log(this);
    z(x => console.log(x, this));
}

foo(function () {
    console.log(this);
    z(x => console.log(x, this));
});

var Ctor = function () {
    console.log(this);
    z(x => console.log(x, this));
};

var func = function () {
    console.log(this);
    z(x => console.log(x, this));
};

var func = function () {
    console.log(this);
    z(x => console.log(x, this));
};

Ctor = function () {
    console.log(this);
    z(x => console.log(x, this));
};

func = function () {
    console.log(this);
    z(x => console.log(x, this));
};

func = function () {
    console.log(this);
    z(x => console.log(x, this));
};

function foo(
    func = function () {
        console.log(this);
        z(x => console.log(x, this));
    },
) {}

[
    func = function () {
        console.log(this);
        z(x => console.log(x, this));
    },
] = a;

function describe(arg0: string, arg1: () => void) {
    throw new Error('Function not implemented.');
}

function it(arg0: string, arg1: (this: Mocha.Context) => void) {
    throw new Error('Function not implemented.');
}

function z(arg0: (x: any) => void) {
    throw new Error('Function not implemented.');
}

function bar(): void {
    throw new Error('Function not implemented.');
}
