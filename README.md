# ecnu-autosign

ECNU 每日打卡 Quantumult X 脚本。

### Installation

请确保已在 iOS 中安装并信任 MitM 证书，在 `task_local` 中 cronjob 的设定时间到达时 Quantumult X 为开启状态。

Quantumult X 配置文件：

```ini
[rewrite_remote]
https://github.com/billchen2k/ecnu-autosign/raw/main/ecnu-autosign.qxrewrite, tag=ecnu-autosign, enabled=true

[task_local]
0 8 * * * https://github.com/billchen2k/ecnu-autosign/raw/main/ecnu-autosign.js, tag=ECNU 自动签到, enabled=true
```

在相应区域内加入以上配置即可。

### Usage

首次使用请在打开 Quantumult X 时手动打开一次学生健康打卡小程序，点击「开始使用」进入签到页面来获取 Open Key 和用户信息。之后一段时间（通常是 7 天）内脚本会帮你自动打卡。如果收到签到错误的通知，再次打开小程序进入签到界面并更新 Open Key 和用户信息即可。

更多帮助请参考 [https://github.com/blackmatrix7/ios_rule_scrip](https://github.com/blackmatrix7/ios_rule_scrip) .