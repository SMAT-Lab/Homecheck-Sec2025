import axios from 'axios';
function rule() {
    axios.get('http://example.com/data');  // 漏洞示例：不安全 HTTP 请求
}