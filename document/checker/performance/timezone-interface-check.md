# Time and time zone coding specifications (timezone-interface-check)
When obtaining non-local time, you are advised to use the standard APIs in **I18n.Calendar** to obtain time and time zone information.

## Rule Details
This rule is aimed at preventing time errors that may occur when the time zone information is obtained without daylight saving time (DST) adjustments.
>See [***documentation***](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V13/ide-timezone-interface-check-V13) for more details.

Examples of **incorrect** code for this rule: 

```ets
// test1.ets
import i18n from '@ohos.i18n';

let timeZone = '123';
let calendar = i18n.getCalendar(i18n.getSystemLocale());
calendar.setTimeZone(timeZone);
calendar.get('zone_offset');
// dst_offset is not obtained.
// calendar.get('dst_offset'); 
```
```ets
// test2.ets
import systemDateTime from '@ohos.systemDateTime';
// This example does not apply to API version 12 (which is the default API version in DevEco Studio).
systemDateTime.setTimezone();

```
```ets
// test3.ets
import moment from '@hview/moment'

moment().utcOffset();
moment().utcOffset(120);
moment().utcOffset("+08:00");
moment().utcOffset(-5, true);
```

Examples of **correct** code for this rule: 

```ets
//test4.ets
import i18n from '@ohos.i18n';

let timeZone = '123';
let calendar = i18n.getCalendar(i18n.getSystemLocale());
calendar.setTimeZone(timeZone);

```
```ets
//test5.ets
import i18n from '@ohos.i18n';

let timeZone = '123';
let calendar = i18n.getCalendar(i18n.getSystemLocale());
calendar.setTimeZone(timeZone);
calendar.get('zone_offset'); 
calendar.get('dst_offset');
```
```ets
//test6.ets
import i18n from '@ohos.i18n';

let calendar = i18n.getCalendar(i18n.getSystemLocale());
calendar.setTimeZone(i18n.getTimeZone().getID());
```
