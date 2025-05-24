import { relationalStore } from '@kit.ArkData';

export class DatabaseManager {
    private store: relationalStore.RdbStore;

    // 不安全的SQL查询 - 直接拼接用户输入
    public unsafeUserQuery(userId: string, userName: string): Promise<relationalStore.ResultSet> {
        // SQL注入漏洞：直接拼接用户输入到SQL语句中
        const sqlQuery = "SELECT * FROM users WHERE id = " + userId + " AND name = '" + userName + "'";
        return this.store.querySql(sqlQuery);
    }

    // 另一个不安全的查询示例
    public unsafeLoginQuery(username: string, password: string): Promise<relationalStore.ResultSet> {
        // 危险的SQL拼接，可能导致SQL注入攻击
        const query = `SELECT * FROM accounts WHERE username = '${username}' AND password = '${password}'`;
        return this.store.querySql(query);
    }

    // 不安全的删除操作
    public unsafeDeleteUser(userInput: string): Promise<number> {
        // 直接使用用户输入构建DELETE语句
        const deleteQuery = "DELETE FROM users WHERE condition = " + userInput;
        return this.store.executeSql(deleteQuery);
    }

    // 不安全的更新操作
    public unsafeUpdateProfile(profileData: string, whereClause: string): Promise<number> {
        // 拼接WHERE子句存在SQL注入风险
        const updateSql = "UPDATE profiles SET data = '" + profileData + "' WHERE " + whereClause;
        return this.store.executeSql(updateSql);
    }

    // 另一种不安全的查询方式
    public searchUsers(searchTerm: string): Promise<relationalStore.ResultSet> {
        // 在LIKE子句中直接使用用户输入
        const searchQuery = "SELECT * FROM users WHERE name LIKE '%" + searchTerm + "%' OR email LIKE '%" + searchTerm + "%'";
        return this.store.querySql(searchQuery);
    }
}
