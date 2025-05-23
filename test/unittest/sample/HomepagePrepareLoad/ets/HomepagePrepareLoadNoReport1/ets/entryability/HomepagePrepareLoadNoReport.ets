import { AbilityConstant, UIAbility, Want } from "@kit.AbilityKit";
import { hilog } from "@kit.PerformanceAnalysisKit";
import { webview } from "@kit.ArkWeb";
import { window } from "@kit.ArkUI";

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    console.log('EntryAbility onCreate');
    webview.WebviewController.initializeWebEngine();
    //预连接时，需要将"https://www.example.com"替换成真实要访问的网站地址。
    //指定第二个参数为true，代表要进行预连接，如果为false该接口只会对网址进行DNS解析
    webview.WebviewController.prepareForPageLoad("https://www.example.com/", true, 2);
    AppStorage.setOrCreate("abilityWant", want);
    console.log('EntryAbility onCreate done');
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    // Main window is created, set main page for this ability
    hilog.info(0x0000, 'testTag', '%{public}s', 'Ability onWindowStageCreate');

    windowStage.loadContent('pages/Index', (err) => {
      if(err.code) {
        hilog.error(0x0000, 'testTag', 'Failed to load the content. Cause: %{public}s', JSON.stringify(err) ?? '');
        return;
      }
      hilog.info(0x0000, 'testTag', 'Succeeded in loading the content.');
    });
  }
}