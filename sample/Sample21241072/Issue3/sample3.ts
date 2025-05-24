/**
 * @file XSSCheck.ts
 * @description XSS 漏洞示例类：展示常见的不安全操作
 */
export class UnsafeXSSExample {
    private readonly userInput: string;

    constructor(input: string) {
        this.userInput = input;
    }

    /**
     * 示例 1：不安全的 innerHTML 操作
     * 使用用户输入直接设置 innerHTML，可能导致 XSS 攻击
     */
    public triggerUnsafeInnerHTML(): void {
        const el: HTMLElement | null = document.getElementById('content');
        if (el !== null) {
            el.innerHTML = this.userInput;
        }
    }

    /**
     * 示例 2：使用 document.write 的不安全写入
     */
    public triggerUnsafeDocumentWrite(): void {
        document.write(this.userInput);
    }

    /**
     * 示例 3：通过 eval 执行用户输入
     */
    public triggerUnsafeEval(): void {
        eval(this.userInput);
    }

    /**
     * 示例 4：在 setTimeout 中使用字符串形式的代码执行
     */
    public triggerUnsafeSetTimeout(): void {
        setTimeout(this.userInput, 1000);
    }

    /**
     * 示例 5：使用 setInterval 作为额外的检测点
     */
    public triggerUnsafeSetInterval(): void {
        setInterval(this.userInput, 2000);
    }
}
