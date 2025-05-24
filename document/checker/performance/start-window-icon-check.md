# Set a suitable size for startWindowIcon.(start-window-icon-check)

Startup icons in larger pixels take more time to decode, slowing down app startup. To improve app startup, use icons of 256 x 256 pixels or smaller.

## Benefits from Code Optimization
Reduced cold start response latency.

## Rule Details
This rule is aimed at speeding ​​up application startup.
>See [***documentation***](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V13/ide-start-window-icon-check-V13) or [***best practice***](https://developer.huawei.com/consumer/cn/doc/best-practices-V5/bpta-application-cold-start-optimization-V5#section5953164714132) for more details.

Examples of **incorrect** code for this rule:

1. `startWindowIcon` is configured for the ability of **mainElement** in `entry/src/main/module.json5`.
2. The image specified by `startWindowIcon` under `entry/src/main/resources/base/media` is larger than 256 x 256 pixels.

Examples of **correct** code for this rule:

1. `startWindowIcon` is configured for the ability of **mainElement** in `entry/src/main/module.json5`.
2. The image specified by `startWindowIcon` under `entry/src/main/resources/base/media` is 256 x 256 pixels or smaller.
