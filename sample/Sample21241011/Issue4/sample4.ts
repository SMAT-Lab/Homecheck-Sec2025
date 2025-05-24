import * as xml2js from 'xml2js';
import { DOMParser } from 'xmldom';
import * as libxmljs from 'libxmljs';

class XMLProcessor {
    
    // 不安全的XML解析 - 启用外部实体
    public parseXMLWithExternalEntities(xmlContent: string): any {
        const parser = new xml2js.Parser({
            explicitCharkey: false,
            trim: false,
            normalize: false,
            explicitRoot: true,
            emptyTag: '',
            explicitArray: false,
            ignoreAttrs: false,
            mergeAttrs: false,
            validator: null,
            xmlns: false,
            explicitChildren: false,
            childkey: '$$',
            charsAsChildren: false,
            includeWhiteChars: false,
            async: false,
            strict: true,
            attrNameProcessors: null,
            attrValueProcessors: null,
            tagNameProcessors: null,
            valueProcessors: null,
            rootName: 'root',
            xmldec: { 'version': '1.0', 'encoding': 'UTF-8', 'standalone': true },
            doctype: null,
            renderOpts: { 'pretty': true, 'indent': '  ', 'newline': '\n' },
            headless: false,
            chunkSize: 10000,
            // 危险：允许外部实体解析
            parseExternalEntities: true,  // 危险配置
            resolveExternalEntities: true  // 危险配置
        });
        
        return parser.parseString(xmlContent, (err: any, result: any) => {
            if (err) {
                console.error('XML parsing error:', err);
                return null;
            }
            return result;
        });
    }
    
    // 不安全的DOM解析器使用
    public parseDOMWithExternalEntities(xmlString: string): Document {
        const parser = new DOMParser({
            locator: {},
            errorHandler: { warning: function(w: any) { }, 
                          error: function(e: any) { }, 
                          fatalError: function(e: any) { console.error(e) } },
            // 危险：没有禁用外部实体
            resolveExternalEntities: true  // 危险配置
        });
        
        return parser.parseFromString(xmlString, 'text/xml');
    }
}

class DocumentProcessor {
    
    // 不安全的libxmljs解析
    public parseLibXMLWithExternalEntities(xmlContent: string): any {
        const options = {
            noblanks: true,
            noent: true,     // 危险：启用实体替换
            dtdload: true,   // 危险：加载DTD
            dtdattr: true,   // 危险：处理DTD属性
            dtdvalid: true,  // 危险：验证DTD
            nonet: false,    // 危险：允许网络访问
            nocdata: false,
            huge: false,
            recover: false
        };
        
        try {
            return libxmljs.parseXml(xmlContent, options);  // 危险的解析选项
        } catch (error) {
            console.error('LibXML parsing error:', error);
            return null;
        }
    }
    
    // 直接处理包含外部实体的XML
    public processXMLWithExternalEntities(): void {
        // 危险的XML内容示例，包含外部实体引用
        const maliciousXML = `<?xml version="1.0"?>
        <!DOCTYPE foo [
            <!ENTITY xxe SYSTEM "file:///etc/passwd">
            <!ENTITY ssrf SYSTEM "http://internal-server/sensitive-data">
        ]>
        <data>
            <user>&xxe;</user>
            <info>&ssrf;</info>
        </data>`;
        
        this.parseLibXMLWithExternalEntities(maliciousXML);  // 危险调用
    }
}

class ConfigurationParser {
    
    // 不安全的配置文件解析
    public parseConfigXML(configPath: string): any {
        const fs = require('fs');
        const xmlContent = fs.readFileSync(configPath, 'utf8');
        
        // 危险：直接解析可能包含外部实体的配置文件
        const parser = new xml2js.Parser({
            explicitArray: false,
            ignoreAttrs: false,
            // 危险设置
            resolveExternalEntities: true,  // 允许外部实体
            parseExternalEntities: true     // 解析外部实体
        });
        
        return parser.parseStringSync(xmlContent);  // 同步解析，可能阻塞
    }
    
    // 不安全的SOAP消息处理
    public processSOAPMessage(soapXML: string): any {
        // 危险：直接处理可能包含XXE的SOAP消息
        const parser = new DOMParser();
        const doc = parser.parseFromString(soapXML, 'application/xml');
        
        // 没有验证或禁用外部实体就直接处理
        return this.extractSOAPData(doc);
    }
    
    private extractSOAPData(doc: Document): any {
        // 简单的数据提取逻辑
        const envelope = doc.getElementsByTagName('soap:Envelope')[0];
        const body = doc.getElementsByTagName('soap:Body')[0];
        return {
            envelope: envelope ? envelope.textContent : '',
            body: body ? body.textContent : ''
        };
    }
}

class WebServiceHandler {
    
    // 不安全的Web服务XML处理
    public handleIncomingXML(xmlPayload: string): any {
        try {
            // 危险：直接解析来自网络的XML，没有禁用外部实体
            const parser = new xml2js.Parser({
                trim: true,
                explicitArray: false,
                // 关键危险配置
                resolveExternalEntities: true,
                parseExternalEntities: true,
                // 没有设置安全的解析器选项
                async: false
            });
            
            return parser.parseStringSync(xmlPayload);
        } catch (error) {
            console.error('Failed to parse XML payload:', error);
            return null;
        }
    }
    
    // 不安全的XML文档验证
    public validateXMLDocument(xmlDoc: string, schemaPath: string): boolean {
        const parser = new DOMParser({
            // 危险：允许外部实体解析进行验证
            resolveExternalEntities: true,
            errorHandler: {
                warning: function(msg: string) { console.warn(msg); },
                error: function(msg: string) { console.error(msg); },
                fatalError: function(msg: string) { throw new Error(msg); }
            }
        });
        
        const doc = parser.parseFromString(xmlDoc, 'text/xml');
        // 简化的验证逻辑
        return doc.documentElement !== null;
    }
}

// 演示XXE漏洞的使用场景
function demonstrateXXEVulnerabilities(): void {
    const xmlProcessor = new XMLProcessor();
    const docProcessor = new DocumentProcessor();
    const configParser = new ConfigurationParser();
    const webHandler = new WebServiceHandler();
    
    // 这些都是存在XXE漏洞的操作
    const testXML = `<?xml version="1.0"?>
    <!DOCTYPE test [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
    <root><data>&xxe;</data></root>`;
    
    console.log('Processing XML with XXE vulnerability...');
    xmlProcessor.parseXMLWithExternalEntities(testXML);
    xmlProcessor.parseDOMWithExternalEntities(testXML);
    docProcessor.parseLibXMLWithExternalEntities(testXML);
    docProcessor.processXMLWithExternalEntities();
    webHandler.handleIncomingXML(testXML);
    webHandler.validateXMLDocument(testXML, '/path/to/schema.xsd');
}