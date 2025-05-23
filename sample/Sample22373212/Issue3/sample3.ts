const userInput = "<img src=x onerror=alert('XSS')>";
document.body.innerHTML = "Welcome " + userInput;
