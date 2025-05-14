# Specify interfaces for identifying call chains.(specified-interface-call-chain-check)

To facilitate interface management, such as interface changes and removal, you may want to identify the call chain for specified interfaces, which can be namespaces, classes, structs, functions, enums, interfaces, types or class properties.

## Rule Details
This rule is aimed at identifying the call chain of a specified interface to facilitate interface management.
The maximum number of call chains is 5000.
>See [***documentation***](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V13/ide-specified-interface-call-chain-check-V13) for more details.

Add the following configuration to the **code-linter.json5** file:
```
"rules": {
    "@security/specified-interface-call-chain-check": [
      "suggestion",
      {
        // Absolute path of the output directory. Create the directory if it does not exist. The output file name is specified-interface-call-chain-check_result.txt.
        "outputDirPath": "",
        // Maximum length of a call chain. The default value is 0, indicating that the length is not limited.
        "callChainMaxLen": 0
      },
      {
        // Enum: namespace/class/function/property/type ('function' includes function and class methods; 'class' includes classes, interfaces, enums and structs)
        "selector": "function",
        // Absolute path of the interface file
        "filePath": "AbsolutePath/Target",
        // Name of the namespace where the interface to be checked is defined. Can be [] if there is no such namespace.
        "namespace": [],
        // Name of the class that is to be checked or where the interface to be checked is defined
        "class": "Cls1",
        // Function name
        "function": "func1",
        // Class property name
        "property": "",
        // Type name
        "type": "",
      },
    ],
}
```

Examples of code for **specified interface**:
```ets
// Target.ets
export class Cls1 {
    public func1() {
        console.log('This is func1 in Cls1.');
    }

    public func2() {
        console.log('This is func2 in Cls1.');
    }
}
```

Examples of **incorrect** code for this rule:

```ets
// Incorrect.ets
import { Cls1 } from './Target';

let testClass = new Cls1();
// warning line
testClass.func1();

```

Examples of **correct** code for this rule:

```ets
// correct.ets
import { Cls1 } from './Target';

let testClass = new Cls1();
testClass.func2();

```