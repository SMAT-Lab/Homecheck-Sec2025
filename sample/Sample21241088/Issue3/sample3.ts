import webview from '@ohos.web.webview'; // 模拟导入
import { BusinessError } from '@ohos.base';

// 模拟 WebviewController
class MockWebviewController {
    private currentUrl: string = "";
    public javaScriptEnabled: boolean = true; // 默认启用JS

    constructor() {
        console.log("MockWebviewController created");
    }

    loadUrl(url: string): void {
        this.currentUrl = url;
        console.log(`WebView loading URL: ${url}`);
        // 实际应用中，如果URL来自不可信源且未验证，可能导致开放重定向或间接XSS
    }

    loadData(data: string, mimeType: string, encoding: string, baseUrl?: string, historyUrl?: string): void {
        console.log(`WebView loading data with MimeType: ${mimeType}`);
        // XSS Vulnerability: Loading untrusted HTML data
        // 实际的WebView会渲染这里的data
    }

    runJavaScript(script: string, callback?: (result: string) => void): void {
        console.log(`WebView running JavaScript: ${script.substring(0, 50)}...`);
        // XSS Vulnerability: Running untrusted JavaScript
        if (callback) {
            callback("mock_js_result");
        }
    }

    setJavaScriptPermitted(permit: boolean): void {
        this.javaScriptEnabled = permit;
        console.log(`WebView JavaScript permitted: ${permit}`);
    }

    get url(): string {
        return this.currentUrl;
    }
}

// 模拟全局webview对象或通过其他方式获取controller
// const globalWebviewController = new MockWebviewController();

class MyAbility {
    private webviewController: MockWebviewController;

    constructor() {
        // 在实际应用中，WebView组件创建后会得到一个controller
        this.webviewController = new MockWebviewController();
    }

    onStart(want: any) {
        console.log("MyAbility onStart");
        this.setupWebView();
    }

    setupWebView() {
        // 场景1: 从不可信来源获取HTML内容并加载 (XSS)
        const untrustedHtml = want.parameters.htmlContent || "<script>alert('XSS from want parameters!')</script>"; // 来自want参数
        // 漏洞: 直接使用 unstrustedHtml
        this.webviewController.loadData(untrustedHtml, "text/html", "UTF-8");

        // 场景2: 从URL参数构造HTML (XSS)
        const nameParam = want.parameters.name || "Guest";
        const userHtml = `<h1>Welcome, ${nameParam}!</h1><img src=x onerror=alert('XSS_from_name_param')>`; // nameParam未转义
        // 漏洞: userHtml包含恶意脚本
        this.webviewController.loadData(userHtml, "text/html", "UTF-8");

        // 场景3: 直接执行来自不可信来源的JavaScript (XSS)
        const scriptFromNetwork = "localStorage.setItem('token', 'hacked_token'); alert('XSS from network script');"; // 假设这是从网络获取的
        // 漏洞: 直接执行 scriptFromNetwork
        this.webviewController.runJavaScript(scriptFromNetwork);

        // 场景4: JavaScript未启用 (相对安全，但功能受限)
        const safeController = new MockWebviewController();
        safeController.setJavaScriptPermitted(false);
        safeController.loadData("<h1>JavaScript is disabled.</h1>", "text/html", "UTF-8");

        // 场景5: 动态构造脚本并执行 (XSS)
        const userId = want.parameters.userId || "0";
        const dynamicScript = `setUser('${userId}');`; // 如果userId可控且未正确处理setUser函数，可能导致XSS
        // 漏洞: dynamicScript 可能被恶意构造
        this.webviewController.runJavaScript(dynamicScript);

        // 场景6: 使用全局webview对象 (如果存在)
        // const someUserInput = "<img src=x onerror=alert('Global_XSS')>";
        // globalWebviewController.loadData(someUserInput, "text/html", "UTF-8");

        // 场景7: JavaScriptEnabled 设置为 true (增加风险)
        this.webviewController.javaScriptEnabled = true; // 明确设置，增加XSS风险
        const anotherUnsafeHtml = want.parameters.footer || "<script>console.error('XSS in footer')</script>";
        this.webviewController.loadData(anotherUnsafeHtml, "text/html", "UTF-8");
    }
}

// 模拟Ability的启动和want参数
const want = {
    parameters: {
        htmlContent: "<iframe src='javascript:alert(\"XSS via iframe\")'></iframe>",
        name: "<script>document.body.innerHTML='Hacked by XSS'</script>",
        userId: "123; alert('XSS in userId');",
        footer: "<div>Footer</div><script>window.location='http://evil.com'</script>"
    }
};

const myAbilityInstance = new MyAbility();
myAbilityInstance.onStart(want);