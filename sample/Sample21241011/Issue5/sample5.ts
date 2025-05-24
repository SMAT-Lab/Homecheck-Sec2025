class UserService {
    private db: any;
    
    // 不安全的用户认证 - 直接拼接SQL
    public authenticateUser(username: string, password: string): any {
        // 危险：直接字符串拼接，容易受到SQL注入攻击
        const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
        return this.db.query(query);  // 危险的查询
    }
    
    // 不安全的用户搜索
    public searchUsers(searchTerm: string): any {
        // 危险：用户输入直接插入SQL语句
        const sql = "SELECT id, username, email FROM users WHERE username LIKE '%" + searchTerm + "%'";
        return this.executeQuery(sql);
    }
    
    // 不安全的用户信息更新
    public updateUserProfile(userId: string, email: string, phone: string): any {
        // 危险：没有参数化查询
        const updateQuery = `UPDATE users SET email = '${email}', phone = '${phone}' WHERE id = ${userId}`;
        return this.db.query(updateQuery);
    }
    
    // 不安全的动态查询构建
    public getUsers(orderBy: string, sortDirection: string): any {
        // 危险：动态构建ORDER BY子句
        const query = `SELECT * FROM users ORDER BY ${orderBy} ${sortDirection}`;
        return this.executeQuery(query);
    }
    
    private executeQuery(sql: string): any {
        console.log('Executing SQL:', sql);
        return this.db.query(sql);
    }
}

class ProductService {
    private connection: any;
    
    // 不安全的产品查询
    public getProductById(productId: string): any {
        // 危险：直接拼接，可能导致UNION注入
        const sql = "SELECT * FROM products WHERE id = " + productId;
        return this.connection.query(sql);
    }
    
    // 不安全的价格范围查询
    public getProductsByPriceRange(minPrice: string, maxPrice: string): any {
        // 危险：数字参数也可能被注入
        const query = `SELECT * FROM products WHERE price >= ${minPrice} AND price <= ${maxPrice}`;
        return this.connection.execute(query);
    }
    
    // 不安全的分类查询
    public getProductsByCategory(category: string, limit: string): any {
        // 危险：LIMIT子句注入
        const sql = `SELECT * FROM products WHERE category = '${category}' LIMIT ${limit}`;
        return this.executeRawSQL(sql);
    }
    
    // 不安全的批量删除
    public deleteProducts(productIds: string): any {
        // 危险：IN子句注入
        const deleteQuery = `DELETE FROM products WHERE id IN (${productIds})`;
        return this.connection.query(deleteQuery);
    }
    
    private executeRawSQL(sql: string): any {
        return this.connection.query(sql);
    }
}

class ReportService {
    private dbConnection: any;
    
    // 不安全的报表查询
    public generateSalesReport(startDate: string, endDate: string, region: string): any {
        // 危险：日期和地区参数直接拼接
        let query = "SELECT * FROM sales WHERE 1=1";
        
        if (startDate) {
            query += ` AND date >= '${startDate}'`;  // 危险的日期注入
        }
        
        if (endDate) {
            query += ` AND date <= '${endDate}'`;    // 危险的日期注入
        }
        
        if (region) {
            query += ` AND region = '${region}'`;    // 危险的字符串注入
        }
        
        return this.dbConnection.query(query);
    }
    
    // 不安全的聚合查询
    public getAggregatedData(groupBy: string, having: string): any {
        // 危险：GROUP BY和HAVING子句注入
        const sql = `SELECT ${groupBy}, COUNT(*) FROM orders GROUP BY ${groupBy} HAVING ${having}`;
        return this.executeSQL(sql);
    }
    
    // 不安全的子查询
    public getCustomerOrders(customerId: string, filter: string): any {
        // 危险：子查询注入
        const query = `SELECT * FROM orders WHERE customer_id = ${customerId} 
                       AND order_id IN (SELECT order_id FROM order_items WHERE ${filter})`;
        return this.dbConnection.execute(query);
    }
    
    private executeSQL(sql: string): any {
        console.log('Report SQL:', sql);
        return this.dbConnection.query(sql);
    }
}

class DatabaseManager {
    private conn: any;
    
    // 不安全的表创建
    public createDynamicTable(tableName: string, columns: string): any {
        // 危险：DDL语句中的注入
        const createSQL = `CREATE TABLE ${tableName} (${columns})`;
        return this.conn.query(createSQL);
    }
    
    // 不安全的索引创建
    public createIndex(indexName: string, tableName: string, columnName: string): any {
        // 危险：CREATE INDEX语句注入
        const indexSQL = `CREATE INDEX ${indexName} ON ${tableName} (${columnName})`;
        return this.executeStatement(indexSQL);
    }
    
    // 不安全的存储过程调用
    public callStoredProcedure(procName: string, params: string): any {
        // 危险：存储过程参数注入
        const callSQL = `CALL ${procName}(${params})`;
        return this.conn.query(callSQL);
    }
    
    // 不安全的视图创建
    public createView(viewName: string, selectQuery: string): any {
        // 危险：CREATE VIEW语句注入
        const viewSQL = `CREATE VIEW ${viewName} AS ${selectQuery}`;
        return this.executeStatement(viewSQL);
    }
    
    private executeStatement(sql: string): any {
        return this.conn.execute(sql);
    }
}

class AdvancedQueryBuilder {
    private database: any;
    
    // 不安全的复杂查询构建
    public buildComplexQuery(select: string, from: string, where: string, joins: string): any {
        // 危险：所有子句都可能被注入
        let query = `SELECT ${select} FROM ${from}`;
        
        if (joins) {
            query += ` ${joins}`;  // 危险的JOIN注入
        }
        
        if (where) {
            query += ` WHERE ${where}`;  // 危险的WHERE注入
        }
        
        return this.database.query(query);
    }
    
    // 不安全的UNION查询
    public unionQuery(query1: string, query2: string): any {
        // 危险：UNION注入，可能泄露其他表数据
        const unionSQL = `${query1} UNION ${query2}`;
        return this.database.execute(unionSQL);
    }
    
    // 不安全的批量插入
    public batchInsert(tableName: string, values: string): any {
        // 危险：VALUES子句注入
        const insertSQL = `INSERT INTO ${tableName} VALUES ${values}`;
        return this.database.query(insertSQL);
    }
    
    // 不安全的条件更新
    public conditionalUpdate(tableName: string, setClause: string, whereClause: string): any {
        // 危险：SET和WHERE子句都可能被注入
        const updateSQL = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`;
        return this.executeUpdate(updateSQL);
    }
    
    private executeUpdate(sql: string): any {
        console.log('Update SQL:', sql);
        return this.database.query(sql);
    }
}

// NoSQL注入示例
class MongoService {
    private collection: any;
    
    // 不安全的MongoDB查询
    public findUser(userInput: string): any {
        // 危险：直接使用用户输入构建查询
        const query = `{ "username": "${userInput}" }`;
        const queryObj = JSON.parse(query);  // 危险：可能导致NoSQL注入
        return this.collection.find(queryObj);
    }
    
    // 不安全的聚合管道
    public aggregateData(pipeline: string): any {
        // 危险：用户可控的聚合管道
        const pipelineObj = JSON.parse(pipeline);
        return this.collection.aggregate(pipelineObj);
    }
}

// 演示SQL注入漏洞的使用场景
function demonstrateSQLInjectionVulnerabilities(): void {
    const userService = new UserService();
    const productService = new ProductService();
    const reportService = new ReportService();
    const dbManager = new DatabaseManager();
    const queryBuilder = new AdvancedQueryBuilder();
    const mongoService = new MongoService();
    
    // 这些都是存在SQL注入漏洞的操作
    console.log('Demonstrating SQL injection vulnerabilities...');
    
    // 经典的SQL注入攻击示例
    userService.authenticateUser("admin' OR '1'='1", "anything");
    userService.searchUsers("'; DROP TABLE users; --");
    productService.getProductById("1 UNION SELECT username,password FROM users");
    reportService.generateSalesReport("2023-01-01' OR '1'='1", "", "");
    dbManager.createDynamicTable("users; DROP TABLE products; --", "id INT");
    queryBuilder.buildComplexQuery("*", "users", "1=1", "");
    mongoService.findUser('", "$where": "function() { return true; }');
}
