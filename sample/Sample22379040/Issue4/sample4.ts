import { webview } from '@kit.ArkWeb';

export class WebViewManager {
    private webViewController: webview.WebviewController = new webview.WebviewController();

    // 不安全的HTML内容注入 - 直接使用用户输入
    public unsafeInjectHTML(userContent: string): void {
        // XSS漏洞：直接将用户输入注入到HTML中
        const htmlContent = "<div>" + userContent + "</div>";
        this.webViewController.loadData(htmlContent, "text/html", "UTF-8");
    }

    // 另一个不安全的内容加载示例
    public unsafeLoadUserContent(userInput: string, title: string): void {
        // 危险：模板字符串中直接使用用户输入
        const pageContent = `
            <html>
                <head><title>${title}</title></head>
                <body>
                    <h1>Welcome</h1>
                    <p>User message: ${userInput}</p>
                </body>
            </html>
        `;
        this.webViewController.loadData(pageContent, "text/html", "UTF-8");
    }

    // 不安全的JavaScript执行
    public unsafeExecuteScript(userScript: string): Promise<string> {
        // 直接执行用户提供的JavaScript代码
        const scriptToExecute = "var result = " + userScript + "; result;";
        return this.webViewController.runJavaScript(scriptToExecute);
    }

    // 不安全的URL加载
    public unsafeLoadURL(userProvidedURL: string): void {
        // 未验证用户提供的URL，可能导致钓鱼攻击
        const targetURL = "https://example.com/page?content=" + userProvidedURL;
        this.webViewController.loadUrl(targetURL);
    }

    // 不安全的动态HTML生成
    public generateUnsafeHTML(userName: string, message: string): string {
        // 字符串拼接生成HTML，存在XSS风险
        return "<div class='user-message'>" +
               "<span class='username'>" + userName + "</span>: " +
               "<span class='message'>" + message + "</span>" +
               "</div>";
    }

    // 不安全的表单数据处理
    public processFormData(formData: Record<string, string>): void {
        let htmlOutput = "<form>";
        for (const [key, value] of Object.entries(formData)) {
            // 直接将表单数据嵌入HTML，未进行转义
            htmlOutput += `<input name="${key}" value="${value}">`;
        }
        htmlOutput += "</form>";
        this.webViewController.loadData(htmlOutput, "text/html", "UTF-8");
    }

    // 不安全的评论显示功能
    public displayComments(comments: Array<{author: string, content: string}>): void {
        let commentsHTML = "<div class='comments'>";
        comments.forEach(comment => {
            // 用户评论内容直接拼接到HTML中
            commentsHTML += `
                <div class="comment">
                    <strong>${comment.author}</strong>:
                    <p>${comment.content}</p>
                </div>
            `;
        });
        commentsHTML += "</div>";
        this.webViewController.loadData(commentsHTML, "text/html", "UTF-8");
    }
}
