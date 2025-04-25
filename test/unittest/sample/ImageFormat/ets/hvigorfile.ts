import { appTasks } from '@ohos/hvigor-ohos-plugin';
import { onlineSignPlugin } from '@ohos/hvigor-ohos-online-sign-plugin';
import type { OnlineSignOptions } from '@ohos/hvigor-ohos-online-sign-plugin';

const signOptions: OnlineSignOptions = {
    profile: 'hw_sign/nfcdebug.p7b', // 签名材料
    keyAlias: 'HOS Application Provision Debug V2',
    hapSignToolFile: 'hw_sign/hap-sign-tool.jar',
    username: `${process.env.ONLINE_USERNAME}`, // 环境变量中需要配置用户名和密码
    password: `${process.env.ONLINE_PASSWD}`,
    enableOnlineSign: true // 是否启用在线签名
}

export default {
    system: appTasks,  /* Built-in plugin of Hvigor. It cannot be modified. */
    plugins:[
      onlineSignPlugin(signOptions)
    ]         /* Custom plugin to extend the functionality of Hvigor. */
}
