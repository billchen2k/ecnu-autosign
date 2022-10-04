# ecnu-autosign

华东师范大学每日打卡 Quantumult X 脚本。

Quantumult X 配置文件中相应片段新增：

```
[rewrite_remote]
https://github.com/billchen2k/ecnu-autosign/raw/main/ecnu-autosign.qxrewrite, tag=ecnu-autosign, enabled=true

[task_local]
0 8 * * * https://github.com/billchen2k/ecnu-autosign/raw/main/ecnu-autosign.js, tag=ecnu-autosign, enabled=true
```