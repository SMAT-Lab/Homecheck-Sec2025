// 不安全的 XSS 代码示例
export class UnsafeXSSExample {
    private userInput: string;

    constructor(input: string) {
        this.userInput = input;
    }

    // 不安全的 DOM 操作示例
    public unsafeInnerHTML(): void {
        const element = document.getElementById('content');
        if (element) {
            // 不安全的直接插入用户输入
            element.innerHTML = this.userInput;
        }
    }

    // 不安全的 document.write 示例
    public unsafeDocumentWrite(): void {
        // 不安全的直接写入用户输入
        document.write(this.userInput);
    }

    // 不安全的 eval 示例
    public unsafeEval(): void {
        // 不安全的执行用户输入
        eval(this.userInput);
    }

    // 不安全的 setTimeout 示例
    public unsafeSetTimeout(): void {
        // 不安全的执行用户输入
        setTimeout(this.userInput, 1000);
    }
} 